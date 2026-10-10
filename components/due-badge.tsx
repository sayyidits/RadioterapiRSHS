import { daysBetween, formatShortDate } from "@/lib/format";

/** Due date relatif terhadap hari ini: "Terlambat 2 hari · 8 Okt" / "Hari ini" / "H-3 · 14 Okt" */
export function DueBadge({ due, today }: { due: string | null; today: string }) {
  const base = "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";
  if (!due) return <span className={`${base} bg-slate-50 text-slate-500 ring-slate-200`}>Belum dijadwalkan</span>;
  const diff = daysBetween(today, due);
  if (diff < 0) {
    return (
      <span className={`${base} bg-rose-50 text-rose-700 ring-rose-200`}>
        Terlambat {-diff} hari · {formatShortDate(due)}
      </span>
    );
  }
  if (diff === 0) return <span className={`${base} bg-amber-50 text-amber-800 ring-amber-200`}>Hari ini</span>;
  return (
    <span className={`${base} bg-white text-slate-600 ring-slate-200`}>
      H-{diff} · {formatShortDate(due)}
    </span>
  );
}
