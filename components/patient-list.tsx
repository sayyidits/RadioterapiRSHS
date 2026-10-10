import Link from "next/link";
import { AddPatientButton } from "@/components/add-patient-button";
import { PatientTable } from "@/components/patient-table";
import { getCurrentUser } from "@/lib/auth";
import { fractionCounts, listPatients } from "@/lib/data";
import { STAGES, isStageKey } from "@/lib/workflow";

/** Halaman daftar pasien. `onlyMine`: hanya pasien dengan DPJP user ini (khusus dokter). */
export async function PatientList({
  title,
  basePath,
  onlyMine = false,
  searchParams,
}: {
  title: string;
  basePath: string;
  onlyMine?: boolean;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const q = typeof searchParams.q === "string" ? searchParams.q : "";
  const stage = isStageKey(searchParams.tahap) ? searchParams.tahap : undefined;

  const user = await getCurrentUser();
  const patients = await listPatients({ q, stage, dpjp: onlyMine ? user.id : undefined });
  // Kolom Fraksi hanya terisi untuk pasien yang sedang penyinaran
  const fractions = await fractionCounts(patients.filter((p) => p.current_stage === "PENYINARAN").map((p) => p.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-slate-500">
            {patients.length} pasien{onlyMine && ` dengan DPJP ${user.full_name}`}
          </p>
        </div>
        {user.role === "administrasi" && <AddPatientButton />}
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4" role="search">
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="label">Cari</label>
          <input id="q" name="q" defaultValue={q} placeholder="Nama atau No. RM" className="input" />
        </div>
        <div className="w-full sm:w-56">
          <label htmlFor="tahap" className="label">Status</label>
          <select id="tahap" name="tahap" defaultValue={stage ?? ""} className="input">
            <option value="">Semua status</option>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-secondary">
          Terapkan
        </button>
        {(q || stage) && (
          <Link href={basePath} className="btn text-slate-500 hover:text-slate-800">
            Reset
          </Link>
        )}
      </form>

      <section className="card overflow-hidden">
        <PatientTable patients={patients} fractions={fractions} showDpjp={!onlyMine} />
      </section>
    </div>
  );
}
