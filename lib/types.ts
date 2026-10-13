import type { Akses, Role, StageKey } from "./workflow";

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
};

/** baru: belum melengkapi profil · menunggu: menunggu persetujuan Admin/Master */
export type StatusAkun = "baru" | "menunggu" | "aktif" | "ditolak" | "nonaktif";

/**
 * Pra-daftar oleh Admin/Master: akun langsung aktif saat pemilik email ini masuk pertama kali,
 * atau (pakai_kode) setelah memasukkan kode 6 angka yang berlaku sampai kode_berlaku_sampai.
 */
export type Undangan = {
  email: string;
  full_name: string;
  role: Role;
  akses: Akses;
  dibuat_at: string;
  dibuat_oleh_nama: string | null;
  pakai_kode: boolean;
  kode_berlaku_sampai: string | null;
  /** Sisa waktu kode menurut jam server saat halaman dibuat (lib/data.ts), 0 bila habis */
  kode_sisa_detik: number;
};

/** Kode undangan yang baru dibuat. Hanya terlihat sekali; database menyimpan hash-nya. */
export type KodeUndangan = { kode: string; berlaku_sampai: string; berlaku_detik: number };

/** Hasil per baris dari undang_akun (dengan kode bila mendaftarkan satu akun) */
export type HasilUndangan = { email: string; ok: boolean; hasil: string } & Partial<KodeUndangan>;

/** User aktif yang sedang login: role kerja + hak akses pengelolaan akun */
export type CurrentUser = Profile & { email: string; akses: Akses };

/** Akun beserta status persetujuannya (halaman Akun milik Admin/Master) */
export type Akun = {
  id: string;
  full_name: string;
  email: string | null;
  role: Role | null;
  akses: Akses;
  status: StatusAkun;
  created_at: string;
  diproses_at: string | null;
  /** Hanya akun belum pernah aktif (baru, menunggu, ditolak): akun Google dengan email terverifikasi */
  terverifikasi?: boolean;
};

export type Patient = {
  id: string;
  no_rm: string;
  nama: string;
  tgl_lahir: string;
  jenis_kelamin: "L" | "P";
  no_hp: string | null;
  diagnosis: string;
  current_stage: StageKey;
  stage_entered_at: string;
  dosis_total_gy: number | null;
  total_fraksi: number | null;
  dpjp_id: string | null;
  dpjp: { full_name: string } | null;
  mesin: string | null;
  /** Pasien CITO (dipilih di Poli): kuota pesawat & CT Sim sendiri, verifikasi di hari CT Sim */
  cito: boolean;
  /** Rencana CT Sim (dipilih di Poli) */
  tgl_ct_sim: string | null;
  /** Rencana verifikasi = fraksi 1 (CT Sim + 14 hari, digeser ke hari kerja; CITO di hari CT Sim) */
  tgl_verifikasi: string | null;
  data: Partial<Record<StageKey, Record<string, unknown>>>;
  created_at: string;
  updated_at: string;
};

export type StageEvent = {
  id: number;
  from_stage: StageKey | null;
  to_stage: StageKey;
  action: "create" | "advance" | "return" | "complete";
  actor_role: Role | null;
  note: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string } | null;
};

export type Fraction = {
  id: number;
  fraksi_ke: number;
  tanggal: string;
  mesin: string | null;
  catatan: string | null;
  created_at: string;
  rtt: { full_name: string } | null;
};

/** Satu pencatatan kehadiran (baris terbaru per hari = status yang berlaku) */
export type AttendanceEntry = {
  id: number;
  patient_id: string;
  hadir: boolean;
  catatan: string | null;
  actor_role: Role | null;
  created_at: string;
  actor: { full_name: string } | null;
};

export type ActionState = { error?: string; success?: string } | undefined;
