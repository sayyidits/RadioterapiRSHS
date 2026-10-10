const TZ = "Asia/Jakarta";

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+07:00`) : new Date(value);
  return d.toLocaleDateString("id-ID", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Tanggal WIB (YYYY-MM-DD) dari sebuah timestamp */
export function dateWIB(timestamp: string) {
  return new Date(timestamp).toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Nilai ?tanggal=YYYY-MM-DD yang valid, selain itu hari ini */
export function parseTanggal(value: string | string[] | undefined) {
  const v = typeof value === "string" ? value : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : todayISO();
}

export function age(tglLahir: string) {
  const birth = new Date(tglLahir);
  const now = new Date();
  let a = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) a--;
  return a;
}

/** "< 1 hari", "1 hari", "5 hari" sejak tanggal tertentu */
export function daysSince(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  return days <= 0 ? "< 1 hari" : `${days} hari`;
}

/** "Kamis, 8 Oktober 2026" (WIB) */
export function formatToday() {
  return new Date().toLocaleDateString("id-ID", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "8 Okt" untuk tanggal ISO (YYYY-MM-DD) */
export function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00+07:00`).toLocaleDateString("id-ID", { timeZone: TZ, day: "numeric", month: "short" });
}

/** Selisih hari kalender b − a untuk tanggal ISO (YYYY-MM-DD) */
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** "Kam, 8 Okt 2026" untuk tanggal ISO (YYYY-MM-DD) */
export function formatDayDate(value: string) {
  return new Date(`${value}T00:00:00+07:00`).toLocaleDateString("id-ID", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
