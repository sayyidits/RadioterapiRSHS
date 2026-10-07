"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_USERS } from "@/lib/demo-seed";
import { resetDemoDb } from "@/lib/demo/db";
import { DEMO_COOKIE, IS_DEMO } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email dan password wajib diisi" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email atau password salah" };

  redirect("/");
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

/** Mode demo: kembalikan data ke kondisi awal (10 pasien dummy). */
export async function resetDemo() {
  if (!IS_DEMO) return;
  await resetDemoDb();
  revalidatePath("/", "layout");
}
