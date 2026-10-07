import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { DEMO_USERS } from "./demo-seed";
import { asUser, selectJson } from "./demo/db";
import { IS_DEMO } from "./mode";
import { demoUserId } from "./rpc";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

/** Data Access Layer: user yang sedang login beserta role-nya. */
export const getCurrentUser = cache(async (): Promise<Profile & { email: string }> => {
  if (IS_DEMO) {
    const uid = await demoUserId();
    const demoUser = DEMO_USERS.find((u) => u.id === uid);
    if (!uid || !demoUser) redirect("/login");
    const [profile] = await asUser(uid, (tx) =>
      selectJson<Profile>(tx, "select id, full_name, role from public.profiles where id = $1", [uid]),
    );
    if (!profile) redirect("/login");
    return { ...profile, email: demoUser.email };
  }

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
