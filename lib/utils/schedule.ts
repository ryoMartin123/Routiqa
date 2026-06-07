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

// ─── Dispatch board working-hours window ──────────────────
// True when a timed slot starts before the board opens, or its duration would
// run past closing — i.e. it falls outside the allocated hours.
export function isOutsideHours(time: string, durationMinutes: number, dayStart: number, dayEnd: number): boolean {
  if (!time) return false;
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h)) return false;
  const startMin = h * 60 + (m || 0);
  const dur = Math.max(0, durationMinutes || 0);
  return startMin < dayStart * 60 || startMin + dur > dayEnd * 60;
}

// Readable hour label, e.g. 17 → "5:00 PM".
export function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}
