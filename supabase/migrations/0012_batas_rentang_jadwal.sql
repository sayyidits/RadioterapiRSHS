-- =====================================================================
-- Flow Radioterapi — 0012
-- Batasi query jadwal yang bisa membebani database (audit keamanan A7,
-- 2026-10-12). Akun aktif mana pun bisa memanggil RPC langsung lewat API.
-- - jadwal_sinar (dan hunian_pesawat yang memakainya) membuat kalender hari
--   kerja dari hari ini sampai p_to. Dengan p_to tahun 9999 itu jutaan baris.
--   Sekarang p_to paling jauh 2 tahun dari hari ini. Aplikasi paling jauh
--   meminta hari ini + 200 hari; cek kuota saat ACC Poli/Planning tetap jauh
--   di bawah batas kecuali jumlah fraksinya tidak masuk akal (batasnya A6).
-- - Fungsi pembantu yang hanya dipakai di dalam RPC security definer
--   (advance_stage, daftar_ulang_poli) tidak lagi bisa dipanggil pengguna,
--   mis. working_days(tanggal, 2 miliar) atau kuota_penuh_pada yang mengunci.
-- Isi jadwal_sinar sama dengan 0005, hanya dibungkus plpgsql untuk cek rentang.
-- =====================================================================

-- Batas jadwal ke depan (hari kalender dari hari ini)
create function public.batas_jadwal_hari()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 730;
$$;

create or replace function public.jadwal_sinar(p_from date, p_to date, p_exclude uuid default null)
returns table (patient_id uuid, mesin text, tanggal date, fraksi_ke integer, sudah boolean)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_from is null or p_to is null then
    raise exception 'Rentang tanggal jadwal wajib diisi';
  end if;
  if p_to > public.today_wib() + public.batas_jadwal_hari() then
    raise exception 'Rentang jadwal terlalu jauh: paling lama % hari dari hari ini', public.batas_jadwal_hari();
  end if;

  return query
  with
  hari_ini as materialized (select public.today_wib() as t),
  -- Hari kerja mulai hari ini, bernomor urut (dihitung sekali)
  kalender as materialized (
    select x::date as d, row_number() over (order by x) as rn
    from hari_ini h, generate_series(h.t, greatest(p_to, h.t), interval '1 day') x
    where extract(isodow from x) < 6
      and not exists (select 1 from public.hari_libur l where l.tanggal = x::date)
  ),
  fraksi as materialized (
    select fr.patient_id, count(*)::int as done, bool_or(fr.tanggal = h.t) as fx_today
    from public.fractions fr, hari_ini h
    group by fr.patient_id
  ),
  absen_hari_ini as materialized (
    select distinct on (a.patient_id) a.patient_id, a.hadir
    from public.attendance a, hari_ini h
    where a.tanggal = h.t
    order by a.patient_id, a.created_at desc, a.id desc
  ),
  aktif as materialized (
    select p.id, p.mesin,
      coalesce(f.done, 0) as done,
      p.total_fraksi - coalesce(f.done, 0) as sisa,
      -- Proyeksi dimulai di hari kerja pertama pada/setelah tanggal ini
      case
        -- Sudah disinar hari ini (juga yang lalu dikembalikan untuk replanning): mulai besok
        when coalesce(f.fx_today, false) then h.t + 1
        when p.current_stage = 'PENYINARAN' then
          case when ab.hadir is distinct from false then h.t else h.t + 1 end
        else greatest(coalesce(p.tgl_verifikasi, h.t), h.t)
      end as dari
    from public.patients p
    cross join hari_ini h
    left join fraksi f on f.patient_id = p.id
    left join absen_hari_ini ab on ab.patient_id = p.id
    where p.current_stage in ('CT_SIM', 'DELINEASI', 'PLANNING', 'VERIFIKASI', 'PENYINARAN')
      and p.mesin is not null
      and p.total_fraksi is not null
      and p.id is distinct from p_exclude
  ),
  mulai as materialized (
    select a.id, a.mesin, a.done, a.sisa, (select min(k.rn) from kalender k where k.d >= a.dari) as rn0
    from aktif a
    where a.sisa > 0
  )
  select fr.patient_id, max(coalesce(fr.mesin, p.mesin)), fr.tanggal, max(fr.fraksi_ke), true
  from public.fractions fr
  join public.patients p on p.id = fr.patient_id
  where fr.tanggal between p_from and p_to
    and fr.patient_id is distinct from p_exclude
  group by fr.patient_id, fr.tanggal
  union all
  select m.id, m.mesin, k.d, (m.done + k.rn - m.rn0 + 1)::int, false
  from mulai m
  join kalender k on k.rn between m.rn0 and m.rn0 + m.sisa - 1
  where k.d between p_from and p_to;
end;
$$;


-- ---------------------------------------------------------------------
-- Grant. Yang tetap dipanggil aplikasi: jadwal_sinar, hunian_pesawat,
-- jumlah_ct_sim (lib/data.ts), dan today_wib di dalamnya.
-- ---------------------------------------------------------------------
revoke execute on function
  public.is_working_day(date),
  public.next_working_day_from(date),
  public.working_days(date, integer),
  public.tgl_verifikasi_dari(date),
  public.kuota_pesawat(text),
  public.kuota_ct_sim(),
  public.kuota_penuh_pada(text, date, integer, uuid),
  public.poli_hangus(public.stage, timestamptz)
from public, anon, authenticated;

-- jadwal_sinar (security invoker) memanggil batas_jadwal_hari atas nama pengguna
revoke execute on function public.batas_jadwal_hari() from public, anon;
grant execute on function public.batas_jadwal_hari() to authenticated;
