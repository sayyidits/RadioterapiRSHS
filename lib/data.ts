import "server-only";
import { asUser, selectJson } from "./demo/db";
import { IS_DEMO } from "./mode";
import { demoUserId } from "./rpc";
import { createClient } from "./supabase/server";
import { todayISO } from "./format";
import type { Hunian } from "./booking";
import type { AttendanceDay } from "./schedule";
import type { Akun, AttendanceEntry, Fraction, Patient, Profile, StageEvent, Undangan } from "./types";
import type { StageKey } from "./workflow";

const BASE_COLUMNS =
  "id, no_rm, nama, tgl_lahir, jenis_kelamin, no_hp, diagnosis, current_stage, stage_entered_at, dosis_total_gy, total_fraksi, dpjp_id, mesin, tgl_ct_sim, tgl_verifikasi, data, created_at, updated_at";
// Nama DPJP ikut diambil (bentuk sama dengan embed PostgREST)
const PATIENT_COLUMNS = `${BASE_COLUMNS}, dpjp:profiles!patients_dpjp_id_fkey(full_name)`;
const DEMO_PATIENT_COLUMNS = `${BASE_COLUMNS},
  (select json_build_object('full_name', d.full_name) from public.profiles d where d.id = patients.dpjp_id) as dpjp`;

/** Jalankan query mode demo sebagai user dari cookie. */
async function demo<T>(fn: Parameters<typeof asUser<T>>[1]) {
  const uid = await demoUserId();
  if (!uid) throw new Error("Belum memilih role demo");
  return asUser(uid, fn);
}

/** Batas baris per respons PostgREST (pengaturan bawaan Supabase "Max rows") */
const PAGE = 1000;

/**
 * Supabase memotong respons di 1000 baris tanpa error, jadi query yang bisa lebih panjang
 * diambil per halaman sampai habis. Query harus berurutan stabil (order sampai ke kolom unik).
 */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function listPatients(opts: { q?: string; stage?: StageKey; dpjp?: string } = {}) {
  const q = opts.q?.replace(/[%,()]/g, " ").trim();

  if (IS_DEMO) {
    return demo((tx) =>
      selectJson<Patient>(
        tx,
        `select ${DEMO_PATIENT_COLUMNS} from public.patients
         where ($1::public.stage is null or current_stage = $1::public.stage)
           and ($2::text is null or nama ilike '%' || $2 || '%' or no_rm ilike '%' || $2 || '%')
           and ($3::uuid is null or dpjp_id = $3::uuid)
         order by stage_entered_at, id`,
        [opts.stage ?? null, q || null, opts.dpjp ?? null],
      ),
    );
  }

  const supabase = await createClient();
  return fetchAll<Patient>((from, to) => {
    let query = supabase.from("patients").select(PATIENT_COLUMNS).order("stage_entered_at").order("id").range(from, to);
    if (opts.stage) query = query.eq("current_stage", opts.stage);
    if (opts.dpjp) query = query.eq("dpjp_id", opts.dpjp);
    if (q) query = query.or(`nama.ilike.%${q}%,no_rm.ilike.%${q}%`);
    return query;
  });
}

export async function getPatient(id: string) {
  if (IS_DEMO) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return demo(async (tx) => {
      const [patient] = await selectJson<Patient>(tx, `select ${DEMO_PATIENT_COLUMNS} from public.patients where id = $1`, [id]);
      if (!patient) return null;
      const events = await selectJson<StageEvent>(
        tx,
        `select e.id, e.from_stage, e.to_stage, e.action, e.actor_role, e.note, e.payload, e.created_at,
                json_build_object('full_name', p.full_name) as actor
         from public.stage_events e left join public.profiles p on p.id = e.actor_id
         where e.patient_id = $1 order by e.created_at desc, e.id desc`,
        [id],
      );
      const fractions = await selectJson<Fraction>(
        tx,
        `select f.id, f.fraksi_ke, f.tanggal, f.mesin, f.catatan, f.created_at,
                json_build_object('full_name', p.full_name) as rtt
         from public.fractions f left join public.profiles p on p.id = f.rtt_id
         where f.patient_id = $1 order by f.fraksi_ke`,
        [id],
      );
      return { patient, events, fractions };
    });
  }

  const supabase = await createClient();
  const [patient, events, fractions] = await Promise.all([
    supabase.from("patients").select(PATIENT_COLUMNS).eq("id", id).maybeSingle(),
    supabase
      .from("stage_events")
      .select("id, from_stage, to_stage, action, actor_role, note, payload, created_at, actor:profiles(full_name)")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("fractions")
      .select("id, fraksi_ke, tanggal, mesin, catatan, created_at, rtt:profiles(full_name)")
      .eq("patient_id", id)
      .order("fraksi_ke", { ascending: true }),
  ]);
  if (patient.error) throw new Error(patient.error.message);
  if (!patient.data) return null;
  return {
    patient: patient.data as unknown as Patient,
    events: (events.data ?? []) as unknown as StageEvent[],
    fractions: (fractions.data ?? []) as unknown as Fraction[],
  };
}

export async function getPatientStage(id: string): Promise<StageKey | null> {
  if (IS_DEMO) {
    const rows = await demo((tx) =>
      selectJson<{ current_stage: StageKey }>(tx, "select current_stage from public.patients where id = $1", [id]),
    );
    return rows[0]?.current_stage ?? null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("patients").select("current_stage").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.current_stage as StageKey) ?? null;
}

/**
 * Jumlah fraksi yang sudah tercatat per pasien, untuk banyak pasien sekaligus.
 * `tanggal`: hanya fraksi di tanggal itu (mis. hari ini).
 */
export async function fractionCounts(patientIds: string[], tanggal?: string) {
  const counts: Record<string, number> = {};
  if (patientIds.length === 0) return counts;

  if (IS_DEMO) {
    const rows = await demo((tx) =>
      selectJson<{ patient_id: string; n: number }>(
        tx,
        `select patient_id, count(*)::int as n from public.fractions
         where patient_id = any($1::uuid[]) and ($2::date is null or tanggal = $2::date) group by patient_id`,
        [patientIds, tanggal ?? null],
      ),
    );
    for (const r of rows) counts[r.patient_id] = r.n;
    return counts;
  }

  const supabase = await createClient();
  const rows = await fetchAll<{ patient_id: string }>((from, to) => {
    let query = supabase.from("fractions").select("patient_id").in("patient_id", patientIds).order("id").range(from, to);
    if (tanggal) query = query.eq("tanggal", tanggal);
    return query;
  });
  for (const row of rows) counts[row.patient_id] = (counts[row.patient_id] ?? 0) + 1;
  return counts;
}

/** Akun dokter yang aktif (pilihan DPJP saat pendaftaran). */
export async function listDoctors() {
  if (IS_DEMO) {
    return demo((tx) =>
      selectJson<Profile>(
        tx,
        "select id, full_name, role from public.profiles where role = 'dokter' and status = 'aktif' order by full_name",
      ),
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("role", "dokter")
    .eq("status", "aktif")
    .order("full_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

/** Undangan yang belum dipakai (pemiliknya belum pernah masuk), terbaru lebih dulu. Hanya terbaca Admin/Master. */
export async function listUndangan() {
  if (IS_DEMO) {
    return demo((tx) =>
      selectJson<Undangan>(
        tx,
        `select u.email, u.full_name, u.role, u.akses, u.dibuat_at, p.full_name as dibuat_oleh_nama
         from public.undangan_akun u left join public.profiles p on p.id = u.dibuat_oleh
         where u.dipakai_at is null order by u.dibuat_at desc, u.email`,
      ),
    );
  }
  const supabase = await createClient();
  const rows = await fetchAll<Omit<Undangan, "dibuat_oleh_nama"> & { pembuat: { full_name: string } | null }>((from, to) =>
    supabase
      .from("undangan_akun")
      .select("email, full_name, role, akses, dibuat_at, pembuat:profiles!undangan_akun_dibuat_oleh_fkey(full_name)")
      .is("dipakai_at", null)
      .order("dibuat_at", { ascending: false })
      .order("email")
      .range(from, to),
  );
  return rows.map(({ pembuat, ...u }) => ({ ...u, dibuat_oleh_nama: pembuat?.full_name ?? null }));
}

/** Semua akun untuk halaman Akun (Admin/Master), terbaru lebih dulu. */
export async function listAccounts() {
  const columns = "id, full_name, email, role, akses, status, created_at, diproses_at";
  if (IS_DEMO) {
    return demo((tx) => selectJson<Akun>(tx, `select ${columns} from public.profiles order by created_at desc, id`));
  }
  const supabase = await createClient();
  return fetchAll<Akun>((from, to) =>
    supabase.from("profiles").select(columns).order("created_at", { ascending: false }).order("id").range(from, to),
  );
}

/** Pencatatan kehadiran hari ini per pasien, urut dari yang paling awal (terakhir = status berlaku). */
export async function attendanceToday(patientIds: string[]) {
  const byPatient: Record<string, AttendanceEntry[]> = {};
  if (patientIds.length === 0) return byPatient;

  let rows: AttendanceEntry[];
  if (IS_DEMO) {
    rows = await demo((tx) =>
      selectJson<AttendanceEntry>(
        tx,
        `select a.id, a.patient_id, a.hadir, a.catatan, a.actor_role, a.created_at,
                json_build_object('full_name', p.full_name) as actor
         from public.attendance a left join public.profiles p on p.id = a.actor_id
         where a.patient_id = any($1::uuid[]) and a.tanggal = $2::date
         order by a.created_at, a.id`,
        [patientIds, todayISO()],
      ),
    );
  } else {
    const supabase = await createClient();
    rows = await fetchAll<AttendanceEntry>((from, to) =>
      supabase
        .from("attendance")
        .select("id, patient_id, hadir, catatan, actor_role, created_at, actor:profiles(full_name)")
        .in("patient_id", patientIds)
        .eq("tanggal", todayISO())
        .order("created_at")
        .order("id")
        .range(from, to),
    );
  }
  for (const r of rows) (byPatient[r.patient_id] ??= []).push(r);
  return byPatient;
}

/** Satu hari penyinaran seorang pasien (fraksi tercatat atau proyeksi), dari jadwal_sinar() */
export type JadwalSinarRow = { patient_id: string; mesin: string; tanggal: string; fraksi_ke: number; sudah: boolean };

/** Jadwal penyinaran semua pasien di rentang tanggal (1 baris per pasien per hari). */
export async function jadwalSinar(from: string, to: string, exclude?: string) {
  if (IS_DEMO) {
    return demo((tx) =>
      selectJson<JadwalSinarRow>(tx, "select * from public.jadwal_sinar($1, $2, $3)", [from, to, exclude ?? null]),
    );
  }
  const supabase = await createClient();
  return fetchAll<JadwalSinarRow>((start, end) =>
    supabase
      .rpc("jadwal_sinar", { p_from: from, p_to: to, p_exclude: exclude ?? null })
      .order("tanggal")
      .order("patient_id")
      .range(start, end),
  );
}

/**
 * Jumlah pasien per pesawat per hari: { Cobalt: { "2026-10-26": 30 } }.
 * Terhitung sejak ACC Poli (tanggal verifikasi) sampai fraksi terakhir.
 */
export async function hunianPesawat(from: string, to: string, exclude?: string): Promise<Hunian> {
  type Row = { mesin: string; tanggal: string; jumlah: number };
  let rows: Row[];
  if (IS_DEMO) {
    rows = await demo((tx) =>
      selectJson<Row>(tx, "select * from public.hunian_pesawat($1, $2, $3)", [from, to, exclude ?? null]),
    );
  } else {
    const supabase = await createClient();
    rows = await fetchAll<Row>((start, end) =>
      supabase
        .rpc("hunian_pesawat", { p_from: from, p_to: to, p_exclude: exclude ?? null })
        .order("tanggal")
        .order("mesin")
        .range(start, end),
    );
  }
  const hunian: Hunian = {};
  for (const r of rows) (hunian[r.mesin] ??= {})[r.tanggal] = r.jumlah;
  return hunian;
}

/** Jumlah pasien yang dijadwalkan CT Sim per tanggal: { "2026-10-26": 7 }, dari jumlah_ct_sim(). */
export async function jumlahCtSim(from: string, to: string, exclude?: string) {
  type Row = { tanggal: string; jumlah: number };
  let rows: Row[];
  if (IS_DEMO) {
    rows = await demo((tx) =>
      selectJson<Row>(tx, "select * from public.jumlah_ct_sim($1, $2, $3)", [from, to, exclude ?? null]),
    );
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("jumlah_ct_sim", { p_from: from, p_to: to, p_exclude: exclude ?? null });
    if (error) throw new Error(error.message);
    rows = (data ?? []) as Row[];
  }
  return Object.fromEntries(rows.map((r) => [r.tanggal, r.jumlah])) as Record<string, number>;
}

/** Status kehadiran yang berlaku per tanggal untuk satu pasien (untuk jadwal fraksi). */
export async function attendanceDays(patientId: string) {
  if (IS_DEMO) {
    return demo((tx) =>
      selectJson<AttendanceDay>(
        tx,
        `select distinct on (tanggal) tanggal, hadir, catatan from public.attendance
         where patient_id = $1 order by tanggal, created_at desc, id desc`,
        [patientId],
      ),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("tanggal, hadir, catatan")
    .eq("patient_id", patientId)
    .order("tanggal", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  // Baris terakhir per tanggal yang berlaku
  const byDate = new Map<string, AttendanceDay>();
  for (const row of (data ?? []) as AttendanceDay[]) byDate.set(row.tanggal, row);
  return [...byDate.values()];
}
