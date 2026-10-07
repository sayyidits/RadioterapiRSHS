import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

/** Data Access Layer: user yang sedang login beserta role-nya. */
export const getCurrentUser = cache(async (): Promise<Profile & { email: string }> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", claims.sub)
    .single();
  if (!profile) redirect("/login?error=profil");

  return { ...(profile as Profile), email: String(claims.email ?? "") };
});
