import Link from "next/link";
import { AttendanceControl } from "@/components/attendance-control";
import { FractionForm } from "@/components/fraction-form";
import { getCurrentUser } from "@/lib/auth";
import { attendanceToday, fractionCounts, fractionsToday, listPatients } from "@/lib/data";
import { formatToday } from "@/lib/format";
import type { AttendanceEntry, Patient } from "@/lib/types";
import { MESIN } from "@/lib/workflow";

/**
 * Penyinaran hari ini: administrasi mengabsen pasien yang datang, RTT melihat
 * siapa yang hadir per mesin lalu mencatat fraksinya.
 */
export default async function TreatmentTodayPage() {
  const [user, patients] = await Promise.all([getCurrentUser(), listPatients({ stage: "PENYINARAN" })]);
  const ids = patients.map((p) => p.id);
  const [done, attendance, today] = await Promise.all([fractionCounts(ids), attendanceToday(ids), fractionsToday(ids)]);

  const canAttend = user.role === "administrasi" || user.role === "rtt";
  const canRecord = user.role === "rtt";

  const status = (p: Patient) => attendance[p.id]?.at(-1)?.hadir;
  const hadir = patients.filter((p) => status(p) === true).length;
  const tidak = patients.filter((p) => status(p) === false).length;
  const stats = [
    { label: "Pasien penyinaran", value: patients.length },
    { label: "Hadir", value: hadir },
    { label: "Tidak hadir", value: tidak },
    { label: "Belum diabsen", value: patients.length - hadir - tidak, highlight: canAttend && patients.length - hadir - tidak > 0 },
  ];

  // RTT melihat yang hadir lebih dulu, administrasi yang belum diabsen lebih dulu
  const rank = (p: Patient) => {
    const s = status(p);
    if (canRecord) return s === true ? 0 : s === undefined ? 1 : 2;
    return s === undefined ? 0 : s === true ? 1 : 2;
  };
  const groups = [...MESIN, null]
    .map((m) => ({
      mesin: m,
      patients: patients.filter((p) => p.mesin === m).sort((a, b) => rank(a) - rank(b) || a.nama.localeCompare(b.nama)),
    }))
    .filter((g) => g.patients.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{user.role === "administrasi" ? "Absen penyinaran" : "Penyinaran hari ini"}</h1>
        <p className="text-sm text-slate-500">
          {formatToday()}.{" "}
          {canRecord
            ? "Fraksi hanya bisa dicatat untuk pasien yang sudah tercatat hadir."
            : canAttend
              ? "Catat kehadiran pasien yang datang untuk penyinaran hari ini."
              : "Kehadiran dicatat oleh administrasi dan RTT."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`card p-4 ${s.highlight ? "border-teal-300 bg-teal-50" : ""}`}>
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${s.highlight ? "text-teal-800" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <p className="card px-5 py-10 text-center text-sm text-slate-500">Tidak ada pasien yang sedang penyinaran.</p>
      )}

      {groups.map((g) => (
        <section key={g.mesin ?? "none"} className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">{g.mesin ?? "Mesin belum ditentukan"}</h2>
            <span className="text-xs text-slate-500">
              {g.patients.filter((p) => status(p) === true).length} hadir dari {g.patients.length} pasien
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {g.patients.map((p) => (
              <PatientRow
                key={p.id}
                patient={p}
                done={done[p.id] ?? 0}
                entries={attendance[p.id] ?? []}
                todayCount={today[p.id] ?? 0}
                canAttend={canAttend}
                canRecord={canRecord}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PatientRow({
  patient: p,
  done,
  entries,
  todayCount,
  canAttend,
  canRecord,
}: {
  patient: Patient;
  done: number;
  entries: AttendanceEntry[];
  todayCount: number;
  canAttend: boolean;
  canRecord: boolean;
}) {
  const total = p.total_fraksi ?? 0;
  const present = entries.at(-1)?.hadir === true;
  return (
    <li className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_minmax(0,22rem)]">
      <div className="min-w-0">
        <Link href={`/pasien/${p.id}`} className="font-medium text-slate-900 hover:text-teal-700">
          {p.nama}
        </Link>
        <p className="font-mono text-xs text-slate-500">RM {p.no_rm}</p>
        <p className="mt-1 text-xs text-slate-500">DPJP: {p.dpjp?.full_name ?? "-"}</p>
        <div className="mt-2 w-40">
          <p className="text-xs text-slate-600">
            Fraksi {done}/{total}
            {todayCount > 0 && <span className="text-teal-700"> · {todayCount} hari ini</span>}
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-sky-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <AttendanceControl
        key={entries.at(-1)?.id ?? "none"}
        patientId={p.id}
        entries={entries}
        canEdit={canAttend}
        fractionsToday={todayCount}
      />

      <div>
        {canRecord && present && done < total && (
          <FractionForm patientId={p.id} nextFraction={done + 1} total={total} defaultMesin={p.mesin ?? ""} compact />
        )}
        {canRecord && !present && <p className="text-xs text-slate-500">Catat fraksi setelah pasien tercatat hadir.</p>}
      </div>
    </li>
  );
}
