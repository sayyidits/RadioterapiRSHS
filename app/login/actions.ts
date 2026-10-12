"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_USERS } from "@/lib/demo-seed";
import { resetDemoDb } from "@/lib/demo/db";
import { DEMO_COOKIE, IS_DEMO } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";

/** Alamat website ini (localhost saat development, domain Vercel saat produksi) untuk redirect dari Supabase */
async function siteOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

/**
 * Masuk dengan Google, satu-satunya cara masuk (login email + password dihapus, audit A5).
 * Supabase mengembalikan pengguna ke /auth/callback.
 */
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
