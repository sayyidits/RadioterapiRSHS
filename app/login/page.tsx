import { Logo } from "@/components/logo";
import { ROLE_SHORT, STAGES } from "@/lib/workflow";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-teal-800 p-10 text-teal-50 lg:flex">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9" />
          <span className="text-lg font-semibold text-white">Flow Radioterapi</span>
        </div>
        <div>
          <h2 className="text-3xl font-semibold leading-tight text-white">
            Pantau setiap pasien dari pendaftaran hingga fraksi terakhir.
          </h2>
          <ol className="mt-8 space-y-2 text-sm">
            {STAGES.filter((s) => s.key !== "SELESAI").map((s, i) => (
              <li key={s.key} className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-teal-700 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                {s.label}
                {s.owner && <span className="text-teal-300">· {ROLE_SHORT[s.owner]}</span>}
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs text-teal-200">Gunakan hanya data dummy sampai sistem disetujui.</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo />
            <span className="text-lg font-semibold">Flow Radioterapi</span>
          </div>
          <h1 className="text-2xl font-semibold">Masuk</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">Gunakan akun yang diberikan oleh administrator.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
