/**
 * Mode demo: `npm run dev:demo` (NEXT_PUBLIC_DEMO=1), atau otomatis bila Supabase belum
 * dikonfigurasi. Nilainya ditanam saat server dev/build dimulai, jadi ganti mode = restart server.
 */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1" || !process.env.NEXT_PUBLIC_SUPABASE_URL;

export const DEMO_COOKIE = "demo_uid";
