// Data dummy (fiktif) untuk akun demo dan pasien di berbagai tahap.
// Dipakai oleh mode demo lokal (lib/demo/db.ts) dan scripts/seed.ts (Supabase).
//
// Garis waktu tiap pasien mengikuti aturan jadwal: CT Sim di H, Delineasi & Planning
// sebelum verifikasi, verifikasi = H+14 hari (hari kerja), fraksi 1 di hari verifikasi.
// Selain pasien bernama, dibuat pasien pengisi supaya kuota harian Synergy, Precise,
// dan Cobalt penuh di minggu-minggu awal (lihat FULL) sehingga dokter/perawat di Poli
// harus mencari tanggal CT Sim yang masih kosong.
import { tglVerifikasiDari } from "./booking";
import { addDays, isWorkingDay, nextWorkingDay, prevWorkingDay, workingDayFrom, workingDaysFrom } from "./holidays";
import { KUOTA_PESAWAT, MESIN_EKSTERNAL, STAGE_KEYS, type Role, type StageKey } from "./workflow";

/** Kunci akun demo: satu per role, ditambah dokter kedua untuk contoh DPJP */
export type DemoKey = Role | "dokter2";

export const DEMO_USERS: { key: DemoKey; id: string; email: string; full_name: string; role: Role }[] = [
  { key: "dokter", id: "00000000-0000-4000-8000-000000000001", email: "dokter@flowrt.test", full_name: "dr. Andi Pratama, Sp.Onk.Rad", role: "dokter" },
  { key: "dokter2", id: "00000000-0000-4000-8000-000000000006", email: "dokter2@flowrt.test", full_name: "dr. Maya Anggraini, Sp.Onk.Rad", role: "dokter" },
  { key: "perawat", id: "00000000-0000-4000-8000-000000000002", email: "perawat@flowrt.test", full_name: "Ns. Sari Wulandari", role: "perawat" },
  { key: "rtt", id: "00000000-0000-4000-8000-000000000003", email: "rtt@flowrt.test", full_name: "Budi Santoso, A.Md.Rad", role: "rtt" },
  { key: "fismed", id: "00000000-0000-4000-8000-000000000004", email: "fismed@flowrt.test", full_name: "Rina Kusuma, M.Si", role: "fismed" },
  { key: "administrasi", id: "00000000-0000-4000-8000-000000000005", email: "admin@flowrt.test", full_name: "Dewi Lestari", role: "administrasi" },
];

type Identity = {
  no_rm: string;
  nama: string;
  tgl_lahir: string;
  jenis_kelamin: "L" | "P";
  diagnosis: string;
  area: string;
  dosis: number;
  fraksi: number;
  teknik: string;
  mesin: string;
  dpjp: "dokter" | "dokter2";
};

type SeedPatient = Identity & {
  stage: StageKey;
  /** Tahap CT Sim s.d. Verifikasi: tanggal verifikasi, dalam hari kerja dari hari ini (negatif = sudah lewat) */
  verifIn?: number;
  fractionsDone?: number;
  /** Plan dikembalikan RTT dari Verifikasi ke Planning (contoh) */
  returnedFromVerifikasi?: boolean;
  /** Replanning: dikembalikan RTT dari Penyinaran ke `stage` setelah sejumlah fraksi */
  replanAfter?: number;
  /** Poli di-ACC oleh perawat (contoh) */
  poliByPerawat?: boolean;
  /** Kunjungan Poli kemarin yang tidak di-ACC, jadi hangus (contoh) */
  poliHangus?: boolean;
  /** Kehadiran hari ini yang sudah dicatat administrasi */
  hadirToday?: boolean;
  /** Pasien tidak hadir satu hari setelah fraksi ke-n (contoh jadwal mundur) */
  absentAfter?: number;
};

const PATIENTS: SeedPatient[] = [
  // Poli: didaftarkan hari ini (Nurhayati kemarin, sudah hangus), untuk dicoba dokter/perawat memilih tanggal CT Sim
  { no_rm: "RM-000101", nama: "Siti Aminah", tgl_lahir: "1968-04-12", jenis_kelamin: "P", diagnosis: "Ca serviks stadium IIB", area: "Pelvis", dosis: 50, fraksi: 25, teknik: "VMAT", mesin: "Synergy", dpjp: "dokter", stage: "POLI" },
  { no_rm: "RM-000102", nama: "Joko Susilo", tgl_lahir: "1959-09-30", jenis_kelamin: "L", diagnosis: "Ca nasofaring T3N2M0", area: "Kepala leher", dosis: 70, fraksi: 35, teknik: "IMRT", mesin: "Synergy", dpjp: "dokter2", stage: "POLI" },
  { no_rm: "RM-000113", nama: "Rudi Hartanto", tgl_lahir: "1955-03-02", jenis_kelamin: "L", diagnosis: "Metastasis tulang femur dekstra", area: "Femur dekstra", dosis: 30, fraksi: 10, teknik: "3DCRT", mesin: "Cobalt", dpjp: "dokter", stage: "POLI" },
  { no_rm: "RM-000114", nama: "Nurhayati", tgl_lahir: "1972-08-25", jenis_kelamin: "P", diagnosis: "Ca mammae sinistra post BCS", area: "Payudara kiri", dosis: 40, fraksi: 15, teknik: "3DCRT", mesin: "Precise", dpjp: "dokter2", stage: "POLI", poliHangus: true },
  { no_rm: "RM-000115", nama: "Suparman", tgl_lahir: "1950-12-11", jenis_kelamin: "L", diagnosis: "Metastasis tulang vertebra torakal", area: "Vertebra T8-T10", dosis: 20, fraksi: 5, teknik: "3DCRT", mesin: "Cobalt", dpjp: "dokter", stage: "POLI" },
  { no_rm: "RM-000116", nama: "Lestari Wahyuni", tgl_lahir: "1977-06-19", jenis_kelamin: "P", diagnosis: "Glioma derajat tinggi post reseksi", area: "Otak", dosis: 60, fraksi: 30, teknik: "VMAT", mesin: "Synergy", dpjp: "dokter2", stage: "POLI" },
  // Sudah dijadwalkan, menunggu tahap berikutnya
  { no_rm: "RM-000103", nama: "Ratna Dewi", tgl_lahir: "1975-01-18", jenis_kelamin: "P", diagnosis: "Ca mammae dekstra post MRM", area: "Dinding dada + supraklavikula", dosis: 50, fraksi: 25, teknik: "3DCRT", mesin: "Precise", dpjp: "dokter", stage: "CT_SIM", verifIn: 12, poliByPerawat: true },
  { no_rm: "RM-000117", nama: "Teguh Prasetyo", tgl_lahir: "1963-02-07", jenis_kelamin: "L", diagnosis: "Ca paru NSCLC stadium III", area: "Paru + mediastinum", dosis: 60, fraksi: 30, teknik: "3DCRT", mesin: "Cobalt", dpjp: "dokter2", stage: "CT_SIM", verifIn: 9 },
  { no_rm: "RM-000104", nama: "Bambang Hartono", tgl_lahir: "1952-06-05", jenis_kelamin: "L", diagnosis: "Ca prostat risiko tinggi", area: "Prostat + vesikula seminalis", dosis: 70, fraksi: 28, teknik: "VMAT", mesin: "Synergy", dpjp: "dokter2", stage: "DELINEASI", verifIn: 6 },
  { no_rm: "RM-000105", nama: "Agus Salim", tgl_lahir: "1964-11-22", jenis_kelamin: "L", diagnosis: "Ca rekti post LAR", area: "Pelvis", dosis: 50.4, fraksi: 28, teknik: "IMRT", mesin: "Synergy", dpjp: "dokter", stage: "PLANNING", verifIn: 2, returnedFromVerifikasi: true },
  { no_rm: "RM-000106", nama: "Maria Ulfa", tgl_lahir: "1980-03-09", jenis_kelamin: "P", diagnosis: "Ca mammae sinistra post BCS", area: "Payudara kiri", dosis: 40, fraksi: 15, teknik: "3DCRT", mesin: "Precise", dpjp: "dokter", stage: "VERIFIKASI", verifIn: 0 },
  { no_rm: "RM-000107", nama: "Hendra Wijaya", tgl_lahir: "1971-07-14", jenis_kelamin: "L", diagnosis: "Glioblastoma post reseksi", area: "Otak", dosis: 60, fraksi: 30, teknik: "VMAT", mesin: "Synergy", dpjp: "dokter2", stage: "VERIFIKASI", verifIn: -1 },
  // Penyinaran, selesai, dan replanning
  { no_rm: "RM-000108", nama: "Yuliana Putri", tgl_lahir: "1966-12-01", jenis_kelamin: "P", diagnosis: "Ca serviks stadium IIIB", area: "Pelvis + paraaorta", dosis: 50, fraksi: 25, teknik: "VMAT", mesin: "Synergy", dpjp: "dokter", stage: "PENYINARAN", fractionsDone: 12, hadirToday: true, absentAfter: 6 },
  { no_rm: "RM-000109", nama: "Slamet Riyadi", tgl_lahir: "1949-02-27", jenis_kelamin: "L", diagnosis: "Metastasis tulang vertebra lumbal", area: "Vertebra L2-L4", dosis: 20, fraksi: 5, teknik: "3DCRT", mesin: "Cobalt", dpjp: "dokter2", stage: "PENYINARAN", fractionsDone: 3 },
  { no_rm: "RM-000111", nama: "Dedi Kurniawan", tgl_lahir: "1961-05-03", jenis_kelamin: "L", diagnosis: "Ca laring glotik T2N0M0", area: "Laring", dosis: 66, fraksi: 33, teknik: "IMRT", mesin: "Precise", dpjp: "dokter", stage: "PENYINARAN", fractionsDone: 10, hadirToday: false },
  { no_rm: "RM-000112", nama: "Wayan Sudarsa", tgl_lahir: "1957-10-21", jenis_kelamin: "L", diagnosis: "Ca nasofaring T4N1M0", area: "Kepala leher", dosis: 70, fraksi: 35, teknik: "IMRT", mesin: "Synergy", dpjp: "dokter2", stage: "PLANNING", replanAfter: 8 },
  { no_rm: "RM-000110", nama: "Kartini Rahayu", tgl_lahir: "1958-08-17", jenis_kelamin: "P", diagnosis: "Metastasis otak multipel", area: "Whole brain", dosis: 20, fraksi: 5, teknik: "3DCRT", mesin: "Cobalt", dpjp: "dokter2", stage: "SELESAI", fractionsDone: 5 },
];

/**
 * Rentang hari kerja (indeks dari hari ini) yang dibuat penuh tepat sesuai kuota.
 * Di antara rentang ada celah, jadi kursus pendek bisa masuk lebih awal daripada kursus panjang.
 */
const FULL: Record<string, [number, number][]> = {
  Synergy: [[0, 20], [26, 34]],
  Precise: [[0, 12], [18, 25]],
  Cobalt: [[0, 25]],
};

/** Jumlah fraksi umum dan bobot kemunculannya pada pasien pengisi */
const COURSES: [number, number][] = [[5, 1], [10, 1], [15, 2], [20, 1], [25, 4], [28, 2], [30, 3], [33, 2], [35, 3]];

/** Dosis total umum per jumlah fraksi */
const DOSIS: Record<number, number> = { 5: 20, 10: 30, 15: 40, 20: 40, 25: 50, 28: 50.4, 30: 60, 33: 66, 35: 70 };

/** Diagnosis contoh per jumlah fraksi: [diagnosis, area] */
const DIAGNOSIS: Record<number, [string, string][]> = {
  5: [["Metastasis tulang vertebra", "Vertebra"], ["Metastasis otak multipel", "Whole brain"]],
  10: [["Metastasis tulang pelvis", "Pelvis"], ["Ca paru paliatif", "Mediastinum"]],
  15: [["Ca mammae post BCS", "Payudara"], ["Ca prostat paliatif", "Pelvis"]],
  20: [["Ca esofagus paliatif", "Esofagus"], ["Ca buli paliatif", "Pelvis"]],
  25: [["Ca serviks stadium IIB", "Pelvis"], ["Ca mammae post MRM", "Dinding dada + supraklavikula"], ["Ca endometrium post histerektomi", "Pelvis"]],
  28: [["Ca rekti post LAR", "Pelvis"], ["Ca prostat risiko sedang", "Prostat"]],
  30: [["Glioblastoma post reseksi", "Otak"], ["Ca paru NSCLC stadium III", "Paru + mediastinum"]],
  33: [["Ca laring glotik", "Laring"], ["Ca orofaring", "Kepala leher"]],
  35: [["Ca nasofaring", "Kepala leher"], ["Ca lidah post operasi", "Kepala leher"]],
};

const NAMA_L = ["Ahmad", "Budi", "Cahyo", "Darmawan", "Eko", "Fajar", "Gunawan", "Hadi", "Imam", "Joko", "Kurnia", "Lukman", "Mulyadi", "Nanang", "Purnomo", "Rahmat", "Sugeng", "Taufik", "Untung", "Wahyu", "Yusuf", "Zainal", "Asep", "Dadang", "Ujang", "Ketut", "Made", "Nyoman"];
const NAMA_P = ["Ani", "Butet", "Citra", "Dewi", "Endah", "Fitri", "Gita", "Hartini", "Indah", "Juwita", "Kurniasih", "Lilis", "Mega", "Nining", "Oktaviani", "Puspita", "Rina", "Sri", "Tuti", "Umi", "Wulan", "Yanti", "Euis", "Neneng", "Ayu", "Komang"];
const NAMA_BELAKANG = ["Kusuma", "Siregar", "Nasution", "Simanjuntak", "Lubis", "Hasibuan", "Rahman", "Sitompul", "Tanjung", "Harahap", "Pane", "Sinaga"];
const NAMA_BELAKANG_L = [...NAMA_BELAKANG, "Saputra", "Setiawan", "Hidayat", "Nugroho", "Santoso", "Wibowo", "Permana", "Sulistyo", "Purwanto", "Suryadi", "Firmansyah", "Maulana", "Ramadhan"];
const NAMA_BELAKANG_P = [...NAMA_BELAKANG, "Wijayanti", "Handayani", "Lestari", "Pertiwi", "Susanti", "Rahayu", "Puspitasari", "Kartika", "Anggraeni", "Safitri", "Utami"];

/** Pasien lengkap dengan tanggal-tanggalnya, sebelum diubah menjadi baris tabel */
type Spec = Identity & {
  stage: StageKey;
  /** Tanggal fraksi yang sudah diberikan (urut) */
  fractionDates: string[];
  /** Tanggal tidak hadir di tengah penyinaran */
  absentDates: string[];
  /** Rencana CT Sim & verifikasi (null untuk pasien yang belum di-ACC Poli) */
  ct: string | null;
  verif: string | null;
  hadirToday?: boolean;
  poliByPerawat?: boolean;
  poliHangus?: boolean;
  returnedFromVerifikasi?: boolean;
  /** Dikembalikan dari Penyinaran ke `stage` (replanning) */
  replan?: boolean;
};

const OWNER: Partial<Record<StageKey, Role>> = {
  POLI: "dokter",
  CT_SIM: "rtt",
  DELINEASI: "dokter",
  PLANNING: "fismed",
  VERIFIKASI: "rtt",
};

/** Tahap yang menempati slot pesawat (sama dengan jadwal_sinar di 0004_jadwal_kuota.sql) */
const BOOKED_STAGES: StageKey[] = ["CT_SIM", "DELINEASI", "PLANNING", "VERIFIKASI", "PENYINARAN"];

function payloadFor(stage: StageKey, p: Spec): Record<string, unknown> {
  const head = /Kepala|Otak|brain|Laring/.test(p.area);
  switch (stage) {
    case "POLI":
      return {
        diagnosis_kerja: p.diagnosis,
        intent: p.fraksi <= 10 ? "Paliatif" : "Kuratif",
        area_radiasi: p.area,
        dosis_total_gy: p.dosis,
        total_fraksi: p.fraksi,
        mesin: p.mesin,
        tgl_ct_sim: p.ct,
      };
    case "CT_SIM":
      return { tanggal_ct: p.ct, posisi: "Supine", imobilisasi: head ? "Thermoplastic mask" : "Vacloc" };
    case "DELINEASI":
      return { catatan_kontur: "GTV, CTV, PTV dan OAR selesai dikontur" };
    case "PLANNING":
      return { teknik: p.teknik, mesin: p.mesin, tps: `Plan_${p.no_rm}_v1` };
    case "VERIFIKASI":
      return { tanggal_verifikasi: p.verif, metode: p.teknik === "3DCRT" ? ["DRR", "EPID"] : ["DRR", "CBCT"], hasil: "Lolos, shift dalam toleransi" };
    default:
      return {};
  }
}

export type SeedRecord = {
  patient: Record<string, unknown>;
  events: Record<string, unknown>[];
  fractions: Record<string, unknown>[];
  attendance: Record<string, unknown>[];
};

/** Susun riwayat lengkap tiap pasien dummy relatif terhadap hari ini. */
export function buildDemoPatients(ids: Record<DemoKey, string>, now = Date.now()): SeedRecord[] {
  const today = new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const named = PATIENTS.map((p) => namedSpec(p, today));
  const specs = [...named, ...fillerSpecs(named, today)];
  return specs.map((s, i) => toRecord(s, i, ids, today, now));
}

// ---------------------------------------------------------------------
// Tanggal
// ---------------------------------------------------------------------

/** Hari kerja ke-n dari hari ini (0 = hari kerja ini), negatif = ke belakang */
function workday(today: string, n: number) {
  if (n >= 0) return workingDaysFrom(today, n + 1)[n];
  let d = today;
  for (let i = 0; i < -n; i++) d = prevWorkingDay(d);
  return d;
}

/** n hari kerja setelah tanggal ini */
function plusWorkdays(d: string, n: number) {
  for (let i = 0; i < n; i++) d = nextWorkingDay(d);
  return d;
}

/** n hari kerja sebelum tanggal ini */
function minusWorkdays(d: string, n: number) {
  for (let i = 0; i < n; i++) d = prevWorkingDay(d);
  return d;
}

/** Tanggal CT Sim yang menghasilkan verifikasi di tanggal ini, atau null bila tidak ada */
function ctFor(verif: string) {
  for (let back = 14; back <= 20; back++) {
    const ct = addDays(verif, -back);
    if (isWorkingDay(ct) && tglVerifikasiDari(ct) === verif) return ct;
  }
  return null;
}

/** Tanggal CT Sim & verifikasi untuk verifikasi yang diinginkan (digeser bila perlu) */
function scheduleFor(verif: string) {
  const ct = ctFor(verif);
  if (ct) return { ct, verif };
  const fallback = workingDayFrom(addDays(verif, -14));
  return { ct: fallback, verif: tglVerifikasiDari(fallback) };
}

/** Hari-hari kerja yang ditempati pasien ini mulai hari ini (sama dengan jadwal_sinar di SQL) */
function projectedDays(s: Spec, today: string) {
  if (!s.verif || !BOOKED_STAGES.includes(s.stage)) return [];
  const sisa = s.fraksi - s.fractionDates.length;
  let start: string;
  if (s.stage === "PENYINARAN") {
    const fxToday = s.fractionDates.includes(today);
    start = isWorkingDay(today) && !fxToday && s.hadirToday !== false ? today : nextWorkingDay(today);
  } else {
    start = workingDayFrom(s.verif > today ? s.verif : today);
  }
  return sisa > 0 ? workingDaysFrom(start, sisa) : [];
}

/** Hari-hari fraksi yang sudah diberikan, mundur dari `last`, dengan satu hari absen setelah fraksi ke-n */
function pastFractions(last: string, count: number, absentAfter?: number) {
  const days: string[] = [];
  let d = last;
  const total = count + (absentAfter ? 1 : 0);
  while (days.length < total) {
    days.unshift(d);
    d = prevWorkingDay(d);
  }
  const absentDates = absentAfter ? days.splice(absentAfter, 1) : [];
  return { fractionDates: days, absentDates };
}

// ---------------------------------------------------------------------
// Pasien bernama & pasien pengisi
// ---------------------------------------------------------------------

function namedSpec(p: SeedPatient, today: string): Spec {
  const base: Spec = {
    ...p,
    fractionDates: [],
    absentDates: [],
    ct: null,
    verif: null,
  };
  const done = p.replanAfter ?? p.fractionsDone ?? 0;
  if (done > 0) {
    // Selesai 2 hari kerja lalu; penyinaran (juga yang dikembalikan hari ini untuk replanning) sampai kemarin
    const last = workday(today, p.stage === "SELESAI" ? -3 : -1);
    const { fractionDates, absentDates } = pastFractions(last, done, p.absentAfter);
    const sched = { verif: fractionDates[0], ct: ctFor(fractionDates[0]) ?? minusWorkdays(fractionDates[0], 10) };
    return { ...base, ...sched, fractionDates, absentDates, replan: !!p.replanAfter };
  }
  if (p.verifIn !== undefined) return { ...base, ...scheduleFor(workday(today, p.verifIn)) };
  return base;
}

/** Pembangkit acak dengan seed tetap supaya data demo selalu sama */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pasien pengisi per pesawat: hunian dibuat tepat sama dengan kuota pada rentang FULL.
 * Hari ke-0 diisi pasien yang sedang penyinaran, hari berikutnya diisi pasien yang
 * verifikasinya jatuh di hari itu (tahap CT Sim s.d. Verifikasi, tergantung tanggal CT Sim).
 */
function fillerSpecs(named: Spec[], today: string): Spec[] {
  const rnd = random(20261009);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const course = () => {
    const total = COURSES.reduce((s, [, w]) => s + w, 0);
    let r = rnd() * total;
    for (const [n, w] of COURSES) if ((r -= w) < 0) return n;
    return 25;
  };
  const horizon = Math.max(...Object.values(FULL).flat().map(([, end]) => end));
  const days = workingDaysFrom(today, horizon);
  const indexOf = new Map(days.map((d, k) => [d, k]));

  type Filler = { mesin: string; start: number; len: number; total: number; done: number; verif: string; ct: string };
  const fillers: Filler[] = [];

  for (const mesin of MESIN_EKSTERNAL) {
    const kuota = KUOTA_PESAWAT[mesin];
    const occ = new Array<number>(horizon).fill(0);
    for (const s of named.filter((s) => s.mesin === mesin)) {
      for (const d of projectedDays(s, today)) {
        const k = indexOf.get(d);
        if (k !== undefined) occ[k]++;
      }
    }

    const mine: Filler[] = [];
    for (const [from, to] of FULL[mesin]) {
      for (let k = from; k < to; k++) {
        const active = mine.filter((f) => f.start <= k && k < f.start + f.len);
        let total = occ[k] + active.length;
        // Kelebihan karena pasien bernama: akhiri lebih awal pasien pengisi yang sudah berjalan
        for (const f of active.filter((f) => f.start < k)) {
          if (total <= kuota) break;
          f.len = k - f.start;
          f.total = f.done + f.len;
          total--;
        }
        while (total < kuota) {
          if (k === 0) {
            // Sedang penyinaran: sudah diberikan `done` fraksi sampai kemarin
            const t = course();
            const len = 1 + Math.floor(rnd() * (t - 1));
            mine.push({ mesin, start: 0, len, total: t, done: t - len, verif: "", ct: "" });
          } else {
            const sched = ctFor(days[k]);
            if (!sched) break; // tidak ada tanggal CT Sim yang jatuh tepat di sini, isi di hari berikutnya
            const t = course();
            mine.push({ mesin, start: k, len: t, total: t, done: 0, verif: days[k], ct: sched });
          }
          total++;
        }
      }
    }
    fillers.push(...mine);
  }

  const firstNames = { L: NAMA_L, P: NAMA_P };
  const lastNames = { L: NAMA_BELAKANG_L, P: NAMA_BELAKANG_P };
  return fillers.map((f, i): Spec => {
    const jk = rnd() < 0.5 ? "L" : "P";
    const totalCourse = DOSIS[f.total] ? f.total : null;
    const [diagnosis, area] = pick(DIAGNOSIS[totalCourse ?? 25]);
    const identity: Identity = {
      no_rm: `RM-${String(2001 + i).padStart(6, "0")}`,
      nama: `${pick(firstNames[jk])} ${pick(lastNames[jk])}`,
      tgl_lahir: `${1945 + Math.floor(rnd() * 40)}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`,
      jenis_kelamin: jk,
      diagnosis,
      area,
      dosis: DOSIS[f.total] ?? f.total * 2,
      fraksi: f.total,
      teknik: f.mesin === "Cobalt" || f.total <= 10 ? "3DCRT" : pick(["IMRT", "VMAT"]),
      mesin: f.mesin,
      dpjp: i % 2 ? "dokter2" : "dokter",
    };
    if (f.start === 0) {
      const { fractionDates, absentDates } = pastFractions(prevWorkingDay(today), f.done, rnd() < 0.1 && f.done > 3 ? 2 : undefined);
      const verif = fractionDates[0];
      return {
        ...identity,
        stage: "PENYINARAN",
        fractionDates,
        absentDates,
        verif,
        ct: ctFor(verif) ?? minusWorkdays(verif, 10),
        poliByPerawat: rnd() < 0.2,
      };
    }
    return {
      ...identity,
      stage: pipelineStage(f.ct, today),
      fractionDates: [],
      absentDates: [],
      verif: f.verif,
      ct: f.ct,
      poliByPerawat: rnd() < 0.2,
    };
  });
}

/** Tahap pasien yang sudah dijadwalkan menurut tanggal CT Sim-nya */
function pipelineStage(ct: string, today: string): StageKey {
  if (ct >= today) return "CT_SIM";
  if (plusWorkdays(ct, 3) >= today) return "DELINEASI";
  if (plusWorkdays(ct, 7) >= today) return "PLANNING";
  return "VERIFIKASI";
}

// ---------------------------------------------------------------------
// Baris tabel
// ---------------------------------------------------------------------

function toRecord(p: Spec, i: number, ids: Record<DemoKey, string>, today: string, now: number): SeedRecord {
  // Jam kegiatan dibuat di jam kerja (08.00–14.59 WIB), berurutan di hari yang sama
  let n = 0;
  const at = (date: string) => {
    const hour = 1 + Math.min(6, n);
    const minute = (i * 7 + n++ * 13) % 60;
    return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
  };
  const notAfterToday = (d: string) => (d > today ? today : d);

  const target = STAGE_KEYS.indexOf(p.replan ? "PENYINARAN" : p.stage);
  const scheduled = p.ct !== null;
  // Tanggal ACC tiap tahap: Poli beberapa hari sebelum CT Sim (yang CT Sim-nya masih jauh
  // sudah di-ACC dalam 2 minggu terakhir), Delineasi H+3, Planning H+7, Verifikasi di tanggal verifikasi
  const accDate: Partial<Record<StageKey, string>> = scheduled
    ? {
        POLI: [minusWorkdays(p.ct!, 2 + (i % 4)), workday(today, -(i % 10))].sort()[0],
        CT_SIM: p.ct!,
        DELINEASI: plusWorkdays(p.ct!, 3),
        PLANNING: plusWorkdays(p.ct!, 7),
        VERIFIKASI: p.verif!,
      }
    : {};
  // Kunjungan Poli hanya berlaku hari itu: pasien yang masih di Poli didaftarkan hari ini
  const registered = scheduled ? prevWorkingDay(accDate.POLI!) : p.poliHangus ? prevWorkingDay(today) : today;

  const data: Record<string, unknown> = {};
  const events: Record<string, unknown>[] = [
    { from_stage: "PENDAFTARAN", to_stage: "POLI", action: "create", actor_id: ids.administrasi, actor_role: "administrasi", note: "Pasien didaftarkan dan dikirim ke Poli", created_at: at(registered) },
  ];
  let entered = events[0].created_at as string;

  // Tahap POLI .. VERIFIKASI yang sudah dilewati (PENYINARAN dicatat lewat fraksi)
  const lastManual = Math.min(target, STAGE_KEYS.indexOf("PENYINARAN"));
  for (let s = 1; s < lastManual; s++) {
    const stage = STAGE_KEYS[s];
    // Tahap dokter dikerjakan DPJP pasien, Poli bisa juga oleh perawat
    const owner = stage === "POLI" && p.poliByPerawat ? "perawat" : OWNER[stage]!;
    const actor = owner === "dokter" ? ids[p.dpjp] : ids[owner];
    const ts = at(notAfterToday(accDate[stage]!));
    const payload = payloadFor(stage, p);
    data[stage] = { ...payload, _at: ts, _by: actor };
    events.push({ from_stage: stage, to_stage: STAGE_KEYS[s + 1], action: "advance", actor_id: actor, actor_role: owner, payload, created_at: ts });
    entered = ts;
  }

  // Contoh plan yang dikembalikan RTT dari Verifikasi ke Planning
  if (p.returnedFromVerifikasi) {
    const day = notAfterToday(prevWorkingDay(today));
    const payload = payloadFor("PLANNING", p);
    const planned = at(day);
    data.PLANNING = { ...payload, _at: planned, _by: ids.fismed };
    events.push({ from_stage: "PLANNING", to_stage: "VERIFIKASI", action: "advance", actor_id: ids.fismed, actor_role: "fismed", payload, created_at: planned });
    entered = at(day);
    events.push({ from_stage: "VERIFIKASI", to_stage: "PLANNING", action: "return", actor_id: ids.rtt, actor_role: "rtt", note: "Hasil QA plan di luar toleransi, mohon optimasi ulang", created_at: entered });
  }

  // Setiap fraksi didahului absen hadir oleh administrasi
  const fractions: Record<string, unknown>[] = [];
  const attendance: Record<string, unknown>[] = [];
  for (const [k, tanggal] of p.fractionDates.entries()) {
    n = 0;
    attendance.push({ tanggal, hadir: true, actor_id: ids.administrasi, actor_role: "administrasi", created_at: at(tanggal) });
    fractions.push({ fraksi_ke: k + 1, tanggal, mesin: p.mesin, rtt_id: ids.rtt, created_at: at(tanggal) });
  }
  for (const tanggal of p.absentDates) {
    n = 0;
    attendance.push({ tanggal, hadir: false, catatan: "Pasien demam, tidak datang", actor_id: ids.rtt, actor_role: "rtt", created_at: at(tanggal) });
  }
  if (p.stage === "PENYINARAN" && p.hadirToday !== undefined) {
    attendance.push({
      tanggal: today,
      hadir: p.hadirToday,
      actor_id: ids.administrasi,
      actor_role: "administrasi",
      created_at: new Date(now - 60 * 60_000).toISOString(),
    });
  }
  const lastFraction = p.fractionDates.at(-1);
  if (p.replan && lastFraction) {
    n = 3;
    entered = at(nextWorkingDay(lastFraction));
    events.push({ from_stage: "PENYINARAN", to_stage: p.stage, action: "return", actor_id: ids.rtt, actor_role: "rtt", note: "Tumor tampak membesar pada CBCT, plan perlu dibuat ulang (replanning).", created_at: entered });
  }
  if (p.stage === "SELESAI" && lastFraction) {
    n = 3;
    entered = at(lastFraction);
    events.push({ from_stage: "PENYINARAN", to_stage: "SELESAI", action: "complete", actor_id: ids.rtt, actor_role: "rtt", note: `Penyinaran selesai (${p.fraksi}/${p.fraksi} fraksi)`, created_at: entered });
  }
  const passedPoli = target > STAGE_KEYS.indexOf("POLI");
  return {
    patient: {
      no_rm: p.no_rm,
      nama: p.nama,
      tgl_lahir: p.tgl_lahir,
      jenis_kelamin: p.jenis_kelamin,
      no_hp: `0812${p.no_rm.replace(/\D/g, "").slice(-8)}`,
      diagnosis: p.diagnosis,
      current_stage: p.stage,
      stage_entered_at: entered,
      dosis_total_gy: passedPoli ? p.dosis : null,
      total_fraksi: passedPoli ? p.fraksi : null,
      dpjp_id: ids[p.dpjp],
      // Pesawat & tanggal dipilih di Poli; pasien replanning yang kembali ke Poli tetap menyimpannya
      mesin: passedPoli ? p.mesin : null,
      tgl_ct_sim: passedPoli ? p.ct : null,
      tgl_verifikasi: passedPoli ? p.verif : null,
      data,
      created_by: ids.administrasi,
      created_at: events[0].created_at,
      updated_at: entered,
    },
    events,
    fractions,
    attendance,
  };
}
