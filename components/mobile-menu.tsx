"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Menu header untuk layar sempit (HP): tombol ☰ yang membuka daftar menu dan info akun
 * di bawah header. `children` = bagian akun (nama, role, keluar) yang dirender server.
 */
export function MobileMenu({ links, children }: { links: { href: string; label: string }[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Tutup menu setelah pindah halaman
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Tutup dengan tombol Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="ml-auto md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="menu-hp"
        aria-label={open ? "Tutup menu" : "Buka menu"}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <>
          {/* Latar gelap: ketuk di luar menu untuk menutup */}
          <div className="fixed inset-0 top-[var(--header-h)] z-10 bg-slate-900/20" onClick={() => setOpen(false)} aria-hidden />
          <div
            id="menu-hp"
            className="absolute inset-x-0 top-full z-20 max-h-[calc(100dvh-var(--header-h))] overflow-y-auto border-b border-slate-200 bg-white shadow-lg"
          >
            <nav className="grid gap-1 px-4 py-3">
              {links.map((l) => {
                const active = l.href === "/" ? pathname === "/" : pathname === l.href;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={`rounded-lg px-3 py-2.5 text-base font-medium ${
                      active ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-slate-100 px-4 py-4">{children}</div>
          </div>
        </>
      )}
    </div>
  );
}
