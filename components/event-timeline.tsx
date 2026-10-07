import { formatDateTime } from "@/lib/format";
import type { StageEvent } from "@/lib/types";
import { ROLE_SHORT, STAGE_MAP } from "@/lib/workflow";

const ACTION_STYLE = {
  create: { dot: "bg-sky-500", tag: "bg-sky-50 text-sky-700", text: "Didaftarkan" },
  advance: { dot: "bg-teal-600", tag: "bg-teal-50 text-teal-700", text: "ACC" },
  return: { dot: "bg-rose-500", tag: "bg-rose-50 text-rose-700", text: "Dikembalikan" },
  complete: { dot: "bg-emerald-500", tag: "bg-emerald-50 text-emerald-700", text: "Selesai" },
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
              <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold ${style.tag}`}>{style.text}</span>
              {e.from_stage && e.action !== "create" && <>{STAGE_MAP[e.from_stage].label} → </>}
              <span className="font-medium">{STAGE_MAP[e.to_stage].label}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
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
