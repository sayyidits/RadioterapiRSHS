import { redirect } from "next/navigation";
import { PatientList } from "@/components/patient-list";
import { getCurrentUser } from "@/lib/auth";

/** Daftar pasien milik dokter yang sedang login (sebagai DPJP). */
export default async function MyPatientsPage({ searchParams }: PageProps<"/pasien/saya">) {
  const [user, sp] = await Promise.all([getCurrentUser(), searchParams]);
  if (user.role !== "dokter") redirect("/pasien");
  return <PatientList title="Daftar pasien" basePath="/pasien/saya" onlyMine searchParams={sp} />;
}
