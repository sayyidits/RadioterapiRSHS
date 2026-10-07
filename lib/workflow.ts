// Definisi alur radioterapi. Urutan tahap, penanggung jawab, dan tujuan
// "Kembalikan" harus sama dengan fungsi stage_owner / can_return di
// supabase/migrations/0001_init.sql.

export const ROLES = {
  dokter: "Dokter Sp.Onk.Rad",
  perawat: "Perawat",
  rtt: "RTT",
  fismed: "Fisikawan Medis",
  administrasi: "Administrasi",
} as const;

export type Role = keyof typeof ROLES;

export const ROLE_SHORT: Record<Role, string> = {
  dokter: "Dokter",
  perawat: "Perawat",
  rtt: "RTT",
  fismed: "Fismed",
  administrasi: "Administrasi",
};

export const STAGE_KEYS = [
  "PENDAFTARAN",
  "POLI",
  "CT_SIM",
  "DELINEASI",
  "PLANNING",
  "ACC_PLAN",
  "VERIFIKASI",
  "PENYINARAN",
  "SELESAI",
] as const;

export type StageKey = (typeof STAGE_KEYS)[number];

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "textarea" | "date" | "number" | "select" | "checkboxes";
  required?: boolean;
  options?: string[];
  placeholder?: string;
  step?: string;
  /** Nilai awal diambil dari kolom tabel patients (bukan dari data tahap) */
  column?: "no_rm" | "nama" | "tgl_lahir" | "jenis_kelamin" | "no_hp" | "diagnosis" | "dosis_total_gy" | "total_fraksi";
};

export type StageDef = {
  key: StageKey;
  label: string;
  short: string;
  owner: Role | null;
  description: string;
  actionLabel?: string;
  fields: FieldDef[];
  returnTargets: StageKey[];
};

export const JENIS_KELAMIN: Record<string, string> = { L: "Laki-laki", P: "Perempuan" };

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
    description: "Pemeriksaan dan penetapan indikasi radioterapi oleh dokter.",
    actionLabel: "ACC, kirim ke CT Simulator",
    fields: [
      { name: "diagnosis_kerja", label: "Diagnosis kerja", type: "textarea", required: true },
      { name: "stadium", label: "Stadium", type: "text", placeholder: "mis. T2N1M0 / IIB" },
      { name: "intent", label: "Tujuan terapi", type: "select", required: true, options: ["Kuratif", "Paliatif", "Adjuvan", "Neoadjuvan"] },
      { name: "area_radiasi", label: "Area radiasi", type: "text", required: true, placeholder: "mis. Serviks + KGB pelvis" },
      { name: "catatan", label: "Catatan", type: "textarea" },
    ],
    returnTargets: ["PENDAFTARAN"],
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
    returnTargets: ["POLI"],
  },
  {
    key: "DELINEASI",
    label: "Delineasi",
    short: "Delineasi",
    owner: "dokter",
    description: "Dokter membuat kontur target & OAR serta menetapkan preskripsi dosis.",
    actionLabel: "Selesai, kirim ke Planning",
    fields: [
      { name: "dosis_total_gy", label: "Dosis total (Gy)", type: "number", required: true, step: "0.01", column: "dosis_total_gy" },
      { name: "total_fraksi", label: "Jumlah fraksi", type: "number", required: true, step: "1", column: "total_fraksi" },
      { name: "catatan_kontur", label: "Catatan kontur", type: "textarea" },
    ],
    returnTargets: ["CT_SIM"],
  },
  {
    key: "PLANNING",
    label: "Planning",
    short: "Planning",
    owner: "fismed",
    description: "Fisikawan medis menyusun rencana penyinaran di TPS.",
    actionLabel: "Kirim ke dokter untuk ACC",
    fields: [
      { name: "teknik", label: "Teknik", type: "select", required: true, options: ["3DCRT", "IMRT", "VMAT"] },
      { name: "tps", label: "TPS / nama plan", type: "text" },
      { name: "catatan", label: "Catatan plan", type: "textarea" },
    ],
    returnTargets: ["DELINEASI"],
  },
  {
    key: "ACC_PLAN",
    label: "ACC Planning",
    short: "ACC Plan",
    owner: "dokter",
    description: "Dokter meninjau dan menyetujui rencana penyinaran.",
    actionLabel: "ACC plan, kirim ke Verifikasi",
    fields: [
      { name: "dosis_total_gy", label: "Dosis total (Gy)", type: "number", required: true, step: "0.01", column: "dosis_total_gy" },
      { name: "total_fraksi", label: "Jumlah fraksi", type: "number", required: true, step: "1", column: "total_fraksi" },
      { name: "catatan", label: "Catatan persetujuan", type: "textarea" },
    ],
    returnTargets: ["PLANNING"],
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
      { name: "mesin", label: "Mesin", type: "text", required: true, placeholder: "mis. LINAC 1" },
      { name: "metode", label: "Metode verifikasi", type: "checkboxes", required: true, options: ["DRR", "CBCT", "EPID", "QA"] },
      { name: "hasil", label: "Hasil / catatan", type: "textarea" },
    ],
    returnTargets: ["PLANNING", "CT_SIM"],
  },
  {
    key: "PENYINARAN",
    label: "Penyinaran",
    short: "Sinar",
    owner: "rtt",
    description: "RTT mencatat setiap fraksi penyinaran hingga selesai.",
    fields: [],
    returnTargets: [],
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

/** Tahap yang perlu ditindaklanjuti oleh role ini */
export function stagesOwnedBy(role: Role): StageKey[] {
  return STAGES.filter((s) => s.owner === role).map((s) => s.key);
}

export const STAGE_COLORS: Record<StageKey, string> = {
  PENDAFTARAN: "bg-slate-100 text-slate-700 ring-slate-300",
  POLI: "bg-sky-50 text-sky-700 ring-sky-200",
  CT_SIM: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  DELINEASI: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  PLANNING: "bg-violet-50 text-violet-700 ring-violet-200",
  ACC_PLAN: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
  VERIFIKASI: "bg-amber-50 text-amber-800 ring-amber-200",
  PENYINARAN: "bg-orange-50 text-orange-700 ring-orange-200",
  SELESAI: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};
