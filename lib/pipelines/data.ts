// Pipeline stages — settings model, resolved through the layered scoped store.
// Lives at Org → Company → Branch (cascade + override). getStages(scope) resolves
// the effective stages for a scope; the Settings editor uses useScopedSetting.

import { resolveScoped, writeScoped, clearScoped, type ScopeIds } from "@/lib/settings-scope/store";

export const PIPELINE_SETTING_KEY = "pipeline-stages";

export type StageCategory = "open" | "won" | "lost";

export interface PipelineStage {
  id:       string;
  name:     string;
  key:      string;        // slug
  order:    number;
  color:    string;        // hex
  category: StageCategory;
  active:   boolean;
}

export const STAGE_CATEGORY_LABELS: Record<StageCategory, string> = {
  open: "Open", won: "Won", lost: "Lost",
};

// Preset colors for the stage color picker
export const STAGE_COLORS = [
  "#6366f1", "#3b82f6", "#0891b2", "#8b5cf6",
  "#f59e0b", "#ec4899", "#10b981", "#ef4444", "#6b7280",
];

// ─── Default stages (General Service template) ────────────
export const DEFAULT_STAGES: PipelineStage[] = [
  { id: "ps-1", name: "New Lead",              key: "new_lead",              order: 1, color: "#6366f1", category: "open", active: true },
  { id: "ps-2", name: "Contacted",            key: "contacted",             order: 2, color: "#f59e0b", category: "open", active: true },
  { id: "ps-3", name: "Appointment Scheduled", key: "appointment_scheduled", order: 3, color: "#3b82f6", category: "open", active: true },
  { id: "ps-4", name: "Estimate Needed",      key: "estimate_needed",       order: 4, color: "#ec4899", category: "open", active: true },
  { id: "ps-5", name: "Estimate Sent",        key: "estimate_sent",         order: 5, color: "#8b5cf6", category: "open", active: true },
  { id: "ps-6", name: "Follow-Up",            key: "follow_up",             order: 6, color: "#0891b2", category: "open", active: true },
  { id: "ps-7", name: "Won",                  key: "won",                   order: 7, color: "#10b981", category: "won",  active: true },
  { id: "ps-8", name: "Lost",                 key: "lost",                  order: 8, color: "#ef4444", category: "lost", active: true },
];

// Re-number order sequentially (called on save).
export function reorderStages(stages: PipelineStage[]): PipelineStage[] {
  return [...stages].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i + 1 }));
}

// Effective stages for a scope (defaults to Org when no scope given), sorted.
export function getStages(scope: ScopeIds = {}): PipelineStage[] {
  return resolveScoped<PipelineStage[]>(PIPELINE_SETTING_KEY, scope, DEFAULT_STAGES)
    .slice().sort((a, b) => a.order - b.order);
}

// Persist stages at a scope (Org by default — used by industry defaults).
export function saveStages(stages: PipelineStage[], scopeKey = "org"): void {
  writeScoped(PIPELINE_SETTING_KEY, scopeKey, reorderStages(stages));
}

// Drop the override at a scope (Org by default) → falls back to inherited/default.
export function resetStages(scopeKey = "org"): PipelineStage[] {
  clearScoped(PIPELINE_SETTING_KEY, scopeKey);
  return [...DEFAULT_STAGES];
}

export function newStageId(): string {
  return `ps-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 48);
}
