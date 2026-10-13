"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { klaimKodeAction } from "./actions";

/** Kolom kode 6 angka yang ditunjukkan Admin/Master saat mendaftarkan akun ini (berlaku 5 menit). */
export function KodeForm() {
  const [state, action] = useActionState(klaimKodeAction, undefined);
  return (
    <form action={action} className="space-y-3 rounded-lg bg-slate-50 px-4 py-4 ring-1 ring-inset ring-slate-200">
      <div>
        <label htmlFor="kode" className="label">
          Kode dari Admin
        </label>
        <input
          id="kode"
          name="kode"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          placeholder="6 angka"
          title="6 angka"
          className="input text-center font-mono text-2xl tracking-[0.3em]"
        />
        <p className="mt-1 text-xs text-slate-500">
          Kode berlaku 5 menit. Kalau sudah lewat, minta Admin membuat kode baru.
        </p>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Memeriksa…" className="w-full">
        Aktifkan akun
      </SubmitButton>
    </form>
  );
}
