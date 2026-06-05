// Technician availability — PTO, time off, training, on-call, and ad-hoc blocked
// time. These are NOT dispatchable work (no lifecycle/status); they shape a
// tech's row on the board and feed the roster's daily status. localStorage-backed
// so dispatchers can manage them without a backend; the board reads them
// client-side (via effect) to stay hydration-safe.

import type { TechStatusKind } from "./types";

export type AvailabilityKind = "pto" | "time_off" | "training" | "on_call" | "blocked";

export interface AvailabilityEvent {
  id: string;
  techName: string;
  kind: AvailabilityKind;
  date: string;          // yyyy-mm-dd (the day it applies to)
  allDay: boolean;
  startHour?: number;    // when !allDay (24h)
  endHour?: number;
  note?: string;
}

export const AVAILABILITY_CONFIG: Record<AvailabilityKind, { label: string; color: string; blocksWork: boolean }> = {
  pto:       { label: "PTO",         color: "#9ca3af", blocksWork: true  },
  time_off:  { label: "Time Off",    color: "#9ca3af", blocksWork: true  },
  training:  { label: "Training",    color: "#8b5cf6", blocksWork: true  },
  on_call:   { label: "On Call",     color: "#8b5cf6", blocksWork: false },
  blocked:   { label: "Blocked",     color: "#6b7280", blocksWork: true  },
};

// How an all-day availability event reflects in the tech roster's status chip.
const KIND_TO_TECH_STATUS: Record<AvailabilityKind, TechStatusKind> = {
  pto:      "off_today",
  time_off: "off_today",
  training: "late_shift",
  on_call:  "on_call",
  blocked:  "available",   // a single blocked slot doesn't take the tech off the day
};

export function techStatusForKind(kind: AvailabilityKind): TechStatusKind {
  return KIND_TO_TECH_STATUS[kind];
}

// ─── Store ────────────────────────────────────────────────
const KEY = "crm-availability";
let _events: AvailabilityEvent[] | null = null;

function load(): AvailabilityEvent[] {
  if (_events) return _events;
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(KEY); _events = r ? JSON.parse(r) : []; }
  catch { _events = []; }
  return _events!;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(_events ?? [])); } catch { /* ignore */ }
}

export function getAvailability(): AvailabilityEvent[] {
  return load();
}

// Events covering a given day (yyyy-mm-dd).
export function getAvailabilityForDay(ymd: string): AvailabilityEvent[] {
  return load().filter(e => e.date === ymd);
}

export interface NewAvailabilityInput {
  techName: string;
  kind: AvailabilityKind;
  date: string;
  allDay: boolean;
  startHour?: number;
  endHour?: number;
  note?: string;
}

export function createAvailability(input: NewAvailabilityInput): AvailabilityEvent {
  const ev: AvailabilityEvent = {
    id: `avail-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    techName: input.techName,
    kind: input.kind,
    date: input.date,
    allDay: input.allDay,
    startHour: input.allDay ? undefined : input.startHour,
    endHour: input.allDay ? undefined : input.endHour,
    note: input.note?.trim() || undefined,
  };
  _events = [...load(), ev];
  persist();
  return ev;
}

export function removeAvailability(id: string): void {
  _events = load().filter(e => e.id !== id);
  persist();
}
