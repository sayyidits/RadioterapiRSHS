"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/types";
import { gantiNamaAction } from "./actions";

/** Nama lengkap di halaman Profil: tampil biasa, tombol "Ubah" membuka isian. */
export function NamaForm({ nama }: { nama: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(async (prev: ActionState, formData: FormData) => {
    const hasil = await gantiNamaAction(prev, formData);
    if (hasil?.success) setEditing(false);
    return hasil;
  }, undefined);

  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">{nama}</span>
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-teal-700 hover:underline">
            Ubah
          </button>
        </div>
        <FormMessage state={state} />
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input
        name="full_name"
        required
        minLength={3}
        maxLength={100}
        defaultValue={nama}
        autoFocus
        aria-label="Nama lengkap"
        placeholder="mis. dr. Andi Pratama, Sp.Onk.Rad"
        className="input"
      />
      <p className="text-xs text-slate-500">
        Nama ini tampil di riwayat ACC, pencatatan fraksi, dan DPJP, termasuk catatan sebelumnya. Setiap perubahan tercatat.
      </p>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton pendingText="Menyimpan…">Simpan</SubmitButton>
        <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
          Batal
        </button>
      </div>
    </form>
  );
}
