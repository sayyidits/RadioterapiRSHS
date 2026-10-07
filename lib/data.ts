import "server-only";
import { createClient } from "./supabase/server";
import type { Fraction, Patient, StageEvent } from "./types";
import type { StageKey } from "./workflow";

const PATIENT_COLUMNS =
  "id, no_rm, nama, tgl_lahir, jenis_kelamin, no_hp, diagnosis, current_stage, stage_entered_at, dosis_total_gy, total_fraksi, data, created_at, updated_at";

export async function listPatients(opts: { q?: string; stage?: StageKey } = {}) {
  const supabase = await createClient();
  let query = supabase.from("patients").select(PATIENT_COLUMNS).order("stage_entered_at", { ascending: true });
  if (opts.stage) query = query.eq("current_stage", opts.stage);
  if (opts.q) {
    const q = opts.q.replace(/[%,()]/g, " ").trim();
    if (q) query = query.or(`nama.ilike.%${q}%,no_rm.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Patient[];
}

export async function getPatient(id: string) {
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
    patient: patient.data as Patient,
    events: (events.data ?? []) as unknown as StageEvent[],
    fractions: (fractions.data ?? []) as unknown as Fraction[],
  };
}

/** Jumlah fraksi yang sudah tercatat untuk banyak pasien sekaligus. */
export async function fractionCounts(patientIds: string[]) {
  if (patientIds.length === 0) return {} as Record<string, number>;
  const supabase = await createClient();
  const { data } = await supabase.from("fractions").select("patient_id").in("patient_id", patientIds);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.patient_id] = (counts[row.patient_id] ?? 0) + 1;
  return counts;
}
