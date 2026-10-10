import { signOut } from "@/app/login/actions";
import { LogoLengkap } from "@/components/logo";

/** Kerangka halaman akun yang belum aktif (lengkapi profil, menunggu persetujuan). */
export function AuthShell({
  title,
  subtitle,
  email,
  children,
}: {
  title: string;
  subtitle: string;
  email: string | null;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <LogoLengkap className="h-12 w-auto" />
        <section className="card p-6">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mb-5 mt-1 text-sm text-slate-500">{subtitle}</p>
          {children}
        </section>
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Masuk sebagai {email ?? "-"}</span>
          <form action={signOut}>
            <button type="submit" className="font-medium text-teal-700 hover:underline">
              Keluar
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
