import { isWorkingDay, nextWorkingDay } from "./holidays";
import type { Fraction } from "./types";

export type ScheduleRow =
  | { kind: "done"; fraction: Fraction }
  | { kind: "planned"; fraksi_ke: number; tanggal: string; today: boolean }
  | { kind: "absent"; tanggal: string; catatan: string | null };

/** Kehadiran yang berlaku per tanggal (pencatatan terakhir di hari itu) */
export type AttendanceDay = { tanggal: string; hadir: boolean; catatan: string | null };

/**
 * Jadwal fraksi: fraksi yang sudah diberikan (tanggal sebenarnya), hari tidak hadir,
 * lalu sisa fraksi yang diproyeksikan 1 per hari kerja mulai hari ini. Karena dihitung
 * ulang dari hari ini, setiap hari tidak hadir otomatis memundurkan sisa jadwal.
 * `project` false (replanning / selesai): tanpa proyeksi.
 */
export function buildSchedule({
  fractions,
  total,
  attendance,
  today,
  project,
}: {
  fractions: Fraction[];
  total: number;
  attendance: AttendanceDay[];
  today: string;
  project: boolean;
}): ScheduleRow[] {
  if (fractions.length === 0) return [];

  const firstDate = fractions[0].tanggal;
  const fractionDates = new Set(fractions.map((f) => f.tanggal));
  const rows: ScheduleRow[] = [
    ...fractions.map((f) => ({ kind: "done" as const, fraction: f })),
    ...attendance
      .filter((a) => !a.hadir && a.tanggal >= firstDate && !fractionDates.has(a.tanggal))
      .map((a) => ({ kind: "absent" as const, tanggal: a.tanggal, catatan: a.catatan })),
  ];

  const remaining = total - fractions.length;
  if (project && remaining > 0) {
    // Hari ini masih bisa dipakai kalau hari kerja, tidak tercatat absen, dan belum ada fraksi
    const todayAbsent = attendance.some((a) => a.tanggal === today && !a.hadir);
    let date = isWorkingDay(today) && !todayAbsent && !fractionDates.has(today) ? today : nextWorkingDay(today);
    for (let n = fractions.length + 1; n <= total; n++) {
      rows.push({ kind: "planned", fraksi_ke: n, tanggal: date, today: date === today });
      date = nextWorkingDay(date);
    }
  }

  const dateOf = (r: ScheduleRow) => (r.kind === "done" ? r.fraction.tanggal : r.tanggal);
  const order = (r: ScheduleRow) => (r.kind === "done" ? r.fraction.fraksi_ke : r.kind === "planned" ? r.fraksi_ke : 0);
  return rows.sort((a, b) => dateOf(a).localeCompare(dateOf(b)) || order(a) - order(b));
}
