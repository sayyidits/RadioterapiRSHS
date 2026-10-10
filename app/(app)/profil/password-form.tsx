"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { setPasswordAction } from "./actions";

export function PasswordForm() {
  const [state, action] = useActionState(setPasswordAction, undefined);
  return (
    // key: kosongkan isian setelah berhasil
    <form key={state?.success ?? "form"} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="password" className="label">Password baru</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="Minimal 8 karakter"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="konfirmasi" className="label">Ulangi password</label>
          <input id="konfirmasi" name="konfirmasi" type="password" autoComplete="new-password" required className="input" />
        </div>
      </div>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton>Simpan password</SubmitButton>
      </div>
    </form>
  );
}
