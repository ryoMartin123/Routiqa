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

// TimePicker `minTime` for a given day (yyyy-mm-dd): when the date is TODAY,
// returns the current "HH:MM" rounded UP to the next step so past times are
// blocked out of the list entirely; for a future day (or none) returns undefined
// (all times allowed). Past days are already blocked by the DatePicker `min`.
export function minTimeFor(ymd: string, stepMinutes = 15): string | undefined {
  if (!ymd || ymd !== todayYMD()) return undefined;
  const now = new Date();
  let total = now.getHours() * 60 + now.getMinutes();
  total = Math.ceil(total / stepMinutes) * stepMinutes;   // round up to the next slot
  if (total >= 24 * 60) return "23:59";                    // late-night: nothing left today
  const h = Math.floor(total / 60), m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Local "yyyy-mm-dd" for tomorrow.
export function tomorrowYMD(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Earliest day still bookable given the board's closing hour: TODAY when a slot
// remains before close, otherwise TOMORROW. Pass as the DatePicker `min` so a day
// with no available times left (e.g. it's 11pm and the board closed at 9pm) can't
// be selected at all — it lines up with what the TimePicker would show.
export function minBookableYMD(endHour = 21, stepMinutes = 15): string {
  const now = new Date();
  const mins = Math.ceil((now.getHours() * 60 + now.getMinutes()) / stepMinutes) * stepMinutes;
  return mins < endHour * 60 ? todayYMD() : tomorrowYMD();
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
