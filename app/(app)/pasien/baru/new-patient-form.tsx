"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { StageFields } from "@/components/stage-fields";
import { SubmitButton } from "@/components/submit-button";
import type { Profile } from "@/lib/types";
import { PATIENT_IDENTITY_FIELDS } from "@/lib/workflow";
import { createPatientAction } from "../actions";

export function NewPatientForm({ doctors }: { doctors: Profile[] }) {
  const [state, action] = useActionState(createPatientAction, undefined);
  return (
    <form action={action} className="space-y-5">
      <StageFields fields={PATIENT_IDENTITY_FIELDS} />
      <div>
        <label htmlFor="dpjp" className="label">
          Dokter DPJP <span className="text-rose-600">*</span>
        </label>
        <select id="dpjp" name="dpjp" required defaultValue="" className="input">
          <option value="" disabled>
            Pilih dokter…
          </option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">Pasien langsung masuk antrean Poli dokter ini dan tidak dapat dipindah ke dokter lain.</p>
      </div>
      <div>
        <label htmlFor="note" className="label">Catatan untuk Poli</label>
        <input id="note" name="note" className="input" placeholder="Opsional, mis. rujukan dari RS X" />
      </div>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton pendingText="Mendaftarkan…">Daftarkan & kirim ke Poli</SubmitButton>
      </div>
    </form>
  );
}
