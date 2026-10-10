/** Bar horizontal value / max (fraksi, hunian pesawat). Tinggi & warna lewat className. */
export function ProgressBar({
  value,
  max,
  label,
  className = "h-1.5",
  barClassName = "bg-sky-300",
}: {
  value: number;
  max: number;
  label?: string;
  className?: string;
  barClassName?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className={`overflow-hidden rounded-full bg-slate-100 ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
