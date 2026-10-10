import Link from "next/link";
import { RoleBadge } from "@/components/badges";
import { Logo } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { RoleSwitcher } from "@/components/demo-controls";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_USERS } from "@/lib/demo-seed";
import { IS_DEMO } from "@/lib/mode";
import { signOut } from "../login/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  // Dokter: "Daftar Pasien" = pasien DPJP-nya, "Daftar Pasien Penuh" = semua pasien
  const links = [
    { href: "/", label: "Dashboard" },
    ...(user.role === "dokter"
      ? [
          { href: "/pasien/saya", label: "Daftar Pasien" },
          { href: "/pasien", label: "Daftar Pasien Penuh" },
        ]
      : [{ href: "/pasien", label: "Daftar Pasien" }]),
    { href: "/pesawat", label: "Info Pesawat" },
    ...(user.role === "administrasi" ? [{ href: "/penyinaran", label: "Absen Penyinaran" }] : []),
    ...(user.role === "rtt" ? [{ href: "/penyinaran", label: "Penyinaran Hari Ini" }] : []),
    ...(user.role === "administrasi" ? [{ href: "/pasien/baru", label: "+ Pasien Baru" }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-semibold tracking-tight">Radioterapi RSHS</span>
          </Link>
          <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
            <NavLinks links={links} />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.full_name}</p>
              <p className="text-xs text-slate-500">{IS_DEMO ? "Mode demo" : user.email}</p>
            </div>
            {IS_DEMO ? (
              <RoleSwitcher users={DEMO_USERS} currentId={user.id} />
            ) : (
              <RoleBadge role={user.role} />
            )}
            <form action={signOut}>
              <button type="submit" className="btn btn-secondary px-3 py-1.5 text-xs">
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
