import Link from "next/link";
import { CitoBadge, StageBadge } from "@/components/badges";
import { ProgressBar } from "@/components/progress-bar";
import { age, daysSince, formatDate, todayISO } from "@/lib/format";
import type { Patient } from "@/lib/types";
import { actorsLabel, poliHangus, stageIndex } from "@/lib/workflow";

export function PatientTable({
  patients,
  fractions,
  showDpjp = true,
}: {
  patients: Patient[];
  fractions: Record<string, number>;
  showDpjp?: boolean;
}) {
  const today = todayISO();
  if (patients.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-slate-500">Tidak ada pasien.</p>;
  }
  return (
    <>
      {/* HP & tablet: satu kartu per pasien, karena tabel 8 kolom harus digeser ke samping */}
      <ul className="divide-y divide-slate-100 lg:hidden">
        {patients.map((p) => (
          <li key={p.id}>
            <Link href={`/pasien/${p.id}`} className="block px-4 py-3 active:bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{p.nama}</p>
                  <p className="font-mono text-xs text-slate-500">
                    RM {p.no_rm} · {p.jenis_kelamin} · {age(p.tgl_lahir)} th
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StageBadge stage={p.current_stage} />
                  {p.cito && <CitoBadge />}
                  {poliHangus(p, today) && <span className="text-xs font-medium text-rose-700">Hangus</span>}
                </div>
              </div>
              <p className="mt-1 truncate text-sm text-slate-600">{p.diagnosis}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {showDpjp && <MobileField label="DPJP" className="col-span-2">{p.dpjp?.full_name ?? "-"}</MobileField>}
                <MobileField label="Menunggu">{actorsLabel(p.current_stage)}</MobileField>
                <MobileField label="Lama di tahap">
                  {p.current_stage === "SELESAI" ? "-" : daysSince(p.stage_entered_at)}
                </MobileField>
                <MobileField label="Verifikasi">
                  <VerificationDate patient={p} today={today} />
                </MobileField>
                {p.current_stage === "PENYINARAN" && p.total_fraksi ? (
                  <MobileField label="Fraksi">
                    <FractionProgress done={fractions[p.id] ?? 0} total={p.total_fraksi} />
                  </MobileField>
                ) : null}
              </dl>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-2.5 font-medium">Pasien</th>
              <th className="px-3 py-2.5 font-medium">Diagnosis</th>
              {showDpjp && <th className="px-3 py-2.5 font-medium">DPJP</th>}
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Menunggu</th>
              <th className="px-3 py-2.5 font-medium">Lama di tahap</th>
              <th className="px-3 py-2.5 font-medium">Verifikasi</th>
              <th className="px-5 py-2.5 font-medium">Fraksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/pasien/${p.id}`} className="font-medium text-slate-900 hover:text-teal-700">
                      {p.nama}
                    </Link>
                    <p className="font-mono text-xs text-slate-500">
                      RM {p.no_rm} · {p.jenis_kelamin} · {age(p.tgl_lahir)} th
                    </p>
                  </td>
                  <td className="max-w-xs truncate px-3 py-3 text-slate-600">{p.diagnosis}</td>
                  {showDpjp && <td className="whitespace-nowrap px-3 py-3 text-slate-600">{p.dpjp?.full_name ?? "-"}</td>}
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <StageBadge stage={p.current_stage} />
                      {p.cito && <CitoBadge />}
                    </div>
                    {poliHangus(p, today) && <span className="mt-1 block text-xs font-medium text-rose-700">Hangus</span>}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{actorsLabel(p.current_stage)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    {p.current_stage === "SELESAI" ? "-" : daysSince(p.stage_entered_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    <VerificationDate patient={p} today={today} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                    {/* Fraksi hanya relevan saat penyinaran berjalan */}
                    {p.current_stage === "PENYINARAN" && p.total_fraksi ? (
                      <FractionProgress done={fractions[p.id] ?? 0} total={p.total_fraksi} />
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MobileField({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-slate-700">{children}</dd>
    </div>
  );
}

/**
 * Tanggal verifikasi (= fraksi 1): rencana dari Poli, atau tanggal sebenarnya bila sudah diverifikasi.
 * Pasien yang belum di-ACC Poli belum punya jadwal.
 */
function VerificationDate({ patient: p, today }: { patient: Patient; today: string }) {
  const idx = stageIndex(p.current_stage);
  if (idx <= stageIndex("POLI")) return <>-</>;
  const done = idx > stageIndex("VERIFIKASI");
  const actual = p.data.VERIFIKASI?.tanggal_verifikasi;
  const date = done && typeof actual === "string" ? actual : p.tgl_verifikasi;
  if (!date) return <>-</>;
  const late = !done && date < today;
  return (
    <span className={late ? "font-medium text-rose-700" : done ? "text-slate-500" : "text-slate-800"}>
      {formatDate(date)}
      {late && <span className="block text-xs font-normal">terlambat</span>}
    </span>
  );
}

function FractionProgress({ done, total }: { done: number; total: number }) {
  return (
    <div className="w-24">
      <span>
        {done}/{total}
      </span>
      <ProgressBar value={done} max={total} label={`${done} dari ${total} fraksi`} className="mt-1 h-1.5" />
    </div>
  );
}
