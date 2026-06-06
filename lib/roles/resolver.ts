// ─── Resolver — principal → effective permissions ─────────
// Pure functions (safe on server and client). Given a Principal, answers:
//   can(resource, action, ctx?)   fieldVisible(mask, ctx?)   hasFlag(flag)
//
// Resolution rule: gather the principal's grants whose SCOPE contains the record
// context, map each to its role definition, and take the UNION (most-permissive
// wins). This is what makes multiple assignments work — e.g. Manager at Augusta
// + Technician at Evans yields manager powers on an Augusta record and tech
// powers on an Evans record, automatically.

import { getRoleDefinition } from "./store";
import {
  RESTRICTED_RESOURCES,
  type Action, type AccessLevel, type FieldMask, type PermissionContext, type Principal,
  type Resource, type RoleDefinition, type RoleGrant, type RoleKey, type SensitiveFlag,
} from "./types";

const RANK: Record<AccessLevel, number> = { none: 0, own: 1, all: 2 };

// Resolve a grant's role through the store (custom + edited roles), falling back
// to the shipped preset / a safe minimal role for unknown keys.
function roleOf(g: RoleGrant): RoleDefinition {
  return getRoleDefinition(g.role);
}

// Does a grant's scope contain the given context?
//   org-level     (no companyId/locationId) → contains everything
//   company-level (companyId only)          → matches same company
//   location-level(locationId)              → matches same location
// An omitted ctx field is treated as "any" (module-level check).
function scopeContains(g: RoleGrant, ctx?: PermissionContext): boolean {
  if (!ctx) return true;
  if (g.locationId) {
    return !ctx.locationId || ctx.locationId === g.locationId;
  }
  if (g.companyId) {
    return !ctx.companyId || ctx.companyId === g.companyId;
  }
  return true; // org-level grant
}

// The access level a single role grants for resource+action (before scope/own).
function grantedLevel(def: RoleDefinition, resource: Resource, action: Action): AccessLevel {
  if (def.allAccess && !RESTRICTED_RESOURCES.includes(resource)) return "all";
  return def.capabilities[resource]?.[action] ?? "none";
}

// Evaluate a level against the ownership context.
//   all → allowed (scope already checked)
//   own → allowed unless we know the record is NOT the user's (ownedByMe === false)
function levelAllows(level: AccessLevel, ctx?: PermissionContext): boolean {
  if (level === "all") return true;
  if (level === "own") return ctx?.ownedByMe !== false;
  return false;
}

// ─── Public API ───────────────────────────────────────────

export function can(
  principal: Principal,
  resource: Resource,
  action: Action,
  ctx?: PermissionContext,
): boolean {
  for (const g of principal.grants) {
    if (!scopeContains(g, ctx)) continue;
    if (levelAllows(grantedLevel(roleOf(g), resource, action), ctx)) return true;
  }
  return false;
}

// Highest access level the principal has for resource+action across in-scope
// grants (handy for "own vs all" list filtering).
export function accessLevel(
  principal: Principal,
  resource: Resource,
  action: Action,
  ctx?: PermissionContext,
): AccessLevel {
  let best: AccessLevel = "none";
  for (const g of principal.grants) {
    if (!scopeContains(g, ctx)) continue;
    const lvl = grantedLevel(roleOf(g), resource, action);
    if (RANK[lvl] > RANK[best]) best = lvl;
  }
  return best;
}

// Can the principal see a masked field/section? Any in-scope role granting it wins.
export function fieldVisible(
  principal: Principal,
  mask: FieldMask,
  ctx?: PermissionContext,
): boolean {
  return principal.grants.some(g => scopeContains(g, ctx) && roleOf(g).masks.includes(mask));
}

// Does the principal hold a sensitive-action flag (anywhere, or within ctx scope)?
export function hasFlag(
  principal: Principal,
  flag: SensitiveFlag,
  ctx?: PermissionContext,
): boolean {
  return principal.grants.some(g => scopeContains(g, ctx) && roleOf(g).flags.includes(flag));
}

// All role definitions the principal holds (deduped) — for "you are: Manager, Tech".
export function principalRoles(principal: Principal): RoleDefinition[] {
  const seen = new Set<RoleKey>();
  const out: RoleDefinition[] = [];
  for (const g of principal.grants) {
    const def = roleOf(g);
    if (!seen.has(def.key)) { seen.add(def.key); out.push(def); }
  }
  return out;
}
