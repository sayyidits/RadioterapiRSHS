"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { StageFields } from "@/components/stage-fields";
import { SubmitButton } from "@/components/submit-button";
import { PATIENT_IDENTITY_FIELDS } from "@/lib/workflow";
import { createPatientAction } from "../actions";

export function NewPatientForm() {
  const [state, action] = useActionState(createPatientAction, undefined);
  return (
    <form action={action} className="space-y-5">
      <StageFields fields={PATIENT_IDENTITY_FIELDS} />
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
