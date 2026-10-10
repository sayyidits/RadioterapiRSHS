"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDayDate } from "@/lib/format";
import { nextWorkingDay, prevWorkingDay } from "@/lib/holidays";

/** Pindah tanggal lewat ?tanggal=YYYY-MM-DD: hari kerja sebelumnya/berikutnya, pilih tanggal, atau hari ini. */
export function DateNav({ basePath, tanggal, today }: { basePath: string; tanggal: string; today: string }) {
  const router = useRouter();
  const href = (d: string) => (d === today ? basePath : `${basePath}?tanggal=${d}`);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={href(prevWorkingDay(tanggal))} className="btn btn-secondary px-3 py-1.5" aria-label="Hari kerja sebelumnya">
        ‹
      </Link>
      <label className="sr-only" htmlFor="date-nav">
        Pilih tanggal
      </label>
      <input
        id="date-nav"
        type="date"
        value={tanggal}
        onChange={(e) => e.target.value && router.push(href(e.target.value))}
        className="input w-auto py-1.5"
      />
      <Link href={href(nextWorkingDay(tanggal))} className="btn btn-secondary px-3 py-1.5" aria-label="Hari kerja berikutnya">
        ›
      </Link>
      {tanggal !== today && (
        <Link href={basePath} className="text-sm font-medium text-teal-700 hover:text-teal-900">
          Hari ini
        </Link>
      )}
      <span className="text-sm text-slate-500">{formatDayDate(tanggal)}</span>
    </div>
  );
}
