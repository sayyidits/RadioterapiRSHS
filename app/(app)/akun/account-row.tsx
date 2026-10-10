"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/form-message";
import { formatDateTime } from "@/lib/format";
import type { Akun } from "@/lib/types";
import { AKSES, ROLES, ROLE_LIST, hakAtas, type Akses } from "@/lib/workflow";
import { aturAkunAction } from "./actions";

/** Tombol aksi per status akun: [status tujuan, label, gaya] */
const AKSI: Record<Akun["status"], [string, string, string][]> = {
  menunggu: [
    ["aktif", "Setujui", "btn-primary"],
    ["ditolak", "Tolak", "btn-secondary"],
  ],
  aktif: [
    ["aktif", "Simpan", "btn-secondary"],
    ["nonaktif", "Nonaktifkan", "btn-danger"],
  ],
  baru: [["ditolak", "Tolak", "btn-secondary"]],
  ditolak: [["aktif", "Aktifkan", "btn-primary"]],
  nonaktif: [["aktif", "Aktifkan kembali", "btn-primary"]],
};

const AKSES_STYLE: Record<Akses, string> = {
  master: "bg-violet-50 text-violet-700 ring-violet-200",
  admin: "bg-sky-50 text-sky-700 ring-sky-200",
  nakes: "bg-slate-50 text-slate-600 ring-slate-200",
};

export function AksesBadge({ akses }: { akses: Akses }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${AKSES_STYLE[akses]}`}>
      {AKSES[akses]}
    </span>
  );
}

/** Satu akun di halaman Akun: data pendaftar, role kerja, hak akses, dan aksi yang diizinkan. */
export function AccountRow({ akun, saya }: { akun: Akun; saya: { id: string; akses: Akses } }) {
  const [state, action] = useActionState(aturAkunAction.bind(null, akun.id), undefined);
  const hak = hakAtas(saya, akun);
  // Akun sendiri: hanya role kerja yang bisa diganti
  const aksi = !hak.kelola ? [] : hak.sendiri ? [["aktif", "Simpan role", "btn-secondary"] as [string, string, string]] : AKSI[akun.status];

  return (
    <li className="px-5 py-4">
      <form action={action} className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {akun.full_name}
            <AksesBadge akses={akun.akses} />
            {hak.sendiri && <span className="text-xs font-normal text-slate-500">(Anda)</span>}
          </p>
          <p className="truncate text-xs text-slate-500">
            {akun.email ?? "-"} · daftar {formatDateTime(akun.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {akun.status === "baru" ? (
            <span className="text-xs text-slate-500">Belum melengkapi profil</span>
          ) : !hak.kelola ? (
            <span className="text-sm text-slate-700">{akun.role ? ROLES[akun.role] : "-"}</span>
          ) : (
            <select
              name="role"
              defaultValue={akun.role ?? ""}
              aria-label={`Role kerja ${akun.full_name}`}
              className="input w-auto py-1.5"
            >
              <option value="" disabled>
                Pilih role…
              </option>
              {ROLE_LIST.map((r) => (
                <option key={r} value={r}>
                  {ROLES[r]}
                </option>
              ))}
            </select>
          )}
          {hak.aksesBisaDiubah && akun.status !== "baru" && (
            <select
              name="akses"
              defaultValue={akun.akses}
              aria-label={`Hak akses ${akun.full_name}`}
              className="input w-auto py-1.5"
            >
              {(Object.keys(AKSES) as Akses[]).map((a) => (
                <option key={a} value={a}>
                  {AKSES[a]}
                </option>
              ))}
            </select>
          )}
          {aksi.map(([status, label, style]) => (
            <ActionButton key={status + label} status={status} className={style}>
              {label}
            </ActionButton>
          ))}
        </div>
      </form>
      <div className="mt-2 empty:hidden">
        <FormMessage state={state} />
      </div>
    </li>
  );
}

function ActionButton({ status, className, children }: { status: string; className: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="status" value={status} disabled={pending} className={`btn px-3 py-1.5 ${className}`}>
      {children}
    </button>
  );
}
