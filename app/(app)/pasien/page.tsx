import Link from "next/link";
import { PatientTable } from "@/components/patient-table";
import { getCurrentUser } from "@/lib/auth";
import { fractionCounts, listPatients } from "@/lib/data";
import { STAGES, isStageKey } from "@/lib/workflow";

export default async function PatientsPage({ searchParams }: PageProps<"/pasien">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const stage = isStageKey(sp.tahap) ? sp.tahap : undefined;

  const [user, patients] = await Promise.all([getCurrentUser(), listPatients({ q, stage })]);
  const fractions = await fractionCounts(patients.map((p) => p.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Daftar pasien</h1>
          <p className="text-sm text-slate-500">{patients.length} pasien</p>
        </div>
        {user.role === "administrasi" && (
          <Link href="/pasien/baru" className="btn btn-primary">
            + Pasien baru
          </Link>
        )}
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-4" role="search">
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="label">Cari</label>
          <input id="q" name="q" defaultValue={q} placeholder="Nama atau No. RM" className="input" />
        </div>
        <div className="w-full sm:w-56">
          <label htmlFor="tahap" className="label">Tahap</label>
          <select id="tahap" name="tahap" defaultValue={stage ?? ""} className="input">
            <option value="">Semua tahap</option>
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
          <Link href="/pasien" className="btn text-slate-500 hover:text-slate-800">
            Reset
          </Link>
        )}
      </form>

      <section className="card overflow-hidden">
        <PatientTable patients={patients} fractions={fractions} />
      </section>
    </div>
  );
}
