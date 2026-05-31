// Calendar / Dispatch settings — the org-level *defaults* for the Dispatching
// module. Settings here control the default view, hours, service blocks, boards,
// and layers. The dispatch board itself controls the *current* view at runtime.
//
// Persistence is localStorage-only for now (no Supabase). The shape mirrors what
// will become a per-organization settings row in production.

import {
  SERVICE_BLOCKS, CALENDAR_LAYERS, LAYER_CONFIG, DAY_START_HOUR, DAY_END_HOUR,
  type CalendarItemType, type DispatchMode,
} from "./types";

const STORAGE_KEY = "crm-dispatch-settings";

// ─── Types ────────────────────────────────────────────────
export type CalendarViewMode = "dispatch" | "day" | "week" | "month";
export type HourIncrement = 15 | 30 | 60;
export type HourLabelStyle = "hours" | "all";

export interface SettingsServiceBlock {
  id: string;
  name: string;
  startHour: number;   // 24h, may be fractional (e.g. 8.5 = 8:30)
  endHour: number;
  active: boolean;
  order: number;
}

export interface SettingsBoard {
  id: string;
  name: string;
  location: string;
  dispatchers: string[];
  techNames: string[];
  jobTypes: string[];
  active: boolean;
  isDefault: boolean;
}

export interface SettingsLayer {
  type: CalendarItemType;
  enabled: boolean;          // available at all
  visibleByDefault: boolean; // shown on first load
  color: string;
}

export interface DispatchSettings {
  // 1 — Default calendar settings
  defaultView: CalendarViewMode;
  defaultDispatchMode: DispatchMode;

  // 2 — Hourly view settings
  hourly: {
    startHour: number;
    endHour: number;
    increment: HourIncrement;
    labelStyle: HourLabelStyle;
  };

  // 3 — Service blocks
  blocks: SettingsServiceBlock[];

  // 4 — Dispatch boards / teams
  boards: SettingsBoard[];

  // 5 — Calendar layers
  layers: SettingsLayer[];
}

// ─── Mock users (dispatchers + field techs) ───────────────
// Stand-ins until the users module lands. Used to populate the assignment
// pickers on dispatch boards.
export const MOCK_DISPATCHERS = ["Sara Cho", "Kylie Reyes", "Ernest Vaughn", "Marcus Webb"];
export const MOCK_TECHS = ["J. Patel", "M. Cole", "D. Nguyen", "T. Brooks", "R. Avery", "P. Singh"];
export const MOCK_JOB_TYPES = ["Service", "Repair", "Installation", "Maintenance", "Inspection", "Estimate"];

// ─── Defaults ─────────────────────────────────────────────
function defaultBlocks(): SettingsServiceBlock[] {
  return SERVICE_BLOCKS.map((b, i) => ({
    id: b.key,
    name: b.label,
    startHour: b.startHour,
    endHour: b.endHour,
    active: true,
    order: i,
  }));
}

function defaultBoards(): SettingsBoard[] {
  return [
    { id: "service",    name: "Service Board",    location: "Augusta Branch", dispatchers: ["Sara Cho"],     techNames: ["M. Cole", "T. Brooks"],   jobTypes: ["Service", "Repair", "Maintenance"], active: true, isDefault: true },
    { id: "install",    name: "Install Board",    location: "Augusta Branch", dispatchers: ["Kylie Reyes"],  techNames: ["J. Patel", "D. Nguyen"],  jobTypes: ["Installation"],                     active: true, isDefault: false },
    { id: "commercial", name: "Commercial Board", location: "Evans Branch",   dispatchers: ["Ernest Vaughn"],techNames: ["D. Nguyen", "R. Avery"],  jobTypes: ["Service", "Inspection"],            active: true, isDefault: false },
  ];
}

function defaultLayers(): SettingsLayer[] {
  // The six layers the spec calls out, in display order.
  const order: CalendarItemType[] = [
    "job", "agreement_visit", "task", "project_milestone", "internal_event", "blocked_time",
  ];
  const hiddenByDefault = new Set<CalendarItemType>(["blocked_time"]);
  return order.map(type => ({
    type,
    enabled: true,
    visibleByDefault: !hiddenByDefault.has(type),
    color: LAYER_CONFIG[type].color,
  }));
}

export function defaultDispatchSettings(): DispatchSettings {
  return {
    defaultView: "dispatch",
    defaultDispatchMode: "hourly",
    hourly: {
      startHour: DAY_START_HOUR,   // 7 AM
      endHour: 18,                 // 6 PM
      increment: 30,
      labelStyle: "hours",
    },
    blocks: defaultBlocks(),
    boards: defaultBoards(),
    layers: defaultLayers(),
  };
}

// ─── Persistence ──────────────────────────────────────────
export function getDispatchSettings(): DispatchSettings {
  if (typeof window === "undefined") return defaultDispatchSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultDispatchSettings();
    const parsed = JSON.parse(raw) as Partial<DispatchSettings>;
    // Shallow-merge against defaults so new fields fill in gracefully.
    const base = defaultDispatchSettings();
    return {
      ...base,
      ...parsed,
      hourly: { ...base.hourly, ...(parsed.hourly ?? {}) },
      blocks: parsed.blocks ?? base.blocks,
      boards: parsed.boards ?? base.boards,
      layers: parsed.layers ?? base.layers,
    };
  } catch {
    return defaultDispatchSettings();
  }
}

export function saveDispatchSettings(s: DispatchSettings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function resetDispatchSettings(): DispatchSettings {
  const d = defaultDispatchSettings();
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  return d;
}

// ─── Helpers ──────────────────────────────────────────────
// Format a (possibly fractional) 24h hour as "7:00 AM" / "6:30 PM".
export function formatHour(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  const period = whole >= 12 ? "PM" : "AM";
  const h12 = whole % 12 === 0 ? 12 : whole % 12;
  return `${h12}:${mins.toString().padStart(2, "0")} ${period}`;
}

export function newBlockId(): string {
  return `blk-${Math.random().toString(36).slice(2, 8)}`;
}
export function newBoardId(): string {
  return `brd-${Math.random().toString(36).slice(2, 8)}`;
}

export const LAYER_LABEL = (type: CalendarItemType): string => LAYER_CONFIG[type].label;
export { CALENDAR_LAYERS };
