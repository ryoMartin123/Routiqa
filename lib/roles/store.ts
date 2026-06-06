// ─── Roles store ──────────────────────────────────────────
// The organization's live role set. Seeds from ROLE_PRESETS (the HVAC defaults)
// on first use, then persists edits and custom roles to localStorage. The
// resolver and the Roles matrix UI both read through here, so a default role and
// a custom role behave identically.
//
// Maps to a future `roles` table (system + custom rows) keyed on organization_id.

import { ROLE_PRESETS, ROLE_ORDER, FALLBACK_ROLE } from "./presets";
import type { RoleDefinition, RoleKey } from "./types";

const KEY = "crm-roles";
let _roles: RoleDefinition[] | null = null;

function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

// Fresh copy of the shipped defaults, in display order.
function defaultRoles(): RoleDefinition[] {
  return ROLE_ORDER.map(k => clone(ROLE_PRESETS[k])).filter(Boolean);
}

function load(): RoleDefinition[] {
  if (_roles) return _roles;
  if (typeof window === "undefined") return defaultRoles();
  try {
    const raw = localStorage.getItem(KEY);
    _roles = raw ? (JSON.parse(raw) as RoleDefinition[]) : defaultRoles();
  } catch {
    _roles = defaultRoles();
  }
  return _roles!;
}

function persist(): void {
  if (!_roles) return;
  try { localStorage.setItem(KEY, JSON.stringify(_roles)); } catch { /* ignore */ }
}

// ─── Reads ────────────────────────────────────────────────
export function getOrgRoles(): RoleDefinition[] {
  return [...load()];
}

// Resolver lookup — store first, then shipped preset, then a safe fallback.
export function getRoleDefinition(key: RoleKey): RoleDefinition {
  return load().find(r => r.key === key) ?? ROLE_PRESETS[key] ?? FALLBACK_ROLE;
}

export function getOrgRole(key: RoleKey): RoleDefinition | undefined {
  return load().find(r => r.key === key);
}

export function getRoleLabel(key: RoleKey): string {
  return getOrgRole(key)?.label ?? ROLE_PRESETS[key]?.label ?? key;
}

export function isSystemRole(key: RoleKey): boolean {
  return Boolean(ROLE_PRESETS[key]);
}

// Roles offered when assigning a user (everything except the owner grant).
export function getAssignableRoles(): RoleDefinition[] {
  return load().filter(r => r.key !== "org_owner");
}

// ─── Writes ───────────────────────────────────────────────
// Create or replace a role by key. System roles can be edited (permissions) but
// keep system=true; custom roles are system=false.
export function upsertRole(def: RoleDefinition): void {
  const list = load();
  const idx = list.findIndex(r => r.key === def.key);
  if (idx >= 0) _roles = list.map((r, i) => (i === idx ? def : r));
  else _roles = [...list, def];
  persist();
}

// Delete a custom role. System roles are not deletable (use reset instead).
export function deleteRole(key: RoleKey): boolean {
  if (isSystemRole(key)) return false;
  _roles = load().filter(r => r.key !== key);
  persist();
  return true;
}

// Restore a single system role to its shipped default.
export function resetRole(key: RoleKey): void {
  if (!ROLE_PRESETS[key]) return;
  upsertRole(clone(ROLE_PRESETS[key]));
}

// Restore the entire role set to the shipped defaults (drops custom roles).
export function resetAllRoles(): void {
  _roles = defaultRoles();
  persist();
}

// Generate a unique key from a label (for new custom roles).
export function roleKeyFromLabel(label: string): string {
  const base = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "role";
  let key = base;
  let n = 2;
  const taken = new Set(load().map(r => r.key));
  while (taken.has(key)) key = `${base}_${n++}`;
  return key;
}
