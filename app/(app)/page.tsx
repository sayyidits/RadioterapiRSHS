import Link from "next/link";
import { AddPatientButton } from "@/components/add-patient-button";
import { CitoBadge, CountPill, StageBadge } from "@/components/badges";
import { DateNav } from "@/components/date-nav";
import { DueBadge } from "@/components/due-badge";
import { LoadBar, loadTone } from "@/components/machine-load";
import { ProgressBar } from "@/components/progress-bar";
import { StatCards } from "@/components/stat-cards";
import { getCurrentUser } from "@/lib/auth";
import { IS_DEMO } from "@/lib/mode";
import { fractionCounts, jadwalSinar, listAccounts, listPatients, type JadwalSinarRow } from "@/lib/data";
import { dateWIB, daysSince, formatDate, parseTanggal, todayISO } from "@/lib/format";
import { isWorkingDay } from "@/lib/holidays";
import type { Akun, Patient } from "@/lib/types";
import {
  KUOTA_CT_SIM,
  KUOTA_CT_SIM_CITO,
  KUOTA_PESAWAT,
  KUOTA_PESAWAT_CITO,
  MESIN_EKSTERNAL,
  ROLES,
  STAGES,
  STAGE_MAP,
  actorsLabel,
  canActOn,
  kelolaAkun,
  dueDate,
  poliHangus,
  stageActors,
  stageIndex,
  stagesOwnedBy,
  type Role,
  type StageKey,
} from "@/lib/workflow";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const today = todayISO();
  const tanggal = parseTanggal((await searchParams).tanggal);
  const [user, patients, jadwal] = await Promise.all([getCurrentUser(), listPatients(), jadwalSinar(tanggal, tanggal)]);

  const myStages = stagesOwnedBy(user.role);
  // Dokter hanya melihat tugas untuk pasien yang DPJP-nya dia
  const mine = patients.filter((p) => myStages.includes(p.current_stage) && canActOn(p, user));
  // Jumlah fraksi hanya ditampilkan untuk pasien yang sedang penyinaran
  const inTreatment = patients.filter((p) => p.current_stage === "PENYINARAN").map((p) => p.id);
  const [fractions, doneToday, accounts] = await Promise.all([
    fractionCounts(inTreatment),
    fractionCounts(
      mine.filter((p) => p.current_stage === "PENYINARAN").map((p) => p.id),
      today,
    ),
    kelolaAkun(user.akses) ? listAccounts() : [],
  ]);
  // Akun yang sudah masuk tetapi belum didaftarkan / disetujui
  const pendingAccounts = accounts.filter((a) => a.status === "baru" || a.status === "menunggu");
  const myTasks = prioritize(mine, today, doneToday);
  // Dokter: antrean Poli (belum dijadwalkan) dipisah dari tugas bertanggal (Delineasi)
  const splitPoli = user.role === "dokter";
  const active = patients.filter((p) => p.current_stage !== "SELESAI");

  const stats = [
    { label: "Pasien aktif", value: active.length },
    { label: "Sedang penyinaran", value: inTreatment.length },
    { label: "Selesai", value: patients.length - active.length },
    { label: "Menunggu saya", value: myTasks.length, highlight: myTasks.length > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Halo, {user.full_name}</h1>
          <p className="text-sm text-slate-500">Masuk sebagai {ROLES[user.role]}</p>
        </div>
        {user.role === "administrasi" && <AddPatientButton />}
      </div>

      <StatCards stats={stats} />

      {splitPoli && (
        <TaskSection
          title="Poli hari ini"
          hint="Pasien menunggu pemeriksaan dan jadwal CT Sim, urut dari yang paling lama menunggu."
          stages={["POLI"]}
          tasks={myTasks.filter((t) => t.patient.current_stage === "POLI")}
          today={today}
          fractions={fractions}
        />
      )}
      {/* Admin/Master: pendaftar yang menunggu persetujuan, di atas tugas role kerjanya */}
      {pendingAccounts.length > 0 && <PendingAccounts accounts={pendingAccounts} />}

      {/* Administrasi: pendaftaran langsung masuk Poli, jadi tugasnya adalah daftar Poli hangus */}
      {user.role === "administrasi" ? (
        <ExpiredPoli patients={patients.filter((p) => poliHangus(p, today))} />
      ) : (
        <TaskSection
          title="Tugas saya"
          hint="Urut dari due date terdekat, yang terlambat paling atas."
          stages={splitPoli ? myStages.filter((s) => s !== "POLI") : myStages}
          tasks={splitPoli ? myTasks.filter((t) => t.patient.current_stage !== "POLI") : myTasks}
          today={today}
          fractions={fractions}
        />
      )}

      <Agenda tanggal={tanggal} today={today} patients={patients} jadwal={jadwal} />

      {/* Papan alur hanya untuk presentasi (mode demo); tidak ditampilkan di versi produksi */}
      {IS_DEMO && <StageBoard patients={patients} fractions={fractions} role={user.role} />}
    </div>
  );
}

/** Kepala kartu: judul + jumlah + keterangan, dengan isi tambahan di kanan */
function SectionHeader({ title, count, hint, children }: { title: string; count: number; hint: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="font-semibold">
          {title}
          <CountPill n={count} className="ml-2" />
        </h2>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      {children}
    </div>
  );
}

/** Admin/Master: akun yang sudah masuk tetapi belum didaftarkan / disetujui */
function PendingAccounts({ accounts }: { accounts: Akun[] }) {
  return (
    <section className="card">
      <SectionHeader
        title="Akun belum terdaftar"
        count={accounts.length}
        hint="Sudah masuk dengan Google tetapi belum didaftarkan. Daftarkan dari halaman Akun bila staf."
      >
        <Link href="/akun" className="btn btn-secondary px-3 py-1.5">
          Kelola akun
        </Link>
      </SectionHeader>
      {accounts.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">Tidak ada pendaftaran yang menunggu.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {accounts.map((a) => (
            <li key={a.id}>
              <Link href="/akun" className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
                <div>
                  <p className="font-medium">{a.full_name}</p>
                  <p className="text-xs text-slate-500">{a.email}</p>
                </div>
                <span className="text-xs text-slate-600">{a.role ? ROLES[a.role] : "-"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Pasien yang kunjungan Polinya hangus: didaftarkan ulang dari halaman pasien saat datang lagi */
function ExpiredPoli({ patients }: { patients: Patient[] }) {
  return (
    <section className="card">
      <SectionHeader
        title="Poli hangus"
        count={patients.length}
        hint="Tidak di-ACC di hari kunjungan Poli. Buka pasien dan daftarkan ulang bila pasien datang lagi."
      />
      {patients.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">Tidak ada kunjungan Poli yang hangus.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
          {patients.map((p) => (
            <li key={p.id}>
              <Link href={`/pasien/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
                <div>
                  <p className="font-medium">{p.nama}</p>
                  <p className="font-mono text-xs text-slate-500">
                    RM {p.no_rm} · {p.dpjp?.full_name ?? "-"}
                  </p>
                </div>
                <span className="text-xs font-medium text-rose-700">Hangus · kunjungan {formatDate(dateWIB(p.stage_entered_at))}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Task = { patient: Patient; due: string | null };

/** Daftar tugas bernomor sesuai urutan prioritas */
function TaskSection({
  title,
  hint,
  stages,
  tasks,
  today,
  fractions,
}: {
  title: string;
  hint: string;
  stages: StageKey[];
  tasks: Task[];
  today: string;
  fractions: Record<string, number>;
}) {
  return (
    <section className="card">
      <SectionHeader title={title} count={tasks.length} hint={hint}>
        <span className="text-xs text-slate-500">Tahap: {stages.map((s) => STAGE_MAP[s].label).join(", ")}</span>
      </SectionHeader>
      {tasks.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">Tidak ada pasien yang menunggu tindakan Anda.</p>
      ) : (
        <ol className="max-h-[36rem] divide-y divide-slate-100 overflow-y-auto">
          {tasks.map(({ patient: p, due }, i) => (
            <li key={p.id}>
              <Link
                href={`/pasien/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                    {i + 1}
                  </span>
                  <div>
                    <p className="flex flex-wrap items-center gap-1.5 font-medium">
                      {p.nama}
                      {p.cito && <CitoBadge />}
                    </p>
                    <p className="font-mono text-xs text-slate-500">RM {p.no_rm}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {p.current_stage === "PENYINARAN" && p.total_fraksi && (
                    <span className="text-xs text-slate-600">
                      Fx {fractions[p.id] ?? 0}/{p.total_fraksi}
                    </span>
                  )}
                  {p.current_stage === "POLI" ? (
                    <span className="text-xs text-slate-500">Menunggu {daysSince(p.stage_entered_at)}</span>
                  ) : (
                    <DueBadge due={due} today={today} />
                  )}
                  <StageBadge stage={p.current_stage} />
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Urutan prioritas: due date terdekat (terlambat paling atas), CITO lebih dulu di due date yang sama, Poli tanpa due date di akhir. */
function prioritize(patients: Patient[], today: string, doneToday: Record<string, number>) {
  return patients
    .map((p) => ({ patient: p, due: dueDate(p, today, (doneToday[p.id] ?? 0) > 0) }))
    .sort(
      (a, b) =>
        (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
        Number(b.patient.cito) - Number(a.patient.cito) ||
        // Di due date yang sama, tahap persiapan didahulukan dari penyinaran harian
        Number(a.patient.current_stage === "PENYINARAN") - Number(b.patient.current_stage === "PENYINARAN") ||
        a.patient.stage_entered_at.localeCompare(b.patient.stage_entered_at),
    );
}

/** Agenda satu tanggal untuk semua role: CT Sim, verifikasi & mulai sinar, selesai sinar, hunian pesawat. */
function Agenda({
  tanggal,
  today,
  patients,
  jadwal,
}: {
  tanggal: string;
  today: string;
  patients: Patient[];
  jadwal: JadwalSinarRow[];
}) {
  const byId = new Map(patients.map((p) => [p.id, p]));
  // Tanggal rencana hanya berlaku setelah ACC Poli
  const scheduled = patients.filter((p) => stageIndex(p.current_stage) > stageIndex("POLI"));
  const ctSim = scheduled.filter((p) => p.tgl_ct_sim === tanggal);
  const verifikasi = scheduled.filter((p) => p.tgl_verifikasi === tanggal);
  const selesai = jadwal.flatMap((j) => {
    const p = byId.get(j.patient_id);
    return p && j.fraksi_ke === p.total_fraksi ? [p] : [];
  });

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-semibold">Agenda</h2>
          <p className="text-xs text-slate-500">
            {isWorkingDay(tanggal) ? "Jadwal pasien di tanggal ini." : "Bukan hari kerja."}
          </p>
        </div>
        <DateNav basePath="/" tanggal={tanggal} today={today} />
      </div>

      <div className="grid gap-px bg-slate-100 md:grid-cols-2 xl:grid-cols-4">
        <AgendaColumn
          title="CT Simulator"
          empty="Tidak ada CT Sim."
          counts={[
            { n: ctSim.filter((p) => !p.cito).length, kuota: KUOTA_CT_SIM },
            { label: "CITO", n: ctSim.filter((p) => p.cito).length, kuota: KUOTA_CT_SIM_CITO },
          ]}
          items={ctSim.map((p) => ({
            patient: p,
            note: stageIndex(p.current_stage) > stageIndex("CT_SIM") ? "Sudah CT Sim" : undefined,
            warn: p.current_stage === "CT_SIM" && tanggal < today,
          }))}
        />
        <AgendaColumn
          title="Verifikasi & mulai penyinaran"
          hint="Due date Delineasi + Planning"
          empty="Tidak ada verifikasi."
          items={verifikasi.map((p) => {
            const diff = stageIndex(p.current_stage) - stageIndex("VERIFIKASI");
            return {
              patient: p,
              note: diff < 0 ? `Masih ${STAGE_MAP[p.current_stage].label}` : diff > 0 ? "Sudah verifikasi" : undefined,
              warn: diff < 0 && tanggal <= today,
            };
          })}
        />
        <AgendaColumn
          title="Selesai penyinaran"
          hint="Fraksi terakhir"
          empty="Tidak ada yang selesai."
          items={selesai.map((p) => ({ patient: p, note: `${p.total_fraksi} fraksi` }))}
        />
        <div className="bg-white px-5 py-4">
          <h3 className="text-sm font-semibold">Penyinaran per pesawat</h3>
          <p className="mb-3 text-xs text-slate-500">Pasien standar dan CITO dibanding kuota hariannya</p>
          <ul className="space-y-3">
            {MESIN_EKSTERNAL.map((m) => {
              const rows = jadwal.filter((j) => j.mesin === m);
              const cito = rows.filter((j) => byId.get(j.patient_id)?.cito).length;
              const n = rows.length - cito;
              const kuota = KUOTA_PESAWAT[m];
              const kuotaCito = KUOTA_PESAWAT_CITO[m];
              return (
                <li key={m}>
                  <Link href={`/pesawat?tanggal=${tanggal}`} className="block hover:opacity-80">
                    <div className="mb-1 flex justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-700">{m}</span>
                      <span>
                        <span className={loadTone(n, kuota).text}>
                          {n}/{kuota}
                        </span>
                        <span className={`ml-2 ${cito >= kuotaCito ? "text-rose-700" : "text-rose-600/80"}`}>
                          CITO {cito}/{kuotaCito}
                        </span>
                      </span>
                    </div>
                    <LoadBar n={n} kuota={kuota} label={`${m}: ${n} dari ${kuota} pasien standar, ${cito} dari ${kuotaCito} CITO`} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function AgendaColumn({
  title,
  hint,
  empty,
  counts,
  items,
}: {
  title: string;
  hint?: string;
  empty: string;
  /** Kuota harian per kategori: jumlah ditampilkan "n/kuota", rose bila penuh */
  counts?: { label?: string; n: number; kuota: number }[];
  items: { patient: Patient; note?: string; warn?: boolean }[];
}) {
  return (
    <div className="bg-white px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
        {counts ? (
          <span className="flex flex-wrap justify-end gap-1">
            {counts.map((c) => (
              <span
                key={c.label ?? ""}
                className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${c.n >= c.kuota ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700"}`}
              >
                {c.label && `${c.label} `}
                {c.n}/{c.kuota}
              </span>
            ))}
          </span>
        ) : (
          <CountPill n={items.length} />
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{empty}</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {items.map(({ patient: p, note, warn }) => (
            <li key={p.id}>
              <Link href={`/pasien/${p.id}`} className="block rounded-md px-2 py-1 hover:bg-slate-50">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{p.nama}</span>
                  {p.cito && <CitoBadge />}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {p.mesin ?? "-"} · {p.dpjp?.full_name ?? "-"}
                  {note && <span className={warn ? "font-medium text-rose-700" : ""}> · {note}</span>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StageBoard({
  patients,
  fractions,
  role,
}: {
  patients: Patient[];
  fractions: Record<string, number>;
  role: Role;
}) {
  return (
    <section>
      <h2 className="mb-3 font-semibold">Alur pasien</h2>
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex min-w-max gap-3">
          {STAGES.map((s) => {
            const list = patients.filter((p) => p.current_stage === s.key);
            const mine = stageActors(s.key).includes(role);
            return (
              <div
                key={s.key}
                className={`flex w-60 flex-col rounded-xl border ${mine ? "border-teal-300 bg-teal-50/50" : "border-slate-200 bg-slate-100/60"}`}
              >
                <div className="flex items-center justify-between px-3 pb-2 pt-3">
                  <div>
                    <p className="text-sm font-semibold">{s.label}</p>
                    <p className="text-[11px] text-slate-500">{actorsLabel(s.key)}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {list.length}
                  </span>
                </div>
                <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto px-2 pb-2">
                  {list.length === 0 && <p className="px-1 py-3 text-center text-xs text-slate-400">Kosong</p>}
                  {list.map((p) => (
                    <KanbanCard key={p.id} patient={p} done={fractions[p.id] ?? 0} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function KanbanCard({ patient: p, done }: { patient: Patient; done: number }) {
  // Pasien selesai pasti sudah menerima semua fraksinya, jadi jumlahnya tidak perlu di-query
  const given = p.current_stage === "SELESAI" ? (p.total_fraksi ?? 0) : done;
  const showFx = p.total_fraksi && (p.current_stage === "PENYINARAN" || p.current_stage === "SELESAI");
  return (
    <Link
      href={`/pasien/${p.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 shadow-xs transition hover:border-teal-400 hover:shadow-sm"
    >
      <p className="truncate text-sm font-medium">{p.nama}</p>
      <p className="font-mono text-[11px] text-slate-500">RM {p.no_rm}</p>
      <p className="mt-1 truncate text-xs text-slate-600">{p.diagnosis}</p>
      {showFx ? (
        <div className="mt-2">
          <ProgressBar value={given} max={p.total_fraksi!} barClassName="bg-teal-600" />
          <p className="mt-1 text-[11px] text-slate-500">
            {given}/{p.total_fraksi} fraksi
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">{daysSince(p.stage_entered_at)} di tahap ini</p>
      )}
    </Link>
  );
}
