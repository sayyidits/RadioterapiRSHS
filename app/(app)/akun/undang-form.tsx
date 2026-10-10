"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { formatDateTime } from "@/lib/format";
import type { Undangan } from "@/lib/types";
import { AKSES, ROLES, ROLE_LIST, type Akses } from "@/lib/workflow";
import { AksesBadge } from "./account-row";
import { hapusUndanganAction, undangAkunAction } from "./actions";

/** Daftarkan akun lewat undangan: satu per satu, atau tempel banyak baris dari Excel. */
export function UndangForm({ akses }: { akses: Akses }) {
  const [mode, setMode] = useState<"satu" | "banyak">("satu");
  const [state, action] = useActionState(undangAkunAction, undefined);
  const berhasil = state?.hasil?.filter((h) => h.ok).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm" role="tablist">
        {(["satu", "banyak"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 font-medium ${mode === m ? "bg-white text-teal-800 shadow-xs" : "text-slate-600"}`}
          >
            {m === "satu" ? "Satu akun" : "Tempel dari Excel"}
          </button>
        ))}
      </div>

      <form key={berhasil ? JSON.stringify(state?.hasil) : "form"} action={action} className="space-y-4">
        {mode === "satu" ? (
          <div className="grid gap-3 md:grid-cols-[1.2fr_1.5fr_1fr_auto]">
            <div>
              <label htmlFor="u-email" className="label">Email Google</label>
              <input id="u-email" name="email" type="email" required placeholder="nama@gmail.com" className="input" />
            </div>
            <div>
              <label htmlFor="u-nama" className="label">Nama lengkap + gelar</label>
              <input id="u-nama" name="full_name" required minLength={3} placeholder="dr. Andi Pratama, Sp.Onk.Rad" className="input" />
            </div>
            <div>
              <label htmlFor="u-role" className="label">Role kerja</label>
              <select id="u-role" name="role" required defaultValue="" className="input">
                <option value="" disabled>
                  Pilih…
                </option>
                {ROLE_LIST.map((r) => (
                  <option key={r} value={r}>
                    {ROLES[r]}
                  </option>
                ))}
              </select>
            </div>
            {akses === "master" && (
              <div>
                <label htmlFor="u-akses" className="label">Hak akses</label>
                <select id="u-akses" name="akses" defaultValue="nakes" className="input">
                  {(Object.keys(AKSES) as Akses[]).map((a) => (
                    <option key={a} value={a}>
                      {AKSES[a]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="u-daftar" className="label">Satu akun per baris</label>
            <textarea
              id="u-daftar"
              name="daftar"
              required
              rows={6}
              className="input font-mono text-xs"
              placeholder={
                "budi.hartono@gmail.com\tdr. Budi Hartono, Sp.Onk.Rad\tDokter\nputri.maharani@gmail.com\tNs. Putri Maharani, S.Kep\tPerawat"
              }
            />
            <p className="mt-1 text-xs text-slate-500">
              Salin kolom dari Excel / Google Sheets dengan urutan: <b>email</b>, <b>nama lengkap + gelar</b>, <b>role kerja</b>
              {akses === "master" && (
                <>
                  , lalu <b>hak akses</b> (opsional: Nakes / Admin / Master)
                </>
              )}
              . Pemisah kolom boleh Tab, titik koma, atau garis tegak. Role: Dokter, Perawat, RTT, Fismed, Administrasi. Baris
              judul dilewati otomatis.
            </p>
          </div>
        )}
        <FormMessage state={state?.error ? { error: state.error } : undefined} />
        <div className="flex justify-end">
          <SubmitButton pendingText="Mendaftarkan…">{mode === "satu" ? "Daftarkan" : "Daftarkan semua"}</SubmitButton>
        </div>
      </form>

      {state?.hasil && state.hasil.length > 0 && (
        <div className="rounded-lg ring-1 ring-inset ring-slate-200">
          <p className="border-b border-slate-100 px-4 py-2 text-sm">
            <b>{berhasil}</b> dari {state.hasil.length} berhasil didaftarkan.
          </p>
          <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto text-sm">
            {state.hasil.map((h, i) => (
              <li key={`${h.email}-${i}`} className="flex flex-wrap justify-between gap-2 px-4 py-1.5">
                <span className="font-mono text-xs">{h.email || "(kosong)"}</span>
                <span className={h.ok ? "text-emerald-700" : "text-rose-700"}>{h.hasil}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Satu undangan yang belum dipakai, dengan tombol hapus bila diizinkan */
export function UndanganRow({ undangan: u, bisaHapus }: { undangan: Undangan; bisaHapus: boolean }) {
  const [state, action] = useActionState(hapusUndanganAction.bind(null, u.email), undefined);
  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {u.full_name}
            <AksesBadge akses={u.akses} />
          </p>
          <p className="truncate text-xs text-slate-500">
            {u.email} · {ROLES[u.role]} · didaftarkan {formatDateTime(u.dibuat_at)}
            {u.dibuat_oleh_nama && ` oleh ${u.dibuat_oleh_nama}`}
          </p>
        </div>
        {bisaHapus && (
          <form action={action}>
            <SubmitButton variant="secondary" pendingText="Menghapus…" className="px-3 py-1.5">
              Hapus
            </SubmitButton>
          </form>
        )}
      </div>
      <div className="mt-2 empty:hidden">
        <FormMessage state={state} />
      </div>
    </li>
  );
}
