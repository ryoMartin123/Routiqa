// ─── Principal adapters ───────────────────────────────────
// Build the resolver's Principal from either user model:
//   • CurrentUser  — the hierarchy session user (memberships, HierarchyRole)
//   • AppUser      — a directory user (assignments, full RoleKey set)
// Keeping this conversion in one place lets the resolver stay model-agnostic.

import type { CurrentUser } from "@/lib/hierarchy/types";
import type { AppUser } from "@/lib/users/data";
import type { Principal, RoleKey } from "./types";

export function principalFromCurrentUser(u: CurrentUser): Principal {
  return {
    id: u.id,
    name: u.fullName,
    grants: u.memberships.map(m => ({
      role: m.role as RoleKey,        // HierarchyRole ⊂ RoleKey
      companyId: m.companyId,
      locationId: m.locationId,
    })),
  };
}

export function principalFromAppUser(u: AppUser): Principal {
  return {
    id: u.id,
    name: u.fullName,
    grants: u.assignments.map(a => ({
      role: a.role,
      companyId: a.companyId,
      locationId: a.locationId,
      serviceAreaId: a.serviceAreaId,
    })),
  };
}
