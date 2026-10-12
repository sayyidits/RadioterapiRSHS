import { getCurrentUser } from "@/lib/auth";
import { AKSES, ROLES } from "@/lib/workflow";

/** Profil akun sendiri. Tidak ada pengaturan password: semua akun masuk lewat Google (audit A5). */
export default async function ProfilPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Profil</h1>
        <p className="text-sm text-slate-500">Nama, role kerja, dan hak akses diubah oleh Admin atau Master.</p>
      </div>

      <section className="card p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Nama lengkap</dt>
            <dd className="font-medium">{user.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="font-medium">{user.email || "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Role kerja</dt>
            <dd className="font-medium">{ROLES[user.role]}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Hak akses</dt>
            <dd className="font-medium">{AKSES[user.akses]}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
