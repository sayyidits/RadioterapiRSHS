"use client";

import { useState } from "react";
import { JUMLAH_PILIHAN_CT, ctSimOptions, type CtSimOption, type Hunian } from "@/lib/booking";
import { formatDayDate, formatShortDate } from "@/lib/format";
import { HARI_LIBUR, addDays } from "@/lib/holidays";
import { KUOTA_CT_SIM, kuotaOf } from "@/lib/workflow";

/**
 * Pemilih tanggal CT Sim di Poli. Tanggal hanya bisa dipilih bila kuota CT Simulator hari itu
 * belum penuh dan setiap hari penyinaran (mulai verifikasi = CT + 14 hari) masih ada kuota di
 * pesawat yang dipilih. Database mengecek ulang saat ACC.
 */
export function CtSimPicker({
  id,
  name,
  hunian,
  ctSim,
  today,
  mesin,
  jumlahFraksi,
}: {
  id: string;
  name: string;
  hunian: Hunian;
  /** Pasien yang sudah dijadwalkan CT Sim per tanggal */
  ctSim: Record<string, number>;
  today: string;
  mesin: string;
  /** Sisa fraksi yang akan diberikan (total − sudah diberikan) */
  jumlahFraksi: number;
}) {
  const [selected, setSelected] = useState("");

  if (!mesin || !(jumlahFraksi > 0)) {
    return (
      <div id={id} className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
        Pilih rencana pesawat dan isi jumlah fraksi dulu untuk melihat tanggal CT Sim yang tersedia.
        <input type="hidden" name={name} value="" />
      </div>
    );
  }

  const options = ctSimOptions({ hunian, ctSim, mesin, jumlahFraksi, dari: today, jumlah: JUMLAH_PILIHAN_CT });
  const byDate = new Map(options.map((o) => [o.ct, o]));
  // Pilihan yang menjadi penuh setelah pesawat/fraksi diganti otomatis batal
  const chosen = byDate.get(selected)?.bisa ? byDate.get(selected)! : null;
  const kuota = kuotaOf(mesin);
  const weeks = groupByWeek(options[0].ct, options.at(-1)!.ct);
  const available = options.filter((o) => o.bisa).length;

  return (
    <div id={id} className="space-y-3">
      <input type="hidden" name={name} value={chosen?.ct ?? ""} />
      <p className="text-xs text-slate-500">
        {kuota ? `Kuota ${mesin}: ${kuota} pasien/hari.` : `${mesin} tanpa kuota harian.`} Kuota CT Simulator: {KUOTA_CT_SIM}{" "}
        pasien/hari. Tanggal dicoret berarti CT Sim hari itu sudah penuh
        {kuota ? " atau ada hari penyinaran yang kuota pesawatnya sudah penuh" : ""}.{" "}
        {available === 0 && <b className="text-rose-700">Tidak ada tanggal tersedia dalam 8 minggu ke depan.</b>}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] table-fixed border-separate border-spacing-1 text-xs">
          <thead>
            <tr className="text-slate-500">
              {["Sen", "Sel", "Rab", "Kam", "Jum"].map((d) => (
                <th key={d} className="font-medium">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]}>
                {week.map((date) => (
                  <td key={date} className="align-top">
                    <DayCell
                      date={date}
                      mesin={mesin}
                      option={byDate.get(date)}
                      selected={chosen?.ct === date}
                      onSelect={() => setSelected(date)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {chosen ? (
        <div className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-900 ring-1 ring-inset ring-teal-200">
          <p>
            CT Sim <b>{formatDayDate(chosen.ct)}</b>
          </p>
          <p>
            Verifikasi & fraksi 1 <b>{formatDayDate(chosen.verifikasi)}</b> · perkiraan fraksi terakhir{" "}
            <b>{formatDayDate(chosen.selesai)}</b>
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Belum ada tanggal dipilih.</p>
      )}
    </div>
  );
}

function DayCell({
  date,
  mesin,
  option,
  selected,
  onSelect,
}: {
  date: string;
  mesin: string;
  option: CtSimOption | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  if (!option) {
    const libur = HARI_LIBUR[date];
    return (
      <div className="h-full rounded-md px-2 py-1.5 text-slate-300" title={libur}>
        <p className="font-medium">{formatShortDate(date)}</p>
        <p className="truncate">{libur ? "Libur" : ""}</p>
      </div>
    );
  }
  if (!option.bisa) {
    const ctPenuh = option.ctSisa === 0;
    const reasons = [
      ctPenuh && `CT Simulator sudah ${KUOTA_CT_SIM} pasien`,
      !option.tersedia && `Pesawat penuh pada ${formatDayDate(option.penuhPada!)} (${option.hariPenuh} hari penuh)`,
    ].filter(Boolean);
    return (
      <button
        type="button"
        disabled
        title={reasons.join(". ")}
        className="w-full cursor-not-allowed rounded-md bg-slate-100 px-2 py-1.5 text-left text-slate-400"
      >
        <p className="font-medium line-through">{formatShortDate(date)}</p>
        <p>{ctPenuh && option.tersedia ? "CT Sim penuh" : "Penuh"}</p>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={`Verifikasi & fraksi 1: ${formatDayDate(option.verifikasi)}`}
      className={`w-full rounded-md px-2 py-1.5 text-left ring-1 ring-inset transition ${
        selected ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-slate-700 ring-teal-200 hover:bg-teal-50"
      }`}
    >
      <p className="font-medium">{formatShortDate(date)}</p>
      <p className={selected ? "text-teal-100" : "text-slate-500"}>Verif {formatShortDate(option.verifikasi)}</p>
      {option.sisaMin != null && (
        <p className={selected ? "text-teal-100" : option.sisaMin <= 5 ? "text-amber-700" : "text-slate-400"}>
          {mesin} sisa {option.sisaMin}
        </p>
      )}
      <p className={selected ? "text-teal-100" : option.ctSisa <= 2 ? "text-amber-700" : "text-slate-400"}>
        CT sisa {option.ctSisa}
      </p>
    </button>
  );
}

/** Minggu Senin–Jumat yang mencakup rentang tanggal */
function groupByWeek(first: string, last: string) {
  const day = new Date(`${first}T00:00:00Z`).getUTCDay();
  let monday = addDays(first, -((day + 6) % 7));
  const weeks: string[][] = [];
  while (monday <= last) {
    weeks.push([0, 1, 2, 3, 4].map((i) => addDays(monday, i)));
    monday = addDays(monday, 7);
  }
  return weeks;
}
