/** Deretan angka ringkas di atas halaman; `highlight` menandai yang perlu ditindaklanjuti. */
export function StatCards({ stats }: { stats: { label: string; value: number; highlight?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className={`card p-4 ${s.highlight ? "border-teal-300 bg-teal-50" : ""}`}>
          <p className="text-xs font-medium text-slate-500">{s.label}</p>
          <p className={`mt-1 text-2xl font-semibold ${s.highlight ? "text-teal-800" : ""}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
