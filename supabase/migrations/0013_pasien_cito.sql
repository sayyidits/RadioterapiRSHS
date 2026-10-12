-- =====================================================================
-- Flow Radioterapi — 0013
-- Pasien CITO (butuh penanganan segera). Di Poli, dokter/perawat memilih
-- kategori Standar atau CITO.
-- - Pasien CITO memakai kuota terpisah yang khusus untuknya, di atas kuota
--   standar: 10 pasien/hari per pesawat (Synergy, Precise, Cobalt; Brakiterapi
--   tetap tanpa kuota) dan 10 pasien/hari di CT Simulator.
-- - Kuota tidak saling dipinjam: pasien CITO hanya memakai slot CITO dan pasien
--   standar hanya memakai slot standar.
-- - Tanpa jeda CT Sim -> Verifikasi: verifikasi & fraksi 1 CITO direncanakan di
--   hari CT Sim itu juga (nakes yang menyesuaikan pelaksanaannya), jadi slot
--   pesawat ditempati mulai tanggal CT Sim.
-- Aturan ini harus sama dengan KUOTA_PESAWAT_CITO, KUOTA_CT_SIM_CITO, dan
-- tglVerifikasiDari di lib/workflow.ts dan lib/booking.ts.
-- Selain kategori, advance_stage sama dengan 0006.
-- =====================================================================

alter table public.patients add column cito boolean not null default false;

-- Kuota pasien CITO per hari per pesawat (sama dengan KUOTA_PESAWAT_CITO). NULL = tanpa kuota.
create function public.kuota_pesawat_cito(m text)
returns integer
language sql
immutable
as $$
  select case m
    when 'Synergy' then 10
    when 'Precise' then 10
    when 'Cobalt'  then 10
    else null
  end;
$$;

-- Kuota per hari per pesawat untuk kategori pasien (CITO atau standar). NULL = tanpa kuota.
create function public.kuota_kategori(m text, p_cito boolean)
returns integer
language sql
immutable
as $$
  select case when p_cito then public.kuota_pesawat_cito(m) else public.kuota_pesawat(m) end;
$$;

-- Kuota pasien CITO CT Simulator per hari (sama dengan KUOTA_CT_SIM_CITO)
create function public.kuota_ct_sim_cito()
returns integer
language sql
immutable
as $$
  select 10;
$$;


-- ---------------------------------------------------------------------
-- Hunian dan jumlah CT Sim dipisah per kategori (kolom cito). Bentuk
-- hasilnya berubah, jadi fungsi lama di-drop dulu.
-- ---------------------------------------------------------------------
drop function public.hunian_pesawat(date, date, uuid);

-- Jumlah pasien per pesawat per hari per kategori (dari jadwal_sinar)
create function public.hunian_pesawat(p_from date, p_to date, p_exclude uuid default null)
returns table (mesin text, tanggal date, cito boolean, jumlah integer)
language sql
stable
set search_path = ''
as $$
  select j.mesin, j.tanggal, p.cito, count(*)::int
  from public.jadwal_sinar(p_from, p_to, p_exclude) j
  join public.patients p on p.id = j.patient_id
  group by j.mesin, j.tanggal, p.cito;
$$;

drop function public.jumlah_ct_sim(date, date, uuid);

-- Jumlah pasien yang dijadwalkan CT Sim per tanggal per kategori
create function public.jumlah_ct_sim(p_from date, p_to date, p_exclude uuid default null)
returns table (tanggal date, cito boolean, jumlah integer)
language sql
stable
set search_path = ''
as $$
  select p.tgl_ct_sim, p.cito, count(*)::int
  from public.patients p
  where p.tgl_ct_sim between p_from and p_to
    and p.current_stage > 'POLI'::public.stage
    and p.id is distinct from p_exclude
  group by p.tgl_ct_sim, p.cito;
$$;

drop function public.kuota_penuh_pada(text, date, integer, uuid);

-- Hari pertama yang kuota kategori ini sudah habis bila pasien menempati p_hari
-- hari kerja mulai p_mulai (NULL = semua hari masih ada kuotanya). Dikunci per
-- pesawat supaya dua ACC bersamaan tidak sama-sama mengambil slot terakhir.
create function public.kuota_penuh_pada(p_mesin text, p_mulai date, p_hari integer, p_exclude uuid, p_cito boolean)
returns date
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_kuota integer := public.kuota_kategori(p_mesin, p_cito);
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
  left join public.hunian_pesawat(p_mulai, v_akhir, p_exclude) h
    on h.mesin = p_mesin and h.tanggal = d and h.cito = p_cito
  where coalesce(h.jumlah, 0) >= v_kuota
  order by d
  limit 1;

  return v_penuh;
end;
$$;


-- ---------------------------------------------------------------------
-- RPC: ACC tahap saat ini. Poli: kategori (Standar/CITO), dosis, fraksi,
-- rencana pesawat, dan tanggal CT Sim (cek kuota CT Sim dan kuota pesawat
-- kategori pasien). Planning: pesawat boleh diganti bila masih ada kuota.
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
  v_kategori text;
  v_cito boolean;
  v_label text;
  v_kuota_ct integer;
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
    v_kategori := coalesce(nullif(trim(v_payload ->> 'cito'), ''), 'Standar');
    if v_kategori not in ('Standar', 'CITO') then
      raise exception 'Kategori pasien harus Standar atau CITO';
    end if;
    v_cito := v_kategori = 'CITO';
    v_label := case when v_cito then 'CITO' else 'standar' end;
    v_kuota_ct := case when v_cito then public.kuota_ct_sim_cito() else public.kuota_ct_sim() end;
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

    -- Kuota CT Simulator hari itu untuk kategori pasien. Dikunci supaya dua ACC bersamaan
    -- tidak sama-sama mengambil slot terakhir (kunci CT Sim selalu sebelum kunci pesawat).
    perform pg_advisory_xact_lock(hashtext('kuota:ct_sim'));
    if (select coalesce(sum(j.jumlah), 0) from public.jumlah_ct_sim(v_ct, v_ct, p_patient) j where j.cito = v_cito) >= v_kuota_ct then
      raise exception 'Kuota CT Simulator % tanggal % sudah penuh (% pasien/hari). Pilih tanggal CT Sim lain.',
        v_label, to_char(v_ct, 'DD/MM/YYYY'), v_kuota_ct;
    end if;

    -- CITO tanpa jeda: verifikasi & fraksi 1 direncanakan di hari CT Sim
    if v_cito then
      v_verif := v_ct;
    else
      v_verif := public.tgl_verifikasi_dari(v_ct);
    end if;
    v_penuh := public.kuota_penuh_pada(v_mesin, v_verif, v_fraksi - v_done, p_patient, v_cito);
    if v_penuh is not null then
      raise exception 'Kuota % % sudah penuh pada % (% pasien/hari). Pilih tanggal CT Sim lain.',
        v_label, v_mesin, to_char(v_penuh, 'DD/MM/YYYY'), public.kuota_kategori(v_mesin, v_cito);
    end if;

    update public.patients set
      cito = v_cito,
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
    -- Ganti pesawat hanya ke pesawat yang masih ada kuota kategori pasien ini di hari-harinya
    if v_mesin is distinct from v_p.mesin and v_p.total_fraksi is not null then
      v_mulai := public.next_working_day_from(greatest(coalesce(v_p.tgl_verifikasi, public.today_wib()), public.today_wib()));
      v_penuh := public.kuota_penuh_pada(v_mesin, v_mulai, v_p.total_fraksi - v_done, p_patient, v_p.cito);
      if v_penuh is not null then
        raise exception 'Kuota % % sudah penuh pada % (% pasien/hari). Pilih pesawat lain yang masih ada kuotanya.',
          case when v_p.cito then 'CITO' else 'standar' end, v_mesin, to_char(v_penuh, 'DD/MM/YYYY'),
          public.kuota_kategori(v_mesin, v_p.cito);
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
-- Grant. hunian_pesawat dan jumlah_ct_sim tetap dipanggil aplikasi
-- (lib/data.ts); pembantu kuota hanya dipakai di dalam advance_stage.
-- ---------------------------------------------------------------------
revoke execute on function
  public.kuota_pesawat_cito(text),
  public.kuota_kategori(text, boolean),
  public.kuota_ct_sim_cito(),
  public.kuota_penuh_pada(text, date, integer, uuid, boolean)
from public, anon, authenticated;

revoke execute on function
  public.hunian_pesawat(date, date, uuid),
  public.jumlah_ct_sim(date, date, uuid)
from public, anon;

grant execute on function
  public.hunian_pesawat(date, date, uuid),
  public.jumlah_ct_sim(date, date, uuid)
to authenticated;
