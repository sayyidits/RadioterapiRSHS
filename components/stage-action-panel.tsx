"use client";

import { useActionState, useState } from "react";
import { advanceAction, returnAction } from "@/app/(app)/pasien/actions";
import { FormMessage } from "@/components/form-message";
import { StageFields } from "@/components/stage-fields";
import { SubmitButton } from "@/components/submit-button";
import { STAGE_MAP, type StageKey } from "@/lib/workflow";

export function StageActionPanel({
  patientId,
  stage,
  defaults,
}: {
  patientId: string;
  stage: StageKey;
  defaults: Record<string, unknown>;
}) {
  const def = STAGE_MAP[stage];
  const [mode, setMode] = useState<"advance" | "return">("advance");
  const [advanceState, advance] = useActionState(advanceAction.bind(null, patientId), undefined);
  const [returnState, doReturn] = useActionState(returnAction.bind(null, patientId), undefined);
  const canReturn = def.returnTargets.length > 0;

  return (
    <div className="space-y-4">
      {canReturn && (
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "advance"}
            onClick={() => setMode("advance")}
            className={`rounded-md px-3 py-1.5 font-medium ${mode === "advance" ? "bg-white text-teal-800 shadow-xs" : "text-slate-600"}`}
          >
            ACC & Lanjutkan
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "return"}
            onClick={() => setMode("return")}
            className={`rounded-md px-3 py-1.5 font-medium ${mode === "return" ? "bg-white text-rose-700 shadow-xs" : "text-slate-600"}`}
          >
            Kembalikan
          </button>
        </div>
      )}

      {mode === "advance" ? (
        <form key={stage} action={advance} className="space-y-4">
          <input type="hidden" name="stage" value={stage} />
          <StageFields fields={def.fields} defaults={defaults} />
          <div>
            <label htmlFor="note" className="label">Catatan untuk tahap berikutnya</label>
            <input id="note" name="note" className="input" placeholder="Opsional" />
          </div>
          <FormMessage state={advanceState} />
          <div className="flex justify-end">
            <SubmitButton>{def.actionLabel ?? "ACC & Lanjutkan"}</SubmitButton>
          </div>
        </form>
      ) : (
        <form key={`${stage}-return`} action={doReturn} className="space-y-4">
          <div>
            <label htmlFor="target" className="label">Kembalikan ke tahap</label>
            <select id="target" name="target" required className="input" defaultValue={def.returnTargets[0]}>
              {def.returnTargets.map((t) => (
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
          <FormMessage state={returnState} />
          <div className="flex justify-end">
            <SubmitButton variant="danger">Kembalikan</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
