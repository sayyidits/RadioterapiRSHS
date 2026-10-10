import { PatientList } from "@/components/patient-list";
import { getCurrentUser } from "@/lib/auth";

export default async function PatientsPage({ searchParams }: PageProps<"/pasien">) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  // Dokter punya dua tab: "Daftar pasien" (pasiennya sendiri) dan "Daftar pasien penuh" (halaman ini)
  const title = user.role === "dokter" ? "Daftar pasien penuh" : "Daftar pasien";
  return <PatientList title={title} basePath="/pasien" searchParams={sp} />;
}
