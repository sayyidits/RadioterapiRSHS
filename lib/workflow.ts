// Definisi alur radioterapi. Urutan tahap, penanggung jawab, dan tujuan
// "Kembalikan" harus sama dengan fungsi stage_owner / can_return / can_act di
// supabase/migrations (0001_init.sql, 0002_dpjp_mesin_absensi.sql, 0003_alur_ringkas.sql,
// 0004_jadwal_kuota.sql).
import { dateWIB, todayISO } from "./format";
import { nextWorkingDay, workingDayFrom } from "./holidays";

export const ROLES = {
  dokter: "Dokter Sp.Onk.Rad",
  perawat: "Perawat",
  rtt: "RTT",
  fismed: "Fisikawan Medis",
  administrasi: "Administrasi",
} as const;

export type Role = keyof typeof ROLES;

export const ROLE_LIST = Object.keys(ROLES) as Role[];

export const ROLE_SHORT: Record<Role, string> = {
  dokter: "Dokter",
  perawat: "Perawat",
  rtt: "RTT",
  fismed: "Fismed",
  administrasi: "Administrasi",
};

/**
 * Hak akses pengelolaan akun, terpisah dari role kerja (sama dengan akses_akun di
 * 0009_hak_akses.sql). Nakes: tidak mengelola akun. Admin: mengelola akun Nakes.
 * Master: mengelola semua akun, termasuk memberi hak Admin/Master.
 */
export const AKSES = { nakes: "Nakes", admin: "Admin", master: "Master" } as const;

export type Akses = keyof typeof AKSES;

const AKSES_RANK: Record<Akses, number> = { nakes: 0, admin: 1, master: 2 };

/** Boleh mengelola akun (halaman Akun) */
export function kelolaAkun(akses: Akses) {
  return akses !== "nakes";
}

/**
 * Apa yang boleh dilakukan `saya` pada akun `target` (sama dengan atur_akun di SQL).
 * Akun sendiri: hanya role kerja. Admin: hanya akun Nakes, tanpa memberi hak akses.
 */
export function hakAtas(saya: { id: string; akses: Akses }, target: { id: string; akses: Akses }) {
  const sendiri = saya.id === target.id;
  if (!kelolaAkun(saya.akses)) return { kelola: false, aksesBisaDiubah: false, sendiri };
  if (sendiri) return { kelola: true, aksesBisaDiubah: false, sendiri };
  return {
    kelola: saya.akses === "master" || AKSES_RANK[target.akses] < AKSES_RANK[saya.akses],
    aksesBisaDiubah: saya.akses === "master",
    sendiri,
  };
}

export const STAGE_KEYS = [
  "PENDAFTARAN",
  "POLI",
  "CT_SIM",
  "DELINEASI",
  "PLANNING",
  "VERIFIKASI",
  "PENYINARAN",
  "SELESAI",
] as const;

export type StageKey = (typeof STAGE_KEYS)[number];

export type FieldDef = {
  name: string;
  label: string;
  /** "ctsim": pemilih tanggal CT Sim berdasarkan kuota pesawat (lib/booking.ts) */
  type: "text" | "textarea" | "date" | "number" | "select" | "checkboxes" | "ctsim";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  step?: string;
  /** Nilai awal diambil dari kolom tabel patients (bukan dari data tahap) */
  column?: "no_rm" | "nama" | "tgl_lahir" | "jenis_kelamin" | "no_hp" | "diagnosis" | "dosis_total_gy" | "total_fraksi" | "mesin";
};

export type StageDef = {
  key: StageKey;
  label: string;
  short: string;
  owner: Role | null;
  /** Role lain yang juga boleh ACC / mengembalikan di tahap ini */
  alsoBy?: Role[];
  description: string;
  actionLabel?: string;
  fields: FieldDef[];
  returnTargets: StageKey[];
};

export const JENIS_KELAMIN: Record<string, string> = { L: "Laki-laki", P: "Perempuan" };

/** Mesin radioterapi (harus sama dengan is_valid_mesin di 0002_dpjp_mesin_absensi.sql) */
export const MESIN = ["Synergy", "Precise", "Cobalt", "Brakiterapi"];

/** Pesawat radiasi eksternal yang tampil di Info Pesawat */
export const MESIN_EKSTERNAL = ["Synergy", "Precise", "Cobalt"];

/**
 * Kuota pasien per hari per pesawat (sama dengan kuota_pesawat() di 0004_jadwal_kuota.sql).
 * Mutlak saat memilih tanggal CT Sim di Poli. Brakiterapi tanpa kuota.
 */
export const KUOTA_PESAWAT: Record<string, number> = { Synergy: 65, Precise: 65, Cobalt: 30 };

/**
 * Kuota pasien CT Simulator per hari, untuk semua pesawat (sama dengan kuota_ct_sim() di
 * 0006_kuota_ct_sim.sql). Mutlak saat memilih tanggal CT Sim di Poli.
 */
export const KUOTA_CT_SIM = 7;

export function kuotaOf(mesin: string | null | undefined): number | null {
  return (mesin && KUOTA_PESAWAT[mesin]) || null;
}

/** Verifikasi = CT Sim + 14 hari kalender, digeser ke hari kerja; fraksi 1 di hari yang sama. */
export const JEDA_CT_VERIFIKASI = 14;

const MESIN_FIELD: FieldDef = { name: "mesin", label: "Mesin", type: "select", required: true, options: MESIN, column: "mesin" };

export const PATIENT_IDENTITY_FIELDS: FieldDef[] = [
  { name: "no_rm", label: "No. Rekam Medis", type: "text", required: true, column: "no_rm" },
  { name: "nama", label: "Nama pasien", type: "text", required: true, column: "nama" },
  { name: "tgl_lahir", label: "Tanggal lahir", type: "date", required: true, column: "tgl_lahir" },
  { name: "jenis_kelamin", label: "Jenis kelamin", type: "select", required: true, options: ["L", "P"], column: "jenis_kelamin" },
  { name: "no_hp", label: "No. HP", type: "text", column: "no_hp", placeholder: "08xxxxxxxxxx" },
  { name: "diagnosis", label: "Diagnosis rujukan", type: "textarea", required: true, column: "diagnosis" },
];

export const STAGES: StageDef[] = [
  {
    key: "PENDAFTARAN",
    label: "Pendaftaran",
    short: "Daftar",
    owner: "administrasi",
    description: "Administrasi mendaftarkan pasien dan mengirim ke Poli.",
    actionLabel: "Kirim ke Poli",
    fields: PATIENT_IDENTITY_FIELDS,
    returnTargets: [],
  },
  {
    key: "POLI",
    label: "Poli Radioterapi",
    short: "Poli",
    owner: "dokter",
    alsoBy: ["perawat"],
    description:
      "Pemeriksaan, penetapan indikasi, preskripsi dosis, dan jadwal CT Sim sesuai kuota pesawat oleh dokter, dapat diisi bersama perawat.",
    actionLabel: "ACC, kirim ke CT Simulator",
    fields: [
      { name: "diagnosis_kerja", label: "Diagnosis kerja", type: "textarea", required: true },
      { name: "stadium", label: "Stadium", type: "text", placeholder: "mis. T2N1M0 / IIB" },
      { name: "intent", label: "Tujuan terapi", type: "select", required: true, options: ["Kuratif", "Paliatif", "Adjuvan", "Neoadjuvan"] },
      { name: "area_radiasi", label: "Area radiasi", type: "text", required: true, placeholder: "mis. Serviks + KGB pelvis" },
      { name: "dosis_total_gy", label: "Dosis total (Gy)", type: "number", required: true, step: "0.01", column: "dosis_total_gy" },
      { name: "total_fraksi", label: "Jumlah fraksi", type: "number", required: true, step: "1", column: "total_fraksi" },
      { ...MESIN_FIELD, label: "Rencana pesawat" },
      { name: "tgl_ct_sim", label: "Tanggal CT Sim", type: "ctsim", required: true },
      { name: "catatan", label: "Catatan", type: "textarea" },
    ],
    returnTargets: [],
  },
  {
    key: "CT_SIM",
    label: "CT Simulator",
    short: "CT Sim",
    owner: "rtt",
    description: "RTT melakukan CT simulasi dan mencatat posisi & imobilisasi.",
    actionLabel: "Selesai, kirim ke Delineasi",
    fields: [
      { name: "tanggal_ct", label: "Tanggal CT simulasi", type: "date", required: true },
      { name: "posisi", label: "Posisi pasien", type: "select", required: true, options: ["Supine", "Prone", "Lainnya"] },
      { name: "imobilisasi", label: "Alat imobilisasi", type: "text", placeholder: "mis. Thermoplastic mask, vacloc" },
      { name: "catatan", label: "Catatan", type: "textarea" },
    ],
    // Poli sudah pasti selesai saat pasien di CT Sim, jadi tidak ada Kembalikan
    returnTargets: [],
  },
  {
    key: "DELINEASI",
    label: "Delineasi",
    short: "Delineasi",
    owner: "dokter",
    description: "Dokter membuat kontur target & OAR.",
    actionLabel: "Selesai, kirim ke Planning",
    fields: [{ name: "catatan_kontur", label: "Catatan kontur", type: "textarea" }],
    returnTargets: ["CT_SIM"],
  },
  {
    key: "PLANNING",
    label: "Planning",
    short: "Planning",
    owner: "fismed",
    description: "Fisikawan medis menyusun dan meng-ACC rencana penyinaran (sudah didiskusikan dengan dokter).",
    actionLabel: "ACC plan, kirim ke Verifikasi",
    fields: [
      { name: "teknik", label: "Teknik", type: "select", required: true, options: ["3DCRT", "IMRT", "VMAT"] },
      MESIN_FIELD,
      { name: "tps", label: "TPS / nama plan", type: "text" },
      { name: "catatan", label: "Catatan plan", type: "textarea" },
    ],
    returnTargets: ["DELINEASI", "CT_SIM"],
  },
  {
    key: "VERIFIKASI",
    label: "Verifikasi",
    short: "Verifikasi",
    owner: "rtt",
    description: "RTT memverifikasi plan dan posisi pasien di mesin radioterapi.",
    actionLabel: "Lolos verifikasi, mulai penyinaran",
    fields: [
      { name: "tanggal_verifikasi", label: "Tanggal verifikasi", type: "date", required: true },
      { name: "metode", label: "Metode verifikasi", type: "checkboxes", required: true, options: ["DRR", "CBCT", "EPID", "QA"] },
      { name: "hasil", label: "Hasil / catatan", type: "textarea" },
    ],
    returnTargets: ["PLANNING", "DELINEASI", "CT_SIM"],
  },
  {
    key: "PENYINARAN",
    label: "Penyinaran",
    short: "Sinar",
    owner: "rtt",
    description: "RTT mencatat setiap fraksi penyinaran hingga selesai.",
    fields: [],
    // Replanning di tengah penyinaran (mis. tumor membesar), paling jauh CT ulang
    returnTargets: ["VERIFIKASI", "PLANNING", "DELINEASI", "CT_SIM"],
  },
  {
    key: "SELESAI",
    label: "Selesai",
    short: "Selesai",
    owner: null,
    description: "Seluruh fraksi penyinaran telah diberikan.",
    fields: [],
    returnTargets: [],
  },
];

export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<StageKey, StageDef>;

export function stageIndex(key: StageKey) {
  return STAGE_KEYS.indexOf(key);
}

export function isStageKey(value: unknown): value is StageKey {
  return typeof value === "string" && (STAGE_KEYS as readonly string[]).includes(value);
}

/** Role yang boleh ACC / mengembalikan di tahap ini */
export function stageActors(key: StageKey): Role[] {
  const s = STAGE_MAP[key];
  return s.owner ? [s.owner, ...(s.alsoBy ?? [])] : [];
}

/** "Dokter / Perawat", "RTT", atau "-" */
export function actorsLabel(key: StageKey) {
  const actors = stageActors(key);
  return actors.length ? actors.map((r) => ROLE_SHORT[r]).join(" / ") : "-";
}

/** Tahap yang perlu ditindaklanjuti oleh role ini */
export function stagesOwnedBy(role: Role): StageKey[] {
  return STAGE_KEYS.filter((k) => stageActors(k).includes(role));
}

/**
 * Apakah user ini boleh menindaklanjuti pasien di tahapnya sekarang.
 * Tahap dokter hanya untuk DPJP pasien (sama dengan can_act di SQL).
 */
export function canActOn(
  patient: { current_stage: StageKey; dpjp_id: string | null; stage_entered_at: string },
  user: { id: string; role: Role },
) {
  if (!stageActors(patient.current_stage).includes(user.role)) return false;
  if (poliHangus(patient, todayISO())) return false;
  if (user.role === "dokter") return patient.dpjp_id === null || patient.dpjp_id === user.id;
  return true;
}

/**
 * Kunjungan Poli hanya berlaku di hari pasien masuk Poli (didaftarkan, didaftarkan ulang, atau
 * dikembalikan ke Poli). Lewat hari itu tanpa ACC = hangus, dan administrasi harus mendaftarkan
 * ulang saat pasien datang lagi. Sama dengan poli_hangus() di 0004_jadwal_kuota.sql.
 */
export function poliHangus(patient: { current_stage: StageKey; stage_entered_at: string }, today: string) {
  return patient.current_stage === "POLI" && dateWIB(patient.stage_entered_at) < today;
}

/**
 * Due date tahap saat ini (YYYY-MM-DD) untuk urutan prioritas "Tugas saya".
 * CT Sim: tanggal CT Sim. Delineasi, Planning, Verifikasi: tanggal verifikasi (H+14).
 * Penyinaran: hari kerja ini (atau berikutnya bila fraksi hari ini sudah dicatat). Poli: belum dijadwalkan (null).
 * Pasien yang dikembalikan setelah tanggal rencananya lewat (replanning, CT ulang) jatuh tempo
 * di hari ia dikembalikan, bukan di tanggal lama.
 */
export function dueDate(
  patient: { current_stage: StageKey; stage_entered_at: string; tgl_ct_sim: string | null; tgl_verifikasi: string | null },
  today: string,
  fractionToday = false,
): string | null {
  const notBeforeEntered = (d: string | null) => {
    const entered = dateWIB(patient.stage_entered_at);
    return d && d < entered ? entered : d;
  };
  switch (patient.current_stage) {
    case "CT_SIM":
      return notBeforeEntered(patient.tgl_ct_sim);
    case "DELINEASI":
    case "PLANNING":
    case "VERIFIKASI":
      return notBeforeEntered(patient.tgl_verifikasi);
    case "PENYINARAN":
      return fractionToday ? nextWorkingDay(today) : workingDayFrom(today);
    default:
      return null;
  }
}

export const STAGE_COLORS: Record<StageKey, string> = {
  PENDAFTARAN: "bg-slate-100 text-slate-700 ring-slate-300",
  POLI: "bg-sky-50 text-sky-700 ring-sky-200",
  CT_SIM: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  DELINEASI: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  PLANNING: "bg-violet-50 text-violet-700 ring-violet-200",
  VERIFIKASI: "bg-amber-50 text-amber-800 ring-amber-200",
  PENYINARAN: "bg-orange-50 text-orange-700 ring-orange-200",
  SELESAI: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};
