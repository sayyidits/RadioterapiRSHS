import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listDoctors } from "@/lib/data";
import { NewPatientForm } from "./new-patient-form";

export default async function NewPatientPage() {
  const user = await getCurrentUser();
  const doctors = user.role === "administrasi" ? await listDoctors() : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/pasien" className="text-sm text-slate-500 hover:text-teal-700">
          ← Daftar pasien
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Pendaftaran pasien baru</h1>
        <p className="text-sm text-slate-500">Setelah didaftarkan, pasien langsung masuk antrean Poli dokter DPJP yang dipilih.</p>
      </div>
      <section className="card p-5">
        {user.role === "administrasi" ? (
          <NewPatientForm doctors={doctors} />
        ) : (
          <p className="text-sm text-slate-600">Hanya akun Administrasi yang dapat mendaftarkan pasien baru.</p>
        )}
      </section>
    </div>
  );
}
