"use client";

// ─── User · effective permissions preview ─────────────────
// Phase 1 (now): a READ-ONLY matrix of what a user can actually do, derived from
// the union of their assigned role(s). Apps enabled, the widest default data
// scope, and a per-module access level grouped by app.
//
// Per-user overrides intentionally live in the ROLE builder, not here — a user's
// capabilities come entirely from the role(s) they're granted.

import { useMemo } from "react";
import { getOrgRole } from "@/lib/roles/store";
import {
  roleApps, roleDataScope, resourcesForApp, APP_META, APP_ORDER, SCOPE_LABEL, DATA_SCOPES,
  levelOfRow, MODULE_LEVEL_LABELS, type ModuleLevel,
} from "@/lib/roles/appmap";
import { RESOURCE_LABELS } from "@/lib/roles/catalog";
import { ScopeBadge } from "@/components/settings/rolesUi";
import type {
  AccessLevel, Action, CapabilityMap, DataScope, Resource, RoleDefinition,
} from "@/lib/roles/types";
import type { PlatformAppId } from "@/lib/platform/apps";

const ACCESS_RANK: Record<AccessLevel, number> = { none: 0, own: 1, all: 2 };
const maxAccess = (a: AccessLevel | undefined, b: AccessLevel | undefined): AccessLevel =>
  (ACCESS_RANK[b ?? "none"] > ACCESS_RANK[a ?? "none"] ? (b ?? "none") : (a ?? "none"));

// Breadth order — last is widest.
const SCOPE_ORDER = DATA_SCOPES.map((s) => s.value);
function widestScope(scopes: DataScope[]): DataScope {
  return scopes.reduce((widest, s) => (SCOPE_ORDER.indexOf(s) > SCOPE_ORDER.indexOf(widest) ? s : widest), "self" as DataScope);
}

interface Merged {
  allAccess: boolean;
  apps: PlatformAppId[];
  capabilities: CapabilityMap;
  dataScope: DataScope;
}

// Union the assigned roles into one effective access shape.
function mergeRoles(defs: RoleDefinition[], isOwner: boolean): Merged {
  const allAccess = isOwner || defs.some((d) => d.allAccess);
  const apps = new Set<PlatformAppId>(["portal"]);
  defs.forEach((d) => roleApps(d).forEach((a) => apps.add(a)));

  const capabilities: CapabilityMap = {};
  for (const d of defs) {
    for (const res of Object.keys(d.capabilities) as Resource[]) {
      const row = d.capabilities[res]!;
      capabilities[res] = capabilities[res] ?? {};
      for (const act of Object.keys(row) as Action[]) {
        capabilities[res]![act] = maxAccess(capabilities[res]![act], row[act]);
      }
    }
  }

  const dataScope = isOwner ? "all" : (defs.length ? widestScope(defs.map(roleDataScope)) : "assigned");
  return { allAccess, apps: APP_ORDER.filter((a) => apps.has(a)), capabilities, dataScope };
}

// Module access level → badge style.
const LEVEL_STYLE: Record<ModuleLevel, { bg: string; color: string }> = {
  none:        { bg: "var(--bg-input)", color: "var(--text-muted)" },
  view:        { bg: "var(--bg-input)", color: "var(--text-secondary)" },
  create_edit: { bg: "#d3ebe6", color: "#0c6b60" },
  manage:      { bg: "#d1fae5", color: "#065f46" },
  custom:      { bg: "#fef3c7", color: "#92400e" },
};

function LevelBadge({ level, full }: { level: ModuleLevel; full?: boolean }) {
  if (full) {
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>Full access</span>;
  }
  if (level === "none") {
    return <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>—</span>;
  }
  const s = LEVEL_STYLE[level];
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{MODULE_LEVEL_LABELS[level]}</span>;
}

export default function UserPermissionPreview({ roleKeys, isOwner = false }: {
  roleKeys: string[];
  isOwner?: boolean;
}) {
  const defs = useMemo(
    () => roleKeys.map((k) => getOrgRole(k)).filter(Boolean) as RoleDefinition[],
    [roleKeys],
  );
  const merged = useMemo(() => mergeRoles(defs, isOwner), [defs, isOwner]);

  if (!isOwner && roleKeys.length === 0) {
    return (
      <div className="rounded-xl px-4 py-8 text-center" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px dashed var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Assign a role to preview the permissions this user will have.</p>
      </div>
    );
  }

  // Apps that show in the matrix (exclude portal — always on, no granular modules).
  const matrixApps = merged.apps.filter((a) => a !== "portal");

  return (
    <div className="space-y-4">
      {/* Summary — apps + scope */}
      <div className="rounded-xl p-4 grid sm:grid-cols-2 gap-4" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Apps enabled</p>
          <div className="flex flex-wrap items-center gap-1">
            {merged.apps.map((a) => (
              <span key={a} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: APP_META[a].accent + "1f", color: APP_META[a].accent }}>
                {APP_META[a].name}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Default data scope</p>
          <ScopeBadge scope={merged.dataScope} />
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{SCOPE_LABEL[merged.dataScope]} visibility by default.</p>
        </div>
      </div>

      {/* Per-app module matrix */}
      {isOwner ? (
        <div className="rounded-xl p-4 flex items-center gap-2.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#10b981" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Organization Owner — full access to every module across all apps.</p>
        </div>
      ) : matrixApps.length === 0 ? (
        <p className="text-sm italic px-1" style={{ color: "var(--text-muted)" }}>These roles grant app access only — no granular module permissions.</p>
      ) : (
        <div className="space-y-3">
          {matrixApps.map((app) => {
            const resources = resourcesForApp(app);
            return (
              <div key={app} className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: APP_META[app].accent }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{APP_META[app].name}</p>
                </div>
                {resources.length === 0 ? (
                  <p className="text-xs px-4 py-3" style={{ color: "var(--text-muted)" }}>App access only — no granular modules.</p>
                ) : (
                  resources.map((res, i) => (
                    <div key={res} className="px-4 py-2 flex items-center justify-between gap-3"
                      style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                      <span className="text-sm" style={{ color: "var(--text-primary)" }}>{RESOURCE_LABELS[res]}</span>
                      <LevelBadge level={levelOfRow(merged.capabilities[res])} full={merged.allAccess} />
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Permissions come from the assigned role(s). To change what a role can do, edit it in Roles &amp; Permissions.
      </p>
    </div>
  );
}
