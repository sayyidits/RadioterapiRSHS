import "server-only";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DEMO_PENDAFTAR, DEMO_UNDANGAN, DEMO_USERS, buildDemoPatients, type DemoKey } from "../demo-seed";

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
    raw_user_meta_data jsonb,
    raw_app_meta_data jsonb,
    email_confirmed_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

const globalForDb = globalThis as unknown as { __demoDb?: Promise<PGlite>; __demoDbFingerprint?: string };

export function getDemoDb() {
  // Saat development migration dicek ulang tiap request, jadi perubahan SQL
  // langsung terpakai (data demo dibuat ulang) tanpa restart dev server.
  const recheck = !globalForDb.__demoDb || process.env.NODE_ENV !== "production";
  const fingerprint = recheck ? migrationsFingerprint() : globalForDb.__demoDbFingerprint!;
  if (!globalForDb.__demoDb || fingerprint !== globalForDb.__demoDbFingerprint) {
    const previous = globalForDb.__demoDb;
    globalForDb.__demoDbFingerprint = fingerprint;
    globalForDb.__demoDb = Promise.resolve(previous?.then((db) => db.close()).catch(() => {}))
      .then(() => open(fingerprint))
      .catch((err) => {
        globalForDb.__demoDb = undefined; // coba lagi di request berikutnya
        throw err;
      });
  }
  return globalForDb.__demoDb;
}

function readMigrations() {
  const dir = join(process.cwd(), "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => ({ file, sql: readFileSync(join(dir, file), "utf8") }));
}

/** Sidik jari isi migration. Kalau berubah, data demo dibuat ulang dari awal. */
function migrationsFingerprint() {
  const hash = createHash("sha256");
  for (const m of readMigrations()) hash.update(m.file).update(m.sql);
  return hash.digest("hex");
}

async function open(fingerprint: string) {
  const persistent = !DATA_DIR.startsWith("memory://");
  if (persistent) mkdirSync(DATA_DIR, { recursive: true });
  let db = new PGlite(DATA_DIR);
  await db.waitReady;

  const { rows } = await db.query<{ ok: boolean }>("select to_regclass('public.patients') is not null as ok");
  if (rows[0].ok && (await storedFingerprint(db)) === fingerprint) return db;

  if (rows[0].ok) {
    // Migration SQL sudah berubah sejak data demo dibuat: buang dan isi ulang
    await db.close();
    if (persistent) {
      rmSync(DATA_DIR, { recursive: true, force: true });
      mkdirSync(DATA_DIR, { recursive: true });
    }
    db = new PGlite(DATA_DIR);
    await db.waitReady;
  }
  await initialize(db, fingerprint);
  return db;
}

async function storedFingerprint(db: PGlite) {
  const { rows } = await db.query<{ ok: boolean }>("select to_regclass('app_private.demo_meta') is not null as ok");
  if (!rows[0].ok) return null;
  const meta = await db.query<{ fingerprint: string }>("select fingerprint from app_private.demo_meta limit 1");
  return meta.rows[0]?.fingerprint ?? null;
}

async function initialize(db: PGlite, fingerprint: string) {
  await db.exec(SUPABASE_STUB);
  for (const m of readMigrations()) await db.exec(m.sql);
  await db.exec("create schema if not exists app_private; create table app_private.demo_meta (fingerprint text not null)");
  await db.query("insert into app_private.demo_meta (fingerprint) values ($1)", [fingerprint]);

  // Akun demo dibuat "administrator": role di app_metadata, jadi langsung aktif (sama dengan scripts/seed.ts)
  for (const u of DEMO_USERS) {
    await db.query(
      "insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values ($1, $2, $3::jsonb, $4::jsonb)",
      [u.id, u.email, JSON.stringify({ full_name: u.full_name }), JSON.stringify({ role: u.role, akses: u.akses ?? "nakes" })],
    );
  }
  // Pernah masuk dengan Google tetapi belum didaftarkan: profil 'baru' tanpa akses
  for (const p of DEMO_PENDAFTAR) {
    await db.query(
      "insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values ($1, $2, $3::jsonb, now())",
      [p.id, p.email, JSON.stringify({ full_name: p.full_name })],
    );
  }
  // Undangan yang belum dipakai (dibuat Admin/Master, pemiliknya belum pernah masuk)
  const [admin] = DEMO_USERS.filter((u) => u.akses === "admin");
  for (const u of DEMO_UNDANGAN) {
    await db.query(
      "insert into public.undangan_akun (email, full_name, role, akses, dibuat_oleh) values ($1, $2, $3, 'nakes', $4)",
      [u.email, u.full_name, u.role, admin.id],
    );
  }

  const ids = Object.fromEntries(DEMO_USERS.map((u) => [u.key, u.id])) as Record<DemoKey, string>;
  const rows = { patients: [], stage_events: [], fractions: [], attendance: [] } as Record<string, Record<string, unknown>[]>;
  for (const rec of buildDemoPatients(ids)) {
    const id = randomUUID();
    rows.patients.push({ id, ...rec.patient });
    for (const e of rec.events) rows.stage_events.push({ ...e, patient_id: id });
    for (const f of rec.fractions) rows.fractions.push({ ...f, patient_id: id });
    for (const a of rec.attendance) rows.attendance.push({ ...a, patient_id: id });
  }
  // Ratusan pasien dan ribuan fraksi: insert banyak baris sekaligus
  for (const [table, list] of Object.entries(rows)) await insertMany(db, table, list);
}

/** Insert per kelompok baris dengan kolom yang sama, maksimal 500 baris per query. */
async function insertMany(db: PGlite, table: string, rows: Record<string, unknown>[]) {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = Object.keys(row).join(",");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const [key, list] of groups) {
    const cols = key.split(",");
    for (let i = 0; i < list.length; i += 500) {
      const chunk = list.slice(i, i + 500);
      const values: unknown[] = [];
      const tuples = chunk.map((row) => {
        const start = values.length;
        for (const c of cols) {
          const v = row[c];
          values.push(v !== null && typeof v === "object" ? JSON.stringify(v) : v);
        }
        return `(${cols.map((_, j) => `$${start + j + 1}`).join(", ")})`;
      });
      await db.query(`insert into public.${table} (${cols.join(", ")}) values ${tuples.join(", ")}`, values);
    }
  }
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
