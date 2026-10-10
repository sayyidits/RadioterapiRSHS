import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getSessionProfile } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

/**
 * Akun baru: isi nama lengkap + gelar dan pilih role kerja, lalu menunggu persetujuan Admin/Master.
 * Akun aktif tanpa role kerja (Master lama) memilih role kerjanya di sini dan tetap aktif.
 */
export default async function LengkapiProfilPage() {
  const akun = await getSessionProfile();
  const aktifTanpaRole = akun.status === "aktif" && !akun.role;
  if (akun.status === "aktif" && !aktifTanpaRole) redirect("/");
  if (akun.status !== "baru" && akun.status !== "menunggu" && !aktifTanpaRole) redirect("/menunggu");

  return (
    <AuthShell
      title="Lengkapi profil"
      subtitle={
        aktifTanpaRole
          ? "Akun Anda sudah aktif. Pilih role kerja Anda sebagai nakes; hak akses pengelolaan akun tidak berubah."
          : "Isi nama lengkap beserta gelar dan pilih role Anda. Akun dapat digunakan setelah disetujui Admin atau Master."
      }
      email={akun.email}
    >
      <ProfileForm
        // Nama dari Google dipakai sebagai isian awal; tanpa nama, email bukan nama yang layak
        defaultName={akun.full_name === akun.email ? "" : akun.full_name}
        defaultRole={akun.role}
      />
    </AuthShell>
  );
}
