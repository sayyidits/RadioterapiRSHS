import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { DEMO_USERS } from "./demo-seed";
import { asUser, selectJson } from "./demo/db";
import { IS_DEMO } from "./mode";
import { demoUserId } from "./rpc";
import { createClient } from "./supabase/server";
import type { Akun, CurrentUser } from "./types";

const PROFILE_COLUMNS = "id, full_name, email, role, akses, status, created_at, diproses_at";

/**
 * Akun yang sedang login, apa pun status persetujuannya (untuk halaman lengkapi profil
 * dan menunggu persetujuan). Belum login: ke /login.
 */
export const getSessionProfile = cache(async (): Promise<Akun> => {
  if (IS_DEMO) {
    const uid = await demoUserId();
    if (!uid) redirect("/login");
    // Cookie berisi akun yang tidak dikenal: proxy.ts menghapusnya di /login?sesi=habis
    if (!DEMO_USERS.some((u) => u.id === uid)) redirect("/login?sesi=habis");
    const [profile] = await asUser(uid, (tx) =>
      selectJson<Akun>(tx, `select ${PROFILE_COLUMNS} from public.profiles where id = $1`, [uid]),
    );
    if (!profile) redirect("/login?sesi=habis");
    return profile;
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const uid = claimsData?.claims?.sub;
  if (!uid) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", uid).maybeSingle();
  if (!profile) redirect("/login?error=profil");
  return profile as Akun;
});

/**
 * Data Access Layer: user aktif yang sedang login beserta role kerja dan hak aksesnya.
 * Akun yang belum melengkapi profil (atau aktif tanpa role kerja) ke /daftar, yang belum
 * disetujui (atau ditolak/nonaktif) ke /menunggu.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const akun = await getSessionProfile();
  if (akun.status === "baru" || (akun.status === "aktif" && !akun.role)) redirect("/daftar");
  if (akun.status !== "aktif" || !akun.role) redirect("/menunggu");
  return { id: akun.id, full_name: akun.full_name, role: akun.role, akses: akun.akses, email: akun.email ?? "" };
});
