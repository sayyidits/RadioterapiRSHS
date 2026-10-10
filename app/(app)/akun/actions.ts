"use server";

import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/rpc";
import type { ActionState } from "@/lib/types";
import { AKSES, ROLES } from "@/lib/workflow";

const PESAN = { aktif: "Tersimpan.", ditolak: "Pendaftaran ditolak.", nonaktif: "Akun dinonaktifkan." } as const;

/**
 * Admin/Master: setujui (boleh sekaligus mengganti role kerja / hak akses), tolak, atau
 * nonaktifkan akun. Batas hierarki ditegakkan oleh atur_akun di database.
 */
export async function aturAkunAction(userId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const status = String(formData.get("status") ?? "");
  const role = String(formData.get("role") ?? "") || null;
  const akses = String(formData.get("akses") ?? "") || null;
  if (!(status in PESAN)) return { error: "Aksi tidak valid" };
  if (role && !(role in ROLES)) return { error: "Role tidak valid" };
  if (akses && !(akses in AKSES)) return { error: "Hak akses tidak valid" };

  const { error } = await rpc("atur_akun", { p_user: userId, p_status: status, p_role: role, p_akses: akses });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: PESAN[status as keyof typeof PESAN] };
}
