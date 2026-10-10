import Link from "next/link";
import { StageBadge } from "@/components/badges";
import { age, daysSince, formatDate, todayISO } from "@/lib/format";
import type { Patient } from "@/lib/types";
import { STAGE_KEYS, actorsLabel, poliHangus } from "@/lib/workflow";

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
    <div className="overflow-x-auto">
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
          {patients.map((p) => {
            return (
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
                  <StageBadge stage={p.current_stage} />
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Tanggal verifikasi (= fraksi 1): rencana dari Poli, atau tanggal sebenarnya bila sudah diverifikasi.
 * Pasien yang belum di-ACC Poli belum punya jadwal.
 */
function VerificationDate({ patient: p, today }: { patient: Patient; today: string }) {
  const idx = STAGE_KEYS.indexOf(p.current_stage);
  if (idx <= STAGE_KEYS.indexOf("POLI")) return <>-</>;
  const done = idx > STAGE_KEYS.indexOf("VERIFIKASI");
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
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={`${done} dari ${total} fraksi`}
      >
        <div className="h-full rounded-full bg-sky-300" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </div>
  );
}
