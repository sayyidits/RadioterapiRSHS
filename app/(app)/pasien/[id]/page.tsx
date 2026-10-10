import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendanceControl } from "@/components/attendance-control";
import { StageBadge } from "@/components/badges";
import { DueBadge } from "@/components/due-badge";
import { EventTimeline } from "@/components/event-timeline";
import { FractionForm } from "@/components/fraction-form";
import { FractionSchedule } from "@/components/fraction-schedule";
import { PoliExpired } from "@/components/poli-expired";
import { ReturnForm } from "@/components/return-form";
import { StageActionPanel } from "@/components/stage-action-panel";
import { StageStepper } from "@/components/stage-stepper";
import { getCurrentUser } from "@/lib/auth";
import { JUMLAH_PILIHAN_CT, cekKuota, type Hunian } from "@/lib/booking";
import { ProgressBar } from "@/components/progress-bar";
import { attendanceDays, attendanceToday, fractionCounts, getPatient, hunianPesawat, jumlahCtSim } from "@/lib/data";
import { age, dateWIB, formatDate, formatDateTime, todayISO } from "@/lib/format";
import { addDays, workingDayFrom, workingDaysFrom } from "@/lib/holidays";
import { buildSchedule, type ScheduleRow } from "@/lib/schedule";
import type { AttendanceEntry, Fraction, Patient, Profile } from "@/lib/types";
import {
  JENIS_KELAMIN,
  MESIN,
  ROLES,
  STAGES,
  STAGE_MAP,
  actorsLabel,
  canActOn,
  dueDate,
  poliHangus,
  type FieldDef,
  type StageKey,
} from "@/lib/workflow";

export default async function PatientPage({ params }: PageProps<"/pasien/[id]">) {
  const { id } = await params;
  const [user, result] = await Promise.all([getCurrentUser(), getPatient(id)]);
  if (!result) notFound();

  const { patient, events, fractions } = result;
  const stage = STAGE_MAP[patient.current_stage];
  const isOwner = canActOn(patient, user);
  const today = todayISO();
  // Kunjungan Poli yang tidak di-ACC di harinya
  const hangus = poliHangus(patient, today);
  // Due date ditampilkan di samping nama tahap Delineasi & Planning
  const due = patient.current_stage === "DELINEASI" || patient.current_stage === "PLANNING" ? dueDate(patient, today) : null;
  const inTreatment = patient.current_stage === "PENYINARAN";
  // Poli memesan slot pesawat (tanggal CT Sim), Planning boleh mengganti pesawat yang masih ada kuotanya
  const needsHunian = isOwner && (patient.current_stage === "POLI" || patient.current_stage === "PLANNING");

  // Absensi hanya relevan saat penyinaran (daftar id kosong = tanpa query). Hunian dihitung tanpa pasien ini sendiri.
  const ids = inTreatment ? [patient.id] : [];
  const booksCtSim = isOwner && patient.current_stage === "POLI";
  const [attendance, countToday, days, hunian, ctSim] = await Promise.all([
    attendanceToday(ids),
    fractionCounts(ids, today),
    fractions.length > 0 ? attendanceDays(patient.id) : [],
    needsHunian ? hunianPesawat(today, addDays(today, 200), patient.id) : null,
    booksCtSim ? jumlahCtSim(today, workingDaysFrom(today, JUMLAH_PILIHAN_CT).at(-1)!, patient.id) : {},
  ]);
  const attendanceEntries = attendance[patient.id] ?? [];
  const todayCount = countToday[patient.id] ?? 0;
  // Jadwal fraksi muncul setelah fraksi pertama diberikan; proyeksi hanya saat penyinaran berjalan
  const schedule = buildSchedule({
    fractions,
    total: patient.total_fraksi ?? fractions.length,
    attendance: days,
    today,
    project: inTreatment,
  });
  const booking = hunian && booksCtSim ? { hunian, ctSim, today, fraksiDone: fractions.length } : undefined;
  const optionLabels =
    hunian && patient.current_stage === "PLANNING"
      ? { mesin: machineOptionLabels(hunian, patient, fractions.length, today) }
      : undefined;

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
                  <h2 className="flex flex-wrap items-center gap-2 font-semibold">
                    Tahap saat ini: {stage.label}
                    {due && (
                      <span className="flex items-center gap-1.5 text-xs font-normal text-slate-500">
                        Due date <DueBadge due={due} today={today} />
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-slate-500">{stage.description}</p>
                </div>
                <span className="text-xs text-slate-500">Di tahap ini sejak {formatDateTime(patient.stage_entered_at)}</span>
              </div>

              {hangus ? (
                <PoliExpired
                  patientId={patient.id}
                  tanggal={formatDate(dateWIB(patient.stage_entered_at))}
                  canReRegister={user.role === "administrasi"}
                />
              ) : inTreatment ? (
                <FractionSection
                  patient={patient}
                  fractions={fractions}
                  user={user}
                  attendance={attendanceEntries}
                  todayCount={todayCount}
                  schedule={schedule}
                />
              ) : isOwner ? (
                <StageActionPanel
                  patientId={patient.id}
                  stage={patient.current_stage}
                  defaults={fieldDefaults(patient, patient.current_stage)}
                  optionLabels={optionLabels}
                  booking={booking}
                />
              ) : (
                <WaitingNotice role={waitingFor(patient)} />
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

          {/* Selesai, atau sedang replanning setelah sebagian fraksi diberikan */}
          {!inTreatment && fractions.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">
                Catatan fraksi
                {patient.current_stage !== "SELESAI" && (
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {fractions.length} fraksi sudah diberikan sebelum replanning
                  </span>
                )}
              </h2>
              <FractionSchedule rows={schedule} mesin={patient.mesin} />
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
          <p className="mt-1 text-sm text-slate-600">
            DPJP: <span className="font-medium text-slate-800">{patient.dpjp?.full_name ?? "-"}</span>
            {patient.mesin && (
              <>
                {" "}· Mesin: <span className="font-medium text-slate-800">{patient.mesin}</span>
              </>
            )}
          </p>
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
      <ProgressBar value={done} max={total} label="Progress penyinaran" className="h-2.5" barClassName="bg-teal-600" />
    </div>
  );
}

function FractionSection({
  patient,
  fractions,
  user,
  attendance,
  todayCount,
  schedule,
}: {
  patient: Patient;
  fractions: Fraction[];
  user: Profile;
  attendance: AttendanceEntry[];
  todayCount: number;
  schedule: ScheduleRow[];
}) {
  const total = patient.total_fraksi ?? 0;
  const present = attendance.at(-1)?.hadir === true;
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="mb-2 text-sm font-semibold">Kehadiran hari ini</h3>
        <AttendanceControl
          key={attendance.at(-1)?.id ?? "none"}
          patientId={patient.id}
          entries={attendance}
          canEdit={user.role === "administrasi" || user.role === "rtt"}
          fractionsToday={todayCount}
        />
      </div>
      {user.role !== "rtt" ? (
        <WaitingNotice role={ROLES.rtt} text="Fraksi penyinaran dicatat oleh RTT." />
      ) : present ? (
        <FractionForm
          patientId={patient.id}
          nextFraction={fractions.length + 1}
          total={total}
          defaultMesin={patient.mesin ?? ""}
        />
      ) : (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
          Fraksi baru bisa dicatat setelah pasien tercatat <b>hadir</b> hari ini.
        </p>
      )}
      {schedule.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Catatan & jadwal fraksi</h3>
          <FractionSchedule rows={schedule} mesin={patient.mesin} />
        </div>
      )}
      {user.role === "rtt" && (
        <details className="rounded-lg border border-rose-200 p-4">
          <summary className="cursor-pointer text-sm font-medium text-rose-700">Kembalikan untuk replanning</summary>
          <p className="my-4 text-sm text-slate-600">
            Fraksi yang sudah tercatat tetap dihitung. Penyinaran dilanjutkan setelah pasien kembali melewati tahap-tahapnya.
          </p>
          <ReturnForm patientId={patient.id} stage="PENYINARAN" />
        </details>
      )}
    </div>
  );
}

/** Siapa yang ditunggu: untuk tahap dokter sebutkan nama DPJP */
function waitingFor(patient: Patient) {
  const stage = STAGE_MAP[patient.current_stage];
  if (stage.owner === "dokter" && patient.dpjp) {
    const nurse = stage.alsoBy?.includes("perawat") ? " / Perawat" : "";
    return `${patient.dpjp.full_name} (DPJP)${nurse}`;
  }
  return actorsLabel(patient.current_stage);
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
  if (f.type === "date" || f.type === "ctsim") return formatDate(String(value));
  return String(value);
}

/** "Precise (tersedia)" / "Cobalt (penuh 3 hari)" untuk sisa hari penyinaran pasien ini */
function machineOptionLabels(hunian: Hunian, patient: Patient, done: number, today: string) {
  const mulai = workingDayFrom(patient.tgl_verifikasi && patient.tgl_verifikasi > today ? patient.tgl_verifikasi : today);
  const hari = (patient.total_fraksi ?? 0) - done;
  const labels: Record<string, string> = {};
  for (const m of MESIN) {
    if (m === patient.mesin) {
      labels[m] = `${m} (rencana dari Poli)`;
      continue;
    }
    const cek = cekKuota(hunian, m, mulai, hari);
    labels[m] = cek.sisaMin == null ? `${m} (tanpa kuota)` : cek.tersedia ? `${m} (tersedia)` : `${m} (penuh ${cek.hariPenuh} hari)`;
  }
  return labels;
}

function fieldDefaults(patient: Patient, stage: StageKey) {
  const saved = patient.data[stage] ?? {};
  const defaults: Record<string, unknown> = {};
  for (const f of STAGE_MAP[stage].fields) {
    defaults[f.name] = f.column ? patient[f.column] : saved[f.name];
  }
  // Tanggal rencana dari Poli; RTT mengubahnya bila pelaksanaannya berbeda
  if (stage === "CT_SIM" && !defaults.tanggal_ct) defaults.tanggal_ct = patient.tgl_ct_sim ?? todayISO();
  if (stage === "VERIFIKASI" && !defaults.tanggal_verifikasi) defaults.tanggal_verifikasi = patient.tgl_verifikasi ?? todayISO();
  if (stage === "POLI" && !defaults.diagnosis_kerja) defaults.diagnosis_kerja = patient.diagnosis;
  return defaults;
}
