"use server";

import { redirect } from "next/navigation";
import { rpc } from "@/lib/rpc";
import type { ActionState } from "@/lib/types";
import type { StatusAkun } from "@/lib/types";
import { ROLE_LIST, type Role } from "@/lib/workflow";

export async function lengkapiProfilAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const nama = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;
  if (nama.length < 3) return { error: "Nama lengkap beserta gelar wajib diisi" };
  if (!ROLE_LIST.includes(role)) return { error: "Pilih role Anda" };

  const { data, error } = await rpc<StatusAkun>("lengkapi_profil", { p_full_name: nama, p_role: role });
  if (error) return { error: error.message };
  // Akun yang sudah aktif (Master lama tanpa role kerja) langsung ke dashboard
  redirect(data === "aktif" ? "/" : "/menunggu");
}
