import { ROLES, STAGE_COLORS, STAGE_MAP, type Role, type StageKey } from "@/lib/workflow";

export function StageBadge({ stage, className = "" }: { stage: StageKey; className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STAGE_COLORS[stage]} ${className}`}
    >
      {STAGE_MAP[stage].label}
    </span>
  );
}

/** Jumlah item di samping judul bagian */
export function CountPill({ n, className = "" }: { n: number; className?: string }) {
  return <span className={`rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 ${className}`}>{n}</span>;
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-200">
      {ROLES[role]}
    </span>
  );
}

/** Penanda pasien CITO (butuh penanganan segera, dipilih di Poli) */
export function CitoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white ${className}`}
    >
      CITO
    </span>
  );
}
