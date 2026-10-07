import "server-only";
import { asUser, selectJson } from "./demo/db";
import { IS_DEMO } from "./mode";
import { demoUserId } from "./rpc";
import { createClient } from "./supabase/server";
import type { Fraction, Patient, StageEvent } from "./types";
import type { StageKey } from "./workflow";

const PATIENT_COLUMNS =
  "id, no_rm, nama, tgl_lahir, jenis_kelamin, no_hp, diagnosis, current_stage, stage_entered_at, dosis_total_gy, total_fraksi, data, created_at, updated_at";

/** Jalankan query mode demo sebagai user dari cookie. */
async function demo<T>(fn: Parameters<typeof asUser<T>>[1]) {
  const uid = await demoUserId();
  if (!uid) throw new Error("Belum memilih role demo");
  return asUser(uid, fn);
}

export async function listPatients(opts: { q?: string; stage?: StageKey } = {}) {
  const q = opts.q?.replace(/[%,()]/g, " ").trim();

  if (IS_DEMO) {
    return demo((tx) =>
      selectJson<Patient>(
        tx,
        `select ${PATIENT_COLUMNS} from public.patients
         where ($1::public.stage is null or current_stage = $1::public.stage)
           and ($2::text is null or nama ilike '%' || $2 || '%' or no_rm ilike '%' || $2 || '%')
         order by stage_entered_at`,
        [opts.stage ?? null, q || null],
      ),
    );
  }

  const supabase = await createClient();
  let query = supabase.from("patients").select(PATIENT_COLUMNS).order("stage_entered_at", { ascending: true });
  if (opts.stage) query = query.eq("current_stage", opts.stage);
  if (q) query = query.or(`nama.ilike.%${q}%,no_rm.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Patient[];
}

export async function getPatient(id: string) {
  if (IS_DEMO) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return demo(async (tx) => {
      const [patient] = await selectJson<Patient>(tx, `select ${PATIENT_COLUMNS} from public.patients where id = $1`, [id]);
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
    patient: patient.data as Patient,
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
  const { data } = await supabase.from("patients").select("current_stage").eq("id", id).maybeSingle();
  return (data?.current_stage as StageKey) ?? null;
}

/** Jumlah fraksi yang sudah tercatat untuk banyak pasien sekaligus. */
export async function fractionCounts(patientIds: string[]) {
  const counts: Record<string, number> = {};
  if (patientIds.length === 0) return counts;

  if (IS_DEMO) {
    const rows = await demo((tx) =>
      selectJson<{ patient_id: string; n: number }>(
        tx,
        "select patient_id, count(*)::int as n from public.fractions where patient_id = any($1::uuid[]) group by patient_id",
        [patientIds],
      ),
    );
    for (const r of rows) counts[r.patient_id] = r.n;
    return counts;
  }

  const supabase = await createClient();
  const { data } = await supabase.from("fractions").select("patient_id").in("patient_id", patientIds);
  for (const row of data ?? []) counts[row.patient_id] = (counts[row.patient_id] ?? 0) + 1;
  return counts;
}
