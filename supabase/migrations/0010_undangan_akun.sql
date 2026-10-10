-- =====================================================================
-- Flow Radioterapi — 0010
-- Akun hanya didaftarkan oleh Admin/Master lewat undangan (pra-daftar).
-- - Admin/Master mengisi email, nama lengkap + gelar, role kerja, dan hak akses
--   (undang_akun). Admin hanya bisa mengundang sebagai Nakes.
-- - Saat pemilik email itu masuk pertama kali (Google, atau email yang sudah
--   dikonfirmasi), akunnya langsung aktif dengan data undangan. Undangan hanya
--   dipakai untuk email yang sudah terverifikasi, supaya tidak bisa diserobot
--   lewat pendaftaran email yang belum dikonfirmasi.
-- - Email yang tidak diundang tetap menjadi profil 'baru' tanpa akses; Admin/
--   Master bisa mendaftarkannya langsung dari halaman Akun (atur_akun).
-- Pendaftaran mandiri (lengkapi_profil) tidak dipakai lagi oleh aplikasi.
-- =====================================================================

create table public.undangan_akun (
  email text primary key check (email = lower(email) and email like '%_@_%._%'),
  full_name text not null check (length(trim(full_name)) >= 3),
  role public.user_role not null check (role <> 'master'),
  akses public.akses_akun not null default 'nakes',
  dibuat_oleh uuid references public.profiles (id),
  dibuat_at timestamptz not null default now(),
  -- Terisi saat undangan dipakai (akun aktif)
  dipakai_at timestamptz,
  user_id uuid references public.profiles (id) on delete set null
);


-- ---------------------------------------------------------------------
-- Terapkan undangan ke akun yang emailnya sudah terverifikasi
-- ---------------------------------------------------------------------
create function public.terapkan_undangan(p_user uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_u public.undangan_akun;
begin
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

-- Profil otomatis saat akun dibuat. app_metadata.role (administrator: db:seed, demo) → langsung
-- aktif; selain itu profil 'baru', lalu undangan diterapkan bila emailnya sudah terverifikasi.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := new.raw_app_meta_data ->> 'role';
  v_akses text := coalesce(new.raw_app_meta_data ->> 'akses', 'nakes');
  -- coalesce: tanpa role, "in" bernilai NULL (bukan false) sehingga "not v_valid" ikut NULL
  v_valid boolean := coalesce(v_role in (select unnest(enum_range(null::public.user_role))::text) and v_role <> 'master', false);
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
  if not v_valid and new.email_confirmed_at is not null then
    perform public.terapkan_undangan(new.id, new.email);
  end if;
  return new;
end;
$$;

-- Supabase bisa membuat user dulu lalu mengonfirmasi emailnya di langkah terpisah
-- (Google, atau tautan konfirmasi email): undangan diterapkan saat itu.
create function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.terapkan_undangan(new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();


-- ---------------------------------------------------------------------
-- RPC: undang banyak akun sekaligus. p_items: [{email, full_name, role, akses?}].
-- Mengembalikan hasil per baris: [{email, ok, hasil}]. Email yang sudah punya akun
-- (belum aktif) langsung diaktifkan; akun yang sudah aktif dilewati.
-- ---------------------------------------------------------------------
create function public.undang_akun(p_items jsonb)
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
          -- Sudah pernah masuk (belum terdaftar / ditolak / nonaktif): langsung aktif
          perform public.terapkan_undangan(v_p.id, v_email);
          v_pesan := 'Langsung aktif (sudah pernah masuk)';
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

-- RPC: hapus undangan yang belum dipakai (Admin: hanya undangan Nakes)
create function public.hapus_undangan(p_email text)
returns void
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
    raise exception 'Undangan ini hanya dapat dihapus oleh Master';
  end if;
  delete from public.undangan_akun where email = v_u.email;
end;
$$;


-- ---------------------------------------------------------------------
-- RLS & grant: undangan hanya terbaca oleh Admin/Master aktif
-- ---------------------------------------------------------------------
alter table public.undangan_akun enable row level security;
create policy "baca undangan" on public.undangan_akun for select to authenticated
  using ((select public.akses_saya()) in ('admin', 'master'));

revoke all on public.undangan_akun from anon;
revoke insert, update, delete on public.undangan_akun from authenticated;
grant select on public.undangan_akun to authenticated;
grant all on public.undangan_akun to service_role;

revoke execute on function
  public.terapkan_undangan(uuid, text),
  public.handle_user_confirmed(),
  public.undang_akun(jsonb),
  public.hapus_undangan(text)
from public, anon, authenticated;

grant execute on function
  public.undang_akun(jsonb),
  public.hapus_undangan(text)
to authenticated;
