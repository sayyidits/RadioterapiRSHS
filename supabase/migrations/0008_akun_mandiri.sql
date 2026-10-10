-- =====================================================================
-- Flow Radioterapi — 0008
-- Pendaftaran akun mandiri dengan persetujuan Master.
-- 1. Siapa pun bisa membuat akun (Google atau email). Profilnya berstatus
--    'baru' tanpa role.
-- 2. Pengguna melengkapi profil: nama lengkap + gelar dan role yang diminta
--    (lengkapi_profil), lalu status menjadi 'menunggu'.
-- 3. Master menyetujui (boleh mengganti role), menolak, atau menonaktifkan
--    akun (atur_akun).
-- Hanya akun 'aktif' yang punya role (current_user_role) dan bisa membaca data
-- pasien (RLS). Role dari user_metadata diabaikan karena bisa diisi sendiri
-- saat sign-up; akun yang dibuat administrator lewat service role dengan
-- app_metadata.role (db:seed, mode demo) langsung aktif.
-- =====================================================================

create type public.status_akun as enum ('baru', 'menunggu', 'aktif', 'ditolak', 'nonaktif');

-- Akun yang sudah ada tetap aktif; akun baru mulai dari 'baru'
alter table public.profiles
  alter column role drop not null,
  add column email text,
  add column status public.status_akun not null default 'aktif',
  add column diproses_oleh uuid references public.profiles (id),
  add column diproses_at timestamptz;
alter table public.profiles alter column status set default 'baru';
update public.profiles p set email = u.email from auth.users u where u.id = p.id;


-- ---------------------------------------------------------------------
-- Profil otomatis saat akun dibuat
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := new.raw_app_meta_data ->> 'role';
  v_valid boolean := v_role in (select unnest(enum_range(null::public.user_role))::text);
begin
  insert into public.profiles (id, full_name, email, role, status)
  values (
    new.id,
    -- Google mengisi full_name/name; tetap bisa diubah saat melengkapi profil
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      new.email
    ),
    new.email,
    case when v_valid then v_role::public.user_role end,
    case when v_valid then 'aktif'::public.status_akun else 'baru'::public.status_akun end
  );
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- Hanya akun aktif yang punya role (dipakai semua RPC)
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and status = 'aktif';
$$;

create function public.akun_aktif()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'aktif');
$$;


-- ---------------------------------------------------------------------
-- RLS: data pasien hanya untuk akun aktif. Profil sendiri selalu terbaca
-- (untuk halaman lengkapi profil / menunggu persetujuan).
-- ---------------------------------------------------------------------
drop policy "baca profil" on public.profiles;
drop policy "baca pasien" on public.patients;
drop policy "baca riwayat" on public.stage_events;
drop policy "baca fraksi" on public.fractions;
drop policy "baca absensi" on public.attendance;

create policy "baca profil" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.akun_aktif()));
create policy "baca pasien" on public.patients for select to authenticated using ((select public.akun_aktif()));
create policy "baca riwayat" on public.stage_events for select to authenticated using ((select public.akun_aktif()));
create policy "baca fraksi" on public.fractions for select to authenticated using ((select public.akun_aktif()));
create policy "baca absensi" on public.attendance for select to authenticated using ((select public.akun_aktif()));


-- ---------------------------------------------------------------------
-- RPC: pengguna baru melengkapi profil (nama lengkap + gelar, role yang
-- diminta). Boleh diubah lagi selama masih menunggu persetujuan.
-- ---------------------------------------------------------------------
create function public.lengkapi_profil(p_full_name text, p_role public.user_role)
returns public.status_akun
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.profiles;
  v_nama text := trim(coalesce(p_full_name, ''));
begin
  select * into v_p from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'Profil tidak ditemukan. Silakan masuk ulang.';
  end if;
  if v_p.status not in ('baru', 'menunggu') then
    raise exception 'Akun ini sudah diproses Master. Hubungi Master untuk perubahan.';
  end if;
  if length(v_nama) < 3 then
    raise exception 'Nama lengkap beserta gelar wajib diisi';
  end if;
  if p_role is null or p_role = 'master' then
    raise exception 'Pilih role Anda';
  end if;

  update public.profiles set full_name = v_nama, role = p_role, status = 'menunggu' where id = v_p.id;
  return 'menunggu';
end;
$$;


-- ---------------------------------------------------------------------
-- RPC: Master menyetujui (status aktif, boleh sekaligus mengganti role),
-- menolak, atau menonaktifkan akun.
-- ---------------------------------------------------------------------
create function public.atur_akun(p_user uuid, p_status public.status_akun, p_role public.user_role default null)
returns public.status_akun
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.profiles;
  v_role public.user_role;
begin
  if public.current_user_role() is distinct from 'master' then
    raise exception 'Hanya Master yang dapat mengelola akun';
  end if;
  if p_user = auth.uid() then
    raise exception 'Master tidak dapat mengubah akunnya sendiri';
  end if;
  if p_status is null or p_status not in ('aktif', 'ditolak', 'nonaktif') then
    raise exception 'Status akun tidak valid';
  end if;

  select * into v_p from public.profiles where id = p_user for update;
  if not found then
    raise exception 'Akun tidak ditemukan';
  end if;
  v_role := coalesce(p_role, v_p.role);
  if p_status = 'aktif' and v_role is null then
    raise exception 'Pilih role sebelum menyetujui akun';
  end if;

  update public.profiles set
    status = p_status,
    role = v_role,
    diproses_oleh = auth.uid(),
    diproses_at = now()
  where id = p_user;
  return p_status;
end;
$$;


-- ---------------------------------------------------------------------
-- Grant
-- ---------------------------------------------------------------------
revoke execute on function
  public.akun_aktif(),
  public.lengkapi_profil(text, public.user_role),
  public.atur_akun(uuid, public.status_akun, public.user_role)
from public, anon;

grant execute on function
  public.akun_aktif(),
  public.lengkapi_profil(text, public.user_role),
  public.atur_akun(uuid, public.status_akun, public.user_role)
to authenticated;
