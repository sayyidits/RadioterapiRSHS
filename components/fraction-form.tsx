"use client";

import { useActionState } from "react";
import { recordFractionAction } from "@/app/(app)/pasien/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { MESIN } from "@/lib/workflow";

/** Catat fraksi hari ini. Mesin bawaan dari plan, boleh diganti untuk fraksi ini saja. */
export function FractionForm({
  patientId,
  nextFraction,
  total,
  defaultMesin,
  compact = false,
}: {
  patientId: string;
  nextFraction: number;
  total: number;
  defaultMesin: string;
  compact?: boolean;
}) {
  const [state, action] = useActionState(recordFractionAction.bind(null, patientId), undefined);
  const mesinId = `mesin-${patientId}`;
  const catatanId = `catatan-${patientId}`;
  return (
    <form key={nextFraction} action={action} className={compact ? "space-y-2" : "space-y-4"}>
      <div className={compact ? "flex flex-wrap items-end gap-2" : "grid gap-4 sm:grid-cols-2"}>
        <div className={compact ? "w-32" : ""}>
          <label htmlFor={mesinId} className={compact ? "sr-only" : "label"}>Mesin</label>
          <select id={mesinId} name="mesin" required defaultValue={defaultMesin} className="input">
            <option value="" disabled>
              Pilih mesin…
            </option>
            {MESIN.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className={compact ? "min-w-32 flex-1" : ""}>
          <label htmlFor={catatanId} className={compact ? "sr-only" : "label"}>Catatan</label>
          <input id={catatanId} name="catatan" className="input" placeholder="Catatan (opsional)" />
        </div>
        {compact && (
          <SubmitButton>
            Catat Fx {nextFraction}/{total}
          </SubmitButton>
        )}
      </div>
      <FormMessage state={state} />
      {!compact && (
        <div className="flex justify-end">
          <SubmitButton>
            Catat fraksi ke-{nextFraction} dari {total}
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
