"use client";

// ─── <Can> — declarative permission gate ──────────────────
// Renders children only when the current user is allowed. Use for nav items,
// action buttons, and sensitive sections.
//
//   <Can resource="invoices" action="create">…</Can>
//   <Can resource="jobs" action="edit" ctx={{ locationId, ownedByMe }}>…</Can>
//   <Can mask="finance_cost_margin">$ {cost}</Can>
//   <Can flag="users_manage">…</Can>
//
// Provide exactly one of: (resource + action) | mask | flag. An optional
// `fallback` renders when access is denied.

import { usePermissions } from "@/components/providers/PermissionProvider";
import type { Action, FieldMask, PermissionContext, Resource, SensitiveFlag } from "@/lib/roles/types";

type CanProps = {
  ctx?: PermissionContext;
  fallback?: React.ReactNode;
  children: React.ReactNode;
} & (
  | { resource: Resource; action: Action; mask?: never; flag?: never }
  | { mask: FieldMask; resource?: never; action?: never; flag?: never }
  | { flag: SensitiveFlag; resource?: never; action?: never; mask?: never }
);

export function Can({ resource, action, mask, flag, ctx, fallback = null, children }: CanProps) {
  const perms = usePermissions();

  let allowed = false;
  if (mask) allowed = perms.fieldVisible(mask, ctx);
  else if (flag) allowed = perms.hasFlag(flag, ctx);
  else if (resource && action) allowed = perms.can(resource, action, ctx);

  return <>{allowed ? children : fallback}</>;
}

export default Can;
