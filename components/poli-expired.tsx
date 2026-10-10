"use client";

import { useActionState } from "react";
import { reRegisterPoliAction } from "@/app/(app)/pasien/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

/**
 * Kunjungan Poli yang tidak di-ACC di harinya hangus. Administrasi mendaftarkan ulang
 * saat pasien datang lagi; role lain hanya melihat pemberitahuan.
 */
export function PoliExpired({
  patientId,
  tanggal,
  canReRegister,
}: {
  patientId: string;
  /** Tanggal kunjungan yang hangus, sudah diformat */
  tanggal: string;
  canReRegister: boolean;
}) {
  const [state, action] = useActionState(reRegisterPoliAction.bind(null, patientId), undefined);
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
        <p className="font-medium">Kunjungan Poli tanggal {tanggal} hangus.</p>
        <p className="mt-1">
          Poli hanya berlaku di hari kunjungan karena jadwal CT Sim harus ditentukan saat itu juga.
          {canReRegister
            ? " Daftarkan ulang bila pasien datang lagi."
            : " Administrasi dapat mendaftarkan ulang saat pasien datang lagi."}
        </p>
      </div>
      {canReRegister && (
        <form action={action} className="space-y-3">
          <div>
            <label htmlFor="reregister-note" className="label">
              Catatan
            </label>
            <input id="reregister-note" name="note" className="input" placeholder="Opsional, mis. pasien datang kembali" />
          </div>
          <FormMessage state={state} />
          <div className="flex justify-end">
            <SubmitButton pendingText="Mendaftarkan…">Daftarkan ulang ke Poli hari ini</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
