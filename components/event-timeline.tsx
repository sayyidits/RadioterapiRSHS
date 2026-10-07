import { formatDateTime } from "@/lib/format";
import type { StageEvent } from "@/lib/types";
import { ROLE_SHORT, STAGE_MAP } from "@/lib/workflow";

const ACTION_STYLE = {
  create: { dot: "bg-sky-500", text: "Didaftarkan" },
  advance: { dot: "bg-teal-600", text: "ACC" },
  return: { dot: "bg-rose-500", text: "Dikembalikan" },
  complete: { dot: "bg-emerald-500", text: "Selesai" },
} as const;

export function EventTimeline({ events }: { events: StageEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-slate-500">Belum ada riwayat.</p>;

  return (
    <ol className="relative space-y-5 border-l border-slate-200 pl-5">
      {events.map((e) => {
        const style = ACTION_STYLE[e.action];
        return (
          <li key={e.id} className="relative">
            <span className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${style.dot}`} />
            <p className="text-sm">
              <span className="font-medium">{style.text}</span>{" "}
              {e.action === "return" ? (
                <>
                  {e.from_stage && STAGE_MAP[e.from_stage].label} → <b>{STAGE_MAP[e.to_stage].label}</b>
                </>
              ) : (
                <>
                  {e.from_stage && STAGE_MAP[e.from_stage].label}
                  {e.action !== "complete" && <> → {STAGE_MAP[e.to_stage].label}</>}
                </>
              )}
            </p>
            <p className="text-xs text-slate-500">
              {e.actor?.full_name ?? "Sistem"}
              {e.actor_role && ` · ${ROLE_SHORT[e.actor_role]}`} · {formatDateTime(e.created_at)}
            </p>
            {e.note && (
              <p
                className={`mt-1.5 rounded-lg px-3 py-2 text-sm ${
                  e.action === "return" ? "bg-rose-50 text-rose-800" : "bg-slate-50 text-slate-700"
                }`}
              >
                {e.note}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
