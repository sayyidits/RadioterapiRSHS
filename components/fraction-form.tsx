"use client";

import { useActionState } from "react";
import { recordFractionAction } from "@/app/(app)/pasien/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function FractionForm({
  patientId,
  nextFraction,
  total,
  defaultMesin,
  today,
}: {
  patientId: string;
  nextFraction: number;
  total: number;
  defaultMesin: string;
  today: string;
}) {
  const [state, action] = useActionState(recordFractionAction.bind(null, patientId), undefined);
  return (
    <form key={nextFraction} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="tanggal" className="label">Tanggal</label>
          <input id="tanggal" name="tanggal" type="date" required defaultValue={today} className="input" />
        </div>
        <div>
          <label htmlFor="mesin" className="label">Mesin</label>
          <input id="mesin" name="mesin" defaultValue={defaultMesin} className="input" />
        </div>
        <div>
          <label htmlFor="catatan" className="label">Catatan</label>
          <input id="catatan" name="catatan" className="input" placeholder="Opsional" />
        </div>
      </div>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton>
          Catat fraksi ke-{nextFraction} dari {total}
        </SubmitButton>
      </div>
    </form>
  );
}
