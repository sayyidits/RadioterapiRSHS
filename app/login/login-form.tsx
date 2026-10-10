"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { signIn, signInWithGoogle, signUp } from "./actions";

/** Login Supabase: Google, atau email + password (tab Masuk / Daftar). */
export function LoginForm() {
  const [mode, setMode] = useState<"masuk" | "daftar">("masuk");

  return (
    <div className="space-y-5">
      <form action={signInWithGoogle}>
        <SubmitButton variant="secondary" pendingText="Mengalihkan ke Google…" className="w-full py-2.5">
          <GoogleIcon />
          Masuk dengan Google
        </SubmitButton>
      </form>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        atau dengan email
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm" role="tablist">
        {(["masuk", "daftar"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md py-1.5 font-medium ${mode === m ? "bg-white text-teal-800 shadow-xs" : "text-slate-600"}`}
          >
            {m === "masuk" ? "Masuk" : "Daftar akun baru"}
          </button>
        ))}
      </div>

      {mode === "masuk" ? <SignInForm /> : <SignUpForm />}
    </div>
  );
}

function SignInForm() {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Masuk…" className="w-full">Masuk</SubmitButton>
    </form>
  );
}

function SignUpForm() {
  const [state, action] = useActionState(signUp, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="su-email" className="label">Email</label>
        <input id="su-email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label htmlFor="su-password" className="label">Password</label>
        <input
          id="su-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="input"
          placeholder="Minimal 8 karakter"
        />
      </div>
      <div>
        <label htmlFor="su-konfirmasi" className="label">Ulangi password</label>
        <input id="su-konfirmasi" name="konfirmasi" type="password" autoComplete="new-password" required className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Mendaftar…" className="w-full">Daftar</SubmitButton>
      <p className="text-xs text-slate-500">
        Setelah mendaftar, Anda mengisi nama lengkap dan role. Akun bisa dipakai setelah disetujui Admin atau Master.
      </p>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
