import { ProgressBar } from "@/components/progress-bar";

/** Warna hunian pesawat: biru muda biasa, amber ≥ 90%, rose penuh (tidak bisa dipesan lagi) */
export function loadTone(n: number, kuota: number) {
  if (n >= kuota) return { bar: "bg-rose-500", text: "text-rose-700", border: "border-rose-300" };
  if (n >= kuota * 0.9) return { bar: "bg-amber-400", text: "text-amber-700", border: "border-amber-300" };
  return { bar: "bg-sky-300", text: "text-slate-900", border: "" };
}

/** Bar horizontal "n / kuota" */
export function LoadBar({ n, kuota, label }: { n: number; kuota: number; label: string }) {
  return <ProgressBar value={n} max={kuota} label={label} className="h-2" barClassName={loadTone(n, kuota).bar} />;
}
