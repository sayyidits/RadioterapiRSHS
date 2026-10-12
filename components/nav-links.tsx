"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <PendingHint />
            <span className="relative">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Tab yang diklik berdenyut sampai halaman tujuan mulai tampil (tanpa menggeser tata letak). */
function PendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`absolute inset-0 rounded-lg bg-teal-100 transition-opacity ${pending ? "animate-pulse opacity-100" : "opacity-0"}`}
    />
  );
}
