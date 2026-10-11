import { formatDayDate } from "@/lib/format";
import type { ScheduleRow } from "@/lib/schedule";

const STATUS = {
  done: { text: "Sudah disinar", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  today: { text: "Hari ini", className: "bg-teal-50 text-teal-800 ring-teal-300" },
  planned: { text: "Belum disinar", className: "bg-slate-100 text-slate-600 ring-slate-300" },
  absent: { text: "Tidak hadir", className: "bg-rose-50 text-rose-700 ring-rose-200" },
} as const;

/** Warna baris, sama dengan tabel desktop */
const ROW_TONE = { done: "", today: "bg-teal-50/40", planned: "text-slate-500", absent: "bg-rose-50/40" } as const;

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
      {/* HP: satu baris ringkas per hari, karena tabel 6 kolom tidak muat */}
      <ul className="divide-y divide-slate-100 border-t border-slate-200 text-sm sm:hidden">
        {rows.map((r) => {
          const row = mobileRow(r, mesin);
          return (
            <li
              key={row.key}
              className={`py-2 ${ROW_TONE[row.status]}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="whitespace-nowrap">
                  <span className="inline-block w-12 font-medium">{row.fx != null ? `Fx ${row.fx}` : "-"}</span>
                  {formatDayDate(row.tanggal)}
                </p>
                <Status kind={row.status} />
              </div>
              {row.detail && <p className="mt-0.5 pl-12 text-xs text-slate-500">{row.detail}</p>}
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
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

/** Satu baris jadwal untuk tampilan HP: nomor fraksi, tanggal, status, dan detail dalam satu teks */
function mobileRow(r: ScheduleRow, mesin: string | null) {
  if (r.kind === "done") {
    const f = r.fraction;
    return {
      key: `fx-${f.id}`,
      fx: f.fraksi_ke,
      tanggal: f.tanggal,
      status: "done" as const,
      detail: [f.mesin, f.rtt?.full_name, f.catatan].filter(Boolean).join(" · "),
    };
  }
  if (r.kind === "absent") {
    return {
      key: `absent-${r.tanggal}`,
      fx: null,
      tanggal: r.tanggal,
      status: "absent" as const,
      detail: r.catatan ?? "Jadwal mundur 1 hari kerja",
    };
  }
  return {
    key: `plan-${r.fraksi_ke}`,
    fx: r.fraksi_ke,
    tanggal: r.tanggal,
    status: r.today ? ("today" as const) : ("planned" as const),
    detail: mesin ?? "",
  };
}

function Status({ kind }: { kind: keyof typeof STATUS }) {
  const s = STATUS[kind];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.className}`}>
      {s.text}
    </span>
  );
}
