import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getSessionProfile } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

/**
 * Akun yang masuk tetapi belum didaftarkan Admin/Master (status 'baru'): tidak ada pendaftaran
 * mandiri, hanya pemberitahuan. Pengecualian: akun aktif tanpa role kerja (Master lama dari 0007)
 * memilih role kerjanya di sini dan tetap aktif.
 */
export default async function BelumTerdaftarPage() {
  const akun = await getSessionProfile();
  const aktifTanpaRole = akun.status === "aktif" && !akun.role;
  if (akun.status === "aktif" && !aktifTanpaRole) redirect("/");
  if (akun.status !== "baru" && !aktifTanpaRole) redirect("/menunggu");

  if (aktifTanpaRole) {
    return (
      <AuthShell
        title="Pilih role kerja"
        subtitle="Akun Anda sudah aktif. Pilih role kerja Anda sebagai nakes; hak akses pengelolaan akun tidak berubah."
        email={akun.email}
      >
        <ProfileForm defaultName={akun.full_name === akun.email ? "" : akun.full_name} defaultRole={akun.role} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Akun belum terdaftar"
      subtitle="Akun di aplikasi ini hanya dibuat oleh Admin atau Master."
      email={akun.email}
    >
      <div className="space-y-4 text-sm text-slate-700">
        <p>
          Email <b>{akun.email}</b> belum didaftarkan. Minta Admin atau Master mendaftarkan email ini beserta nama lengkap dan
          role kerja Anda. Setelah itu, akun langsung bisa dipakai.
        </p>
        <p className="text-slate-500">
          Kalau Anda punya email lain yang sudah didaftarkan, klik Keluar di bawah lalu masuk dengan email tersebut.
        </p>
        {/* Dashboard mengarahkan kembali ke sini selama belum didaftarkan */}
        <Link href="/" className="btn btn-primary">
          Periksa lagi
        </Link>
      </div>
    </AuthShell>
  );
}
