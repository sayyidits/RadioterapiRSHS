import { getCurrentUser } from "@/lib/auth";
import { IS_DEMO } from "@/lib/mode";
import { AKSES, ROLES } from "@/lib/workflow";
import { PasswordForm } from "./password-form";

/** Profil akun sendiri dan pengaturan password (agar akun Google juga bisa masuk dengan email + password). */
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

      <section className="card p-5">
        <h2 className="font-semibold">Password</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Akun yang mendaftar dengan Google belum punya password. Atur password di sini supaya Anda juga bisa masuk dengan
          mengetik email <b>{user.email || "Anda"}</b> dan password, selain tombol Google. Bisa juga dipakai untuk mengganti
          password.
        </p>
        {IS_DEMO ? (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
            Mode demo tidak memakai login, jadi password tidak dapat diatur.
          </p>
        ) : (
          <PasswordForm />
        )}
      </section>
    </div>
  );
}
