import Link from "next/link";
import { RoleBadge } from "@/components/badges";
import { Logo } from "@/components/logo";
import { MobileMenu } from "@/components/mobile-menu";
import { NavLinks } from "@/components/nav-links";
import { RoleSwitcher } from "@/components/demo-controls";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_USERS } from "@/lib/demo-seed";
import { IS_DEMO } from "@/lib/mode";
import { AKSES, kelolaAkun } from "@/lib/workflow";
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
    ...(kelolaAkun(user.akses) ? [{ href: "/akun", label: "Akun" }] : []),
  ];

  const subtitle = (
    <>
      {IS_DEMO ? "Mode demo" : user.email}
      {user.akses !== "nakes" && <> · {AKSES[user.akses]}</>}
    </>
  );
  const roleControl = IS_DEMO ? <RoleSwitcher users={DEMO_USERS} currentId={user.id} /> : <RoleBadge role={user.role} />;
  const logout = (
    <form action={signOut}>
      <button type="submit" className="btn btn-secondary px-3 py-1.5 text-xs">
        Keluar
      </button>
    </form>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <Logo />
            <span className="truncate font-semibold tracking-tight">Radioterapi RSHS</span>
          </Link>
          {/* Tablet & desktop: menu tampil di header. HP: menu di balik tombol ☰ (MobileMenu). */}
          <div className="order-3 hidden w-full md:block lg:order-none lg:w-auto lg:flex-1">
            <NavLinks links={links} />
          </div>
          <div className="ml-auto hidden items-center gap-3 md:flex">
            <Link href="/profil" className="text-right hover:opacity-80" title="Profil & password">
              <p className="text-sm font-medium leading-tight">{user.full_name}</p>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </Link>
            {roleControl}
            {logout}
          </div>
          <MobileMenu links={[...links, { href: "/profil", label: "Profil & password" }]}>
            <p className="font-medium leading-tight">{user.full_name}</p>
            <p className="break-all text-xs text-slate-500">{subtitle}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              {roleControl}
              {logout}
            </div>
          </MobileMenu>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:py-6">{children}</main>
    </div>
  );
}
