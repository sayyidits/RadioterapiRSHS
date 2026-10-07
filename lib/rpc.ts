import "server-only";
import { cookies } from "next/headers";
import { asUser } from "./demo/db";
import { DEMO_COOKIE, IS_DEMO } from "./mode";
import { createClient } from "./supabase/server";

type RpcResult<T> = { data: T | null; error: { message: string } | null };

/** Panggil fungsi Postgres (create_patient, advance_stage, ...) sebagai user yang sedang login. */
export async function rpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  if (!IS_DEMO) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(name, args);
    return { data: data as T | null, error };
  }

  const uid = await demoUserId();
  if (!uid) return { data: null, error: { message: "Sesi berakhir, silakan pilih role lagi" } };
  const keys = Object.keys(args);
  const values = keys.map((k) => {
    const v = args[k];
    return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
  });
  try {
    const data = await asUser(uid, async (tx) => {
      const { rows } = await tx.query<{ r: T }>(
        `select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`,
        values,
      );
      return rows[0]?.r ?? null;
    });
    return { data, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

export async function demoUserId() {
  return (await cookies()).get(DEMO_COOKIE)?.value ?? null;
}
