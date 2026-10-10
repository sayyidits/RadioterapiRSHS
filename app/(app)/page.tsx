import Link from "next/link";
import { AddPatientButton } from "@/components/add-patient-button";
import { StageBadge } from "@/components/badges";
import { DateNav } from "@/components/date-nav";
import { DueBadge } from "@/components/due-badge";
import { LoadBar, loadTone } from "@/components/machine-load";
import { getCurrentUser } from "@/lib/auth";
import { IS_DEMO } from "@/lib/mode";
import { fractionCounts, fractionsToday, jadwalSinar, listPatients, type JadwalSinarRow } from "@/lib/data";
import { dateWIB, daysSince, formatDate, parseTanggal, todayISO } from "@/lib/format";
import { isWorkingDay } from "@/lib/holidays";
import type { Patient } from "@/lib/types";
import {
  KUOTA_PESAWAT,
  MESIN_EKSTERNAL,
  ROLES,
  STAGES,
  STAGE_KEYS,
  STAGE_MAP,
  actorsLabel,
  canActOn,
  dueDate,
  poliHangus,
  stageActors,
  stagesOwnedBy,
  type Role,
  type StageKey,
} from "@/lib/workflow";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const today = todayISO();
  const tanggal = parseTanggal((await searchParams).tanggal);
  const [user, patients, jadwal] = await Promise.all([getCurrentUser(), listPatients(), jadwalSinar(tanggal, tanggal)]);
  const fractions = await fractionCounts(patients.map((p) => p.id));

  const myStages = stagesOwnedBy(user.role);
  // Dokter hanya melihat tugas untuk pasien yang DPJP-nya dia
  const mine = patients.filter((p) => myStages.includes(p.current_stage) && canActOn(p, user));
  const doneToday = await fractionsToday(mine.filter((p) => p.current_stage === "PENYINARAN").map((p) => p.id));
  const myTasks = prioritize(mine, today, doneToday);
  // Dokter: antrean Poli (belum dijadwalkan) dipisah dari tugas bertanggal (Delineasi)
  const splitPoli = user.role === "dokter";
  const poliTasks = myTasks.filter((t) => t.patient.current_stage === "POLI");
  const dueTasks = myTasks.filter((t) => t.patient.current_stage !== "POLI");
  // Kunjungan Poli yang tidak di-ACC di harinya, untuk didaftarkan ulang administrasi
  const expired = user.role === "administrasi" ? patients.filter((p) => poliHangus(p, today)) : [];
  const active = patients.filter((p) => p.current_stage !== "SELESAI");

  const stats = [
    { label: "Pasien aktif", value: active.length },
    { label: "Sedang penyinaran", value: patients.filter((p) => p.current_stage === "PENYINARAN").length },
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
        {user.role === "administrasi" && (
          <AddPatientButton />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`card p-4 ${s.highlight ? "border-teal-300 bg-teal-50" : ""}`}>
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${s.highlight ? "text-teal-800" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {splitPoli ? (
        <>
          <TaskSection
            title="Poli hari ini"
            hint="Pasien menunggu pemeriksaan dan jadwal CT Sim, urut dari yang paling lama menunggu."
            stages={["POLI"]}
            tasks={poliTasks}
            today={today}
            fractions={fractions}
          />
          <TaskSection
            title="Tugas saya"
            hint="Urut dari due date terdekat, yang terlambat paling atas."
            stages={myStages.filter((s) => s !== "POLI")}
            tasks={dueTasks}
            today={today}
            fractions={fractions}
          />
        </>
      ) : (
        // Administrasi: pendaftaran langsung masuk Poli, jadi tugasnya adalah daftar Poli hangus di bawah
        myStages.length > 0 &&
        user.role !== "administrasi" && (
          <TaskSection
            title="Tugas saya"
            hint="Urut dari due date terdekat, yang terlambat paling atas."
            stages={myStages}
            tasks={myTasks}
            today={today}
            fractions={fractions}
          />
        )
      )}

      {user.role === "administrasi" && <ExpiredPoli patients={expired} />}

      <Agenda tanggal={tanggal} today={today} patients={patients} jadwal={jadwal} />

      {/* Papan alur hanya untuk presentasi (mode demo); tidak ditampilkan di versi produksi */}
      {IS_DEMO && <StageBoard patients={patients} fractions={fractions} role={user.role} />}
    </div>
  );
}

/** Pasien yang kunjungan Polinya hangus: didaftarkan ulang dari halaman pasien saat datang lagi */
function ExpiredPoli({ patients }: { patients: Patient[] }) {
  return (
    <section className="card">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold">
          Poli hangus
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{patients.length}</span>
        </h2>
        <p className="text-xs text-slate-500">
          Tidak di-ACC di hari kunjungan Poli. Buka pasien dan daftarkan ulang bila pasien datang lagi.
        </p>
      </div>
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="font-semibold">
            {title}
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{tasks.length}</span>
          </h2>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
        <span className="text-xs text-slate-500">Tahap: {stages.map((s) => STAGE_MAP[s].label).join(", ")}</span>
      </div>
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
                    <p className="font-medium">{p.nama}</p>
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

/** Urutan prioritas: due date terdekat (terlambat paling atas), Poli tanpa due date di akhir. */
function prioritize(patients: Patient[], today: string, doneToday: Record<string, number>) {
  return patients
    .map((p) => ({ patient: p, due: dueDate(p, today, (doneToday[p.id] ?? 0) > 0) }))
    .sort(
      (a, b) =>
        (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
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
  // Tanggal rencana hanya berlaku setelah ACC Poli (pasien yang dikembalikan ke Poli dijadwal ulang)
  const scheduled = patients.filter((p) => p.current_stage !== "PENDAFTARAN" && p.current_stage !== "POLI");
  const stageIdx = (p: Patient) => STAGE_KEYS.indexOf(p.current_stage);
  const ctSim = scheduled.filter((p) => p.tgl_ct_sim === tanggal);
  const verifikasi = scheduled.filter((p) => p.tgl_verifikasi === tanggal);
  const selesai = jadwal.flatMap((j) => {
    const p = byId.get(j.patient_id);
    return p && j.fraksi_ke === p.total_fraksi ? [p] : [];
  });
  const perMesin = (m: string) => jadwal.filter((j) => j.mesin === m).length;

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
          items={ctSim.map((p) => ({
            patient: p,
            note: stageIdx(p) > STAGE_KEYS.indexOf("CT_SIM") ? "Sudah CT Sim" : undefined,
            warn: p.current_stage === "CT_SIM" && tanggal < today,
          }))}
        />
        <AgendaColumn
          title="Verifikasi & mulai penyinaran"
          hint="Due date Delineasi + Planning"
          empty="Tidak ada verifikasi."
          items={verifikasi.map((p) => {
            const before = stageIdx(p) < STAGE_KEYS.indexOf("VERIFIKASI");
            return {
              patient: p,
              note: before
                ? `Masih ${STAGE_MAP[p.current_stage].label}`
                : stageIdx(p) > STAGE_KEYS.indexOf("VERIFIKASI")
                  ? "Sudah verifikasi"
                  : undefined,
              warn: before && tanggal <= today,
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
          <p className="mb-3 text-xs text-slate-500">Pasien dibanding kuota harian</p>
          <ul className="space-y-3">
            {MESIN_EKSTERNAL.map((m) => {
              const n = perMesin(m);
              const kuota = KUOTA_PESAWAT[m];
              return (
                <li key={m}>
                  <Link href={`/pesawat?tanggal=${tanggal}`} className="block hover:opacity-80">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{m}</span>
                      <span className={loadTone(n, kuota).text}>
                        {n}/{kuota}
                      </span>
                    </div>
                    <LoadBar n={n} kuota={kuota} label={`${m}: ${n} dari ${kuota} pasien`} />
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
  items,
}: {
  title: string;
  hint?: string;
  empty: string;
  items: { patient: Patient; note?: string; warn?: boolean }[];
}) {
  return (
    <div className="bg-white px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{empty}</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {items.map(({ patient: p, note, warn }) => (
            <li key={p.id}>
              <Link href={`/pasien/${p.id}`} className="block rounded-md px-2 py-1 hover:bg-slate-50">
                <p className="truncate text-sm font-medium">{p.nama}</p>
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
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-teal-600" style={{ width: `${(done / p.total_fraksi!) * 100}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {done}/{p.total_fraksi} fraksi
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">{daysSince(p.stage_entered_at)} di tahap ini</p>
      )}
    </Link>
  );
}
