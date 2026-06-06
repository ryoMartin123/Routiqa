// Scheduling guards — keep new job scheduling out of the past.
// These only gate the scheduling UI; jobs already dated in the past are left
// untouched and remain in the system for record.

// Local "yyyy-mm-dd" for today — pass as DatePicker `min` to block past days.
export function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// True when the given date (yyyy-mm-dd) + optional time (HH:MM, 24h) is before
// now. With no time, only the day is compared (today is NOT past); with a time,
// the full timestamp is compared (so an earlier time today IS past).
export function isPastDateTime(ymd: string, hm?: string): boolean {
  if (!ymd) return false;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return false;

  const now = new Date();
  if (!hm) {
    const day   = new Date(y, m - 1, d);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return day.getTime() < today.getTime();
  }

  const [h, mm] = hm.split(":").map(Number);
  const when = new Date(y, m - 1, d, h || 0, mm || 0, 0, 0);
  return when.getTime() < now.getTime();
}
