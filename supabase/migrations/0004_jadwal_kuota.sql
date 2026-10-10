-- =====================================================================
-- Flow Radioterapi — 0004
-- - Jadwal berbasis tanggal. Di Poli, dokter/perawat memilih rencana pesawat
--   dan tanggal CT Sim (H). Verifikasi = H+14 hari kalender (digeser ke hari
--   kerja berikutnya bila libur), dan fraksi 1 diberikan di hari yang sama.
-- - Kuota pesawat per hari (Synergy 65, Precise 65, Cobalt 30). Tanggal CT Sim
--   hanya bisa dipilih bila setiap hari penyinaran pasien masih ada kuotanya.
--   Fismed boleh mengganti pesawat di Planning hanya ke pesawat yang masih ada
--   kuotanya.
-- - Kembalikan paling jauh ke CT Sim (CT ulang). Poli sudah pasti selesai,
--   jadi tidak pernah menjadi tujuan, dan CT Sim tidak punya Kembalikan.
-- - Kunjungan Poli hanya berlaku 1 hari (hari pasien masuk Poli). Lewat hari
--   itu tanpa ACC = hangus; administrasi mendaftarkan ulang saat pasien datang.
-- Aturan ini harus sama dengan lib/workflow.ts, lib/holidays.ts, lib/booking.ts
-- =====================================================================


-- ---------------------------------------------------------------------
-- Hari libur nasional & cuti bersama (harus sama dengan HARI_LIBUR di
-- lib/holidays.ts). Tambahkan tahun berikutnya setelah SKB 3 Menteri terbit,
-- lewat migration baru.
-- ---------------------------------------------------------------------
create table public.hari_libur (
  tanggal date primary key,
  nama text not null
);

insert into public.hari_libur (tanggal, nama) values
  ('2026-01-01', 'Tahun Baru Masehi'),
  ('2026-01-16', 'Isra Mikraj Nabi Muhammad SAW'),
  ('2026-02-16', 'Cuti bersama Tahun Baru Imlek'),
  ('2026-02-17', 'Tahun Baru Imlek 2577 Kongzili'),
  ('2026-03-18', 'Cuti bersama Hari Suci Nyepi'),
  ('2026-03-19', 'Hari Suci Nyepi'),
  ('2026-03-20', 'Cuti bersama Idulfitri'),
  ('2026-03-21', 'Idulfitri 1447 H'),
  ('2026-03-22', 'Idulfitri 1447 H'),
  ('2026-03-23', 'Cuti bersama Idulfitri'),
  ('2026-03-24', 'Cuti bersama Idulfitri'),
  ('2026-04-03', 'Wafat Yesus Kristus'),
  ('2026-04-05', 'Kebangkitan Yesus Kristus (Paskah)'),
  ('2026-05-01', 'Hari Buruh Internasional'),
  ('2026-05-14', 'Kenaikan Yesus Kristus'),
  ('2026-05-15', 'Cuti bersama Kenaikan Yesus Kristus'),
  ('2026-05-27', 'Iduladha 1447 H'),
  ('2026-05-28', 'Cuti bersama Iduladha'),
  ('2026-05-31', 'Hari Raya Waisak 2570 BE'),
  ('2026-06-01', 'Hari Lahir Pancasila'),
  ('2026-06-16', 'Tahun Baru Islam 1448 H'),
  ('2026-08-17', 'Proklamasi Kemerdekaan'),
  ('2026-08-25', 'Maulid Nabi Muhammad SAW'),
  ('2026-12-24', 'Cuti bersama Natal'),
  ('2026-12-25', 'Kelahiran Yesus Kristus (Natal)'),
  ('2027-01-01', 'Tahun Baru Masehi'),
  ('2027-01-05', 'Isra Mikraj Nabi Muhammad SAW'),
  ('2027-02-05', 'Cuti bersama Tahun Baru Imlek'),
  ('2027-02-06', 'Tahun Baru Imlek 2578 Kongzili'),
  ('2027-03-08', 'Hari Suci Nyepi'),
  ('2027-03-09', 'Cuti bersama Idulfitri'),
  ('2027-03-10', 'Idulfitri 1448 H'),
  ('2027-03-11', 'Idulfitri 1448 H'),
  ('2027-03-12', 'Cuti bersama Idulfitri'),
  ('2027-03-15', 'Cuti bersama Idulfitri'),
  ('2027-03-25', 'Cuti bersama Wafat Yesus Kristus'),
  ('2027-03-26', 'Wafat Yesus Kristus'),
  ('2027-03-28', 'Kebangkitan Yesus Kristus (Paskah)'),
  ('2027-05-01', 'Hari Buruh Internasional'),
  ('2027-05-06', 'Kenaikan Yesus Kristus'),
  ('2027-05-17', 'Iduladha 1448 H'),
  ('2027-05-18', 'Cuti bersama Iduladha'),
  ('2027-05-19', 'Cuti bersama Waisak'),
  ('2027-05-20', 'Hari Raya Waisak 2571 BE'),
  ('2027-06-01', 'Hari Lahir Pancasila'),
  ('2027-06-06', 'Tahun Baru Islam 1449 H'),
  ('2027-08-15', 'Maulid Nabi Muhammad SAW'),
  ('2027-08-17', 'Proklamasi Kemerdekaan'),
  ('2027-12-24', 'Cuti bersama Natal'),
  ('2027-12-25', 'Kelahiran Yesus Kristus (Natal)'),
  ('2027-12-26', 'Isra Mikraj Nabi Muhammad SAW');


-- ---------------------------------------------------------------------
-- Hari kerja & garis waktu
-- ---------------------------------------------------------------------
-- Senin–Jumat, bukan libur nasional atau cuti bersama
create function public.is_working_day(d date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select extract(isodow from d) < 6
     and not exists (select 1 from public.hari_libur h where h.tanggal = d);
$$;

-- Hari kerja pertama pada atau setelah tanggal ini
create function public.next_working_day_from(d date)
returns date
language sql
stable
set search_path = ''
as $$
  select min(x)::date from generate_series(d, d + 30, interval '1 day') x
  where public.is_working_day(x::date);
$$;

-- n hari kerja berturut-turut mulai tanggal ini (tanggal ini ikut bila hari kerja)
create function public.working_days(p_mulai date, p_n integer)
returns setof date
language sql
stable
set search_path = ''
as $$
  select x::date from generate_series(p_mulai, p_mulai + (greatest(p_n, 0) * 2 + 30), interval '1 day') x
  where public.is_working_day(x::date)
  order by x
  limit greatest(p_n, 0);
$$;

-- Verifikasi = CT Sim + 14 hari kalender, digeser ke hari kerja (sama dengan JEDA_CT_VERIFIKASI)
create function public.tgl_verifikasi_dari(ct date)
returns date
language sql
stable
set search_path = ''
as $$
  select public.next_working_day_from(ct + 14);
$$;

-- Kuota pasien per hari per pesawat (sama dengan KUOTA_PESAWAT). NULL = tanpa kuota.
create function public.kuota_pesawat(m text)
returns integer
language sql
immutable
as $$
  select case m
    when 'Synergy' then 65
    when 'Precise' then 65
    when 'Cobalt'  then 30
    else null
  end;
$$;


-- Kembalikan ke tahap mana pun sebelumnya, paling jauh CT Sim
create or replace function public.can_return(from_s public.stage, to_s public.stage)
returns boolean
language sql
immutable
as $$
  select from_s between 'DELINEASI'::public.stage and 'PENYINARAN'::public.stage
     and to_s between 'CT_SIM'::public.stage and 'VERIFIKASI'::public.stage
     and to_s < from_s
     and 'ACC_PLAN'::public.stage not in (from_s, to_s);
$$;

-- Kunjungan Poli yang sudah lewat harinya (sama dengan poliHangus di lib/workflow.ts)
create function public.poli_hangus(p_stage public.stage, p_entered timestamptz)
returns boolean
language sql
stable
as $$
  select p_stage = 'POLI' and (p_entered at time zone 'Asia/Jakarta')::date < public.today_wib();
$$;


-- ---------------------------------------------------------------------
-- Tanggal kunci pasien
-- ---------------------------------------------------------------------
alter table public.patients
  add column tgl_ct_sim date,
  add column tgl_verifikasi date;


-- ---------------------------------------------------------------------
-- Jadwal penyinaran per pasien per hari (1 slot per hari kerja).
-- - Fraksi yang sudah tercatat di rentang tanggal (semua status).
-- - Proyeksi sisa fraksi untuk pasien CT Sim s.d. Penyinaran yang punya mesin:
--   * Penyinaran: mulai hari ini bila hari kerja, belum ada fraksi hari ini,
--     dan tidak tercatat tidak hadir; selain itu hari kerja berikutnya
--     (sama dengan buildSchedule di lib/schedule.ts).
--   * Sebelum penyinaran: mulai tgl_verifikasi, atau hari kerja pertama
--     >= hari ini bila tanggal itu sudah lewat / kosong.
-- Pasien di Poli (termasuk yang dikembalikan ke Poli) tidak menempati slot.
-- ---------------------------------------------------------------------
create function public.jadwal_sinar(p_from date, p_to date, p_exclude uuid default null)
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
        when p.current_stage = 'PENYINARAN' then
          case when not coalesce(f.fx_today, false) and ab.hadir is distinct from false then h.t else h.t + 1 end
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

-- Jumlah pasien per pesawat per hari
create function public.hunian_pesawat(p_from date, p_to date, p_exclude uuid default null)
returns table (mesin text, tanggal date, jumlah integer)
language sql
stable
set search_path = ''
as $$
  select j.mesin, j.tanggal, count(*)::int
  from public.jadwal_sinar(p_from, p_to, p_exclude) j
  group by j.mesin, j.tanggal;
$$;

-- Hari pertama yang kuotanya sudah habis bila pasien menempati p_hari hari kerja
-- mulai p_mulai (NULL = semua hari masih ada kuotanya). Dikunci per pesawat
-- supaya dua ACC bersamaan tidak sama-sama mengambil slot terakhir.
create function public.kuota_penuh_pada(p_mesin text, p_mulai date, p_hari integer, p_exclude uuid)
returns date
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_kuota integer := public.kuota_pesawat(p_mesin);
  v_akhir date;
  v_penuh date;
begin
  if v_kuota is null or p_hari <= 0 then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtext('kuota:' || p_mesin));

  select max(d) into v_akhir from public.working_days(p_mulai, p_hari) d;

  select d into v_penuh
  from public.working_days(p_mulai, p_hari) d
  left join public.hunian_pesawat(p_mulai, v_akhir, p_exclude) h on h.mesin = p_mesin and h.tanggal = d
  where coalesce(h.jumlah, 0) >= v_kuota
  order by d
  limit 1;

  return v_penuh;
end;
$$;


-- ---------------------------------------------------------------------
-- RPC: ACC tahap saat ini. Poli: dosis, fraksi, rencana pesawat, dan tanggal
-- CT Sim (cek kuota). Planning: pesawat boleh diganti bila masih ada kuota.
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
  v_done integer;
  v_mesin text;
  v_ct date;
  v_verif date;
  v_mulai date;
  v_penuh date;
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
  select count(*) into v_done from public.fractions where patient_id = p_patient;

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

  if v_p.current_stage = 'POLI' then
    -- Jadwal harus ditentukan di hari kunjungan Poli itu juga
    if public.poli_hangus(v_p.current_stage, v_p.stage_entered_at) then
      raise exception 'Kunjungan Poli tanggal % sudah hangus. Minta administrasi mendaftarkan ulang pasien ke Poli saat pasien datang.',
        to_char((v_p.stage_entered_at at time zone 'Asia/Jakarta')::date, 'DD/MM/YYYY');
    end if;
    v_fraksi := coalesce(nullif(v_payload ->> 'total_fraksi', '')::integer, v_p.total_fraksi);
    v_dosis  := coalesce(nullif(v_payload ->> 'dosis_total_gy', '')::numeric, v_p.dosis_total_gy);
    if v_fraksi is null or v_fraksi <= 0 then
      raise exception 'Jumlah fraksi wajib diisi dan lebih dari 0';
    end if;
    if v_dosis is null or v_dosis <= 0 then
      raise exception 'Dosis total wajib diisi dan lebih dari 0';
    end if;
    -- Replanning di tengah penyinaran: fraksi yang sudah diberikan tetap dihitung
    if v_fraksi < v_done then
      raise exception 'Jumlah fraksi tidak boleh kurang dari fraksi yang sudah diberikan (%)', v_done;
    end if;

    v_mesin := nullif(trim(v_payload ->> 'mesin'), '');
    if v_mesin is null or not public.is_valid_mesin(v_mesin) then
      raise exception 'Rencana pesawat wajib dipilih (Synergy, Precise, Cobalt, atau Brakiterapi)';
    end if;
    v_ct := nullif(v_payload ->> 'tgl_ct_sim', '')::date;
    if v_ct is null then
      raise exception 'Tanggal CT Sim wajib dipilih';
    end if;
    if v_ct < public.today_wib() then
      raise exception 'Tanggal CT Sim tidak boleh sebelum hari ini';
    end if;
    if not public.is_working_day(v_ct) then
      raise exception 'Tanggal CT Sim harus hari kerja (bukan Sabtu, Minggu, libur nasional, atau cuti bersama)';
    end if;

    v_verif := public.tgl_verifikasi_dari(v_ct);
    v_penuh := public.kuota_penuh_pada(v_mesin, v_verif, v_fraksi - v_done, p_patient);
    if v_penuh is not null then
      raise exception 'Kuota % sudah penuh pada % (% pasien/hari). Pilih tanggal CT Sim lain.',
        v_mesin, to_char(v_penuh, 'DD/MM/YYYY'), public.kuota_pesawat(v_mesin);
    end if;

    update public.patients set
      total_fraksi = v_fraksi,
      dosis_total_gy = v_dosis,
      mesin = v_mesin,
      tgl_ct_sim = v_ct,
      tgl_verifikasi = v_verif
    where id = p_patient;
  end if;

  if v_p.current_stage = 'PLANNING' then
    v_mesin := coalesce(nullif(trim(v_payload ->> 'mesin'), ''), v_p.mesin);
    if v_mesin is null or not public.is_valid_mesin(v_mesin) then
      raise exception 'Mesin wajib dipilih (Synergy, Precise, Cobalt, atau Brakiterapi)';
    end if;
    -- Ganti pesawat hanya ke pesawat yang masih ada kuotanya di hari-hari pasien ini
    if v_mesin is distinct from v_p.mesin and v_p.total_fraksi is not null then
      v_mulai := public.next_working_day_from(greatest(coalesce(v_p.tgl_verifikasi, public.today_wib()), public.today_wib()));
      v_penuh := public.kuota_penuh_pada(v_mesin, v_mulai, v_p.total_fraksi - v_done, p_patient);
      if v_penuh is not null then
        raise exception 'Kuota % sudah penuh pada % (% pasien/hari). Pilih pesawat lain yang masih ada kuotanya.',
          v_mesin, to_char(v_penuh, 'DD/MM/YYYY'), public.kuota_pesawat(v_mesin);
      end if;
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
-- RPC: daftarkan ulang pasien yang kunjungan Polinya hangus (administrasi).
-- Kunjungan baru berlaku hari ini.
-- ---------------------------------------------------------------------
create function public.daftar_ulang_poli(p_patient uuid, p_note text default null)
returns public.stage
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_user_role();
  v_p public.patients;
begin
  if v_role is distinct from 'administrasi' then
    raise exception 'Hanya administrasi yang dapat mendaftarkan ulang pasien ke Poli';
  end if;

  select * into v_p from public.patients where id = p_patient for update;
  if not found then
    raise exception 'Pasien tidak ditemukan';
  end if;
  if not public.poli_hangus(v_p.current_stage, v_p.stage_entered_at) then
    raise exception 'Pasien tidak sedang dalam kunjungan Poli yang hangus';
  end if;

  update public.patients set stage_entered_at = now(), updated_at = now() where id = p_patient;

  insert into public.stage_events (patient_id, from_stage, to_stage, action, actor_id, actor_role, note)
  values (p_patient, 'POLI', 'POLI', 'create', auth.uid(), v_role,
          coalesce(nullif(trim(p_note), ''), 'Didaftarkan ulang ke Poli'));

  return 'POLI';
end;
$$;


-- ---------------------------------------------------------------------
-- RLS & grant
-- ---------------------------------------------------------------------
alter table public.hari_libur enable row level security;
create policy "baca hari libur" on public.hari_libur for select to authenticated using (true);

revoke insert, update, delete on public.hari_libur from anon, authenticated;
revoke all on public.hari_libur from anon;
grant select on public.hari_libur to authenticated;
grant all on public.hari_libur to service_role;

revoke execute on function
  public.is_working_day(date),
  public.next_working_day_from(date),
  public.working_days(date, integer),
  public.tgl_verifikasi_dari(date),
  public.kuota_pesawat(text),
  public.jadwal_sinar(date, date, uuid),
  public.hunian_pesawat(date, date, uuid),
  public.kuota_penuh_pada(text, date, integer, uuid),
  public.poli_hangus(public.stage, timestamptz),
  public.daftar_ulang_poli(uuid, text)
from public, anon;

grant execute on function
  public.is_working_day(date),
  public.next_working_day_from(date),
  public.working_days(date, integer),
  public.tgl_verifikasi_dari(date),
  public.kuota_pesawat(text),
  public.jadwal_sinar(date, date, uuid),
  public.hunian_pesawat(date, date, uuid),
  public.poli_hangus(public.stage, timestamptz),
  public.daftar_ulang_poli(uuid, text)
to authenticated;
