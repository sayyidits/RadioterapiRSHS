"use server";

import { IS_DEMO } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

/**
 * Atur / ganti password akun yang sedang login. Akun yang mendaftar lewat Google belum punya
 * password; setelah diatur, akun yang sama bisa dimasuki dengan email + password juga.
 */
export async function setPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (IS_DEMO) return { error: "Mode demo tidak memakai password." };
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password minimal 8 karakter" };
  if (password !== formData.get("konfirmasi")) return { error: "Konfirmasi password tidak sama" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (/different from the old/i.test(error.message)) return { error: "Password baru sama dengan password lama." };
    if (/reauthenticat|nonce/i.test(error.message))
      return { error: "Demi keamanan, keluar lalu masuk lagi, kemudian ulangi pengaturan password." };
    if (/weak|at least/i.test(error.message)) return { error: "Password terlalu lemah. Gunakan kombinasi huruf, angka, dan simbol." };
    return { error: error.message };
  }
  return { success: "Password tersimpan. Anda sekarang bisa masuk dengan email dan password ini, selain tombol Google." };
}
