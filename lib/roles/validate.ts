// ─── Role & assignment validation ─────────────────────────
// Catches impossible role configurations and impossible scope assignments before
// they're saved, so the UI can surface a clear message.

import type { HierarchyRole } from "@/lib/hierarchy/types";
import type { ScopeLevel } from "@/lib/users/data";
import { ACTION_ORDER, RESOURCE_ORDER } from "./catalog";
import type { RoleDefinition } from "./types";

// Broadness ranks. A role may be granted at a scope at least as broad as its
// tier (e.g. a Location Manager can be granted company-wide), but never narrower
// (an Org Admin can't be scoped to a single location).
const TIER_RANK: Record<HierarchyRole, number> = {
  org_admin: 3, company_admin: 2, location_manager: 1, employee: 0,
};
const LEVEL_RANK: Record<ScopeLevel, number> = {
  org: 3, company: 2, location: 1, service_area: 0,
};

const TIER_LEVEL_LABEL: Record<HierarchyRole, string> = {
  org_admin: "organization-wide",
  company_admin: "a company (or organization-wide)",
  location_manager: "a location, company, or organization-wide",
  employee: "any scope",
};

// The scope levels a role may legitimately be granted at.
export function allowedLevelsForRole(role: RoleDefinition): ScopeLevel[] {
  const min = TIER_RANK[role.scopeTier];
  return (Object.keys(LEVEL_RANK) as ScopeLevel[]).filter(l => LEVEL_RANK[l] >= min);
}

// Returns an error string if granting `role` at `level` is impossible, else null.
export function assignmentError(role: RoleDefinition, level: ScopeLevel): string | null {
  if (LEVEL_RANK[level] < TIER_RANK[role.scopeTier]) {
    return `${role.label} is too high-level for a single ${level.replace("_", " ")}. Grant it at ${TIER_LEVEL_LABEL[role.scopeTier]}.`;
  }
  return null;
}

// Validate a role definition before save. Returns a list of human-readable
// problems (empty = valid).
export function roleErrors(def: RoleDefinition, others: RoleDefinition[]): string[] {
  const errs: string[] = [];

  if (!def.label.trim()) errs.push("Role name is required.");

  const dup = others.some(r => r.key !== def.key && r.label.trim().toLowerCase() === def.label.trim().toLowerCase());
  if (dup) errs.push("A role with that name already exists.");

  // Must grant something.
  const grantsSomething = def.allAccess
    || Object.keys(def.capabilities).length > 0
    || def.flags.length > 0;
  if (!grantsSomething) errs.push("This role grants no access — add at least one permission.");

  // Coherence: any create/edit/delete/etc. on a resource implies View on it.
  if (!def.allAccess) {
    for (const res of RESOURCE_ORDER) {
      const caps = def.capabilities[res];
      if (!caps) continue;
      const hasOther = ACTION_ORDER.some(a => a !== "view" && caps[a] && caps[a] !== "none");
      const viewLevel = caps.view ?? "none";
      if (hasOther && viewLevel === "none") {
        errs.push(`"${res}" grants actions without View — enable View to make them usable.`);
      }
    }
  }

  return errs;
}
