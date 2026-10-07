"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";
import { demoSignIn, resetDemo } from "@/app/login/actions";
import { SubmitButton } from "@/components/submit-button";
import { ROLES, type Role } from "@/lib/workflow";

type DemoUser = { id: string; full_name: string; role: Role };

/** Dropdown ganti role di header (mode demo). Tetap di halaman yang sama. */
export function RoleSwitcher({ users, currentId }: { users: DemoUser[]; currentId: string }) {
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={demoSignIn} className="flex items-center gap-2">
      <input type="hidden" name="next" value={pathname} />
      <label htmlFor="role-switch" className="hidden text-xs font-medium text-slate-500 md:block">
        Lihat sebagai
      </label>
      <select
        id="role-switch"
        name="uid"
        defaultValue={currentId}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-teal-300 bg-teal-50 py-1.5 pl-2 pr-7 text-sm font-medium text-teal-900 outline-none focus:ring-2 focus:ring-teal-600/30"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {ROLES[u.role]}
          </option>
        ))}
      </select>
    </form>
  );
}

export function ResetDemoButton() {
  return (
    <form
      action={resetDemo}
      onSubmit={(e) => {
        if (!confirm("Kembalikan semua data demo ke kondisi awal? Perubahan yang sudah dibuat akan hilang.")) {
          e.preventDefault();
        }
      }}
    >
      <SubmitButton variant="secondary" pendingText="Mereset…" className="w-full text-xs">
        Reset data demo
      </SubmitButton>
    </form>
  );
}
