// Membuat 6 akun demo (1 per role + dokter kedua) dan pasien dummy di Supabase.
// Pakai: npm run db:seed   (butuh NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD di .env.local)
// Semua data di sini fiktif (lihat lib/demo-seed.ts).
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { DEMO_USERS, buildDemoPatients, type DemoKey } from "../lib/demo-seed";

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
  const ids: Partial<Record<DemoKey, string>> = {};
  for (const u of DEMO_USERS) {
    const existing = data.users.find((x) => x.email === u.email);
    if (existing) {
      ids[u.key] = existing.id;
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
    ids[u.key] = created.user.id;
    console.log(`+ akun ${u.email} (${u.role}) dibuat`);
  }
  return ids as Record<DemoKey, string>;
}

async function seedPatients(ids: Record<DemoKey, string>) {
  const { count } = await admin.from("patients").select("id", { count: "exact", head: true });
  if (count && count > 0) {
    console.log(`✓ tabel pasien sudah berisi ${count} data, seed pasien dilewati`);
    return;
  }

  // Ratusan pasien pengisi kuota: id dibuat di sini lalu semua tabel di-insert per kelompok
  const rows: Record<"patients" | "stage_events" | "fractions" | "attendance", Record<string, unknown>[]> = {
    patients: [],
    stage_events: [],
    fractions: [],
    attendance: [],
  };
  for (const rec of buildDemoPatients(ids)) {
    const id = randomUUID();
    rows.patients.push({ id, ...rec.patient });
    rows.stage_events.push(...rec.events.map((e) => ({ ...e, patient_id: id })));
    rows.fractions.push(...rec.fractions.map((f) => ({ ...f, patient_id: id })));
    rows.attendance.push(...rec.attendance.map((a) => ({ ...a, patient_id: id })));
  }
  for (const [table, list] of Object.entries(rows)) {
    for (let i = 0; i < list.length; i += 500) {
      const { error } = await admin.from(table).insert(list.slice(i, i + 500));
      if (error) throw error;
    }
    console.log(`+ ${list.length} baris ${table}`);
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
