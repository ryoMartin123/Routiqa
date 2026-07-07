// Project settings — customizable config resolved through the layered scoped
// store (Org → Company → Branch), mirroring lib/pipelines/data.ts.
//
//   • Stages    → the custom project pipeline (Kanban columns)
//   • Types     → selectable project types
//   • Templates → preset phase sets that seed a new project
//   • Defaults  → default stage/type/priority + whether budget fields show

import { resolveScoped, writeScoped, clearScoped, type ScopeIds } from "@/lib/settings-scope/store";
import { PROJECT_TYPE_LABELS } from "./data";

// ─── Stages (custom project pipeline) ─────────────────────
export const PROJECT_STAGES_KEY = "project-stages";

export type ProjectStageCategory = "open" | "done" | "canceled";

export interface ProjectStage {
  id: string;
  name: string;
  key: string;
  order: number;
  color: string;
  category: ProjectStageCategory;
  active: boolean;
}

export const PROJECT_STAGE_COLORS = [
  "#239c8d", "#3b82f6", "#0891b2", "#8b5cf6",
  "#f59e0b", "#ec4899", "#10b981", "#ef4444", "#6b7280",
];

export const DEFAULT_PROJECT_STAGES: ProjectStage[] = [
  { id: "prs-1", name: "Planning",    key: "planning",    order: 1, color: "#239c8d", category: "open",     active: true },
  { id: "prs-2", name: "Scheduled",   key: "scheduled",   order: 2, color: "#3b82f6", category: "open",     active: true },
  { id: "prs-3", name: "In Progress", key: "in_progress", order: 3, color: "#f59e0b", category: "open",     active: true },
  { id: "prs-4", name: "On Hold",     key: "on_hold",     order: 4, color: "#6b7280", category: "open",     active: true },
  { id: "prs-5", name: "Completed",   key: "completed",   order: 5, color: "#10b981", category: "done",     active: true },
  { id: "prs-6", name: "Canceled",    key: "canceled",    order: 6, color: "#ef4444", category: "canceled", active: true },
];

export function reorderProjectStages(stages: ProjectStage[]): ProjectStage[] {
  return [...stages].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i + 1 }));
}

export function getProjectStages(scope: ScopeIds = {}): ProjectStage[] {
  return resolveScoped<ProjectStage[]>(PROJECT_STAGES_KEY, scope, DEFAULT_PROJECT_STAGES)
    .slice().sort((a, b) => a.order - b.order);
}
export function saveProjectStages(stages: ProjectStage[], scopeKey = "org"): void {
  writeScoped(PROJECT_STAGES_KEY, scopeKey, reorderProjectStages(stages));
}
export function resetProjectStages(scopeKey = "org"): ProjectStage[] {
  clearScoped(PROJECT_STAGES_KEY, scopeKey);
  return [...DEFAULT_PROJECT_STAGES];
}

// First active stage = where new projects land by default.
export function defaultStageKey(scope: ScopeIds = {}): string {
  return getProjectStages(scope).find(s => s.active)?.key ?? "planning";
}

// ─── Types ────────────────────────────────────────────────
export const PROJECT_TYPES_KEY = "project-types";

export interface ProjectTypeOption { key: string; label: string; active: boolean; }

export const DEFAULT_PROJECT_TYPES: ProjectTypeOption[] =
  (Object.entries(PROJECT_TYPE_LABELS) as [string, string][]).map(([key, label]) => ({ key, label, active: true }));

export function getProjectTypes(scope: ScopeIds = {}): ProjectTypeOption[] {
  return resolveScoped<ProjectTypeOption[]>(PROJECT_TYPES_KEY, scope, DEFAULT_PROJECT_TYPES);
}
export function saveProjectTypes(types: ProjectTypeOption[], scopeKey = "org"): void {
  writeScoped(PROJECT_TYPES_KEY, scopeKey, types);
}
export function resetProjectTypes(scopeKey = "org"): ProjectTypeOption[] {
  clearScoped(PROJECT_TYPES_KEY, scopeKey);
  return [...DEFAULT_PROJECT_TYPES];
}
// Resolve a label for any type key (custom or built-in).
export function projectTypeLabel(key: string, scope: ScopeIds = {}): string {
  return getProjectTypes(scope).find(t => t.key === key)?.label
    ?? (PROJECT_TYPE_LABELS as Record<string, string>)[key]
    ?? key;
}

// ─── Templates (preset phase sets) ────────────────────────
export const PROJECT_TEMPLATES_KEY = "project-templates";

export interface ProjectTemplate {
  id: string;
  name: string;
  typeKey?: string;     // optional default type when applied
  phases: string[];     // ordered phase names
  checklist?: string[]; // optional starter checklist
}

export const DEFAULT_PROJECT_TEMPLATES: ProjectTemplate[] = [
  { id: "ptpl-hvac", name: "HVAC System Install", typeKey: "installation",
    phases: ["Site survey", "Equipment order", "Rough-in", "Equipment install", "Startup & QA", "Final walkthrough"] },
  { id: "ptpl-roof", name: "Roof Replacement", typeKey: "replacement",
    phases: ["Inspection", "Materials ordered", "Tear-off", "Decking & underlayment", "Install", "Cleanup & QA"] },
  { id: "ptpl-restore", name: "Water Restoration", typeKey: "restoration",
    phases: ["Assessment", "Mitigation", "Demo", "Drying", "Rebuild", "Final inspection"] },
];

export function getProjectTemplates(scope: ScopeIds = {}): ProjectTemplate[] {
  return resolveScoped<ProjectTemplate[]>(PROJECT_TEMPLATES_KEY, scope, DEFAULT_PROJECT_TEMPLATES);
}
export function saveProjectTemplates(templates: ProjectTemplate[], scopeKey = "org"): void {
  writeScoped(PROJECT_TEMPLATES_KEY, scopeKey, templates);
}
export function resetProjectTemplates(scopeKey = "org"): ProjectTemplate[] {
  clearScoped(PROJECT_TEMPLATES_KEY, scopeKey);
  return [...DEFAULT_PROJECT_TEMPLATES];
}

// ─── Defaults ─────────────────────────────────────────────
export const PROJECT_DEFAULTS_KEY = "project-defaults";

export interface ProjectDefaults {
  defaultTypeKey: string;
  defaultPriority: "low" | "normal" | "high" | "urgent";
  showBudget: boolean;     // show estimated vs actual / cost fields
}

export const DEFAULT_PROJECT_DEFAULTS: ProjectDefaults = {
  defaultTypeKey: "installation",
  defaultPriority: "normal",
  showBudget: true,
};

export function getProjectDefaults(scope: ScopeIds = {}): ProjectDefaults {
  return resolveScoped<ProjectDefaults>(PROJECT_DEFAULTS_KEY, scope, DEFAULT_PROJECT_DEFAULTS);
}
export function saveProjectDefaults(defaults: ProjectDefaults, scopeKey = "org"): void {
  writeScoped(PROJECT_DEFAULTS_KEY, scopeKey, defaults);
}

export function newProjectStageId(): string { return `prs-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`; }
export function newProjectTemplateId(): string { return `ptpl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`; }
export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 48);
}
