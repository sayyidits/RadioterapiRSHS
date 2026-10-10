import Link from "next/link";
import { ResetDemoButton } from "@/components/demo-controls";
import { Logo, LogoLengkap } from "@/components/logo";
import { DEMO_USERS } from "@/lib/demo-seed";
import { IS_DEMO } from "@/lib/mode";
import { AKSES, ROLES, STAGES, actorsLabel, stagesOwnedBy, STAGE_MAP } from "@/lib/workflow";
import { demoSignIn } from "./actions";
import { LoginForm } from "./login-form";

/** Pesan dari ?error= (callback Google/email, profil) dan ?sesi=habis (mode demo) */
const PESAN: Record<string, string> = {
  masuk: "Gagal masuk. Login dibatalkan atau tautan sudah kedaluwarsa, silakan coba lagi.",
  google: "Tidak dapat terhubung ke Google. Silakan coba lagi.",
  profil: "Akun ini belum memiliki profil. Silakan keluar lalu masuk lagi, atau hubungi Admin.",
  habis: "Sesi berakhir, silakan pilih akun lagi.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const kode = typeof sp.error === "string" ? sp.error : typeof sp.sesi === "string" ? sp.sesi : "";
  const pesan = PESAN[kode];
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-teal-800 p-10 text-teal-50 lg:flex">
        <div className="flex items-center gap-3">
          {/* Latar putih supaya logo tetap terbaca di panel teal */}
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white">
            <Logo className="h-8 w-8" />
          </span>
          <span className="text-lg font-semibold text-white">Radioterapi RSHS</span>
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
                {s.owner && <span className="text-teal-300">· {actorsLabel(s.key)}</span>}
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs text-teal-200">Gunakan hanya data dummy sampai sistem disetujui.</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <div className={`w-full ${IS_DEMO ? "max-w-md" : "max-w-sm"}`}>
          <div className="mb-8">
            <LogoLengkap className="h-12 w-auto" />
            <p className="mt-3 text-lg font-semibold lg:hidden">Radioterapi RSHS</p>
          </div>
          {pesan && (
            <p role="alert" className="mb-5 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
              {pesan}
            </p>
          )}
          {IS_DEMO ? <DemoRolePicker /> : <PasswordLogin />}
          <p className="mt-8 text-center text-xs text-slate-500">
            <Link href="/privasi" className="hover:text-teal-700 hover:underline">
              Kebijakan Privasi
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function PasswordLogin() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Selamat datang</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">
        Masuk dengan akun Google atau email yang sudah didaftarkan oleh Admin atau Master.
      </p>
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
                  <p className="font-semibold">
                    {ROLES[u.role]}
                    {u.akses && <span className="ml-2 text-xs font-medium text-violet-700">+ {AKSES[u.akses]}</span>}
                  </p>
                  <p className="text-sm text-slate-600">{u.full_name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {stages.length ? `ACC: ${stages.join(", ")}` : "Hanya melihat"}
                    {u.akses === "master" && " · mengelola semua akun"}
                    {u.akses === "admin" && " · mengelola akun Nakes"}
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
