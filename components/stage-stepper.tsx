import { STAGES, actorsLabel, stageIndex, type StageKey } from "@/lib/workflow";

export function StageStepper({ current }: { current: StageKey }) {
  const currentIdx = stageIndex(current);
  const done = current === "SELESAI";

  return (
    <>
      <CompactStepper current={current} />
      <ol className="hidden w-full min-w-[720px] items-start md:flex">
        {STAGES.map((s, i) => {
          const state = done || i < currentIdx ? "done" : i === currentIdx ? "active" : "todo";
          const last = i === STAGES.length - 1;
          return (
            <li key={s.key} className={`flex items-start ${last ? "" : "flex-1"}`}>
              <div className="flex w-20 shrink-0 flex-col items-center text-center">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold ring-4 ${
                    state === "done"
                      ? "bg-teal-700 text-white ring-teal-50"
                      : state === "active"
                        ? "bg-white text-teal-800 ring-teal-200 outline-2 outline-teal-700"
                        : "bg-slate-100 text-slate-400 ring-white"
                  }`}
                  aria-current={state === "active" ? "step" : undefined}
                >
                  {state === "done" ? (
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                      <path d="M7.7 13.3 4.4 10l-1.1 1.1 4.4 4.4 9-9-1.1-1.1z" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`mt-2 text-xs font-medium leading-tight ${
                    state === "active" ? "text-teal-800" : state === "done" ? "text-slate-700" : "text-slate-400"
                  }`}
                >
                  {s.label}
                </span>
                {s.owner && <span className="mt-0.5 text-[11px] text-slate-400">{actorsLabel(s.key)}</span>}
              </div>
              {!last && (
                <span
                  className={`mt-[18px] h-0.5 min-w-2 flex-1 ${i < currentIdx || done ? "bg-teal-700" : "bg-slate-200"}`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** HP: 8 tahap tidak muat berjajar, jadi tampil sebagai "Tahap n dari 8" dengan bar bersegmen. */
function CompactStepper({ current }: { current: StageKey }) {
  const currentIdx = stageIndex(current);
  const done = current === "SELESAI";
  const next = done ? undefined : STAGES[currentIdx + 1];
  return (
    <div className="md:hidden">
      <p className="text-xs text-slate-500">
        Tahap {currentIdx + 1} dari {STAGES.length}
      </p>
      <p className="font-semibold text-teal-800">
        {STAGES[currentIdx].label}
        {STAGES[currentIdx].owner && (
          <span className="ml-1.5 text-xs font-normal text-slate-500">{actorsLabel(current)}</span>
        )}
      </p>
      <ol className="mt-2 flex gap-1" aria-label="Tahap pasien">
        {STAGES.map((s, i) => (
          <li
            key={s.key}
            title={s.label}
            aria-current={i === currentIdx ? "step" : undefined}
            className={`h-1.5 flex-1 rounded-full ${
              done || i < currentIdx ? "bg-teal-700" : i === currentIdx ? "bg-teal-400" : "bg-slate-200"
            }`}
          >
            <span className="sr-only">{s.label}</span>
          </li>
        ))}
      </ol>
      {next && <p className="mt-2 text-xs text-slate-500">Berikutnya: {next.label}</p>}
    </div>
  );
}
