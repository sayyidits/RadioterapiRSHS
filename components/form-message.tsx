import type { ActionState } from "@/lib/types";

export function FormMessage({ state }: { state: ActionState }) {
  if (state?.error)
    return (
      <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
        {state.error}
      </p>
    );
  if (state?.success)
    return (
      <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">
        {state.success}
      </p>
    );
  return null;
}
