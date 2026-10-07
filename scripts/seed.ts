// Membuat 5 akun demo (1 per role) dan pasien dummy di Supabase.
// Pakai: npm run db:seed   (butuh NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD di .env.local)
// Semua data di sini fiktif (lihat lib/demo-seed.ts).
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { DEMO_USERS, buildDemoPatients } from "../lib/demo-seed";
import type { Role } from "../lib/workflow";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;
if (!url || !serviceKey || !password || password.length < 8) {
  console.error("Isi NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan DEMO_PASSWORD (min. 8 karakter) di .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function ensureUsers() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const ids: Partial<Record<Role, string>> = {};
  for (const u of DEMO_USERS) {
    const existing = data.users.find((x) => x.email === u.email);
    if (existing) {
      ids[u.role] = existing.id;
      console.log(`✓ akun ${u.email} sudah ada`);
      continue;
    }
    const { data: created, error: err } = await admin.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, role: u.role },
    });
    if (err) throw err;
    ids[u.role] = created.user.id;
    console.log(`+ akun ${u.email} (${u.role}) dibuat`);
  }
  return ids as Record<Role, string>;
}

async function seedPatients(ids: Record<Role, string>) {
  const { count } = await admin.from("patients").select("id", { count: "exact", head: true });
  if (count && count > 0) {
    console.log(`✓ tabel pasien sudah berisi ${count} data, seed pasien dilewati`);
    return;
  }

  for (const rec of buildDemoPatients(ids)) {
    const { data: row, error } = await admin.from("patients").insert(rec.patient).select("id").single();
    if (error) throw error;

    const { error: evErr } = await admin.from("stage_events").insert(rec.events.map((e) => ({ ...e, patient_id: row.id })));
    if (evErr) throw evErr;
    if (rec.fractions.length) {
      const { error: fxErr } = await admin.from("fractions").insert(rec.fractions.map((f) => ({ ...f, patient_id: row.id })));
      if (fxErr) throw fxErr;
    }
    console.log(`+ pasien ${rec.patient.nama} (${rec.patient.current_stage})`);
  }
}

ensureUsers()
  .then(seedPatients)
  .then(() => {
    console.log("\nSelesai. Login dengan email di atas dan password dari DEMO_PASSWORD.");
  })
  .catch((err) => {
    console.error("Gagal:", err.message ?? err);
    process.exit(1);
  });
