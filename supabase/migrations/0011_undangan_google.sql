-- =====================================================================
-- Flow Radioterapi — 0011
-- Undangan dan pendaftaran akun hanya untuk akun Google yang emailnya terbukti
-- milik pemiliknya (audit keamanan A1, 2026-10-12).
-- Kunci publik Supabase memang terbuka, jadi siapa pun bisa membuat akun
-- email + password lewat API dengan email nakes yang diundang. Sebelumnya akun
-- seperti itu bisa aktif bila pemilik email mengeklik tautan konfirmasinya, atau
-- bila Admin mendaftarkannya (undang_akun / atur_akun tidak memeriksa email).
-- Sekarang semua jalur aktivasi akun yang belum pernah aktif memakai
-- akun_google_terverifikasi(). Semua staf memang masuk lewat Google.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Akun Google murni dengan email terverifikasi: email dikonfirmasi, punya
-- identitas Google dengan email yang sama, tidak punya identitas lain, dan
-- belum punya password. Akun email/password buatan orang lain tidak lolos,
-- walaupun pemilik email belakangan menautkan Google ke akun itu (password
-- buatan penyerang tetap ada). p_email: bila diisi, email akun harus sama.
-- Hanya dipakai di dalam fungsi lain (tidak di-grant ke pengguna), karena
-- hasilnya membuka apakah sebuah akun punya password.
-- Mode demo (PGlite, lib/demo/db.ts) tidak punya tabel login Supabase dan tidak
-- punya akun Google sungguhan, jadi di sana pemeriksaan dilewati dan demo tetap
-- seperti sebelumnya. Di Supabase tabel auth.identities selalu ada.
-- plpgsql (bukan sql) supaya fungsi tetap bisa dibuat walaupun tabelnya tidak ada.
-- ---------------------------------------------------------------------
create function public.akun_google_terverifikasi(p_user uuid, p_email text default null)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if to_regclass('auth.identities') is null then
    return true;
  end if;
  return exists (
    select 1
    from auth.users u
    join auth.identities i on i.user_id = u.id and i.provider = 'google'
    where u.id = p_user
      and u.email_confirmed_at is not null
      and coalesce(u.encrypted_password, '') = ''
      and lower(i.identity_data ->> 'email') = lower(u.email)
      and (p_email is null or lower(u.email) = lower(trim(p_email)))
      and not exists (select 1 from auth.identities x where x.user_id = u.id and x.provider <> 'google')
  );
end;
$$;


-- ---------------------------------------------------------------------
-- Terapkan undangan hanya ke akun Google terverifikasi. Dipanggil trigger
-- on_auth_user_confirmed (Google: user dibuat, identitas Google ditempel, lalu
-- email dikonfirmasi), undang_akun, dan klaim_undangan.
-- ---------------------------------------------------------------------
create or replace function public.terapkan_undangan(p_user uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_u public.undangan_akun;
begin
  if not public.akun_google_terverifikasi(p_user, p_email) then
    return false;
  end if;

  select * into v_u from public.undangan_akun
  where email = lower(trim(p_email)) and dipakai_at is null
  for update;
  if not found then
    return false;
  end if;

  update public.profiles set
    full_name = v_u.full_name,
    role = v_u.role,
    akses = v_u.akses,
    status = 'aktif',
    diproses_oleh = v_u.dibuat_oleh,
    diproses_at = now()
  where id = p_user and status <> 'aktif';

  update public.undangan_akun set dipakai_at = now(), user_id = p_user where email = v_u.email;
  return true;
end;
$$;


-- ---------------------------------------------------------------------
-- RPC: jaring pengaman saat login. Bila trigger tidak sempat menerapkan
-- undangan (mis. urutan langkah Supabase berubah), akun 'baru' yang sedang
-- login mengambil undangan untuk emailnya sendiri. Dipanggil getSessionProfile.
-- ---------------------------------------------------------------------
create function public.klaim_undangan()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'baru') then
    return false;
  end if;
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return false;
  end if;
  return public.terapkan_undangan(auth.uid(), v_email);
end;
$$;


-- ---------------------------------------------------------------------
-- RPC: Admin/Master melihat akun belum aktif mana yang boleh didaftarkan
-- (halaman Akun menyembunyikan tombol Daftarkan untuk yang tidak lolos).
-- ---------------------------------------------------------------------
create function public.verifikasi_pendaftar()
returns table (id uuid, terverifikasi boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, public.akun_google_terverifikasi(p.id)
  from public.profiles p
  where p.status in ('baru', 'menunggu', 'ditolak')
    and public.akses_saya() in ('admin', 'master');
$$;


-- ---------------------------------------------------------------------
-- RPC: undang banyak akun sekaligus. Sama dengan 0010, kecuali akun yang
-- sudah ada hanya langsung diaktifkan bila lolos akun_google_terverifikasi.
-- ---------------------------------------------------------------------
create or replace function public.undang_akun(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saya public.akses_akun := public.akses_saya();
  v_item jsonb;
  v_email text;
  v_nama text;
  v_role text;
  v_akses text;
  v_p public.profiles;
  v_u public.undangan_akun;
  v_hasil jsonb := '[]'::jsonb;
  v_pesan text;
  v_ok boolean;
begin
  if v_saya is null or v_saya = 'nakes' then
    raise exception 'Hanya Admin atau Master yang dapat mendaftarkan akun';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Data undangan tidak valid';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_email := lower(trim(coalesce(v_item ->> 'email', '')));
    v_nama := trim(coalesce(v_item ->> 'full_name', ''));
    v_role := trim(coalesce(v_item ->> 'role', ''));
    v_akses := coalesce(nullif(trim(v_item ->> 'akses'), ''), 'nakes');
    v_ok := false;

    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      v_pesan := 'Email tidak valid';
    elsif length(v_nama) < 3 then
      v_pesan := 'Nama lengkap wajib diisi';
    elsif v_role not in (select unnest(enum_range(null::public.user_role))::text) or v_role = 'master' then
      v_pesan := 'Role kerja tidak valid';
    elsif v_akses not in ('nakes', 'admin', 'master') then
      v_pesan := 'Hak akses tidak valid';
    elsif v_saya = 'admin' and v_akses <> 'nakes' then
      v_pesan := 'Hanya Master yang dapat memberi hak akses Admin atau Master';
    else
      select * into v_p from public.profiles where lower(email) = v_email limit 1 for update;
      select * into v_u from public.undangan_akun where email = v_email for update;
      if v_p.id is not null and v_p.status = 'aktif' then
        v_pesan := 'Sudah punya akun aktif';
      elsif v_saya = 'admin' and v_p.id is not null and v_p.akses <> 'nakes' then
        v_pesan := 'Admin hanya dapat mengelola akun Nakes';
      elsif v_saya = 'admin' and v_u.email is not null and v_u.akses <> 'nakes' then
        v_pesan := 'Undangan ini hanya dapat diubah oleh Master';
      else
        insert into public.undangan_akun (email, full_name, role, akses, dibuat_oleh, dibuat_at, dipakai_at, user_id)
        values (v_email, v_nama, v_role::public.user_role, v_akses::public.akses_akun, auth.uid(), now(), null, null)
        on conflict (email) do update set
          full_name = excluded.full_name, role = excluded.role, akses = excluded.akses,
          dibuat_oleh = excluded.dibuat_oleh, dibuat_at = now(), dipakai_at = null, user_id = null;
        v_ok := true;
        if v_p.id is not null then
          -- Sudah pernah masuk (belum terdaftar / ditolak / nonaktif): langsung aktif bila akun Google terverifikasi
          if public.terapkan_undangan(v_p.id, v_email) then
            v_pesan := 'Langsung aktif (sudah pernah masuk)';
          else
            v_pesan := 'Diundang. Akun yang sudah ada dengan email ini bukan akun Google terverifikasi, jadi tidak diaktifkan';
          end if;
        elsif v_u.email is not null then
          v_pesan := 'Undangan diperbarui';
        else
          v_pesan := 'Diundang';
        end if;
      end if;
    end if;

    v_hasil := v_hasil || jsonb_build_object('email', v_email, 'ok', v_ok, 'hasil', v_pesan);
    v_p := null;
    v_u := null;
  end loop;
  return v_hasil;
end;
$$;


-- ---------------------------------------------------------------------
-- RPC: Admin/Master mengelola akun. Sama dengan 0009, ditambah:
-- - Akun yang belum pernah aktif (baru, menunggu, ditolak) hanya bisa diaktifkan
--   bila lolos akun_google_terverifikasi.
-- - Nonaktif hanya untuk akun yang pernah aktif, ditolak hanya untuk yang belum,
--   supaya status nonaktif selalu berarti "pernah aktif" (diaktifkan kembali
--   tanpa cek Google, karena akun aktif boleh sudah memasang password).
-- ---------------------------------------------------------------------
create or replace function public.atur_akun(
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

  if p_status = 'nonaktif' and v_p.status not in ('aktif', 'nonaktif') then
    raise exception 'Akun yang belum pernah aktif ditolak, bukan dinonaktifkan';
  end if;
  if p_status = 'ditolak' and v_p.status in ('aktif', 'nonaktif') then
    raise exception 'Akun yang pernah aktif dinonaktifkan, bukan ditolak';
  end if;
  if p_status = 'aktif' and v_p.status in ('baru', 'menunggu', 'ditolak')
     and not public.akun_google_terverifikasi(p_user) then
    raise exception 'Akun ini tidak dapat didaftarkan: bukan akun Google dengan email terverifikasi. Tolak akun ini, lalu daftarkan email nakes lewat "Daftarkan akun" dan minta yang bersangkutan masuk dengan Google.';
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
-- Grant. terapkan_undangan tetap tidak bisa dipanggil pengguna (0010).
-- ---------------------------------------------------------------------
revoke execute on function
  public.akun_google_terverifikasi(uuid, text),
  public.klaim_undangan(),
  public.verifikasi_pendaftar()
from public, anon, authenticated;

grant execute on function
  public.klaim_undangan(),
  public.verifikasi_pendaftar()
to authenticated;
