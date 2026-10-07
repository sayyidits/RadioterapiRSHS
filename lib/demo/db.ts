import "server-only";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DEMO_USERS, buildDemoPatients } from "../demo-seed";
import type { Role } from "../workflow";

// Mode demo: Postgres (PGlite) berjalan di dalam proses Next.js, memakai
// migration SQL yang sama dengan Supabase. Data disimpan di node_modules/.cache/demo-db
// (di luar pantauan file watcher). Di Vercel hanya di memori, hilang saat server restart.
const DATA_DIR = process.env.VERCEL ? "memory://" : join(process.cwd(), "node_modules", ".cache", "demo-db");

// Pengganti minimal skema auth Supabase
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

const globalForDb = globalThis as unknown as { __demoDb?: Promise<PGlite> };

export function getDemoDb() {
  globalForDb.__demoDb ??= open().catch((err) => {
    globalForDb.__demoDb = undefined; // coba lagi di request berikutnya
    throw err;
  });
  return globalForDb.__demoDb;
}

async function open() {
  if (!DATA_DIR.startsWith("memory://")) mkdirSync(DATA_DIR, { recursive: true });
  const db = new PGlite(DATA_DIR);
  await db.waitReady;
  const { rows } = await db.query<{ ok: boolean }>("select to_regclass('public.patients') is not null as ok");
  if (!rows[0].ok) await initialize(db);
  return db;
}

async function initialize(db: PGlite) {
  await db.exec(SUPABASE_STUB);
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }

  for (const u of DEMO_USERS) {
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)", [
      u.id,
      u.email,
      JSON.stringify({ full_name: u.full_name, role: u.role }),
    ]);
  }

  const ids = Object.fromEntries(DEMO_USERS.map((u) => [u.role, u.id])) as Record<Role, string>;
  for (const rec of buildDemoPatients(ids)) {
    const { rows } = await insert<{ id: string }>(db, "patients", rec.patient, "id");
    for (const e of rec.events) await insert(db, "stage_events", { ...e, patient_id: rows[0].id });
    for (const f of rec.fractions) await insert(db, "fractions", { ...f, patient_id: rows[0].id });
  }
}

function insert<T>(db: PGlite, table: string, row: Record<string, unknown>, returning?: string) {
  const cols = Object.keys(row);
  const values = cols.map((c) => {
    const v = row[c];
    return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
  });
  const sql = `insert into public.${table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})${
    returning ? ` returning ${returning}` : ""
  }`;
  return db.query<T>(sql, values);
}

/** Jalankan query sebagai user tertentu (role authenticated + auth.uid()), seperti di Supabase. */
export async function asUser<T>(userId: string, fn: (tx: Transaction) => Promise<T>) {
  const db = await getDemoDb();
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await tx.exec("set local role authenticated");
    return fn(tx);
  });
}

/** Ambil baris sebagai JSON supaya tanggal & angka bentuknya sama dengan respons Supabase. */
export async function selectJson<T>(tx: Transaction, sql: string, params: unknown[] = []) {
  const { rows } = await tx.query<{ r: T }>(`select row_to_json(t) as r from (${sql}) t`, params);
  return rows.map((row) => row.r);
}

/** Kosongkan dan isi ulang data demo. */
export async function resetDemoDb() {
  const current = globalForDb.__demoDb;
  globalForDb.__demoDb = undefined;
  if (current) await (await current).close();
  if (!DATA_DIR.startsWith("memory://") && existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
  await getDemoDb();
}
