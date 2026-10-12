/**
 * Tampil seketika saat pindah halaman di dalam aplikasi, selama data halaman tujuan diambil dari
 * server. Tanpa ini Next.js menahan halaman lama sampai halaman baru siap, sehingga terasa macet
 * (perpindahan lewat menu tidak memunculkan ikon loading di tab browser).
 */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-r-transparent" />
        Memuat halaman…
      </p>
      <div aria-hidden className="animate-pulse space-y-4">
        <div className="h-7 w-48 rounded-lg bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
