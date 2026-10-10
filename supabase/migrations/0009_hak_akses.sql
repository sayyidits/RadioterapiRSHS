-- =====================================================================
-- Flow Radioterapi — 0009
-- Hak akses terpisah dari role kerja. Setiap akun punya:
-- - role (role kerja nakes): dokter, perawat, rtt, fismed, administrasi.
--   Menentukan tahap yang bisa di-ACC, tidak berubah.
-- - akses: nakes < admin < master. Menentukan siapa yang mengelola akun.
--   * nakes : tidak mengelola akun
--   * admin : menyetujui/menolak pendaftar, mengubah role kerja, menonaktifkan
--             dan mengaktifkan akun Nakes. Tidak bisa menyentuh akun Admin atau
--             Master, dan tidak bisa memberi hak Admin/Master.
--   * master: mengelola semua akun, termasuk memberi/mencabut Admin dan Master.
--   Tidak ada yang bisa mengubah status atau hak akses akunnya sendiri
--   (role kerja sendiri boleh diganti).
-- Role 'master' (0007) tidak dipakai lagi; Postgres tidak bisa menghapus nilai
-- enum, jadi nilainya tetap ada tetapi ditolak di semua RPC.
-- =====================================================================

create type public.akses_akun as enum ('nakes', 'admin', 'master');

alter table public.profiles add column akses public.akses_akun not null default 'nakes';

-- Akun Master lama (role 'master') menjadi akses master tanpa role kerja;
-- role kerjanya dipilih lagi di /daftar (lengkapi_profil di bawah mengizinkannya).
update public.profiles set akses = 'master', role = null where role = 'master';


-- ---------------------------------------------------------------------
-- Profil otomatis: role kerja dan akses dari app_metadata (hanya bisa diisi
-- administrator lewat service role: db:seed, mode demo).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := new.raw_app_meta_data ->> 'role';
  v_akses text := coalesce(new.raw_app_meta_data ->> 'akses', 'nakes');
  v_valid boolean := v_role in (select unnest(enum_range(null::public.user_role))::text) and v_role <> 'master';
begin
  insert into public.profiles (id, full_name, email, role, status, akses)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      new.email
    ),
    new.email,
    case when v_valid then v_role::public.user_role end,
    case when v_valid then 'aktif'::public.status_akun else 'baru'::public.status_akun end,
    case when v_valid and v_akses in ('nakes', 'admin', 'master') then v_akses::public.akses_akun else 'nakes'::public.akses_akun end
  );
  return new;
end;
$$;


-- Hak akses akun aktif yang sedang login (NULL = belum login / tidak aktif)
create function public.akses_saya()
returns public.akses_akun
language sql
stable
security definer
set search_path = ''
as $$
  select akses from public.profiles where id = auth.uid() and status = 'aktif';
$$;


-- ---------------------------------------------------------------------
-- RPC: melengkapi profil. Selain pendaftar baru/menunggu, akun aktif tanpa
-- role kerja (Master lama dari 0007) boleh memilih role kerjanya sendiri.
-- ---------------------------------------------------------------------
create or replace function public.lengkapi_profil(p_full_name text, p_role public.user_role)
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
  if not (v_p.status in ('baru', 'menunggu') or (v_p.status = 'aktif' and v_p.role is null)) then
    raise exception 'Akun ini sudah diproses. Hubungi Admin atau Master untuk perubahan.';
  end if;
  if length(v_nama) < 3 then
    raise exception 'Nama lengkap beserta gelar wajib diisi';
  end if;
  if p_role is null or p_role = 'master' then
    raise exception 'Pilih role Anda';
  end if;

  update public.profiles set
    full_name = v_nama,
    role = p_role,
    status = case when v_p.status = 'aktif' then 'aktif'::public.status_akun else 'menunggu'::public.status_akun end
  where id = v_p.id;
  return case when v_p.status = 'aktif' then 'aktif'::public.status_akun else 'menunggu'::public.status_akun end;
end;
$$;


-- ---------------------------------------------------------------------
-- RPC: Admin/Master mengelola akun (status, role kerja, hak akses).
-- ---------------------------------------------------------------------
drop function public.atur_akun(uuid, public.status_akun, public.user_role);

create function public.atur_akun(
  p_user uuid,
  p_status public.status_akun,
  p_role public.user_role default null,
  p_akses public.akses_akun default null
)
returns public.status_akun
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saya public.akses_akun := public.akses_saya();
  v_p public.profiles;
  v_role public.user_role;
  v_akses public.akses_akun;
begin
  if v_saya is null or v_saya = 'nakes' then
    raise exception 'Hanya Admin atau Master yang dapat mengelola akun';
  end if;
  if p_status is null or p_status not in ('aktif', 'ditolak', 'nonaktif') then
    raise exception 'Status akun tidak valid';
  end if;
  if p_role = 'master' then
    raise exception 'Role tidak valid';
  end if;

  select * into v_p from public.profiles where id = p_user for update;
  if not found then
    raise exception 'Akun tidak ditemukan';
  end if;
  v_akses := coalesce(p_akses, v_p.akses);

  if p_user = auth.uid() then
    -- Akun sendiri: hanya role kerja
    if p_status <> 'aktif' or v_akses <> v_p.akses then
      raise exception 'Anda tidak dapat mengubah status atau hak akses akun sendiri';
    end if;
  elsif v_saya = 'admin' then
    if v_p.akses <> 'nakes' then
      raise exception 'Admin hanya dapat mengelola akun Nakes';
    end if;
    if v_akses <> 'nakes' then
      raise exception 'Hanya Master yang dapat memberi hak akses Admin atau Master';
    end if;
  end if;

  v_role := coalesce(p_role, v_p.role);
  if p_status = 'aktif' and v_role is null then
    raise exception 'Pilih role sebelum menyetujui akun';
  end if;

  update public.profiles set
    status = p_status,
    role = v_role,
    akses = v_akses,
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
  public.akses_saya(),
  public.atur_akun(uuid, public.status_akun, public.user_role, public.akses_akun)
from public, anon;

grant execute on function
  public.akses_saya(),
  public.atur_akun(uuid, public.status_akun, public.user_role, public.akses_akun)
to authenticated;
