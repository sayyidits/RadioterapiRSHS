"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { ROLES, ROLE_LIST, stagesOwnedBy, STAGE_MAP, type Role } from "@/lib/workflow";
import { lengkapiProfilAction } from "./actions";

export function ProfileForm({ defaultName, defaultRole }: { defaultName: string; defaultRole: Role | null }) {
  const [state, action] = useActionState(lengkapiProfilAction, undefined);
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="full_name" className="label">
          Nama lengkap beserta gelar <span className="text-rose-600">*</span>
        </label>
        <input
          id="full_name"
          name="full_name"
          required
          minLength={3}
          defaultValue={defaultName}
          placeholder="mis. dr. Andi Pratama, Sp.Onk.Rad"
          className="input"
        />
        <p className="mt-1 text-xs text-slate-500">Nama ini tercatat di riwayat setiap ACC dan pencatatan fraksi.</p>
      </div>

      <fieldset>
        <legend className="label">
          Role <span className="text-rose-600">*</span>
        </legend>
        <div className="grid gap-2">
          {ROLE_LIST.map((r) => {
            const stages = stagesOwnedBy(r).map((s) => STAGE_MAP[s].label);
            return (
              <label
                key={r}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50"
              >
                <input type="radio" name="role" value={r} required defaultChecked={defaultRole === r} className="mt-0.5 accent-teal-700" />
                <span>
                  <span className="block font-medium">{ROLES[r]}</span>
                  <span className="block text-xs text-slate-500">
                    {stages.length ? `ACC: ${stages.join(", ")}` : "Hanya melihat"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <FormMessage state={state} />
      <SubmitButton pendingText="Mengirim…" className="w-full">
        Kirim untuk disetujui
      </SubmitButton>
    </form>
  );
}
