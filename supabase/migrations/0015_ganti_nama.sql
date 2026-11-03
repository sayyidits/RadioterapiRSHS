-- =====================================================================
-- Flow Radioterapi — 0015
-- Akun aktif bisa mengganti nama lengkapnya sendiri (mis. menambah gelar pada
-- nama yang terbawa dari akun Google).
--
-- Nama di riwayat ACC, riwayat fraksi, absensi, dan DPJP diambil langsung dari
-- profiles.full_name (bukan salinan), jadi nama baru juga tampil di catatan
-- lama. Karena itu penggantian nama dijaga:
-- - Setiap penggantian dicatat di profil_riwayat (nama lama, nama baru, waktu),
--   terbaca oleh pemilik akun dan Admin/Master.
-- - Nama tidak boleh sama dengan nama akun aktif/nonaktif lain (tanpa
--   memedulikan huruf besar/kecil dan spasi ganda), supaya tidak ada yang
--   tampil sebagai orang lain di jejak audit.
-- - Paling banyak 5 kali per 24 jam.
-- Yang berubah hanya full_name. Role kerja, hak akses, dan status tetap
-- diatur Admin/Master (atur_akun).
-- =====================================================================

create table public.profil_riwayat (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  nama_lama text not null,
  nama_baru text not null,
  created_at timestamptz not null default now()
);

create index profil_riwayat_user_idx on public.profil_riwayat (user_id, created_at desc);

alter table public.profil_riwayat enable row level security;
create policy "baca riwayat nama" on public.profil_riwayat for select to authenticated
  using (
    (select public.akun_aktif())
    and (user_id = (select auth.uid()) or (select public.akses_saya()) in ('admin', 'master'))
  );

revoke all on public.profil_riwayat from anon;
revoke insert, update, delete on public.profil_riwayat from authenticated;
grant select on public.profil_riwayat to authenticated;
grant all on public.profil_riwayat to service_role;


-- ---------------------------------------------------------------------
-- RPC: ganti nama sendiri. Mengembalikan nama yang tersimpan.
-- ---------------------------------------------------------------------
create function public.ganti_nama(p_full_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.profiles;
  -- spasi/tab/baris baru berurutan jadi satu spasi
  v_nama text := trim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  v_hari integer;
begin
  select * into v_p from public.profiles where id = auth.uid() for update;
  if not found or v_p.status <> 'aktif' then
    raise exception 'Hanya akun aktif yang dapat mengganti nama';
  end if;
  if length(v_nama) < 3 then
    raise exception 'Nama lengkap beserta gelar wajib diisi (minimal 3 karakter)';
  end if;
  if length(v_nama) > 100 then
    raise exception 'Nama terlalu panjang (maksimal 100 karakter)';
  end if;
  if v_nama ~ '[[:cntrl:]]' then
    raise exception 'Nama mengandung karakter yang tidak diizinkan';
  end if;
  if v_nama = v_p.full_name then
    raise exception 'Nama tidak berubah';
  end if;

  select count(*) into v_hari from public.profil_riwayat
  where user_id = v_p.id and created_at > now() - interval '24 hours';
  if v_hari >= 5 then
    raise exception 'Terlalu sering mengganti nama. Coba lagi besok atau hubungi Admin.';
  end if;

  -- Dikunci supaya dua akun tidak sama-sama mengambil nama yang sama
  perform pg_advisory_xact_lock(hashtext('nama:profil'));
  if exists (
    select 1 from public.profiles x
    where x.id <> v_p.id
      and x.status in ('aktif', 'nonaktif')
      and lower(trim(regexp_replace(x.full_name, '\s+', ' ', 'g'))) = lower(v_nama)
  ) then
    raise exception 'Nama ini sudah dipakai akun lain. Tambahkan gelar atau nama yang membedakan, atau hubungi Admin.';
  end if;

  update public.profiles set full_name = v_nama where id = v_p.id;
  insert into public.profil_riwayat (user_id, nama_lama, nama_baru) values (v_p.id, v_p.full_name, v_nama);
  return v_nama;
end;
$$;

revoke execute on function public.ganti_nama(text) from public, anon;
grant execute on function public.ganti_nama(text) to authenticated;
