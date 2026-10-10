"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { setAttendanceAction } from "@/app/(app)/pasien/actions";
import { FormMessage } from "@/components/form-message";
import { formatDateTime } from "@/lib/format";
import type { AttendanceEntry } from "@/lib/types";
import { ROLE_SHORT } from "@/lib/workflow";

/** Status kehadiran hari ini + tombol absen (administrasi & RTT). */
export function AttendanceControl({
  patientId,
  entries,
  canEdit,
  fractionsToday,
}: {
  patientId: string;
  /** Pencatatan hari ini, urut dari yang paling awal */
  entries: AttendanceEntry[];
  canEdit: boolean;
  fractionsToday: number;
}) {
  const [state, action] = useActionState(setAttendanceAction.bind(null, patientId), undefined);
  const [changing, setChanging] = useState(false);
  const latest = entries.at(-1);
  const locked = latest?.hadir === true && fractionsToday > 0;

  return (
    <div className="space-y-2">
      <AttendanceStatus entries={entries} />

      {canEdit && !latest && (
        <form action={action} className="flex flex-wrap gap-2">
          <ChoiceButton value="true" className="btn-primary">
            Hadir
          </ChoiceButton>
          <ChoiceButton value="false" className="btn-secondary">
            Tidak hadir
          </ChoiceButton>
        </form>
      )}

      {canEdit && latest && !locked && !changing && (
        <button type="button" onClick={() => setChanging(true)} className="text-xs font-medium text-teal-700 hover:underline">
          Ubah jadi {latest.hadir ? "tidak hadir" : "hadir"}
        </button>
      )}

      {canEdit && latest && !locked && changing && (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input
            name="catatan"
            className="input min-w-40 flex-1 py-1.5"
            placeholder="Alasan perubahan (opsional)"
            aria-label="Alasan perubahan kehadiran"
          />
          <ChoiceButton value={latest.hadir ? "false" : "true"} className={latest.hadir ? "btn-danger" : "btn-primary"}>
            Simpan: {latest.hadir ? "tidak hadir" : "hadir"}
          </ChoiceButton>
          <button type="button" onClick={() => setChanging(false)} className="btn text-slate-500 hover:text-slate-800">
            Batal
          </button>
        </form>
      )}

      {canEdit && locked && (
        <p className="text-xs text-slate-500">Fraksi hari ini sudah tercatat, kehadiran tidak dapat diubah.</p>
      )}

      <FormMessage state={state} />
    </div>
  );
}

function ChoiceButton({ value, className, children }: { value: string; className: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="hadir" value={value} disabled={pending} className={`btn px-3 py-1.5 ${className}`}>
      {children}
    </button>
  );
}

export function AttendanceStatus({ entries }: { entries: AttendanceEntry[] }) {
  const latest = entries.at(-1);
  if (!latest) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-300">
        Belum diabsen
      </span>
    );
  }
  const changed = entries.length > 1;
  return (
    <div className="space-y-1">
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
          latest.hadir ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"
        }`}
      >
        {latest.hadir ? "Hadir" : "Tidak hadir"}
      </span>
      <p className="text-xs text-slate-500">
        {changed ? "Diubah oleh" : "Dicatat oleh"} {latest.actor?.full_name ?? "-"}
        {latest.actor_role && ` (${ROLE_SHORT[latest.actor_role]})`} · {formatDateTime(latest.created_at)}
      </p>
      {latest.catatan && <p className="text-xs text-slate-600">Catatan: {latest.catatan}</p>}
    </div>
  );
}
