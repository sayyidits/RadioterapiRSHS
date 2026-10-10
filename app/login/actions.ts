"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_USERS } from "@/lib/demo-seed";
import { resetDemoDb } from "@/lib/demo/db";
import { DEMO_COOKIE, IS_DEMO } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

/** Alamat website ini (localhost saat development, domain Vercel saat produksi) untuk redirect dari Supabase */
async function siteOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

/** Pesan error Supabase Auth (bahasa Inggris) dalam bahasa Indonesia */
function authMessage(message: string) {
  if (/invalid login credentials/i.test(message))
    return "Email atau password salah. Kalau Anda mendaftar dengan Google, masuk dengan tombol Google lalu atur password di menu Profil.";
  if (/email not confirmed/i.test(message)) return "Email belum dikonfirmasi. Buka tautan konfirmasi di email Anda.";
  if (/rate limit/i.test(message)) return "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.";
  return message;
}

function readCredentials(formData: FormData) {
  return { email: String(formData.get("email") ?? "").trim(), password: String(formData.get("password") ?? "") };
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "Email dan password wajib diisi" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authMessage(error.message) };

  // Akun yang belum lengkap / belum disetujui diarahkan oleh getCurrentUser
  redirect("/");
}

/** Masuk dengan Google. Supabase mengembalikan pengguna ke /auth/callback. */
export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function signOut() {
  if (IS_DEMO) {
    (await cookies()).delete(DEMO_COOKIE);
  } else {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

/** Mode demo: masuk / ganti role tanpa password. */
export async function demoSignIn(formData: FormData) {
  if (!IS_DEMO) redirect("/login");
  const user = DEMO_USERS.find((u) => u.id === formData.get("uid"));
  if (!user) redirect("/login");

  (await cookies()).set(DEMO_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/" });

  // Tetap di halaman yang sama saat ganti role (hanya path internal)
  const next = String(formData.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

/** Mode demo: kembalikan data ke kondisi awal (±350 pasien dummy dari lib/demo-seed.ts). */
export async function resetDemo() {
  if (!IS_DEMO) return;
  await resetDemoDb();
  revalidatePath("/", "layout");
}
