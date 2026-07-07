// ─── Tasks settings — customizable task types + defaults ──
// Org-level configuration for the Tasks module: the task-type catalog (label,
// color, active, order) and the defaults the New Task modal pre-fills. Persists
// to localStorage (pre-Supabase), mirroring lib/photo-categories and the other
// settings stores. Built-in type keys come from lib/tasks/data.

import { TASK_TYPE_LABELS, type BuiltInTaskType } from "./data";

export interface TaskTypeDef {
  id:     string;
  key:    string;     // stable key stored on tasks (e.g. "follow_up")
  label:  string;
  color:  string;
  active: boolean;
  order:  number;
}

export type DefaultAssignee = "creator" | "unassigned";

export interface TaskSettings {
  types:            TaskTypeDef[];
  defaultTypeKey:   string;
  defaultDueInDays: number;        // New Task due date defaults to today + N
  defaultAssignee:  DefaultAssignee;
  highlightOverdue: boolean;       // red styling for overdue rows on the list
}

export const TASK_TYPE_COLORS = [
  "#0f8578", "#0891b2", "#2563eb", "#9333ea", "#7c3aed",
  "#d97706", "#059669", "#dc2626", "#db2777", "#6b7280",
];

// Default colors for the built-in keys.
const BUILTIN_COLOR: Record<BuiltInTaskType, string> = {
  follow_up:      "#0f8578",
  call:           "#0891b2",
  schedule:       "#2563eb",
  send_estimate:  "#9333ea",
  send_agreement: "#7c3aed",
  review:         "#d97706",
  inspection:     "#059669",
  other:          "#6b7280",
};

const BUILTIN_ORDER: BuiltInTaskType[] = [
  "follow_up", "call", "schedule", "send_estimate", "send_agreement", "review", "inspection", "other",
];

export function defaultTaskTypes(): TaskTypeDef[] {
  return BUILTIN_ORDER.map((key, i) => ({
    id: `tt_${key}`,
    key,
    label: TASK_TYPE_LABELS[key],
    color: BUILTIN_COLOR[key],
    active: true,
    order: i + 1,
  }));
}

export const DEFAULT_TASK_SETTINGS: TaskSettings = {
  types:            defaultTaskTypes(),
  defaultTypeKey:   "follow_up",
  defaultDueInDays: 3,
  defaultAssignee:  "creator",
  highlightOverdue: true,
};

// ─── Persistence ──────────────────────────────────────────
const KEY = "crm-task-settings";
let _cache: TaskSettings | null = null;

export function getTaskSettings(): TaskSettings {
  if (_cache) return _cache;
  if (typeof window === "undefined") return DEFAULT_TASK_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { _cache = DEFAULT_TASK_SETTINGS; return _cache; }
    const parsed = JSON.parse(raw) as Partial<TaskSettings>;
    // Merge over defaults so newly-added fields appear for existing users.
    _cache = {
      ...DEFAULT_TASK_SETTINGS,
      ...parsed,
      types: Array.isArray(parsed.types) && parsed.types.length ? parsed.types : DEFAULT_TASK_SETTINGS.types,
    };
  } catch { _cache = DEFAULT_TASK_SETTINGS; }
  return _cache!;
}

export function saveTaskSettings(next: TaskSettings): TaskSettings {
  _cache = next;
  if (typeof window !== "undefined") {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function resetTaskSettings(): TaskSettings {
  _cache = null;
  if (typeof window !== "undefined") {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }
  return getTaskSettings();
}

// ─── Read helpers ─────────────────────────────────────────
export function getTaskTypes(): TaskTypeDef[] {
  return [...getTaskSettings().types].sort((a, b) => a.order - b.order);
}

export function getActiveTaskTypes(): TaskTypeDef[] {
  return getTaskTypes().filter(t => t.active);
}

function findType(key: string): TaskTypeDef | undefined {
  return getTaskSettings().types.find(t => t.key === key);
}

export function taskTypeLabel(key: string): string {
  return findType(key)?.label ?? TASK_TYPE_LABELS[key as BuiltInTaskType] ?? key;
}

export function taskTypeColor(key: string): string {
  return findType(key)?.color ?? "#6b7280";
}

// ─── Id / slug helpers ────────────────────────────────────
export function ttId(): string {
  return `tt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
export function ttSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
