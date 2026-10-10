-- =====================================================================
-- Flow Radioterapi — 0002
-- - DPJP: pasien dipegang satu dokter, dipilih administrasi saat pendaftaran.
--   Tahap dokter (Poli, Delineasi, ACC Planning) hanya bisa dikerjakan DPJP.
-- - Perawat ikut ACC / mengembalikan di tahap Poli.
-- - Mesin dipilih fismed di Planning, boleh direvisi dokter di ACC Planning.
-- - Absensi penyinaran harian (administrasi & RTT). Fraksi hanya bisa
--   dicatat untuk pasien yang tercatat hadir hari ini.
-- Aturan ini harus sama dengan lib/workflow.ts
-- =====================================================================


-- ---------------------------------------------------------------------
-- Mesin & tanggal
-- ---------------------------------------------------------------------
-- Daftar mesin (harus sama dengan MESIN di lib/workflow.ts)
create function public.is_valid_mesin(m text)
returns boolean
language sql
immutable
as $$
  select m = any (array['Synergy', 'Precise', 'Cobalt', 'Brakiterapi']);
$$;

-- "Hari ini" mengikuti WIB, bukan zona waktu server database
create function public.today_wib()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Jakarta')::date;
$$;


-- ---------------------------------------------------------------------
-- Kolom baru di patients
-- ---------------------------------------------------------------------
alter table public.patients
  add column dpjp_id uuid references public.profiles (id),
  add column mesin text check (mesin is null or public.is_valid_mesin(mesin));

create index patients_dpjp_idx on public.patients (dpjp_id);


-- ---------------------------------------------------------------------
-- Absensi penyinaran. Satu baris per pencatatan (tidak pernah diubah),
-- status yang berlaku = baris terbaru untuk pasien & tanggal itu.
-- ---------------------------------------------------------------------
create table public.attendance (
  id bigint generated always as identity primary key,
  patient_id uuid not null references public.patients (id) on delete cascade,
  tanggal date not null,
  hadir boolean not null,
  catatan text,
  actor_id uuid references public.profiles (id),
  actor_role public.user_role,
  created_at timestamptz not null default now()
);

create index attendance_patient_idx on public.attendance (patient_id, tanggal, created_at);

-- Status kehadiran hari ini (NULL = belum diabsen)
create function public.attendance_today(p_patient uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select hadir from public.attendance
  where patient_id = p_patient and tanggal = public.today_wib()
  order by created_at desc, id desc
  limit 1;
$$;


-- ---------------------------------------------------------------------
-- Siapa yang boleh ACC / mengembalikan di tahap ini.
-- Dokter hanya untuk pasien DPJP-nya (pasien lama tanpa DPJP: semua dokter).
-- Perawat ikut di tahap Poli.
-- ---------------------------------------------------------------------
create function public.can_act(s public.stage, r public.user_role, p_dpjp uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(r is not null and case
    when r = 'perawat' then s = 'POLI'
    when r = 'dokter'  then public.stage_owner(s) = 'dokter' and (p_dpjp is null or p_dpjp = auth.uid())
    else public.stage_owner(s) = r
  end, false);
$$;

-- Pesan error yang jelas saat tidak berwenang
create function public.raise_not_allowed(s public.stage, r public.user_role)
returns void
language plpgsql
as $$
begin
  if r = 'dokter' and public.stage_owner(s) = 'dokter' then
    raise exception 'Hanya dokter DPJP pasien ini yang dapat menindaklanjuti tahap %', s;
  end if;
  raise exception 'Role % tidak berwenang di tahap %', r, s;
end;
$$;


-- ---------------------------------------------------------------------
-- RPC: daftar pasien baru, sekarang wajib memilih DPJP
-- ---------------------------------------------------------------------
drop function public.create_patient(text, text, date, text, text, text, text);

create function public.create_patient(
  p_no_rm text,
  p_nama text,
  p_tgl_lahir date,
  p_jenis_kelamin text,
  p_no_hp text,
  p_diagnosis text,
  p_dpjp uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_id uuid;
begin
  if v_role is distinct from 'administrasi' then
    raise exception 'Hanya administrasi yang dapat mendaftarkan pasien';
  end if;
  if coalesce(trim(p_no_rm), '') = '' or coalesce(trim(p_nama), '') = ''
     or p_tgl_lahir is null or coalesce(trim(p_diagnosis), '') = '' then
    raise exception 'No. RM, nama, tanggal lahir, dan diagnosis wajib diisi';
  end if;
  if not exists (select 1 from public.profiles where id = p_dpjp and role = 'dokter') then
    raise exception 'Pilih dokter DPJP';
  end if;

  begin
    insert into public.patients (
      no_rm, nama, tgl_lahir, jenis_kelamin, no_hp, diagnosis,
      current_stage, dpjp_id, created_by
    )
    values (
      trim(p_no_rm), trim(p_nama), p_tgl_lahir, p_jenis_kelamin,
      nullif(trim(p_no_hp), ''), trim(p_diagnosis), 'POLI', p_dpjp, auth.uid()
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'No. RM % sudah terdaftar', trim(p_no_rm);
  end;

  insert into public.stage_events (patient_id, from_stage, to_stage, action, actor_id, actor_role, note)
  values (v_id, 'PENDAFTARAN', 'POLI', 'create', auth.uid(), v_role,
          coalesce(nullif(trim(p_note), ''), 'Pasien didaftarkan dan dikirim ke Poli'));

  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- RPC: ACC tahap saat ini (cek DPJP/perawat, simpan mesin)
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

  if v_p.current_stage in ('DELINEASI', 'ACC_PLAN') then
    v_fraksi := coalesce(nullif(v_payload ->> 'total_fraksi', '')::integer, v_p.total_fraksi);
    v_dosis  := coalesce(nullif(v_payload ->> 'dosis_total_gy', '')::numeric, v_p.dosis_total_gy);
    if v_fraksi is null or v_fraksi <= 0 then
      raise exception 'Jumlah fraksi wajib diisi dan lebih dari 0';
    end if;
    if v_dosis is null or v_dosis <= 0 then
      raise exception 'Dosis total wajib diisi dan lebih dari 0';
    end if;
    update public.patients set total_fraksi = v_fraksi, dosis_total_gy = v_dosis
    where id = p_patient;
  end if;

  if v_p.current_stage in ('PLANNING', 'ACC_PLAN') then
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


-- ---------------------------------------------------------------------
-- RPC: kembalikan ke tahap sebelumnya (cek DPJP/perawat)
-- ---------------------------------------------------------------------
create or replace function public.return_stage(
  p_patient uuid,
  p_target public.stage,
  p_note text
)
returns public.stage
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_p public.patients;
begin
  if coalesce(trim(p_note), '') = '' then
    raise exception 'Alasan pengembalian wajib diisi';
  end if;

  select * into v_p from public.patients where id = p_patient for update;
  if not found then
    raise exception 'Pasien tidak ditemukan';
  end if;

  if not public.can_act(v_p.current_stage, v_role, v_p.dpjp_id) then
    perform public.raise_not_allowed(v_p.current_stage, v_role);
  end if;

  if not public.can_return(v_p.current_stage, p_target) then
    raise exception 'Tidak dapat mengembalikan dari % ke %', v_p.current_stage, p_target;
  end if;

  update public.patients set
    current_stage = p_target,
    stage_entered_at = now(),
    updated_at = now()
  where id = p_patient;

  insert into public.stage_events (patient_id, from_stage, to_stage, action, actor_id, actor_role, note)
  values (p_patient, v_p.current_stage, p_target, 'return', auth.uid(), v_role, trim(p_note));

  return p_target;
end;
$$;


-- ---------------------------------------------------------------------
-- RPC: isi / ubah kehadiran hari ini (administrasi & RTT)
-- ---------------------------------------------------------------------
create function public.set_attendance(
  p_patient uuid,
  p_hadir boolean,
  p_catatan text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_p public.patients;
begin
  if v_role is null or v_role not in ('administrasi', 'rtt') then
    raise exception 'Hanya administrasi dan RTT yang dapat mengisi kehadiran';
  end if;
  if p_hadir is null then
    raise exception 'Pilih hadir atau tidak hadir';
  end if;

  select * into v_p from public.patients where id = p_patient for update;
  if not found then
    raise exception 'Pasien tidak ditemukan';
  end if;
  if v_p.current_stage <> 'PENYINARAN' then
    raise exception 'Kehadiran hanya dicatat untuk pasien dalam tahap penyinaran';
  end if;

  if public.attendance_today(p_patient) is not distinct from p_hadir then
    raise exception 'Pasien sudah tercatat % hari ini', case when p_hadir then 'hadir' else 'tidak hadir' end;
  end if;
  if not p_hadir and exists (
    select 1 from public.fractions where patient_id = p_patient and tanggal = public.today_wib()
  ) then
    raise exception 'Fraksi hari ini sudah tercatat, kehadiran tidak dapat diubah menjadi tidak hadir';
  end if;

  insert into public.attendance (patient_id, tanggal, hadir, catatan, actor_id, actor_role)
  values (p_patient, public.today_wib(), p_hadir, nullif(trim(p_catatan), ''), auth.uid(), v_role);

  return p_hadir;
end;
$$;


-- ---------------------------------------------------------------------
-- RPC: catat 1 fraksi. Tanggal selalu hari ini, pasien wajib tercatat
-- hadir, mesin bawaan dari plan (boleh diganti untuk fraksi ini saja).
-- Boleh lebih dari 1 fraksi per hari (hiperfraksi).
-- ---------------------------------------------------------------------
drop function public.record_fraction(uuid, date, text, text);

create function public.record_fraction(
  p_patient uuid,
  p_mesin text default null,
  p_catatan text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_p public.patients;
  v_n integer;
  v_mesin text;
begin
  if v_role is distinct from 'rtt' then
    raise exception 'Hanya RTT yang dapat mencatat fraksi';
  end if;

  select * into v_p from public.patients where id = p_patient for update;
  if not found then
    raise exception 'Pasien tidak ditemukan';
  end if;
  if v_p.current_stage <> 'PENYINARAN' then
    raise exception 'Pasien belum/tidak dalam tahap penyinaran';
  end if;
  if v_p.total_fraksi is null then
    raise exception 'Jumlah fraksi belum ditetapkan';
  end if;
  if public.attendance_today(p_patient) is distinct from true then
    raise exception 'Pasien belum tercatat hadir hari ini. Isi kehadiran terlebih dahulu.';
  end if;

  v_mesin := coalesce(nullif(trim(p_mesin), ''), v_p.mesin);
  if v_mesin is null or not public.is_valid_mesin(v_mesin) then
    raise exception 'Mesin wajib dipilih (Synergy, Precise, Cobalt, atau Brakiterapi)';
  end if;

  select count(*) + 1 into v_n from public.fractions where patient_id = p_patient;
  if v_n > v_p.total_fraksi then
    raise exception 'Semua fraksi sudah tercatat';
  end if;

  insert into public.fractions (patient_id, fraksi_ke, tanggal, mesin, catatan, rtt_id)
  values (p_patient, v_n, public.today_wib(), v_mesin, nullif(trim(p_catatan), ''), auth.uid());

  update public.patients set updated_at = now() where id = p_patient;

  if v_n = v_p.total_fraksi then
    update public.patients set current_stage = 'SELESAI', stage_entered_at = now()
    where id = p_patient;

    insert into public.stage_events (patient_id, from_stage, to_stage, action, actor_id, actor_role, note)
    values (p_patient, 'PENYINARAN', 'SELESAI', 'complete', auth.uid(), v_role,
            format('Penyinaran selesai (%s/%s fraksi)', v_n, v_p.total_fraksi));
  end if;

  return v_n;
end;
$$;


-- ---------------------------------------------------------------------
-- RLS & grant
-- ---------------------------------------------------------------------
alter table public.attendance enable row level security;
create policy "baca absensi" on public.attendance for select to authenticated using (true);

revoke insert, update, delete on public.attendance from anon, authenticated;
revoke all on public.attendance from anon;
grant select on public.attendance to authenticated;
grant all on public.attendance to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke execute on function
  public.create_patient(text, text, date, text, text, text, uuid, text),
  public.record_fraction(uuid, text, text),
  public.set_attendance(uuid, boolean, text),
  public.raise_not_allowed(public.stage, public.user_role)
from public, anon;

grant execute on function
  public.create_patient(text, text, date, text, text, text, uuid, text),
  public.record_fraction(uuid, text, text),
  public.set_attendance(uuid, boolean, text)
to authenticated;
