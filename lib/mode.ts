/** Mode demo aktif jika Supabase belum dikonfigurasi. */
export const IS_DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL;

export const DEMO_COOKIE = "demo_uid";
