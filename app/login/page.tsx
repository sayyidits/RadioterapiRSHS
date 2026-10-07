import { ResetDemoButton } from "@/components/demo-controls";
import { Logo } from "@/components/logo";
import { DEMO_USERS } from "@/lib/demo-seed";
import { IS_DEMO } from "@/lib/mode";
import { ROLES, ROLE_SHORT, STAGES, stagesOwnedBy, STAGE_MAP } from "@/lib/workflow";
import { demoSignIn } from "./actions";
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
        <div className={`w-full ${IS_DEMO ? "max-w-md" : "max-w-sm"}`}>
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo />
            <span className="text-lg font-semibold">Flow Radioterapi</span>
          </div>
          {IS_DEMO ? <DemoRolePicker /> : <PasswordLogin />}
        </div>
      </section>
    </main>
  );
}

function PasswordLogin() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Masuk</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Gunakan akun yang diberikan oleh administrator.</p>
      <LoginForm />
    </>
  );
}

function DemoRolePicker() {
  return (
    <>
      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
        MODE DEMO
      </span>
      <h1 className="mt-3 text-2xl font-semibold">Masuk sebagai…</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        Pilih role untuk mencoba alur. Role bisa diganti kapan saja dari menu di kanan atas.
      </p>
      <div className="space-y-2">
        {DEMO_USERS.map((u) => {
          const stages = stagesOwnedBy(u.role).map((s) => STAGE_MAP[s].label);
          return (
            <form key={u.id} action={demoSignIn}>
              <input type="hidden" name="uid" value={u.id} />
              <button
                type="submit"
                className="card flex w-full items-center justify-between gap-3 p-4 text-left transition hover:border-teal-400 hover:bg-teal-50/40"
              >
                <div>
                  <p className="font-semibold">{ROLES[u.role]}</p>
                  <p className="text-sm text-slate-600">{u.full_name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {stages.length ? `ACC: ${stages.join(", ")}` : "Hanya melihat"}
                  </p>
                </div>
                <span className="text-teal-700" aria-hidden="true">→</span>
              </button>
            </form>
          );
        })}
      </div>
      <div className="mt-6">
        <ResetDemoButton />
      </div>
    </>
  );
}
