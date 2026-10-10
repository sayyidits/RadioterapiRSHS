// Hari libur nasional dan cuti bersama menurut SKB 3 Menteri. Penyinaran tidak dijadwalkan di hari ini.
// Harus sama dengan tabel public.hari_libur (supabase/migrations/0004_jadwal_kuota.sql).
// 2026: SKB No. 1497/2025, 2/2025, 5/2025. 2027: SKB No. 1205/2026, 3/2026, 2/2026.
// Sumber: setneg.go.id. Tambahkan tahun berikutnya setelah SKB-nya terbit.
// Tanggal Idulfitri/Iduladha dapat bergeser mengikuti keputusan Menteri Agama.
export const HARI_LIBUR: Record<string, string> = {
  "2026-01-01": "Tahun Baru Masehi",
  "2026-01-16": "Isra Mikraj Nabi Muhammad SAW",
  "2026-02-17": "Tahun Baru Imlek 2577 Kongzili",
  "2026-03-19": "Hari Suci Nyepi",
  "2026-03-21": "Idulfitri 1447 H",
  "2026-03-22": "Idulfitri 1447 H",
  "2026-04-03": "Wafat Yesus Kristus",
  "2026-04-05": "Kebangkitan Yesus Kristus (Paskah)",
  "2026-05-01": "Hari Buruh Internasional",
  "2026-05-14": "Kenaikan Yesus Kristus",
  "2026-05-27": "Iduladha 1447 H",
  "2026-05-31": "Hari Raya Waisak 2570 BE",
  "2026-06-01": "Hari Lahir Pancasila",
  "2026-06-16": "Tahun Baru Islam 1448 H",
  "2026-08-17": "Proklamasi Kemerdekaan",
  "2026-08-25": "Maulid Nabi Muhammad SAW",
  "2026-12-25": "Kelahiran Yesus Kristus (Natal)",
  // Cuti bersama 2026
  "2026-02-16": "Cuti bersama Tahun Baru Imlek",
  "2026-03-18": "Cuti bersama Hari Suci Nyepi",
  "2026-03-20": "Cuti bersama Idulfitri",
  "2026-03-23": "Cuti bersama Idulfitri",
  "2026-03-24": "Cuti bersama Idulfitri",
  "2026-05-15": "Cuti bersama Kenaikan Yesus Kristus",
  "2026-05-28": "Cuti bersama Iduladha",
  "2026-12-24": "Cuti bersama Natal",

  "2027-01-01": "Tahun Baru Masehi",
  "2027-01-05": "Isra Mikraj Nabi Muhammad SAW",
  "2027-02-06": "Tahun Baru Imlek 2578 Kongzili",
  "2027-03-08": "Hari Suci Nyepi",
  "2027-03-10": "Idulfitri 1448 H",
  "2027-03-11": "Idulfitri 1448 H",
  "2027-03-26": "Wafat Yesus Kristus",
  "2027-03-28": "Kebangkitan Yesus Kristus (Paskah)",
  "2027-05-01": "Hari Buruh Internasional",
  "2027-05-06": "Kenaikan Yesus Kristus",
  "2027-05-17": "Iduladha 1448 H",
  "2027-05-20": "Hari Raya Waisak 2571 BE",
  "2027-06-01": "Hari Lahir Pancasila",
  "2027-06-06": "Tahun Baru Islam 1449 H",
  "2027-08-15": "Maulid Nabi Muhammad SAW",
  "2027-08-17": "Proklamasi Kemerdekaan",
  "2027-12-25": "Kelahiran Yesus Kristus (Natal)",
  "2027-12-26": "Isra Mikraj Nabi Muhammad SAW",
  // Cuti bersama 2027
  "2027-02-05": "Cuti bersama Tahun Baru Imlek",
  "2027-03-09": "Cuti bersama Idulfitri",
  "2027-03-12": "Cuti bersama Idulfitri",
  "2027-03-15": "Cuti bersama Idulfitri",
  "2027-03-25": "Cuti bersama Wafat Yesus Kristus",
  "2027-05-18": "Cuti bersama Iduladha",
  "2027-05-19": "Cuti bersama Waisak",
  "2027-12-24": "Cuti bersama Natal",
};

/** Tanggal ISO (YYYY-MM-DD) ditambah n hari. */
export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Hari kerja penyinaran: Senin–Jumat, bukan libur nasional atau cuti bersama. */
export function isWorkingDay(iso: string) {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6 && !(iso in HARI_LIBUR);
}

/** Hari kerja pertama setelah tanggal ini. */
export function nextWorkingDay(iso: string) {
  let d = addDays(iso, 1);
  while (!isWorkingDay(d)) d = addDays(d, 1);
  return d;
}

/** Hari kerja pertama pada atau setelah tanggal ini. */
export function workingDayFrom(iso: string) {
  return isWorkingDay(iso) ? iso : nextWorkingDay(iso);
}

/** n hari kerja berturut-turut mulai tanggal ini (ikut dihitung bila hari kerja). */
export function workingDaysFrom(iso: string, n: number) {
  const days: string[] = [];
  let d = workingDayFrom(iso);
  while (days.length < n) {
    days.push(d);
    d = nextWorkingDay(d);
  }
  return days;
}

/** Hari kerja sebelum tanggal ini. */
export function prevWorkingDay(iso: string) {
  let d = addDays(iso, -1);
  while (!isWorkingDay(d)) d = addDays(d, -1);
  return d;
}
