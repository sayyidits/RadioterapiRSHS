"use client";

import { useActionState } from "react";
import { returnAction } from "@/app/(app)/pasien/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { STAGE_MAP, type StageKey } from "@/lib/workflow";

/** Kembalikan pasien langsung ke tahap mana pun sebelumnya (alasan wajib). */
export function ReturnForm({ patientId, stage }: { patientId: string; stage: StageKey }) {
  const targets = STAGE_MAP[stage].returnTargets;
  const [state, action] = useActionState(returnAction.bind(null, patientId), undefined);
  return (
    <form key={`${stage}-return`} action={action} className="space-y-4">
      <div>
        <label htmlFor="target" className="label">Kembalikan ke tahap</label>
        <select id="target" name="target" required className="input" defaultValue={targets[0]}>
          {targets.map((t) => (
            <option key={t} value={t}>
              {STAGE_MAP[t].label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="return-note" className="label">
          Alasan <span className="text-rose-600">*</span>
        </label>
        <textarea id="return-note" name="note" rows={3} required className="input" placeholder="Jelaskan apa yang perlu diperbaiki" />
      </div>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton variant="danger">Kembalikan</SubmitButton>
      </div>
    </form>
  );
}
