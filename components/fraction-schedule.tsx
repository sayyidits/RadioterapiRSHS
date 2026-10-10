import { formatDayDate } from "@/lib/format";
import type { ScheduleRow } from "@/lib/schedule";

const STATUS = {
  done: { text: "Sudah disinar", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  today: { text: "Hari ini", className: "bg-teal-50 text-teal-800 ring-teal-300" },
  planned: { text: "Belum disinar", className: "bg-slate-100 text-slate-600 ring-slate-300" },
  absent: { text: "Tidak hadir", className: "bg-rose-50 text-rose-700 ring-rose-200" },
} as const;

/** Catatan & jadwal fraksi: yang sudah diberikan, hari tidak hadir, dan sisa jadwal. */
export function FractionSchedule({ rows, mesin }: { rows: ScheduleRow[]; mesin: string | null }) {
  const planned = rows.filter((r) => r.kind === "planned");
  const last = planned.at(-1);

  return (
    <div className="space-y-3">
      {last && (
        <div className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-inset ring-sky-200">
          <p>
            Sisa <b>{planned.length} fraksi</b>, perkiraan selesai <b>{formatDayDate(last.tanggal)}</b>.
          </p>
          <p className="mt-0.5 text-xs text-sky-800">
            Jadwal melewati Sabtu, Minggu, libur nasional, dan cuti bersama. Jika pasien tidak hadir, sisa jadwal otomatis mundur.
          </p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3 font-medium">Fx</th>
              <th className="py-2 pr-3 font-medium">Tanggal</th>
              <th className="py-2 pr-3 font-medium">Mesin</th>
              <th className="py-2 pr-3 font-medium">RTT</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              if (r.kind === "done") {
                const f = r.fraction;
                return (
                  <tr key={`fx-${f.id}`}>
                    <td className="py-2 pr-3 font-medium">{f.fraksi_ke}</td>
                    <td className="whitespace-nowrap py-2 pr-3">{formatDayDate(f.tanggal)}</td>
                    <td className="py-2 pr-3">{f.mesin ?? "-"}</td>
                    <td className="py-2 pr-3">{f.rtt?.full_name ?? "-"}</td>
                    <td className="py-2 pr-3">
                      <Status kind="done" />
                    </td>
                    <td className="py-2 text-slate-600">{f.catatan ?? ""}</td>
                  </tr>
                );
              }
              if (r.kind === "absent") {
                return (
                  <tr key={`absent-${r.tanggal}`} className="bg-rose-50/40">
                    <td className="py-2 pr-3 text-slate-400">-</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{formatDayDate(r.tanggal)}</td>
                    <td className="py-2 pr-3 text-slate-400">-</td>
                    <td className="py-2 pr-3 text-slate-400">-</td>
                    <td className="py-2 pr-3">
                      <Status kind="absent" />
                    </td>
                    <td className="py-2 text-slate-600">{r.catatan ?? "Jadwal mundur 1 hari kerja"}</td>
                  </tr>
                );
              }
              return (
                <tr key={`plan-${r.fraksi_ke}`} className={r.today ? "bg-teal-50/40" : "text-slate-500"}>
                  <td className="py-2 pr-3 font-medium">{r.fraksi_ke}</td>
                  <td className="whitespace-nowrap py-2 pr-3">{formatDayDate(r.tanggal)}</td>
                  <td className="py-2 pr-3">{mesin ?? "-"}</td>
                  <td className="py-2 pr-3">-</td>
                  <td className="py-2 pr-3">
                    <Status kind={r.today ? "today" : "planned"} />
                  </td>
                  <td className="py-2" />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Status({ kind }: { kind: keyof typeof STATUS }) {
  const s = STATUS[kind];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.className}`}>
      {s.text}
    </span>
  );
}
