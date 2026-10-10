const TZ = "Asia/Jakarta";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Tanggal ISO (YYYY-MM-DD) dibaca sebagai tengah malam WIB, timestamp apa adanya */
function toDate(value: string) {
  return new Date(ISO_DATE.test(value) ? `${value}T00:00:00+07:00` : value);
}

function format(value: string, options: Intl.DateTimeFormatOptions) {
  return toDate(value).toLocaleString("id-ID", { timeZone: TZ, ...options });
}

export function formatDate(value: string | null | undefined) {
  return value ? format(value, { day: "numeric", month: "short", year: "numeric" }) : "-";
}

export function formatDateTime(value: string) {
  return format(value, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "8 Okt" untuk tanggal ISO (YYYY-MM-DD) */
export function formatShortDate(value: string) {
  return format(value, { day: "numeric", month: "short" });
}

/** "Kam, 8 Okt 2026" untuk tanggal ISO (YYYY-MM-DD) */
export function formatDayDate(value: string) {
  return format(value, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** "Kamis, 8 Oktober 2026" (WIB) */
export function formatToday() {
  return new Date().toLocaleDateString("id-ID", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** Tanggal WIB (YYYY-MM-DD) dari sebuah timestamp */
export function dateWIB(timestamp: string | Date) {
  return new Date(timestamp).toLocaleDateString("en-CA", { timeZone: TZ });
}

export function todayISO() {
  return dateWIB(new Date());
}

/**
 * Nilai ?tanggal=YYYY-MM-DD yang valid, selain itu hari ini. Tanggal yang tidak ada di kalender
 * (mis. 2026-02-30) ditolak: Date.parse menerimanya, tetapi Postgres tidak.
 */
export function parseTanggal(value: string | string[] | undefined) {
  const v = typeof value === "string" ? value : "";
  const valid = ISO_DATE.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
  return valid ? v : todayISO();
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

/** Selisih hari kalender b − a untuk tanggal ISO (YYYY-MM-DD) */
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
