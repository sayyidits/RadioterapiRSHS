/** Warna hunian pesawat: biru muda biasa, amber ≥ 90%, rose penuh (tidak bisa dipesan lagi) */
export function loadTone(n: number, kuota: number) {
  if (n >= kuota) return { bar: "bg-rose-500", text: "text-rose-700", border: "border-rose-300" };
  if (n >= kuota * 0.9) return { bar: "bg-amber-400", text: "text-amber-700", border: "border-amber-300" };
  return { bar: "bg-sky-300", text: "text-slate-900", border: "" };
}

/** Bar horizontal "n / kuota" */
export function LoadBar({ n, kuota, label }: { n: number; kuota: number; label: string }) {
  const tone = loadTone(n, kuota);
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={kuota}
      aria-valuenow={n}
      aria-label={label}
    >
      <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, (n / kuota) * 100)}%` }} />
    </div>
  );
}
