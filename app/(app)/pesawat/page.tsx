import Link from "next/link";
import { StageBadge } from "@/components/badges";
import { DateNav } from "@/components/date-nav";
import { LoadBar, loadTone } from "@/components/machine-load";
import { hunianPesawat, jadwalSinar, listPatients, type JadwalSinarRow } from "@/lib/data";
import { formatShortDate, parseTanggal, todayISO } from "@/lib/format";
import { isWorkingDay, workingDayFrom, workingDaysFrom } from "@/lib/holidays";
import type { Patient } from "@/lib/types";
import { KUOTA_PESAWAT, MESIN_EKSTERNAL } from "@/lib/workflow";

/** Jumlah hari kerja di strip hunian per pesawat */
const JUMLAH_HARI = 20;

/**
 * Info pesawat radiasi eksternal: hunian per hari dibanding kuota harian.
 * Pasien terhitung sejak ACC Poli (mulai tanggal verifikasi) sampai fraksi terakhir.
 */
export default async function MachineInfoPage({ searchParams }: PageProps<"/pesawat">) {
  const today = todayISO();
  const tanggal = parseTanggal((await searchParams).tanggal);
  const strip = workingDaysFrom(workingDayFrom(today), JUMLAH_HARI);
  const from = tanggal < strip[0] ? tanggal : strip[0];
  const to = tanggal > strip.at(-1)! ? tanggal : strip.at(-1)!;

  const [hunian, jadwal, patients] = await Promise.all([hunianPesawat(from, to), jadwalSinar(tanggal, tanggal), listPatients()]);
  const byId = new Map(patients.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Info pesawat</h1>
          <p className="text-sm text-slate-500">
            Jumlah pasien per hari di tiap pesawat radiasi eksternal dibanding kuota harian. Pasien terhitung sejak ACC Poli,
            mulai hari verifikasi sampai fraksi terakhir.
          </p>
        </div>
        <DateNav basePath="/pesawat" tanggal={tanggal} today={today} />
      </div>

      {!isWorkingDay(tanggal) && (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
          Tanggal ini bukan hari kerja, tidak ada penyinaran.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {MESIN_EKSTERNAL.map((m) => (
          <MachineCard
            key={m}
            mesin={m}
            kuota={KUOTA_PESAWAT[m]}
            tanggal={tanggal}
            strip={strip}
            perHari={hunian[m] ?? {}}
            rows={jadwal.filter((j) => j.mesin === m)}
            byId={byId}
          />
        ))}
      </div>
    </div>
  );
}

function MachineCard({
  mesin,
  kuota,
  tanggal,
  strip,
  perHari,
  rows,
  byId,
}: {
  mesin: string;
  kuota: number;
  tanggal: string;
  strip: string[];
  perHari: Record<string, number>;
  rows: JadwalSinarRow[];
  byId: Map<string, Patient>;
}) {
  const n = perHari[tanggal] ?? 0;
  const tone = loadTone(n, kuota);
  const list = rows
    .map((r) => ({ row: r, patient: byId.get(r.patient_id) }))
    .filter((x): x is { row: JadwalSinarRow; patient: Patient } => !!x.patient)
    .sort((a, b) => a.patient.nama.localeCompare(b.patient.nama));
  const mulai = list.filter((x) => x.row.fraksi_ke === 1).length;

  return (
    <section className={`card flex flex-col ${tone.border}`}>
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">{mesin}</h2>
          <p className="text-sm text-slate-600">
            <span className={`text-2xl font-semibold ${tone.text}`}>{n}</span> / {kuota} pasien
          </p>
        </div>
        <div className="mt-3">
          <LoadBar n={n} kuota={kuota} label={`${n} dari kuota ${kuota} pasien pada ${tanggal}`} />
        </div>
        <p className={`mt-2 text-xs font-medium ${n >= kuota ? "text-rose-700" : "text-slate-500"}`}>
          {n > kuota
            ? `Melebihi kuota ${n - kuota} pasien`
            : n === kuota
              ? "Kuota penuh"
              : `Sisa ${kuota - n} slot`}
          {mulai > 0 && <span className="font-normal text-slate-500"> · {mulai} pasien mulai penyinaran</span>}
        </p>

        <div className="mt-4">
          <p className="mb-1 text-xs text-slate-500">{JUMLAH_HARI} hari kerja ke depan</p>
          <div className="flex h-16 items-end gap-0.5" role="list" aria-label={`Hunian ${mesin} per hari`}>
            {strip.map((d) => {
              const v = perHari[d] ?? 0;
              const t = loadTone(v, kuota);
              return (
                <Link
                  key={d}
                  role="listitem"
                  href={`/pesawat?tanggal=${d}`}
                  title={`${formatShortDate(d)}: ${v}/${kuota}`}
                  aria-label={`${formatShortDate(d)}: ${v} dari ${kuota}`}
                  className={`flex h-full flex-1 flex-col justify-end rounded-sm ${d === tanggal ? "bg-teal-100 ring-1 ring-teal-500" : "bg-slate-50 hover:bg-slate-100"}`}
                >
                  <span className={`block rounded-sm ${t.bar}`} style={{ height: `${Math.min(100, (v / kuota) * 100)}%` }} />
                </Link>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>{formatShortDate(strip[0])}</span>
            <span>{formatShortDate(strip.at(-1)!)}</span>
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-slate-500">Tidak ada pasien di tanggal ini.</p>
      ) : (
        <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
          {list.map(({ row, patient: p }) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
              <div className="min-w-0">
                <Link href={`/pasien/${p.id}`} className="font-medium text-slate-900 hover:text-teal-700">
                  {p.nama}
                </Link>
                <p className="truncate text-xs text-slate-500">
                  <span className="font-mono">RM {p.no_rm}</span> · {p.dpjp?.full_name ?? "-"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StageBadge stage={p.current_stage} />
                <span className="text-xs text-slate-500">
                  {row.fraksi_ke === 1 && !row.sudah ? "Verifikasi & mulai" : `Fx ${row.fraksi_ke}/${p.total_fraksi ?? "?"}`}
                  {row.sudah && " ✓"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
