import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getSessionProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { ROLES } from "@/lib/workflow";

/** Akun yang menunggu persetujuan Admin/Master, atau ditolak / dinonaktifkan. Belum bisa melihat data pasien. */
export default async function MenungguPage() {
  const akun = await getSessionProfile();
  if (akun.status === "aktif") redirect("/");
  if (akun.status === "baru") redirect("/daftar");

  const menunggu = akun.status === "menunggu";
  return (
    <AuthShell
      title={menunggu ? "Menunggu persetujuan" : akun.status === "ditolak" ? "Pendaftaran ditolak" : "Akun dinonaktifkan"}
      subtitle={
        menunggu
          ? "Pendaftaran Anda sudah terkirim. Admin atau Master akan memeriksa dan menyetujui akun Anda."
          : "Akun ini tidak dapat digunakan. Hubungi Admin atau Master bila menurut Anda ini keliru."
      }
      email={akun.email}
    >
      <dl className="space-y-2 rounded-lg bg-slate-50 px-4 py-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Nama lengkap</dt>
          <dd className="font-medium">{akun.full_name}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Role {menunggu ? "yang diminta" : ""}</dt>
          <dd className="font-medium">{akun.role ? ROLES[akun.role] : "-"}</dd>
        </div>
        {akun.diproses_at && (
          <div>
            <dt className="text-xs text-slate-500">Diproses</dt>
            <dd>{formatDateTime(akun.diproses_at)}</dd>
          </div>
        )}
      </dl>
      {menunggu && (
        <div className="mt-5 flex flex-wrap gap-2">
          {/* Dashboard mengarahkan kembali ke sini selama belum disetujui */}
          <Link href="/" className="btn btn-primary">
            Periksa status
          </Link>
          <Link href="/daftar" className="btn btn-secondary">
            Ubah data pendaftaran
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
