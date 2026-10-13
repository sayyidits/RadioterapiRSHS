-- =====================================================================
-- Flow Radioterapi — 0014
-- Kode undangan (2026-10-13). Pendaftaran SATU akun memakai kode 6 angka yang
-- berlaku 5 menit: Admin/Master klik Daftarkan, kode muncul di layarnya, lalu
-- staf yang duduk di sebelahnya masuk dengan Google dan mengetik kode itu.
-- Tujuannya menahan salah ketik email: kalau email yang diketik ternyata milik
-- orang lain, orang itu tidak punya kodenya, jadi undangan tidak bisa dipakai.
-- - Tempel banyak baris (pendaftaran awal sekaligus) tidak memakai kode, sama
--   seperti sebelumnya: aktif otomatis saat pemilik email masuk pertama kali.
--   Undangan lama (sebelum 0014) juga tanpa kode.
-- - Tidak ada batas jumlah percobaan (keputusan pengguna): batasnya masa
--   berlaku 5 menit, dan kode hanya berlaku untuk akun Google dengan email itu.
-- - Kode disimpan sebagai hash, dan kolom hash tidak bisa dibaca pengguna, jadi
--   kode hanya terlihat sekali di layar Admin. Kode hilang: "Buat kode baru".
-- - Daftarkan dari kelompok "Belum terdaftar" (atur_akun) tetap tanpa kode,
--   karena Admin melihat langsung email dan nama Google orangnya.
-- Mode demo tidak memakai kode (tidak ada login Google): aplikasi memanggil
-- undang_akun dengan p_kode = false, jadi perilaku demo tetap seperti sebelumnya.
-- =====================================================================

alter table public.undangan_akun
  add column pakai_kode boolean not null default false,
  add column kode_hash text,
  add column kode_berlaku_sampai timestamptz;

-- Kolom hash tidak ikut terbaca: hak baca per kolom, tanpa kode_hash
revoke select on public.undangan_akun from authenticated;
grant select (email, full_name, role, akses, dibuat_oleh, dibuat_at, dipakai_at, user_id, pakai_kode, kode_berlaku_sampai)
  on public.undangan_akun to authenticated;


-- ---------------------------------------------------------------------
-- Helper internal (tidak di-grant ke pengguna)
-- ---------------------------------------------------------------------
create function public.hash_kode_undangan(p_email text, p_kode text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(lower(trim(p_email)) || ':' || p_kode, 'UTF8')), 'hex');
$$;

-- 6 angka acak dari gen_random_uuid() (sumber acak yang kuat, bukan random())
create function public.kode_acak_undangan()
returns text
language sql
volatile
set search_path = ''
as $$
  select lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 7))::bit(28)::int) % 1000000)::text, 6, '0');
$$;

-- Pasang kode baru (berlaku 5 menit) pada undangan yang belum dipakai. Kode
-- dikembalikan sekali saja; yang tersimpan hanya hash-nya.
create function public.pasang_kode_undangan(p_email text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_kode text := public.kode_acak_undangan();
  v_sampai timestamptz := now() + interval '5 minutes';
begin
  update public.undangan_akun set
    pakai_kode = true,
    kode_hash = public.hash_kode_undangan(email, v_kode),
    kode_berlaku_sampai = v_sampai
  where email = lower(trim(p_email)) and dipakai_at is null;
  if not found then
    raise exception 'Undangan tidak ditemukan atau sudah dipakai';
  end if;
  return jsonb_build_object('kode', v_kode, 'berlaku_sampai', v_sampai, 'berlaku_detik', 300);
end;
$$;


-- ---------------------------------------------------------------------
-- Terapkan undangan. Sama dengan 0011, ditambah: undangan berkode hanya dipakai
-- dengan kode yang benar dan belum kedaluwarsa. Trigger (handle_new_user,
-- handle_user_confirmed) dan klaim_undangan() memanggilnya tanpa kode, jadi
-- undangan berkode tidak pernah aktif otomatis.
-- ---------------------------------------------------------------------
drop function public.terapkan_undangan(uuid, text);

create function public.terapkan_undangan(p_user uuid, p_email text, p_kode text default null)
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

  if v_u.pakai_kode and (
    p_kode is null
    or v_u.kode_berlaku_sampai is null
    or v_u.kode_berlaku_sampai <= now()
    or v_u.kode_hash is distinct from public.hash_kode_undangan(v_u.email, p_kode)
  ) then
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

  update public.undangan_akun set
    dipakai_at = now(), user_id = p_user, kode_hash = null, kode_berlaku_sampai = null
  where email = v_u.email;
  return true;
end;
$$;


-- ---------------------------------------------------------------------
-- RPC: akun yang sedang login (belum aktif) memasukkan kode dari Admin.
-- ---------------------------------------------------------------------
create function public.klaim_undangan_kode(p_kode text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.status_akun;
  v_email text;
  v_kode text := regexp_replace(coalesce(p_kode, ''), '\D', '', 'g');
begin
  select status into v_status from public.profiles where id = auth.uid();
  if v_status is null then
    raise exception 'Silakan masuk dengan Google terlebih dahulu';
  end if;
  if v_status = 'aktif' then
    raise exception 'Akun ini sudah aktif';
  end if;
  if length(v_kode) <> 6 then
    raise exception 'Kode terdiri dari 6 angka';
  end if;

  select email into v_email from auth.users where id = auth.uid();
  if v_email is null or not public.akun_google_terverifikasi(auth.uid(), v_email) then
    raise exception 'Kode hanya bisa dipakai oleh akun yang masuk dengan Google';
  end if;
  if not public.terapkan_undangan(auth.uid(), v_email, v_kode) then
    raise exception 'Kode salah atau sudah kedaluwarsa. Minta Admin membuat kode baru.';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- RPC: undang akun. Sama dengan 0011, ditambah p_kode:
-- - false (tempel banyak baris, mode demo): seperti sebelumnya, tanpa kode.
-- - true (Daftarkan satu akun): hanya satu baris, undangan diberi kode 5 menit
--   (dikembalikan di kolom kode / berlaku_sampai / berlaku_detik), dan akun
--   yang sudah pernah masuk TIDAK langsung diaktifkan: harus memasukkan kode.
-- ---------------------------------------------------------------------
drop function public.undang_akun(jsonb);

create function public.undang_akun(p_items jsonb, p_kode boolean default false)
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
  v_baris jsonb;
  v_pesan text;
  v_ok boolean;
  v_kode jsonb;
begin
  if v_saya is null or v_saya = 'nakes' then
    raise exception 'Hanya Admin atau Master yang dapat mendaftarkan akun';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Data undangan tidak valid';
  end if;
  if coalesce(p_kode, false) and jsonb_array_length(p_items) <> 1 then
    raise exception 'Kode undangan hanya untuk pendaftaran satu akun';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_email := lower(trim(coalesce(v_item ->> 'email', '')));
    v_nama := trim(coalesce(v_item ->> 'full_name', ''));
    v_role := trim(coalesce(v_item ->> 'role', ''));
    v_akses := coalesce(nullif(trim(v_item ->> 'akses'), ''), 'nakes');
    v_ok := false;
    v_kode := null;

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
          dibuat_oleh = excluded.dibuat_oleh, dibuat_at = now(), dipakai_at = null, user_id = null,
          pakai_kode = false, kode_hash = null, kode_berlaku_sampai = null;
        v_ok := true;
        if coalesce(p_kode, false) then
          v_kode := public.pasang_kode_undangan(v_email);
          v_pesan := 'Kode dibuat';
        elsif v_p.id is not null then
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

    v_baris := jsonb_build_object('email', v_email, 'ok', v_ok, 'hasil', v_pesan);
    if v_kode is not null then
      v_baris := v_baris || v_kode;
    end if;
    v_hasil := v_hasil || jsonb_build_array(v_baris);
    v_p := null;
    v_u := null;
  end loop;
  return v_hasil;
end;
$$;


-- ---------------------------------------------------------------------
-- RPC: buat kode baru (5 menit) untuk undangan yang belum dipakai, mis. kode
-- lama kedaluwarsa atau tertutup sebelum dimasukkan. Hak sama dengan
-- hapus_undangan: Admin hanya untuk undangan Nakes.
-- ---------------------------------------------------------------------
create function public.buat_kode_undangan(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saya public.akses_akun := public.akses_saya();
  v_u public.undangan_akun;
begin
  if v_saya is null or v_saya = 'nakes' then
    raise exception 'Hanya Admin atau Master yang dapat mengelola undangan';
  end if;
  select * into v_u from public.undangan_akun where email = lower(trim(p_email)) for update;
  if not found or v_u.dipakai_at is not null then
    raise exception 'Undangan tidak ditemukan atau sudah dipakai';
  end if;
  if v_saya = 'admin' and v_u.akses <> 'nakes' then
    raise exception 'Undangan ini hanya dapat diubah oleh Master';
  end if;
  return public.pasang_kode_undangan(v_u.email);
end;
$$;


-- ---------------------------------------------------------------------
-- Grant
-- ---------------------------------------------------------------------
revoke execute on function
  public.hash_kode_undangan(text, text),
  public.kode_acak_undangan(),
  public.pasang_kode_undangan(text),
  public.terapkan_undangan(uuid, text, text),
  public.klaim_undangan_kode(text),
  public.undang_akun(jsonb, boolean),
  public.buat_kode_undangan(text)
from public, anon, authenticated;

grant execute on function
  public.klaim_undangan_kode(text),
  public.undang_akun(jsonb, boolean),
  public.buat_kode_undangan(text)
to authenticated;
