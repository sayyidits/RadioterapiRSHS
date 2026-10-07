// Data dummy (fiktif) untuk akun demo dan pasien di berbagai tahap.
// Dipakai oleh mode demo lokal (lib/demo/db.ts) dan scripts/seed.ts (Supabase).
import { STAGE_KEYS, type Role, type StageKey } from "./workflow";

export const DEMO_USERS: { id: string; email: string; full_name: string; role: Role }[] = [
  { id: "00000000-0000-4000-8000-000000000001", email: "dokter@flowrt.test", full_name: "dr. Andi Pratama, Sp.Onk.Rad", role: "dokter" },
  { id: "00000000-0000-4000-8000-000000000002", email: "perawat@flowrt.test", full_name: "Ns. Sari Wulandari", role: "perawat" },
  { id: "00000000-0000-4000-8000-000000000003", email: "rtt@flowrt.test", full_name: "Budi Santoso, A.Md.Rad", role: "rtt" },
  { id: "00000000-0000-4000-8000-000000000004", email: "fismed@flowrt.test", full_name: "Rina Kusuma, M.Si", role: "fismed" },
  { id: "00000000-0000-4000-8000-000000000005", email: "admin@flowrt.test", full_name: "Dewi Lestari", role: "administrasi" },
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
  POLI: "dokter",
  CT_SIM: "rtt",
  DELINEASI: "dokter",
  PLANNING: "fismed",
  ACC_PLAN: "dokter",
  VERIFIKASI: "rtt",
};

function payloadFor(stage: StageKey, p: SeedPatient, date: string): Record<string, unknown> {
  const head = /Kepala|Otak|brain/.test(p.area);
  switch (stage) {
    case "POLI":
      return { diagnosis_kerja: p.diagnosis, intent: p.dosis <= 30 ? "Paliatif" : "Kuratif", area_radiasi: p.area };
    case "CT_SIM":
      return { tanggal_ct: date, posisi: "Supine", imobilisasi: head ? "Thermoplastic mask" : "Vacloc" };
    case "DELINEASI":
      return { dosis_total_gy: p.dosis, total_fraksi: p.fraksi, catatan_kontur: "GTV, CTV, PTV dan OAR selesai dikontur" };
    case "PLANNING":
      return { teknik: p.teknik, tps: `Plan_${p.no_rm}_v1` };
    case "ACC_PLAN":
      return { dosis_total_gy: p.dosis, total_fraksi: p.fraksi, catatan: "Plan disetujui" };
    case "VERIFIKASI":
      return { tanggal_verifikasi: date, mesin: "LINAC 1", metode: p.teknik === "3DCRT" ? ["DRR", "EPID"] : ["DRR", "CBCT"], hasil: "Lolos, shift dalam toleransi" };
    default:
      return {};
  }
}

export type SeedRecord = {
  patient: Record<string, unknown>;
  events: Record<string, unknown>[];
  fractions: Record<string, unknown>[];
};

/** Susun riwayat lengkap tiap pasien dummy, mundur dari hari ini. */
export function buildDemoPatients(ids: Record<Role, string>, now = Date.now()): SeedRecord[] {
  return PATIENTS.map((p, i) => {
    const target = STAGE_KEYS.indexOf(p.stage);
    // Tiap tahap ~2 hari, tiap fraksi ~1,4 hari (hari kerja)
    let t = now - (target * 2 + (p.fractionsDone ?? 0) * 1.4 + (p.returnedFromAccPlan ? 3 : 0) + i * 0.1) * 86_400_000;
    // Jam kegiatan dibuat di jam kerja (08.00–14.59 WIB)
    let n = 0;
    const ts = () => {
      const d = new Date(t);
      d.setUTCHours(1 + ((i + n) % 7), (i * 7 + n++ * 13) % 60, 0, 0);
      return d.toISOString();
    };
    const day = () => new Date(t).toISOString().slice(0, 10);
    const step = (days: number) => (t += days * 86_400_000);

    const data: Record<string, unknown> = {};
    const events: Record<string, unknown>[] = [
      { from_stage: "PENDAFTARAN", to_stage: "POLI", action: "create", actor_id: ids.administrasi, actor_role: "administrasi", note: "Pasien didaftarkan dan dikirim ke Poli", created_at: ts() },
    ];
    let entered = ts();

    // Tahap POLI .. VERIFIKASI yang sudah dilewati (PENYINARAN dicatat lewat fraksi)
    const lastManual = Math.min(target, STAGE_KEYS.indexOf("PENYINARAN"));
    for (let s = 1; s < lastManual; s++) {
      const stage = STAGE_KEYS[s];
      const owner = OWNER[stage]!;
      step(1.5 + ((i + s) % 3) * 0.3);
      const payload = payloadFor(stage, p, day());
      data[stage] = { ...payload, _at: ts(), _by: ids[owner] };
      events.push({ from_stage: stage, to_stage: STAGE_KEYS[s + 1], action: "advance", actor_id: ids[owner], actor_role: owner, payload, created_at: ts() });
      entered = ts();
    }

    // Contoh plan yang dikembalikan dokter dari ACC Planning ke Planning
    if (p.returnedFromAccPlan) {
      step(1.5);
      const payload = payloadFor("PLANNING", p, day());
      data.PLANNING = { ...payload, _at: ts(), _by: ids.fismed };
      events.push({ from_stage: "PLANNING", to_stage: "ACC_PLAN", action: "advance", actor_id: ids.fismed, actor_role: "fismed", payload, created_at: ts() });
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
    return {
      patient: {
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
      },
      events,
      fractions,
    };
  });
}
