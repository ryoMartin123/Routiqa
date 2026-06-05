"use client";

// ─── PermissionProvider ───────────────────────────────────
// The runtime entry point for permissions. Resolves the *acting* user (the
// signed-in user, or whoever an admin is "viewing as") to a Principal and
// exposes the bound resolver API. Wrap the dashboard in this; read it via
// usePermissions().
//
// Bridge: the signed-in user is the directory AppUser matching the hierarchy
// session user's id. "View as" swaps the acting user for previewing roles.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { currentUser } from "@/lib/hierarchy/data";
import { getUsers, getUser, type AppUser } from "@/lib/users/data";
import { principalFromAppUser } from "@/lib/roles/principal";
import {
  can as canFn, accessLevel as accessLevelFn, fieldVisible as fieldVisibleFn,
  hasFlag as hasFlagFn, principalRoles,
} from "@/lib/roles/resolver";
import type {
  Action, AccessLevel, FieldMask, PermissionContext, Principal, Resource,
  RoleDefinition, SensitiveFlag,
} from "@/lib/roles/types";

const VIEW_AS_KEY = "crm-view-as";

// A safe fallback if the directory somehow lacks the session user.
const FALLBACK_USER: AppUser = {
  id: currentUser.id, fullName: currentUser.fullName, initials: currentUser.initials,
  email: "", status: "active", isOrgOwner: true,
  assignments: [{ id: "asg-fallback", role: "org_owner", level: "org" }],
  createdAt: "2026-01-01",
};

export interface Permissions {
  principal: Principal;
  me: string;                  // acting user's display name (for ownership checks)
  roles: RoleDefinition[];
  can: (resource: Resource, action: Action, ctx?: PermissionContext) => boolean;
  accessLevel: (resource: Resource, action: Action, ctx?: PermissionContext) => AccessLevel;
  fieldVisible: (mask: FieldMask, ctx?: PermissionContext) => boolean;
  hasFlag: (flag: SensitiveFlag, ctx?: PermissionContext) => boolean;
}

interface PermissionContextValue extends Permissions {
  realUser: AppUser;
  actingUser: AppUser;
  isImpersonating: boolean;
  users: AppUser[];            // directory (for the view-as menu)
  setActingUserId: (id: string) => void;
  resetActing: () => void;
}

const Ctx = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const realUserId = currentUser.id;

  // SSR + first client render use the seed (owner only) so the default acting
  // user is identical on both; the effect then loads the full directory and any
  // persisted "view as" selection.
  const [users, setUsers] = useState<AppUser[]>(() => getUsers());
  const [actingId, setActingId] = useState<string>(realUserId);

  useEffect(() => {
    setUsers(getUsers());
    try {
      const v = localStorage.getItem(VIEW_AS_KEY);
      if (v && v !== realUserId) setActingId(v);
    } catch { /* ignore */ }
  }, [realUserId]);

  const realUser = useMemo(() => getUser(realUserId) ?? FALLBACK_USER, [realUserId]);
  const actingUser = useMemo(
    () => users.find(u => u.id === actingId) ?? realUser,
    [users, actingId, realUser],
  );
  const principal = useMemo(() => principalFromAppUser(actingUser), [actingUser]);

  function setActingUserId(id: string) {
    setActingId(id);
    try {
      if (id === realUserId) localStorage.removeItem(VIEW_AS_KEY);
      else localStorage.setItem(VIEW_AS_KEY, id);
    } catch { /* ignore */ }
  }
  function resetActing() { setActingUserId(realUserId); }

  const value = useMemo<PermissionContextValue>(() => ({
    principal,
    me: actingUser.fullName,
    roles: principalRoles(principal),
    can: (r, a, ctx) => canFn(principal, r, a, ctx),
    accessLevel: (r, a, ctx) => accessLevelFn(principal, r, a, ctx),
    fieldVisible: (m, ctx) => fieldVisibleFn(principal, m, ctx),
    hasFlag: (f, ctx) => hasFlagFn(principal, f, ctx),
    realUser, actingUser,
    isImpersonating: actingUser.id !== realUserId,
    users,
    setActingUserId, resetActing,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [principal, actingUser, realUser, users]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePermissionContext(): PermissionContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePermissionContext must be used within PermissionProvider");
  return ctx;
}

// Primary hook for gating. Returns the bound permission API.
export function usePermissions(): Permissions {
  return usePermissionContext();
}
