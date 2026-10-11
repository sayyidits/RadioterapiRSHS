/**
 * Mode demo: `npm run dev:demo` (NEXT_PUBLIC_DEMO=1), atau otomatis bila Supabase belum
 * dikonfigurasi. Nilainya ditanam saat server dev/build dimulai, jadi ganti mode = restart server.
 *
 * Pengaman: di produksi Vercel (VERCEL_ENV=production) mode demo tidak pernah aktif, walaupun
 * NEXT_PUBLIC_DEMO terpasang. Tanpa Supabase, situs akan error alih-alih diam-diam jadi demo
 * tanpa login. VERCEL_ENV hanya terbaca di server; modul ini memang hanya dipakai di server.
 */
const mintaDemo = process.env.NEXT_PUBLIC_DEMO === "1" || !process.env.NEXT_PUBLIC_SUPABASE_URL;
export const IS_DEMO = mintaDemo && process.env.VERCEL_ENV !== "production";

export const DEMO_COOKIE = "demo_uid";
