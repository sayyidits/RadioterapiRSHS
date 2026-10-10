import type { Role, StageKey } from "./workflow";

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
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
  /** Rencana CT Sim (dipilih di Poli) */
  tgl_ct_sim: string | null;
  /** Rencana verifikasi = fraksi 1 (CT Sim + 14 hari, digeser ke hari kerja) */
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
