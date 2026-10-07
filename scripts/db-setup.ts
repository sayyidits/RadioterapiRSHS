// Menjalankan file SQL di supabase/migrations secara berurutan (sekali saja per file).
// Pakai: npm run db:setup   (butuh SUPABASE_DB_URL di .env.local)
import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL_NON_POOLING;
if (!url) {
  console.error("SUPABASE_DB_URL belum diisi di .env.local");
  console.error("Alternatif: buka Supabase > SQL Editor, lalu tempel isi supabase/migrations/0001_init.sql dan Run.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });

async function main() {
  await sql`create schema if not exists app_private`;
  await sql`create table if not exists app_private.migrations (name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql<{ name: string }[]>`select name from app_private.migrations`).map((r) => r.name));

  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`✓ ${file} (sudah diterapkan)`);
      continue;
    }
    const body = readFileSync(join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into app_private.migrations (name) values (${file})`;
    });
    console.log(`+ ${file} diterapkan`);
  }
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error("Gagal:", err.message);
    await sql.end();
    process.exit(1);
  });
