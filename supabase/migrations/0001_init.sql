-- =====================================================================
-- Flow Radioterapi — skema awal
-- Alur tahap & penanggung jawab harus sama dengan lib/workflow.ts
-- =====================================================================


-- ---------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------
create type public.user_role as enum ('dokter', 'perawat', 'rtt', 'fismed', 'administrasi');

-- Urutan deklarasi = urutan alur (dipakai oleh next_stage)
create type public.stage as enum (
  'PENDAFTARAN',
  'POLI',
  'CT_SIM',
  'DELINEASI',
  'PLANNING',
  'ACC_PLAN',
  'VERIFIKASI',
  'PENYINARAN',
  'SELESAI'
);

create type public.event_action as enum ('create', 'advance', 'return', 'complete');

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null,
  created_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  no_rm text not null unique,
  nama text not null,
  tgl_lahir date not null,
  jenis_kelamin text not null check (jenis_kelamin in ('L', 'P')),
  no_hp text,
  diagnosis text not null,
  current_stage public.stage not null default 'PENDAFTARAN',
  stage_entered_at timestamptz not null default now(),
  dosis_total_gy numeric(6, 2),
  total_fraksi integer check (total_fraksi is null or total_fraksi > 0),
  -- data isian per tahap, contoh: {"POLI": {...}, "CT_SIM": {...}}
  data jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patients_stage_idx on public.patients (current_stage);

create table public.stage_events (
  id bigint generated always as identity primary key,
  patient_id uuid not null references public.patients (id) on delete cascade,
  from_stage public.stage,
  to_stage public.stage not null,
  action public.event_action not null,
  actor_id uuid references public.profiles (id),
  actor_role public.user_role,
  note text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index stage_events_patient_idx on public.stage_events (patient_id, created_at);

create table public.fractions (
  id bigint generated always as identity primary key,
  patient_id uuid not null references public.patients (id) on delete cascade,
  fraksi_ke integer not null check (fraksi_ke > 0),
  tanggal date not null,
  mesin text,
  catatan text,
  rtt_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (patient_id, fraksi_ke)
);

-- ---------------------------------------------------------------------
-- Profil otomatis saat akun dibuat (role dari user_metadata saat pembuatan
-- oleh admin/script). Setelah itu role hanya bisa diubah lewat tabel profiles
-- oleh service role, bukan oleh user sendiri.
-- ---------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'perawat')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Helper alur
-- ---------------------------------------------------------------------
create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Penanggung jawab tiap tahap (NULL = tidak ada ACC manual)
create function public.stage_owner(s public.stage)
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
    when 'ACC_PLAN'    then 'dokter'
    when 'VERIFIKASI'  then 'rtt'
    when 'PENYINARAN'  then 'rtt'
    else null
  end::public.user_role;
$$;

-- Tahap tujuan yang diizinkan saat "Kembalikan"
create function public.can_return(from_s public.stage, to_s public.stage)
returns boolean
language sql
immutable
as $$
  select (from_s, to_s) in (
    ('POLI'::public.stage,       'PENDAFTARAN'::public.stage),
    ('CT_SIM'::public.stage,     'POLI'::public.stage),
    ('DELINEASI'::public.stage,  'CT_SIM'::public.stage),
    ('PLANNING'::public.stage,   'DELINEASI'::public.stage),
    ('ACC_PLAN'::public.stage,   'PLANNING'::public.stage),
    ('VERIFIKASI'::public.stage, 'PLANNING'::public.stage),
    ('VERIFIKASI'::public.stage, 'CT_SIM'::public.stage)
  );
$$;

create function public.next_stage(s public.stage)
returns public.stage
language sql
immutable
as $$
  select x from unnest(enum_range(null::public.stage)) as x
  where x > s order by x limit 1;
$$;

-- ---------------------------------------------------------------------
-- RPC: daftar pasien baru (administrasi) -> langsung dikirim ke Poli
-- ---------------------------------------------------------------------
create function public.create_patient(
  p_no_rm text,
  p_nama text,
  p_tgl_lahir date,
  p_jenis_kelamin text,
  p_no_hp text,
  p_diagnosis text,
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

  begin
    insert into public.patients (
      no_rm, nama, tgl_lahir, jenis_kelamin, no_hp, diagnosis,
      current_stage, created_by
    )
    values (
      trim(p_no_rm), trim(p_nama), p_tgl_lahir, p_jenis_kelamin,
      nullif(trim(p_no_hp), ''), trim(p_diagnosis), 'POLI', auth.uid()
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
-- RPC: ACC tahap saat ini -> pindah ke tahap berikutnya
-- ---------------------------------------------------------------------
create function public.advance_stage(
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

  if public.stage_owner(v_p.current_stage) is distinct from v_role then
    raise exception 'Role % tidak berwenang meng-ACC tahap %', v_role, v_p.current_stage;
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
-- RPC: kembalikan ke tahap sebelumnya (alasan wajib)
-- ---------------------------------------------------------------------
create function public.return_stage(
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

  if public.stage_owner(v_p.current_stage) is distinct from v_role then
    raise exception 'Role % tidak berwenang di tahap %', v_role, v_p.current_stage;
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
-- RPC: catat 1 fraksi penyinaran (RTT). Fraksi terakhir -> SELESAI.
-- ---------------------------------------------------------------------
create function public.record_fraction(
  p_patient uuid,
  p_tanggal date,
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

  select count(*) + 1 into v_n from public.fractions where patient_id = p_patient;
  if v_n > v_p.total_fraksi then
    raise exception 'Semua fraksi sudah tercatat';
  end if;

  insert into public.fractions (patient_id, fraksi_ke, tanggal, mesin, catatan, rtt_id)
  values (p_patient, v_n, coalesce(p_tanggal, current_date),
          nullif(trim(p_mesin), ''), nullif(trim(p_catatan), ''), auth.uid());

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
-- Row Level Security: semua user login boleh membaca, tidak ada tulis langsung.
-- Semua perubahan wajib lewat RPC di atas.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.stage_events enable row level security;
alter table public.fractions enable row level security;

create policy "baca profil" on public.profiles for select to authenticated using (true);
create policy "baca pasien" on public.patients for select to authenticated using (true);
create policy "baca riwayat" on public.stage_events for select to authenticated using (true);
create policy "baca fraksi" on public.fractions for select to authenticated using (true);

revoke insert, update, delete on public.profiles, public.patients, public.stage_events, public.fractions
  from anon, authenticated;
revoke all on public.profiles, public.patients, public.stage_events, public.fractions from anon;

revoke execute on function
  public.create_patient(text, text, date, text, text, text, text),
  public.advance_stage(uuid, jsonb, text),
  public.return_stage(uuid, public.stage, text),
  public.record_fraction(uuid, date, text, text),
  public.current_user_role(),
  public.handle_new_user()
from public, anon;

grant execute on function
  public.create_patient(text, text, date, text, text, text, text),
  public.advance_stage(uuid, jsonb, text),
  public.return_stage(uuid, public.stage, text),
  public.record_fraction(uuid, date, text, text),
  public.current_user_role()
to authenticated;

-- Grant eksplisit (project Supabase baru bisa saja tidak otomatis memberi grant)
grant usage on schema public to authenticated, service_role;
grant select on public.profiles, public.patients, public.stage_events, public.fractions to authenticated;
grant all on public.profiles, public.patients, public.stage_events, public.fractions to service_role;
grant usage, select on all sequences in schema public to service_role;
