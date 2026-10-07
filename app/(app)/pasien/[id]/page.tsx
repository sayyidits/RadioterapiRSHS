import Link from "next/link";
import { notFound } from "next/navigation";
import { StageBadge } from "@/components/badges";
import { EventTimeline } from "@/components/event-timeline";
import { FractionForm } from "@/components/fraction-form";
import { StageActionPanel } from "@/components/stage-action-panel";
import { StageStepper } from "@/components/stage-stepper";
import { getCurrentUser } from "@/lib/auth";
import { getPatient } from "@/lib/data";
import { age, formatDate, formatDateTime, todayISO } from "@/lib/format";
import type { Fraction, Patient } from "@/lib/types";
import { JENIS_KELAMIN, ROLES, STAGES, STAGE_MAP, type FieldDef, type StageKey } from "@/lib/workflow";

export default async function PatientPage({ params }: PageProps<"/pasien/[id]">) {
  const { id } = await params;
  const [user, result] = await Promise.all([getCurrentUser(), getPatient(id)]);
  if (!result) notFound();

  const { patient, events, fractions } = result;
  const stage = STAGE_MAP[patient.current_stage];
  const isOwner = stage.owner === user.role;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/pasien" className="text-sm text-slate-500 hover:text-teal-700">
          ← Daftar pasien
        </Link>
      </div>

      <PatientHeader patient={patient} fractionsDone={fractions.length} />

      <section className="card overflow-x-auto p-5">
        <StageStepper current={patient.current_stage} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {patient.current_stage !== "SELESAI" && (
            <section className="card p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">Tahap saat ini: {stage.label}</h2>
                  <p className="text-sm text-slate-500">{stage.description}</p>
                </div>
                <span className="text-xs text-slate-500">Di tahap ini sejak {formatDateTime(patient.stage_entered_at)}</span>
              </div>

              {patient.current_stage === "PENYINARAN" ? (
                <FractionSection patient={patient} fractions={fractions} canRecord={user.role === "rtt"} />
              ) : isOwner ? (
                <StageActionPanel
                  patientId={patient.id}
                  stage={patient.current_stage}
                  defaults={fieldDefaults(patient, patient.current_stage)}
                />
              ) : (
                <WaitingNotice role={stage.owner ? ROLES[stage.owner] : "-"} />
              )}
            </section>
          )}

          {patient.current_stage === "SELESAI" && (
            <section className="card border-emerald-200 bg-emerald-50 p-5">
              <h2 className="font-semibold text-emerald-800">Penyinaran selesai</h2>
              <p className="text-sm text-emerald-700">
                {fractions.length} dari {patient.total_fraksi} fraksi telah diberikan. Selesai pada{" "}
                {formatDateTime(patient.stage_entered_at)}.
              </p>
            </section>
          )}

          {patient.current_stage === "SELESAI" && fractions.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Catatan fraksi</h2>
              <FractionTable fractions={fractions} />
            </section>
          )}

          <StageSummary patient={patient} />
        </div>

        <aside className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">Riwayat</h2>
          <EventTimeline events={events} />
        </aside>
      </div>
    </div>
  );
}

function PatientHeader({ patient, fractionsDone }: { patient: Patient; fractionsDone: number }) {
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-slate-500">RM {patient.no_rm}</p>
          <h1 className="text-xl font-semibold">{patient.nama}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {JENIS_KELAMIN[patient.jenis_kelamin]} · {age(patient.tgl_lahir)} tahun ({formatDate(patient.tgl_lahir)})
            {patient.no_hp && <> · {patient.no_hp}</>}
          </p>
          <p className="mt-1 text-sm text-slate-600">{patient.diagnosis}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StageBadge stage={patient.current_stage} className="text-sm" />
          {patient.total_fraksi && (
            <p className="text-sm text-slate-600">
              {patient.dosis_total_gy} Gy / {patient.total_fraksi} fraksi
              <span className="text-slate-400">
                {" "}
                ({(Number(patient.dosis_total_gy) / patient.total_fraksi).toFixed(2)} Gy/fx)
              </span>
            </p>
          )}
        </div>
      </div>
      {patient.total_fraksi && ["PENYINARAN", "SELESAI"].includes(patient.current_stage) && (
        <FractionProgress done={fractionsDone} total={patient.total_fraksi} />
      )}
    </section>
  );
}

function FractionProgress({ done, total }: { done: number; total: number }) {
  const pct = Math.round((done / total) * 100);
  return (
    <div className="mt-4">
      <div className="mb-1 flex justify-between text-xs text-slate-600">
        <span>Progress penyinaran</span>
        <span className="font-medium">
          {done}/{total} fraksi ({pct}%)
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FractionSection({
  patient,
  fractions,
  canRecord,
}: {
  patient: Patient;
  fractions: Fraction[];
  canRecord: boolean;
}) {
  const total = patient.total_fraksi ?? 0;
  const defaultMesin = String(patient.data.VERIFIKASI?.mesin ?? "");
  return (
    <div className="space-y-5">
      {canRecord ? (
        <FractionForm
          patientId={patient.id}
          nextFraction={fractions.length + 1}
          total={total}
          defaultMesin={defaultMesin}
          today={todayISO()}
        />
      ) : (
        <WaitingNotice role={ROLES.rtt} text="Fraksi penyinaran dicatat oleh RTT." />
      )}
      {fractions.length > 0 && <FractionTable fractions={fractions} />}
    </div>
  );
}

function FractionTable({ fractions }: { fractions: Fraction[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2 pr-3 font-medium">Fx</th>
            <th className="py-2 pr-3 font-medium">Tanggal</th>
            <th className="py-2 pr-3 font-medium">Mesin</th>
            <th className="py-2 pr-3 font-medium">RTT</th>
            <th className="py-2 font-medium">Catatan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {[...fractions].reverse().map((f) => (
            <tr key={f.id}>
              <td className="py-2 pr-3 font-medium">{f.fraksi_ke}</td>
              <td className="whitespace-nowrap py-2 pr-3">{formatDate(f.tanggal)}</td>
              <td className="py-2 pr-3">{f.mesin ?? "-"}</td>
              <td className="py-2 pr-3">{f.rtt?.full_name ?? "-"}</td>
              <td className="py-2 text-slate-600">{f.catatan ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WaitingNotice({ role, text }: { role: string; text?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
      <p>
        Menunggu tindakan <b>{role}</b>. {text ?? "Anda hanya dapat melihat tahap ini."}
      </p>
    </div>
  );
}

/** Ringkasan data yang sudah diisi pada tiap tahap yang pernah dilewati */
function StageSummary({ patient }: { patient: Patient }) {
  const filled = STAGES.filter((s) => s.key !== "PENDAFTARAN" && patient.data[s.key] && s.fields.length > 0);
  if (filled.length === 0) return null;

  return (
    <section className="card divide-y divide-slate-100">
      <h2 className="px-5 py-4 font-semibold">Data per tahap</h2>
      {filled.map((s) => {
        const d = patient.data[s.key]!;
        return (
          <div key={s.key} className="px-5 py-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">{s.label}</h3>
              {typeof d._at === "string" && <span className="text-xs text-slate-500">{formatDateTime(d._at)}</span>}
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {s.fields
                .filter((f) => d[f.name] != null && d[f.name] !== "")
                .map((f) => (
                  <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                    <dt className="text-xs text-slate-500">{f.label}</dt>
                    <dd className="whitespace-pre-line">{displayValue(f, d[f.name])}</dd>
                  </div>
                ))}
            </dl>
          </div>
        );
      })}
    </section>
  );
}

function displayValue(f: FieldDef, value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (f.type === "date") return formatDate(String(value));
  return String(value);
}

function fieldDefaults(patient: Patient, stage: StageKey) {
  const saved = patient.data[stage] ?? {};
  const defaults: Record<string, unknown> = {};
  for (const f of STAGE_MAP[stage].fields) {
    defaults[f.name] = f.column ? patient[f.column] : saved[f.name];
  }
  if (stage === "CT_SIM" && !defaults.tanggal_ct) defaults.tanggal_ct = todayISO();
  if (stage === "VERIFIKASI" && !defaults.tanggal_verifikasi) defaults.tanggal_verifikasi = todayISO();
  if (stage === "POLI" && !defaults.diagnosis_kerja) defaults.diagnosis_kerja = patient.diagnosis;
  return defaults;
}
