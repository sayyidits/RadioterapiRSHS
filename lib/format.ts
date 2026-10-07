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
