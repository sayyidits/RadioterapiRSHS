-- =====================================================================
-- Flow Radioterapi — 0005
-- Perbaikan jadwal_sinar(): pasien yang sudah menerima fraksi hari ini lalu
-- dikembalikan untuk replanning di hari yang sama terhitung dua kali hari itu
-- (sekali dari fraksi yang sudah diberikan, sekali dari proyeksi yang dimulai
-- hari ini). Sekarang proyeksi siapa pun yang sudah disinar hari ini dimulai
-- hari kerja berikutnya, sama seperti pasien yang masih di Penyinaran.
-- Selain baris `dari`, isi fungsi sama dengan 0004_jadwal_kuota.sql.
-- =====================================================================

create or replace function public.jadwal_sinar(p_from date, p_to date, p_exclude uuid default null)
returns table (patient_id uuid, mesin text, tanggal date, fraksi_ke integer, sudah boolean)
language sql
stable
set search_path = ''
as $$
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
$$;
