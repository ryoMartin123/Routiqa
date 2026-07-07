"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Check } from "lucide-react";

// Themed time picker — type a time (e.g. "3pm", "3:30 pm", "15:30") to filter/jump,
// or pick from the scrollable list. Value is an "HH:MM" 24h string (drop-in for a
// native <input type="time">).
interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: "sm" | "md";
  className?: string;
  minuteStep?: number;
  startHour?: number;
  endHour?: number;
  minTime?: string;         // "HH:MM" lower bound — earlier slots are blocked out (e.g. today's past times)
}

function fmt12(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h)) return "";
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

// "HH:MM" -> its 12-hour parts, for matching typed input against the option list.
function parts12(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return { h12: h % 12 === 0 ? 12 : h % 12, m, period: h >= 12 ? "pm" : "am" };
}

// Free-form time entry -> "HH:MM" (or null). Accepts "3", "3pm", "3:30 pm",
// "330pm", "15:30", etc. Used to commit a time that isn't one of the list slots.
function parseTime(raw: string): string | null {
  let s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  const ampm = s.endsWith("am") ? "am" : s.endsWith("pm") ? "pm" : s.endsWith("a") ? "am" : s.endsWith("p") ? "pm" : "";
  if (ampm) s = s.replace(/(a|p)m?$/, "");
  let h: number, m = 0;
  if (s.includes(":")) {
    const [hp, mp] = s.split(":");
    h = parseInt(hp, 10); m = parseInt(mp || "0", 10);
  } else if (s.length <= 2) {
    h = parseInt(s, 10);
  } else {
    m = parseInt(s.slice(-2), 10);
    h = parseInt(s.slice(0, -2), 10);
  }
  if (isNaN(h) || isNaN(m)) return null;
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Does an option ("HH:MM") match what the user has typed so far?
function matches(opt: string, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const mm = t.match(/^(\d{1,2})(?::?(\d{0,2}))?\s*(am?|pm?)?$/);
  const { h12, m, period } = parts12(opt);
  if (mm) {
    if (parseInt(mm[1], 10) !== h12) return false;
    if (mm[2] && !String(m).padStart(2, "0").startsWith(mm[2])) return false;
    if (mm[3] && (mm[3].startsWith("p") ? "pm" : "am") !== period) return false;
    return true;
  }
  return fmt12(opt).toLowerCase().includes(t);
}

export default function TimePicker({ value, onChange, placeholder = "Select time", size = "md", className, minuteStep = 15, startHour = 6, endHour = 21, minTime }: Props) {
  const [open, setOpen] = useState(false);
  // null = field is showing the current value, list unfiltered (nothing typed yet);
  // a string = the user is actively typing/filtering.
  const [query, setQuery] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => {
    const out: string[] = [];
    for (let h = startHour; h <= endHour; h++) {
      for (let m = 0; m < 60; m += minuteStep) {
        if (h === endHour && m > 0) break;
        const hhmm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        if (minTime && hhmm < minTime) continue;   // past slots are blocked out entirely
        out.push(hhmm);
      }
    }
    return out;
  }, [minuteStep, startHour, endHour, minTime]);

  const filtered = useMemo(() => options.filter(o => matches(o, query ?? "")), [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setQuery(null); }
    };
    document.addEventListener("mousedown", onDoc);
    // Nothing typed yet → show the whole list, scrolled to the current slot.
    if (query === null) requestAnimationFrame(() => selRef.current?.scrollIntoView({ block: "center" }));
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, query]);

  const select = (o: string) => { onChange(o); setOpen(false); setQuery(null); };

  // Commit whatever's typed: nothing typed keeps the value; empty clears it;
  // otherwise prefer the top filtered slot, else a parsed free-form time (rejected
  // if it falls before minTime).
  const commit = () => {
    if (!open) return;
    if (query === null) { setOpen(false); return; }
    const t = query.trim();
    if (t === "") onChange("");
    else if (filtered.length) onChange(filtered[0]);
    else { const p = parseTime(t); if (p && (!minTime || p >= minTime)) onChange(p); }
    setOpen(false);
    setQuery(null);
  };

  const pad = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";

  return (
    <div ref={wrapRef} className={`relative ${className ?? "w-full"}`}>
      {/* The text region keeps the I-beam (type) cursor; the clock icon is the
          explicit clickable trigger (pointer cursor) for the dropdown. */}
      <div
        className={`w-full flex items-center justify-between gap-2 rounded-lg transition-colors cursor-text ${pad}`}
        style={{
          border: `1px solid ${open ? "#8ed0c6" : "var(--border)"}`,
          backgroundColor: "var(--bg-surface)",
          boxShadow: open ? "0 0 0 3px rgba(35,156,141,0.12)" : "none",
        }}>
        <input
          ref={inputRef}
          type="text"
          value={open ? (query ?? fmt12(value)) : fmt12(value)}
          placeholder={placeholder}
          // Open with the FULL list (query stays null) and select the text so the
          // first keystroke replaces it — no backspacing to see all the times.
          onFocus={() => { setOpen(true); setQuery(null); requestAnimationFrame(() => inputRef.current?.select()); }}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape") { setOpen(false); setQuery(null); (e.target as HTMLInputElement).blur(); }
          }}
          onBlur={commit}
          className="flex-1 min-w-0 bg-transparent outline-none cursor-text"
          style={{ color: value || query ? "var(--text-primary)" : "var(--text-muted)" }}
        />
        {/* Clock = the dropdown trigger. onMouseDown (not onClick) fires before the
            input's onBlur, and preventDefault keeps focus stable. Toggles the list —
            works even right after picking a slot, when the input still holds focus. */}
        <button type="button" tabIndex={-1} aria-label="Show times"
          onMouseDown={e => {
            e.preventDefault();
            if (open) { setOpen(false); setQuery(null); }
            else { setOpen(true); setQuery(null); inputRef.current?.focus(); requestAnimationFrame(() => inputRef.current?.select()); }
          }}
          className="shrink-0 flex items-center cursor-pointer transition-colors"
          style={{ color: open ? "#239c8d" : "var(--text-muted)" }}>
          <Clock className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 p-1 rounded-xl overflow-y-auto thin-scroll-y"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)", maxHeight: "240px" }}
          role="listbox">
          {filtered.length === 0 ? (
            <p className="px-2.5 py-2 text-sm" style={{ color: "var(--text-muted)" }}>No matching time</p>
          ) : filtered.map(o => {
            const isSel = o === value;
            return (
              <button key={o} ref={isSel ? selRef : undefined} type="button"
                // onMouseDown so the click registers before the input's onBlur fires.
                onMouseDown={e => { e.preventDefault(); select(o); }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors ${isSel ? "" : "hover:bg-[var(--bg-surface-2)]"}`}
                style={{ backgroundColor: isSel ? "var(--bg-surface-2)" : undefined, color: isSel ? "#0f8578" : "var(--text-secondary)", fontWeight: isSel ? 600 : 400 }}>
                <span>{fmt12(o)}</span>
                {isSel && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#0f8578" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
