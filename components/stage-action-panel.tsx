"use client";

import { useActionState, useRef, useState } from "react";
import { advanceAction } from "@/app/(app)/pasien/actions";
import { FormMessage } from "@/components/form-message";
import { ReturnForm } from "@/components/return-form";
import { StageFields } from "@/components/stage-fields";
import { SubmitButton } from "@/components/submit-button";
import { cekKuota, tglVerifikasiDari, type Hunian } from "@/lib/booking";
import { formatDayDate } from "@/lib/format";
import { JENIS_KELAMIN, STAGE_KEYS, STAGE_MAP, type StageKey } from "@/lib/workflow";

export function StageActionPanel({
  patientId,
  stage,
  defaults,
  optionLabels,
  booking,
}: {
  patientId: string;
  stage: StageKey;
  defaults: Record<string, unknown>;
  optionLabels?: Record<string, Record<string, string>>;
  /** Poli: hunian pesawat & jadwal CT Sim (tanpa pasien ini) dan fraksi yang sudah diberikan (replanning) */
  booking?: { hunian: Hunian; ctSim: Record<string, number>; today: string; fraksiDone: number };
}) {
  const def = STAGE_MAP[stage];
  // Pesawat & jumlah fraksi yang sedang diisi, untuk pemilih tanggal CT Sim
  const [live, setLive] = useState({ mesin: String(defaults.mesin ?? ""), fraksi: Number(defaults.total_fraksi) || 0 });
  const [clientError, setClientError] = useState<string>();
  const [mode, setMode] = useState<"advance" | "return">("advance");
  const [advanceState, advance] = useActionState(advanceAction.bind(null, patientId), undefined);
  const canReturn = def.returnTargets.length > 0;

  // Konfirmasi sebelum ACC: submit pertama membuka dialog, submit kedua (dari dialog) dikirim
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);
  const [review, setReview] = useState<{ label: string; value: string }[]>([]);
  const next = STAGE_MAP[STAGE_KEYS[STAGE_KEYS.indexOf(stage) + 1]];

  function onAdvanceSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ctsim = def.fields.find((f) => f.type === "ctsim");
    if (ctsim?.required && !fd.get(ctsim.name)) {
      setClientError(`${ctsim.label} wajib dipilih`);
      return;
    }
    setClientError(undefined);
    const rows = def.fields
      .map((f) => {
        const values = fd.getAll(f.name).map(String).filter(Boolean);
        const value =
          f.name === "jenis_kelamin"
            ? values.map((v) => JENIS_KELAMIN[v] ?? v)
            : f.type === "ctsim"
              ? values.map(formatDayDate)
              : values;
        return { label: f.label, value: value.join(", ") };
      })
      .filter((r) => r.value);
    // Tanggal yang mengikuti dari CT Sim
    const ct = ctsim && String(fd.get(ctsim.name) ?? "");
    if (ct && booking) {
      const verifikasi = tglVerifikasiDari(ct);
      const { hari } = cekKuota(booking.hunian, live.mesin, verifikasi, live.fraksi - booking.fraksiDone);
      rows.push({ label: "Verifikasi & fraksi 1", value: formatDayDate(verifikasi) });
      if (hari.length) rows.push({ label: "Perkiraan fraksi terakhir", value: formatDayDate(hari.at(-1)!) });
    }
    setReview(rows);
    dialogRef.current?.showModal();
  }

  function onFormChange(e: React.FormEvent<HTMLFormElement>) {
    if (!booking) return;
    const el = e.target as HTMLInputElement;
    if (el.name === "mesin") setLive((l) => ({ ...l, mesin: el.value }));
    if (el.name === "total_fraksi") setLive((l) => ({ ...l, fraksi: Number(el.value) || 0 }));
  }

  function confirmAdvance() {
    dialogRef.current?.close();
    confirmed.current = true;
    formRef.current?.requestSubmit();
  }

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
        <form
          key={stage}
          ref={formRef}
          action={advance}
          onSubmit={onAdvanceSubmit}
          onChange={onFormChange}
          className="space-y-4"
        >
          <input type="hidden" name="stage" value={stage} />
          <StageFields
            fields={def.fields}
            defaults={defaults}
            optionLabels={optionLabels}
            booking={
              booking && {
                hunian: booking.hunian,
                ctSim: booking.ctSim,
                today: booking.today,
                mesin: live.mesin,
                jumlahFraksi: live.fraksi - booking.fraksiDone,
              }
            }
          />
          <div>
            <label htmlFor="note" className="label">Catatan untuk tahap berikutnya</label>
            <input id="note" name="note" className="input" placeholder="Opsional" />
          </div>
          <FormMessage state={clientError ? { error: clientError } : advanceState} />
          <div className="flex justify-end">
            <SubmitButton>{def.actionLabel ?? "ACC & Lanjutkan"}</SubmitButton>
          </div>
        </form>
      ) : (
        <ReturnForm patientId={patientId} stage={stage} />
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="confirm-acc-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl p-0 shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="space-y-4 p-5">
          <div>
            <h2 id="confirm-acc-title" className="font-semibold">
              Konfirmasi ACC
            </h2>
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
              Perhatikan baik-baik kembali datanya sebelum ACC dan melanjutkan ke proses berikutnya.
            </p>
          </div>
          {review.length > 0 && (
            <dl className="max-h-64 space-y-2 overflow-y-auto rounded-lg bg-slate-50 px-3 py-2 text-sm">
              {review.map((r) => (
                <div key={r.label}>
                  <dt className="text-xs text-slate-500">{r.label}</dt>
                  <dd className="whitespace-pre-line">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="text-sm text-slate-600">
            Pasien akan dipindahkan dari <b>{def.label}</b> ke <b>{next?.label}</b>.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => dialogRef.current?.close()}>
              Periksa lagi
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmAdvance}>
              Ya, ACC & lanjutkan
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
