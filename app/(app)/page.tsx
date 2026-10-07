import Link from "next/link";
import { StageBadge } from "@/components/badges";
import { ResetDemoButton } from "@/components/demo-controls";
import { IS_DEMO } from "@/lib/mode";
import { getCurrentUser } from "@/lib/auth";
import { fractionCounts, listPatients } from "@/lib/data";
import { daysSince } from "@/lib/format";
import type { Patient } from "@/lib/types";
import { ROLES, ROLE_SHORT, STAGES, STAGE_MAP, stagesOwnedBy } from "@/lib/workflow";

export default async function DashboardPage() {
  const [user, patients] = await Promise.all([getCurrentUser(), listPatients()]);
  const fractions = await fractionCounts(patients.map((p) => p.id));

  const myStages = stagesOwnedBy(user.role);
  const myTasks = patients.filter((p) => myStages.includes(p.current_stage));
  const active = patients.filter((p) => p.current_stage !== "SELESAI");

  const stats = [
    { label: "Pasien aktif", value: active.length },
    { label: "Sedang penyinaran", value: patients.filter((p) => p.current_stage === "PENYINARAN").length },
    { label: "Selesai", value: patients.length - active.length },
    { label: "Menunggu saya", value: myTasks.length, highlight: myTasks.length > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Halo, {user.full_name}</h1>
          <p className="text-sm text-slate-500">
            Masuk sebagai {ROLES[user.role]}
            {user.role === "perawat" && " (akses lihat saja)"}
          </p>
        </div>
        {IS_DEMO && <ResetDemoButton />}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`card p-4 ${s.highlight ? "border-teal-300 bg-teal-50" : ""}`}>
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${s.highlight ? "text-teal-800" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {myStages.length > 0 && (
        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Tugas saya</h2>
            <span className="text-xs text-slate-500">
              Tahap: {myStages.map((s) => STAGE_MAP[s].label).join(", ")}
            </span>
          </div>
          {myTasks.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">Tidak ada pasien yang menunggu tindakan Anda.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {myTasks.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/pasien/${p.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-medium">{p.nama}</p>
                      <p className="font-mono text-xs text-slate-500">RM {p.no_rm}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.current_stage === "PENYINARAN" && p.total_fraksi && (
                        <span className="text-xs text-slate-600">
                          Fx {fractions[p.id] ?? 0}/{p.total_fraksi}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">{daysSince(p.stage_entered_at)}</span>
                      <StageBadge stage={p.current_stage} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Alur pasien</h2>
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <div className="flex min-w-max gap-3">
            {STAGES.map((s) => {
              const list = patients.filter((p) => p.current_stage === s.key);
              const mine = s.owner === user.role;
              return (
                <div
                  key={s.key}
                  className={`flex w-60 flex-col rounded-xl border ${mine ? "border-teal-300 bg-teal-50/50" : "border-slate-200 bg-slate-100/60"}`}
                >
                  <div className="flex items-center justify-between px-3 pb-2 pt-3">
                    <div>
                      <p className="text-sm font-semibold">{s.label}</p>
                      <p className="text-[11px] text-slate-500">{s.owner ? ROLE_SHORT[s.owner] : "—"}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                      {list.length}
                    </span>
                  </div>
                  <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto px-2 pb-2">
                    {list.length === 0 && <p className="px-1 py-3 text-center text-xs text-slate-400">Kosong</p>}
                    {list.map((p) => (
                      <KanbanCard key={p.id} patient={p} done={fractions[p.id] ?? 0} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function KanbanCard({ patient: p, done }: { patient: Patient; done: number }) {
  const showFx = p.total_fraksi && (p.current_stage === "PENYINARAN" || p.current_stage === "SELESAI");
  return (
    <Link
      href={`/pasien/${p.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 shadow-xs transition hover:border-teal-400 hover:shadow-sm"
    >
      <p className="truncate text-sm font-medium">{p.nama}</p>
      <p className="font-mono text-[11px] text-slate-500">RM {p.no_rm}</p>
      <p className="mt-1 truncate text-xs text-slate-600">{p.diagnosis}</p>
      {showFx ? (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-teal-600" style={{ width: `${(done / p.total_fraksi!) * 100}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {done}/{p.total_fraksi} fraksi
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">{daysSince(p.stage_entered_at)} di tahap ini</p>
      )}
    </Link>
  );
}
