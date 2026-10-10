-- =====================================================================
-- Flow Radioterapi — 0003
-- - Tahap ACC Planning (dokter) dihapus: Planning di-ACC fismed lalu
--   langsung ke Verifikasi. Nilai enum ACC_PLAN tetap ada (Postgres tidak
--   bisa menghapus nilai enum) tetapi dilewati dan tidak dipakai lagi.
-- - Dosis total & jumlah fraksi ditetapkan di Poli, bukan di Delineasi.
-- - "Kembalikan" bisa langsung ke tahap mana pun sebelumnya (paling jauh
--   Poli, Pendaftaran tidak pernah jadi tujuan), termasuk dari Penyinaran
--   untuk replanning.
-- Aturan ini harus sama dengan lib/workflow.ts
-- =====================================================================


-- ---------------------------------------------------------------------
-- Helper alur
-- ---------------------------------------------------------------------
create or replace function public.stage_owner(s public.stage)
returns public.user_role
language sql
immutable
as $$
  select case s
    when 'PENDAFTARAN' then 'administrasi'
    when 'POLI'        then 'dokter'
    when 'CT_SIM'      then 'rtt'
    when 'DELINEASI'   then 'dokter'
    when 'PLANNING'    then 'fismed'
    when 'VERIFIKASI'  then 'rtt'
    when 'PENYINARAN'  then 'rtt'
    else null
  end::public.user_role;
$$;

-- Tahap berikutnya, melewati ACC_PLAN yang sudah tidak dipakai
create or replace function public.next_stage(s public.stage)
returns public.stage
language sql
immutable
as $$
  select x from unnest(enum_range(null::public.stage)) as x
  where x > s and x <> 'ACC_PLAN'::public.stage
  order by x limit 1;
$$;

-- Kembalikan ke tahap mana pun sebelumnya, dari CT Sim s.d. Penyinaran,
-- dengan tujuan paling jauh Poli
create or replace function public.can_return(from_s public.stage, to_s public.stage)
returns boolean
language sql
immutable
as $$
  select from_s between 'CT_SIM'::public.stage and 'PENYINARAN'::public.stage
     and to_s between 'POLI'::public.stage and 'VERIFIKASI'::public.stage
     and to_s < from_s
     and 'ACC_PLAN'::public.stage not in (from_s, to_s);
$$;


-- ---------------------------------------------------------------------
-- Pasien yang sedang menunggu ACC Planning langsung ke Verifikasi
-- ---------------------------------------------------------------------
insert into public.stage_events (patient_id, from_stage, to_stage, action, note)
select id, 'ACC_PLAN', 'VERIFIKASI', 'advance', 'Tahap ACC Planning dihapus dari alur'
from public.patients where current_stage = 'ACC_PLAN';

update public.patients set current_stage = 'VERIFIKASI', stage_entered_at = now(), updated_at = now()
where current_stage = 'ACC_PLAN';


-- ---------------------------------------------------------------------
-- RPC: ACC tahap saat ini. Dosis & fraksi di Poli, mesin di Planning.
-- ---------------------------------------------------------------------
create or replace function public.advance_stage(
  p_patient uuid,
  p_payload jsonb default '{}'::jsonb,
  p_note text default null
)
returns public.stage
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_p public.patients;
  v_next public.stage;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_fraksi integer;
  v_dosis numeric;
  v_done integer;
  v_mesin text;
begin
  if v_role is null then
    raise exception 'Akun tidak memiliki role';
  end if;

  select * into v_p from public.patients where id = p_patient for update;
  if not found then
    raise exception 'Pasien tidak ditemukan';
  end if;

  if v_p.current_stage in ('PENYINARAN', 'SELESAI') then
    raise exception 'Tahap % tidak di-ACC manual', v_p.current_stage;
  end if;

  if not public.can_act(v_p.current_stage, v_role, v_p.dpjp_id) then
    perform public.raise_not_allowed(v_p.current_stage, v_role);
  end if;

  v_next := public.next_stage(v_p.current_stage);

  -- Aturan khusus per tahap
  if v_p.current_stage = 'PENDAFTARAN' then
    update public.patients set
      no_rm         = coalesce(nullif(trim(v_payload ->> 'no_rm'), ''), no_rm),
      nama          = coalesce(nullif(trim(v_payload ->> 'nama'), ''), nama),
      tgl_lahir     = coalesce(nullif(v_payload ->> 'tgl_lahir', '')::date, tgl_lahir),
      jenis_kelamin = coalesce(nullif(v_payload ->> 'jenis_kelamin', ''), jenis_kelamin),
      no_hp         = coalesce(nullif(trim(v_payload ->> 'no_hp'), ''), no_hp),
      diagnosis     = coalesce(nullif(trim(v_payload ->> 'diagnosis'), ''), diagnosis)
    where id = p_patient;
  end if;

  if v_p.current_stage = 'POLI' then
    v_fraksi := coalesce(nullif(v_payload ->> 'total_fraksi', '')::integer, v_p.total_fraksi);
    v_dosis  := coalesce(nullif(v_payload ->> 'dosis_total_gy', '')::numeric, v_p.dosis_total_gy);
    if v_fraksi is null or v_fraksi <= 0 then
      raise exception 'Jumlah fraksi wajib diisi dan lebih dari 0';
    end if;
    if v_dosis is null or v_dosis <= 0 then
      raise exception 'Dosis total wajib diisi dan lebih dari 0';
    end if;
    -- Replanning di tengah penyinaran: fraksi yang sudah diberikan tetap dihitung
    select count(*) into v_done from public.fractions where patient_id = p_patient;
    if v_fraksi < v_done then
      raise exception 'Jumlah fraksi tidak boleh kurang dari fraksi yang sudah diberikan (%)', v_done;
    end if;
    update public.patients set total_fraksi = v_fraksi, dosis_total_gy = v_dosis
    where id = p_patient;
  end if;

  if v_p.current_stage = 'PLANNING' then
    v_mesin := coalesce(nullif(trim(v_payload ->> 'mesin'), ''), v_p.mesin);
    if v_mesin is null or not public.is_valid_mesin(v_mesin) then
      raise exception 'Mesin wajib dipilih (Synergy, Precise, Cobalt, atau Brakiterapi)';
    end if;
    update public.patients set mesin = v_mesin where id = p_patient;
  end if;

  update public.patients set
    current_stage = v_next,
    stage_entered_at = now(),
    updated_at = now(),
    data = data || jsonb_build_object(
      v_p.current_stage::text,
      v_payload || jsonb_build_object('_at', now(), '_by', auth.uid())
    )
  where id = p_patient;

  insert into public.stage_events (patient_id, from_stage, to_stage, action, actor_id, actor_role, note, payload)
  values (p_patient, v_p.current_stage, v_next, 'advance', auth.uid(), v_role,
          nullif(trim(p_note), ''), v_payload);

  return v_next;
end;
$$;
