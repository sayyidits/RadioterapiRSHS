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

export type ActionState = { error?: string; success?: string } | undefined;
