"use server";

import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/rpc";
import type { ActionState, HasilUndangan } from "@/lib/types";
import { AKSES, ROLES, type Akses, type Role } from "@/lib/workflow";

const PESAN = { aktif: "Tersimpan.", ditolak: "Akun ditolak.", nonaktif: "Akun dinonaktifkan." } as const;

/**
 * Admin/Master: aktifkan (boleh sekaligus mengganti role kerja / hak akses), tolak, atau
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

export type UndangState = { error?: string; hasil?: HasilUndangan[] } | undefined;

/** "Dokter Sp.Onk.Rad", "dokter", "Fisikawan Medis", "fismed", ... → kunci role */
function parseRole(value: string): Role | string {
  const v = value.trim().toLowerCase();
  if (v.startsWith("dok") || v.startsWith("dr")) return "dokter";
  if (v.startsWith("pera") || v.startsWith("ns")) return "perawat";
  if (v.startsWith("rtt") || v.startsWith("radiog") || v.startsWith("radioter")) return "rtt";
  if (v.startsWith("fis")) return "fismed";
  if (v.startsWith("adm")) return "administrasi";
  return v;
}

function parseAkses(value: string | undefined): Akses {
  const v = (value ?? "").trim().toLowerCase();
  return v === "master" || v === "admin" ? v : "nakes";
}

/**
 * Daftarkan akun lewat undangan. Isian tunggal (email, full_name, role, akses) atau banyak baris
 * sekaligus di `daftar`: tempelan dari Excel (kolom dipisah Tab, `;`, atau `|`):
 * email | nama lengkap + gelar | role kerja | hak akses (opsional).
 */
export async function undangAkunAction(_prev: UndangState, formData: FormData): Promise<UndangState> {
  const daftar = String(formData.get("daftar") ?? "").trim();
  const items = daftar
    ? daftar
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => line.split(/\t|;|\|/).map((c) => c.trim()))
        // Baris pertama tanpa "@" dianggap judul kolom; baris lain yang salah tetap dilaporkan
        .filter((cols, i) => i > 0 || cols[0]?.includes("@"))
        .map(([email, full_name = "", role = "", akses]) => ({ email, full_name, role: parseRole(role), akses: parseAkses(akses) }))
    : [
        {
          email: String(formData.get("email") ?? "").trim(),
          full_name: String(formData.get("full_name") ?? "").trim(),
          role: String(formData.get("role") ?? ""),
          akses: parseAkses(String(formData.get("akses") ?? "")),
        },
      ];
  if (items.length === 0 || !items[0].email) return { error: "Isi email yang akan didaftarkan" };
  if (items.length > 200) return { error: "Maksimal 200 baris sekali tempel" };

  const { data, error } = await rpc<HasilUndangan[]>("undang_akun", { p_items: items });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { hasil: data ?? [] };
}

/** Hapus undangan yang belum dipakai */
export async function hapusUndanganAction(email: string): Promise<ActionState> {
  const { error } = await rpc("hapus_undangan", { p_email: email });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { success: "Undangan dihapus." };
}
