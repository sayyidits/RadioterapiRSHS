"use server";

import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/rpc";
import type { ActionState } from "@/lib/types";

/** Ganti nama lengkap sendiri (0015). Aturan sebenarnya ditegakkan oleh ganti_nama di database. */
export async function gantiNamaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const nama = String(formData.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  if (nama.length < 3) return { error: "Nama lengkap beserta gelar wajib diisi (minimal 3 karakter)" };
  if (nama.length > 100) return { error: "Nama terlalu panjang (maksimal 100 karakter)" };

  const { error } = await rpc<string>("ganti_nama", { p_full_name: nama });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: "Nama tersimpan." };
}
