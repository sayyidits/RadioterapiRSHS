-- =====================================================================
-- Flow Radioterapi — 0006
-- Kuota CT Simulator: maksimal 7 pasien per hari (satu CT Simulator untuk
-- semua pesawat). Tanggal CT Sim di Poli hanya bisa dipilih bila kuota CT Sim
-- hari itu belum penuh DAN kuota pesawat masih ada di setiap hari penyinaran.
-- Yang dihitung: pasien yang tanggal CT Sim-nya sudah dijadwalkan (sudah lewat
-- Poli). Pasien di Poli tidak menempati slot.
-- Aturan ini harus sama dengan KUOTA_CT_SIM di lib/workflow.ts.
-- Selain cek kuota CT Sim di tahap POLI, advance_stage sama dengan 0004.
-- =====================================================================

-- Kuota pasien CT Simulator per hari (sama dengan KUOTA_CT_SIM)
create function public.kuota_ct_sim()
returns integer
language sql
immutable
as $$
  select 7;
$$;

-- Jumlah pasien yang dijadwalkan CT Sim per tanggal
create function public.jumlah_ct_sim(p_from date, p_to date, p_exclude uuid default null)
returns table (tanggal date, jumlah integer)
language sql
stable
set search_path = ''
as $$
  select p.tgl_ct_sim, count(*)::int
  from public.patients p
  where p.tgl_ct_sim between p_from and p_to
    and p.current_stage > 'POLI'::public.stage
    and p.id is distinct from p_exclude
  group by p.tgl_ct_sim;
$$;


-- ---------------------------------------------------------------------
-- RPC: ACC tahap saat ini. Poli: dosis, fraksi, rencana pesawat, dan tanggal
-- CT Sim (cek kuota CT Sim dan kuota pesawat). Planning: pesawat boleh
-- diganti bila masih ada kuota.
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
  v_ct date;
  v_verif date;
  v_mulai date;
  v_penuh date;
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
  select count(*) into v_done from public.fractions where patient_id = p_patient;

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
    -- Jadwal harus ditentukan di hari kunjungan Poli itu juga
    if public.poli_hangus(v_p.current_stage, v_p.stage_entered_at) then
      raise exception 'Kunjungan Poli tanggal % sudah hangus. Minta administrasi mendaftarkan ulang pasien ke Poli saat pasien datang.',
        to_char((v_p.stage_entered_at at time zone 'Asia/Jakarta')::date, 'DD/MM/YYYY');
    end if;
    v_fraksi := coalesce(nullif(v_payload ->> 'total_fraksi', '')::integer, v_p.total_fraksi);
    v_dosis  := coalesce(nullif(v_payload ->> 'dosis_total_gy', '')::numeric, v_p.dosis_total_gy);
    if v_fraksi is null or v_fraksi <= 0 then
      raise exception 'Jumlah fraksi wajib diisi dan lebih dari 0';
    end if;
    if v_dosis is null or v_dosis <= 0 then
      raise exception 'Dosis total wajib diisi dan lebih dari 0';
    end if;
    -- Replanning di tengah penyinaran: fraksi yang sudah diberikan tetap dihitung
    if v_fraksi < v_done then
      raise exception 'Jumlah fraksi tidak boleh kurang dari fraksi yang sudah diberikan (%)', v_done;
    end if;

    v_mesin := nullif(trim(v_payload ->> 'mesin'), '');
    if v_mesin is null or not public.is_valid_mesin(v_mesin) then
      raise exception 'Rencana pesawat wajib dipilih (Synergy, Precise, Cobalt, atau Brakiterapi)';
    end if;
    v_ct := nullif(v_payload ->> 'tgl_ct_sim', '')::date;
    if v_ct is null then
      raise exception 'Tanggal CT Sim wajib dipilih';
    end if;
    if v_ct < public.today_wib() then
      raise exception 'Tanggal CT Sim tidak boleh sebelum hari ini';
    end if;
    if not public.is_working_day(v_ct) then
      raise exception 'Tanggal CT Sim harus hari kerja (bukan Sabtu, Minggu, libur nasional, atau cuti bersama)';
    end if;

    -- Kuota CT Simulator hari itu. Dikunci supaya dua ACC bersamaan tidak sama-sama
    -- mengambil slot terakhir (kunci CT Sim selalu sebelum kunci pesawat).
    perform pg_advisory_xact_lock(hashtext('kuota:ct_sim'));
    if (select coalesce(sum(j.jumlah), 0) from public.jumlah_ct_sim(v_ct, v_ct, p_patient) j) >= public.kuota_ct_sim() then
      raise exception 'Kuota CT Simulator tanggal % sudah penuh (% pasien/hari). Pilih tanggal CT Sim lain.',
        to_char(v_ct, 'DD/MM/YYYY'), public.kuota_ct_sim();
    end if;

    v_verif := public.tgl_verifikasi_dari(v_ct);
    v_penuh := public.kuota_penuh_pada(v_mesin, v_verif, v_fraksi - v_done, p_patient);
    if v_penuh is not null then
      raise exception 'Kuota % sudah penuh pada % (% pasien/hari). Pilih tanggal CT Sim lain.',
        v_mesin, to_char(v_penuh, 'DD/MM/YYYY'), public.kuota_pesawat(v_mesin);
    end if;

    update public.patients set
      total_fraksi = v_fraksi,
      dosis_total_gy = v_dosis,
      mesin = v_mesin,
      tgl_ct_sim = v_ct,
      tgl_verifikasi = v_verif
    where id = p_patient;
  end if;

  if v_p.current_stage = 'PLANNING' then
    v_mesin := coalesce(nullif(trim(v_payload ->> 'mesin'), ''), v_p.mesin);
    if v_mesin is null or not public.is_valid_mesin(v_mesin) then
      raise exception 'Mesin wajib dipilih (Synergy, Precise, Cobalt, atau Brakiterapi)';
    end if;
    -- Ganti pesawat hanya ke pesawat yang masih ada kuotanya di hari-hari pasien ini
    if v_mesin is distinct from v_p.mesin and v_p.total_fraksi is not null then
      v_mulai := public.next_working_day_from(greatest(coalesce(v_p.tgl_verifikasi, public.today_wib()), public.today_wib()));
      v_penuh := public.kuota_penuh_pada(v_mesin, v_mulai, v_p.total_fraksi - v_done, p_patient);
      if v_penuh is not null then
        raise exception 'Kuota % sudah penuh pada % (% pasien/hari). Pilih pesawat lain yang masih ada kuotanya.',
          v_mesin, to_char(v_penuh, 'DD/MM/YYYY'), public.kuota_pesawat(v_mesin);
      end if;
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


-- ---------------------------------------------------------------------
-- Grant
-- ---------------------------------------------------------------------
revoke execute on function
  public.kuota_ct_sim(),
  public.jumlah_ct_sim(date, date, uuid)
from public, anon;

grant execute on function
  public.kuota_ct_sim(),
  public.jumlah_ct_sim(date, date, uuid)
to authenticated;
