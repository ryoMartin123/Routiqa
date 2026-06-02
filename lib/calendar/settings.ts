// Calendar / Dispatch settings — scoped with inheritance.
//
// Settings cascade Organization defaults → Company overrides → Location/Branch
// overrides. The dispatch board always resolves the *most specific* settings for
// the active company/location context.
//
// A scope stores only the sections it explicitly overrides; absent sections are
// inherited from the parent. Dispatch boards are NOT inherited — each board
// belongs to a company + location and is stored once in a flat list.
//
// Persistence is localStorage-only for now (no Supabase). The shape mirrors what
// will become per-organization / per-company / per-location settings rows.

import {
  SERVICE_BLOCKS, CALENDAR_LAYERS, LAYER_CONFIG, DAY_START_HOUR,
  type CalendarItemType, type DispatchMode,
} from "./types";
import { defaultQueueViews, type QueueView } from "./queueViews";
import { companies, locations } from "@/lib/hierarchy/data";

const STORAGE_KEY = "crm-dispatch-settings";

// ─── Types ────────────────────────────────────────────────
export type CalendarViewMode = "dispatch" | "day" | "week" | "month";
export type HourIncrement = 15 | 30 | 60;
export type HourLabelStyle = "hours" | "all";
export type BoardType = "service" | "install" | "maintenance" | "commercial" | "custom";

export interface SettingsServiceBlock {
  id: string;
  name: string;
  startHour: number;   // 24h, may be fractional (e.g. 8.5 = 8:30)
  endHour: number;
  active: boolean;
  order: number;
}

export interface SettingsLayer {
  type: CalendarItemType;
  enabled: boolean;          // available at all
  visibleByDefault: boolean; // shown on first load
  color: string;
}

// A dispatch board belongs to a company + location.
export interface DispatchBoard {
  id: string;
  name: string;
  companyId: string;
  locationId: string;
  boardType: BoardType;
  dispatchers: string[];
  techNames: string[];
  jobTypes: string[];
  serviceAreaIds: string[];           // optional narrowing; empty = all
  defaultView?: CalendarViewMode;     // optional per-board view seed
  defaultDispatchMode?: DispatchMode; // optional per-board mode seed
  active: boolean;
  isDefault: boolean;                 // default board within its company+location
}

// The fully-resolved, non-board settings the dispatch board consumes.
export interface DispatchSettings {
  defaultView: CalendarViewMode;
  defaultDispatchMode: DispatchMode;
  hourly: {
    startHour: number;
    endHour: number;
    increment: HourIncrement;
    labelStyle: HourLabelStyle;
  };
  blocks: SettingsServiceBlock[];
  layers: SettingsLayer[];
}

// What a single scope (org / company / location) can override. Only the present
// sections are overrides; absent sections inherit from the parent scope.
export interface ScopedDispatchConfig {
  defaults?: { defaultView: CalendarViewMode; defaultDispatchMode: DispatchMode };
  hourly?: DispatchSettings["hourly"];
  blocks?: SettingsServiceBlock[];
  layers?: SettingsLayer[];
}

export type DispatchSection = "defaults" | "hourly" | "blocks" | "layers";

// Persisted store: per-scope overrides + a flat board list + queue views.
export interface DispatchStore {
  version: 3;
  scopes: Record<string, ScopedDispatchConfig>;
  boards: DispatchBoard[];
  queueViews: QueueView[];   // Unscheduled Queue saved tabs/views
}

export type ScopeLevel = "org" | "company" | "location";

// ─── Mock users (dispatchers + field techs) ───────────────
export const MOCK_DISPATCHERS = ["Sara Cho", "Kylie Reyes", "Ernest Vaughn", "Marcus Webb"];
export const MOCK_TECHS = ["J. Patel", "M. Cole", "D. Nguyen", "T. Brooks", "R. Avery", "P. Singh"];
export const MOCK_JOB_TYPES = ["Service", "Repair", "Installation", "Maintenance", "Inspection", "Estimate"];

export const BOARD_TYPE_LABELS: Record<BoardType, string> = {
  service: "Service", install: "Install", maintenance: "Maintenance", commercial: "Commercial", custom: "Custom",
};

// ─── Defaults ─────────────────────────────────────────────
function defaultBlocks(): SettingsServiceBlock[] {
  return SERVICE_BLOCKS.map((b, i) => ({
    id: b.key, name: b.label, startHour: b.startHour, endHour: b.endHour, active: true, order: i,
  }));
}

function defaultLayers(): SettingsLayer[] {
  const order: CalendarItemType[] = [
    "job", "agreement_visit", "task", "project_milestone", "internal_event", "blocked_time",
  ];
  const hiddenByDefault = new Set<CalendarItemType>(["blocked_time"]);
  return order.map(type => ({
    type, enabled: true, visibleByDefault: !hiddenByDefault.has(type), color: LAYER_CONFIG[type].color,
  }));
}

// The hardcoded organization baseline (before any saved org override).
export function defaultDispatchSettings(): DispatchSettings {
  return {
    defaultView: "dispatch",
    defaultDispatchMode: "hourly",
    hourly: { startHour: DAY_START_HOUR, endHour: 18, increment: 30, labelStyle: "hours" },
    blocks: defaultBlocks(),
    layers: defaultLayers(),
  };
}

// Seed boards — Northstar HVAC (Augusta + Evans) and Northstar Roofing (Columbia).
function defaultBoards(): DispatchBoard[] {
  return [
    { id: "brd-aug-service", name: "Service Board",     companyId: "co_hvac",    locationId: "loc_augusta",  boardType: "service",     dispatchers: ["Sara Cho"],      techNames: ["M. Cole", "T. Brooks"], jobTypes: ["Service", "Repair", "Maintenance"], serviceAreaIds: [], active: true, isDefault: true },
    { id: "brd-aug-install", name: "Install Board",     companyId: "co_hvac",    locationId: "loc_augusta",  boardType: "install",     dispatchers: ["Kylie Reyes"],   techNames: ["J. Patel", "D. Nguyen"], jobTypes: ["Installation"],                     serviceAreaIds: [], active: true, isDefault: false },
    { id: "brd-aug-maint",   name: "Maintenance Board", companyId: "co_hvac",    locationId: "loc_augusta",  boardType: "maintenance", dispatchers: ["Sara Cho"],      techNames: ["R. Avery"],              jobTypes: ["Maintenance", "Inspection"],        serviceAreaIds: [], active: true, isDefault: false },
    { id: "brd-aug-comm",    name: "Commercial Board",  companyId: "co_hvac",    locationId: "loc_augusta",  boardType: "commercial",  dispatchers: ["Ernest Vaughn"], techNames: ["D. Nguyen", "R. Avery"], jobTypes: ["Service", "Inspection"],            serviceAreaIds: [], active: true, isDefault: false },
    { id: "brd-evans-service", name: "Service Board",   companyId: "co_hvac",    locationId: "loc_evans",    boardType: "service",     dispatchers: ["Kylie Reyes"],   techNames: ["M. Cole"],               jobTypes: ["Service", "Repair"],                serviceAreaIds: [], active: true, isDefault: true },
    { id: "brd-col-inspect", name: "Inspection Board",  companyId: "co_roofing", locationId: "loc_columbia", boardType: "service",     dispatchers: ["Marcus Webb"],   techNames: ["T. Brooks"],             jobTypes: ["Inspection", "Repair"],             serviceAreaIds: [], active: true, isDefault: true },
  ];
}

function defaultStore(): DispatchStore {
  return { version: 3, scopes: {}, boards: defaultBoards(), queueViews: defaultQueueViews() };
}

// ─── Persistence + migration ──────────────────────────────
// Map a legacy board's free-text `location` label to a location id.
function locationIdFromLabel(label: string): { companyId: string; locationId: string } {
  const norm = (label ?? "").replace(/ Branch$/i, "").trim().toLowerCase();
  const loc = locations.find(l => l.name.replace(/ Branch$/i, "").trim().toLowerCase() === norm)
    ?? locations.find(l => (l.city ?? "").toLowerCase() === norm);
  if (loc) return { companyId: loc.companyId, locationId: loc.id };
  const first = locations[0];
  return { companyId: first.companyId, locationId: first.id };
}

// Convert the old flat v1 shape into the scoped v2 store.
function migrateV1(parsed: Record<string, unknown>): DispatchStore {
  const org: ScopedDispatchConfig = {};
  if (parsed.defaultView || parsed.defaultDispatchMode) {
    org.defaults = {
      defaultView: (parsed.defaultView as CalendarViewMode) ?? "dispatch",
      defaultDispatchMode: (parsed.defaultDispatchMode as DispatchMode) ?? "hourly",
    };
  }
  if (parsed.hourly) org.hourly = parsed.hourly as DispatchSettings["hourly"];
  if (parsed.blocks) org.blocks = parsed.blocks as SettingsServiceBlock[];
  if (parsed.layers) org.layers = parsed.layers as SettingsLayer[];

  let boards = defaultBoards();
  const legacy = parsed.boards as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(legacy) && legacy.length) {
    boards = legacy.map((b, i) => {
      const { companyId, locationId } = locationIdFromLabel(String(b.location ?? ""));
      return {
        id: String(b.id ?? `brd-${i}`),
        name: String(b.name ?? "Board"),
        companyId, locationId,
        boardType: "custom" as BoardType,
        dispatchers: (b.dispatchers as string[]) ?? [],
        techNames: (b.techNames as string[]) ?? [],
        jobTypes: (b.jobTypes as string[]) ?? [],
        serviceAreaIds: [],
        active: b.active !== false,
        isDefault: !!b.isDefault,
      };
    });
  }
  return { version: 3, scopes: { org }, boards, queueViews: defaultQueueViews() };
}

export function getStore(): DispatchStore {
  if (typeof window === "undefined") return defaultStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.version === 3) {
      const store = parsed as unknown as DispatchStore;
      return {
        version: 3,
        scopes: store.scopes ?? {},
        boards: store.boards ?? defaultBoards(),
        queueViews: store.queueViews?.length ? store.queueViews : defaultQueueViews(),
      };
    }
    if (parsed.version === 2) {
      // v2 → v3: keep scopes/boards, seed default queue views (and persist).
      const store = parsed as unknown as DispatchStore;
      const upgraded: DispatchStore = {
        version: 3,
        scopes: store.scopes ?? {},
        boards: store.boards ?? defaultBoards(),
        queueViews: defaultQueueViews(),
      };
      saveStore(upgraded);
      return upgraded;
    }
    // Legacy v1 → migrate (and persist the upgrade).
    const migrated = migrateV1(parsed);
    saveStore(migrated);
    return migrated;
  } catch {
    return defaultStore();
  }
}

export function saveStore(store: DispatchStore): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* ignore */ }
}

export function resetStore(): DispatchStore {
  const d = defaultStore();
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  return d;
}

// ─── Scope keys ───────────────────────────────────────────
export function scopeKeyOf(level: ScopeLevel, companyId?: string, locationId?: string): string {
  if (level === "company") return `company:${companyId}`;
  if (level === "location") return `location:${locationId}`;
  return "org";
}

// ─── Resolution (Org → Company → Location) ────────────────
function mergeInto(base: DispatchSettings, c?: ScopedDispatchConfig): DispatchSettings {
  if (!c) return base;
  return {
    defaultView:         c.defaults?.defaultView ?? base.defaultView,
    defaultDispatchMode: c.defaults?.defaultDispatchMode ?? base.defaultDispatchMode,
    hourly:              c.hourly ?? base.hourly,
    blocks:              c.blocks ?? base.blocks,
    layers:              c.layers ?? base.layers,
  };
}

// Resolve against a given store (used by the Settings UI with unsaved edits).
export function resolveFromStore(store: DispatchStore, companyId?: string, locationId?: string): DispatchSettings {
  let out = defaultDispatchSettings();
  out = mergeInto(out, store.scopes["org"]);
  if (companyId) out = mergeInto(out, store.scopes[`company:${companyId}`]);
  if (locationId) out = mergeInto(out, store.scopes[`location:${locationId}`]);
  return out;
}

// Resolve the most-specific settings for the active context.
export function resolveDispatchSettings(companyId?: string, locationId?: string): DispatchSettings {
  return resolveFromStore(getStore(), companyId, locationId);
}

// The resolved *parent* settings a scope inherits from (for the Settings UI).
export function resolveParent(store: DispatchStore, level: ScopeLevel, companyId?: string, locationId?: string): DispatchSettings {
  if (level === "org") return defaultDispatchSettings();
  if (level === "company") return resolveFromStore(store, undefined, undefined); // base + org
  const loc = locations.find(l => l.id === locationId);
  return resolveFromStore(store, loc?.companyId, undefined);                      // base + org + company
}

// ─── Boards ───────────────────────────────────────────────
// Boards available for a context. Undefined company/location = no narrowing.
export function getBoardsForContext(companyId?: string, locationId?: string): DispatchBoard[] {
  return getStore().boards.filter(b =>
    b.active &&
    (!companyId  || b.companyId  === companyId) &&
    (!locationId || b.locationId === locationId),
  );
}

// Does a scheduled/unscheduled item belong to a board?  Tech OR job-type match,
// optionally narrowed by the board's service areas.
export function itemMatchesBoard(
  item: { assignedTo?: string; jobType?: string; serviceAreaId?: string },
  board: DispatchBoard,
): boolean {
  if (board.serviceAreaIds.length && item.serviceAreaId && !board.serviceAreaIds.includes(item.serviceAreaId)) {
    return false;
  }
  const techMatch = !!item.assignedTo && board.techNames.includes(item.assignedTo);
  const typeMatch = !!item.jobType && board.jobTypes.includes(item.jobType);
  // If the board declares neither techs nor job types, treat it as "all".
  if (board.techNames.length === 0 && board.jobTypes.length === 0) return true;
  return techMatch || typeMatch;
}

// ─── Queue views ──────────────────────────────────────────
// All saved Unscheduled Queue views, ordered. Inactive views are kept (the
// Settings editor still lists them) — the board filters to active+visible.
export function getQueueViews(): QueueView[] {
  return [...getStore().queueViews].sort((a, b) => a.order - b.order);
}

// The views the dispatch board should render as tabs: active and visible by
// default, in order. "All" is guaranteed present even if it was deactivated.
export function getVisibleQueueViews(): QueueView[] {
  const all = getQueueViews();
  const visible = all.filter(v => v.active && v.defaultVisible);
  if (!visible.some(v => v.key === "all")) {
    const allView = all.find(v => v.key === "all") ?? defaultQueueViews()[0];
    return [allView, ...visible];
  }
  return visible;
}

// ─── Helpers ──────────────────────────────────────────────
export function formatHour(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  const period = whole >= 12 ? "PM" : "AM";
  const h12 = whole % 12 === 0 ? 12 : whole % 12;
  return `${h12}:${mins.toString().padStart(2, "0")} ${period}`;
}

export function newBlockId(): string { return `blk-${Math.random().toString(36).slice(2, 8)}`; }
export function newBoardId(): string { return `brd-${Math.random().toString(36).slice(2, 8)}`; }

export const LAYER_LABEL = (type: CalendarItemType): string => LAYER_CONFIG[type].label;
export { CALENDAR_LAYERS };
