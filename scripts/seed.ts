// Membuat 5 akun demo (1 per role) dan pasien dummy di berbagai tahap.
// Pakai: npm run db:seed   (butuh NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD di .env.local)
// Semua data di sini fiktif.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { STAGE_KEYS, type Role, type StageKey } from "../lib/workflow";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;
if (!url || !serviceKey || !password || password.length < 8) {
  console.error("Isi NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan DEMO_PASSWORD (min. 8 karakter) di .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const DEMO_USERS: { email: string; full_name: string; role: Role }[] = [
  { email: "dokter@flowrt.test", full_name: "dr. Andi Pratama, Sp.Onk.Rad", role: "dokter" },
  { email: "perawat@flowrt.test", full_name: "Ns. Sari Wulandari", role: "perawat" },
  { email: "rtt@flowrt.test", full_name: "Budi Santoso, A.Md.Rad", role: "rtt" },
  { email: "fismed@flowrt.test", full_name: "Rina Kusuma, M.Si", role: "fismed" },
  { email: "admin@flowrt.test", full_name: "Dewi Lestari", role: "administrasi" },
];

type SeedPatient = {
  no_rm: string;
  nama: string;
  tgl_lahir: string;
  jenis_kelamin: "L" | "P";
  no_hp: string;
  diagnosis: string;
  area: string;
  dosis: number;
  fraksi: number;
  teknik: string;
  stage: StageKey;
  fractionsDone?: number;
  returnedFromAccPlan?: boolean;
};

const PATIENTS: SeedPatient[] = [
  { no_rm: "RM-000101", nama: "Siti Aminah", tgl_lahir: "1968-04-12", jenis_kelamin: "P", no_hp: "081200000101", diagnosis: "Ca serviks stadium IIB", area: "Pelvis", dosis: 50, fraksi: 25, teknik: "VMAT", stage: "POLI" },
  { no_rm: "RM-000102", nama: "Joko Susilo", tgl_lahir: "1959-09-30", jenis_kelamin: "L", no_hp: "081200000102", diagnosis: "Ca nasofaring T3N2M0", area: "Kepala leher", dosis: 70, fraksi: 35, teknik: "IMRT", stage: "POLI" },
  { no_rm: "RM-000103", nama: "Ratna Dewi", tgl_lahir: "1975-01-18", jenis_kelamin: "P", no_hp: "081200000103", diagnosis: "Ca mammae dekstra post MRM", area: "Dinding dada + supraklavikula", dosis: 50, fraksi: 25, teknik: "3DCRT", stage: "CT_SIM" },
  { no_rm: "RM-000104", nama: "Bambang Hartono", tgl_lahir: "1952-06-05", jenis_kelamin: "L", no_hp: "081200000104", diagnosis: "Ca prostat risiko tinggi", area: "Prostat + vesikula seminalis", dosis: 70, fraksi: 28, teknik: "VMAT", stage: "DELINEASI" },
  { no_rm: "RM-000105", nama: "Agus Salim", tgl_lahir: "1964-11-22", jenis_kelamin: "L", no_hp: "081200000105", diagnosis: "Ca rekti post LAR", area: "Pelvis", dosis: 50.4, fraksi: 28, teknik: "IMRT", stage: "PLANNING", returnedFromAccPlan: true },
  { no_rm: "RM-000106", nama: "Maria Ulfa", tgl_lahir: "1980-03-09", jenis_kelamin: "P", no_hp: "081200000106", diagnosis: "Ca mammae sinistra post BCS", area: "Payudara kiri", dosis: 40, fraksi: 15, teknik: "3DCRT", stage: "ACC_PLAN" },
  { no_rm: "RM-000107", nama: "Hendra Wijaya", tgl_lahir: "1971-07-14", jenis_kelamin: "L", no_hp: "081200000107", diagnosis: "Glioblastoma post reseksi", area: "Otak", dosis: 60, fraksi: 30, teknik: "VMAT", stage: "VERIFIKASI" },
  { no_rm: "RM-000108", nama: "Yuliana Putri", tgl_lahir: "1966-12-01", jenis_kelamin: "P", no_hp: "081200000108", diagnosis: "Ca serviks stadium IIIB", area: "Pelvis + paraaorta", dosis: 50, fraksi: 25, teknik: "VMAT", stage: "PENYINARAN", fractionsDone: 12 },
  { no_rm: "RM-000109", nama: "Slamet Riyadi", tgl_lahir: "1949-02-27", jenis_kelamin: "L", no_hp: "081200000109", diagnosis: "Metastasis tulang vertebra lumbal", area: "Vertebra L2-L4", dosis: 20, fraksi: 5, teknik: "3DCRT", stage: "PENYINARAN", fractionsDone: 3 },
  { no_rm: "RM-000110", nama: "Kartini Rahayu", tgl_lahir: "1958-08-17", jenis_kelamin: "P", no_hp: "081200000110", diagnosis: "Metastasis otak multipel", area: "Whole brain", dosis: 20, fraksi: 5, teknik: "3DCRT", stage: "SELESAI", fractionsDone: 5 },
];

const OWNER: Partial<Record<StageKey, Role>> = {
  PENDAFTARAN: "administrasi",
  POLI: "dokter",
  CT_SIM: "rtt",
  DELINEASI: "dokter",
  PLANNING: "fismed",
  ACC_PLAN: "dokter",
  VERIFIKASI: "rtt",
};

function payloadFor(stage: StageKey, p: SeedPatient, date: string): Record<string, unknown> {
  switch (stage) {
    case "POLI":
      return { diagnosis_kerja: p.diagnosis, intent: p.dosis <= 30 ? "Paliatif" : "Kuratif", area_radiasi: p.area };
    case "CT_SIM":
      return { tanggal_ct: date, posisi: "Supine", imobilisasi: p.area.includes("Kepala") || p.area.includes("Otak") || p.area.includes("brain") ? "Thermoplastic mask" : "Vacloc" };
    case "DELINEASI":
      return { dosis_total_gy: p.dosis, total_fraksi: p.fraksi, catatan_kontur: "GTV, CTV, PTV dan OAR selesai dikontur" };
    case "PLANNING":
      return { teknik: p.teknik, tps: `Plan_${p.no_rm}_v1` };
    case "ACC_PLAN":
      return { dosis_total_gy: p.dosis, total_fraksi: p.fraksi, catatan: "Plan disetujui" };
    case "VERIFIKASI":
      return { tanggal_verifikasi: date, mesin: "LINAC 1", metode: p.teknik === "3DCRT" ? ["DRR", "EPID"] : ["CBCT", "QA"], hasil: "Lolos, shift dalam toleransi" };
    default:
      return {};
  }
}

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

  for (const [i, p] of PATIENTS.entries()) {
    const target = STAGE_KEYS.indexOf(p.stage);
    // Mundur dari hari ini: tiap tahap ~2 hari, tiap fraksi 1 hari kerja
    let t = Date.now() - (target * 2 + (p.fractionsDone ?? 0) * 1.4 + (p.returnedFromAccPlan ? 3 : 0) + i * 0.1) * 86_400_000;
    const ts = () => new Date(t).toISOString();
    const day = () => new Date(t).toISOString().slice(0, 10);
    const step = (days: number) => (t += days * 86_400_000);

    const data: Record<string, unknown> = {};
    const events: Record<string, unknown>[] = [];
    events.push({ from_stage: "PENDAFTARAN", to_stage: "POLI", action: "create", actor_id: ids.administrasi, actor_role: "administrasi", note: "Pasien didaftarkan dan dikirim ke Poli", created_at: ts() });
    let entered = ts();

    // Lewati tahap POLI .. VERIFIKASI yang sudah selesai (PENYINARAN dicatat lewat fraksi)
    const lastManual = Math.min(target, STAGE_KEYS.indexOf("PENYINARAN"));
    for (let s = 1; s < lastManual; s++) {
      const stage = STAGE_KEYS[s];
      const owner = OWNER[stage]!;
      step(1.5 + Math.random());
      const payload = payloadFor(stage, p, day());
      data[stage] = { ...payload, _at: ts(), _by: ids[owner] };
      events.push({ from_stage: stage, to_stage: STAGE_KEYS[s + 1], action: "advance", actor_id: ids[owner], actor_role: owner, payload, created_at: ts() });
      entered = ts();
    }

    // Contoh plan yang dikembalikan dokter dari ACC Planning ke Planning
    if (p.returnedFromAccPlan) {
      step(1.5);
      data.PLANNING = { ...payloadFor("PLANNING", p, day()), _at: ts(), _by: ids.fismed };
      events.push({ from_stage: "PLANNING", to_stage: "ACC_PLAN", action: "advance", actor_id: ids.fismed, actor_role: "fismed", payload: payloadFor("PLANNING", p, day()), created_at: ts() });
      step(1);
      events.push({ from_stage: "ACC_PLAN", to_stage: "PLANNING", action: "return", actor_id: ids.dokter, actor_role: "dokter", note: "Dosis rektum melebihi constraint, mohon optimasi ulang", created_at: ts() });
      entered = ts();
    }

    const fractions: Record<string, unknown>[] = [];
    for (let f = 1; f <= (p.fractionsDone ?? 0); f++) {
      step(1.4);
      fractions.push({ fraksi_ke: f, tanggal: day(), mesin: "LINAC 1", rtt_id: ids.rtt, created_at: ts() });
    }
    if (p.stage === "SELESAI") {
      events.push({ from_stage: "PENYINARAN", to_stage: "SELESAI", action: "complete", actor_id: ids.rtt, actor_role: "rtt", note: `Penyinaran selesai (${p.fraksi}/${p.fraksi} fraksi)`, created_at: ts() });
      entered = ts();
    }

    const passedDelineasi = target > STAGE_KEYS.indexOf("DELINEASI");
    const { data: row, error } = await admin
      .from("patients")
      .insert({
        no_rm: p.no_rm,
        nama: p.nama,
        tgl_lahir: p.tgl_lahir,
        jenis_kelamin: p.jenis_kelamin,
        no_hp: p.no_hp,
        diagnosis: p.diagnosis,
        current_stage: p.stage,
        stage_entered_at: entered,
        dosis_total_gy: passedDelineasi ? p.dosis : null,
        total_fraksi: passedDelineasi ? p.fraksi : null,
        data,
        created_by: ids.administrasi,
        created_at: events[0].created_at,
        updated_at: ts(),
      })
      .select("id")
      .single();
    if (error) throw error;

    const { error: evErr } = await admin.from("stage_events").insert(events.map((e) => ({ ...e, patient_id: row.id })));
    if (evErr) throw evErr;
    if (fractions.length) {
      const { error: fxErr } = await admin.from("fractions").insert(fractions.map((f) => ({ ...f, patient_id: row.id })));
      if (fxErr) throw fxErr;
    }
    console.log(`+ pasien ${p.nama} (${p.stage})`);
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
