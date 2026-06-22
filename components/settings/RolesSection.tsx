"use client";

// ─── Admin → Roles & Permissions ──────────────────────────
// A compact permission control center: summary cards, search + filters, and a
// dense role table (type · scope · app badges · users · sensitive count). Click a
// role to open its detail drawer; create/edit opens the guided Role Builder.
// Replaces the old oversized card grid and the giant default permission matrix.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Shield, ShieldCheck, Users, AlertTriangle, Plus, RotateCcw, Search, MoreHorizontal,
  Pencil, Copy, Trash2, Lock, UserCog, SlidersHorizontal,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import StatusBadge from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/platform/ui";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import StatusTabs from "@/components/shared/StatusTabs";
import { usePermissions } from "@/components/providers/PermissionProvider";
import { getOrgRoles, getOrgRole, deleteRole, resetRole } from "@/lib/roles/store";
import {
  roleApps, roleDataScope, sensitiveCount, adminCount, hasAdminAccess, APP_META, APP_ORDER, SCOPE_LABEL, DATA_SCOPES,
} from "@/lib/roles/appmap";
import { getUsers } from "@/lib/users/data";
import { AppBadges, ScopeBadge, TypeBadge } from "@/components/settings/rolesUi";
import RoleBuilder from "@/components/settings/RoleBuilder";
import RoleDrawer from "@/components/settings/RoleDrawer";
import type { RoleDefinition, DataScope } from "@/lib/roles/types";
import type { PlatformAppId } from "@/lib/platform/apps";

export default function RolesSection() {
  const { hasFlag } = usePermissions();
  const canManage = hasFlag("roles_manage");

  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  const roles = useMemo(() => getOrgRoles(), [version]);
  const usersByRole = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of getUsers()) for (const a of u.assignments) m.set(a.role, (m.get(a.role) ?? 0) + 1);
    return m;
  }, [version]);
  const activeUsers = useMemo(() => getUsers().filter((u) => u.status !== "inactive").length, [version]);

  const [builder, setBuilder] = useState<{ initial?: RoleDefinition; isNew: boolean } | null>(null);
  const [drawerKey, setDrawerKey] = useState<string | null>(null);

  // Deep link from App Access ("Edit Role") — ?role=<key> opens that role's drawer.
  const searchParams = useSearchParams();
  useEffect(() => {
    const key = searchParams.get("role");
    if (key && getOrgRole(key)) setDrawerKey(key);
  }, [searchParams]);

  // Roles = the working table (default); Overview = the KPI cards.
  const [view, setView] = useState<ModuleView>("list");

  // Filter tabs (CRM-style) — quick segments across the role set.
  const [tab, setTab] = useState("all");

  // Filters (condensed into one popover, CRM-style)
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fType, setFType] = useState("all");
  const [fApp, setFApp] = useState("all");
  const [fScope, setFScope] = useState("all");
  const activeFilters = [fType !== "all", fApp !== "all", fScope !== "all"].filter(Boolean).length;
  function clearFilters() { setFType("all"); setFApp("all"); setFScope("all"); }

  if (builder) {
    return (
      <RoleBuilder
        initial={builder.initial} isNew={builder.isNew}
        onCancel={() => setBuilder(null)}
        onSaved={() => { setBuilder(null); refresh(); }}
      />
    );
  }

  const customCount = roles.filter((r) => !r.system).length;
  const sensitiveRoles = roles.filter((r) => sensitiveCount(r) > 0 || adminCount(r) > 0).length;

  // ── Filter tabs (CRM customers-style segments) ──
  const TAB_FNS: Record<string, (r: RoleDefinition) => boolean> = {
    all: () => true,
    admin: (r) => hasAdminAccess(r),
    sensitive: (r) => sensitiveCount(r) > 0,
    no_users: (r) => (usersByRole.get(r.key) ?? 0) === 0,
  };
  const tabFn = TAB_FNS[tab] ?? TAB_FNS.all;

  const filtered = roles.filter((r) => {
    if (!tabFn(r)) return false;
    if (search && !(`${r.label} ${r.description}`.toLowerCase().includes(search.toLowerCase()))) return false;
    if (fType === "system" && !r.system) return false;
    if (fType === "custom" && r.system) return false;
    if (fApp !== "all" && !roleApps(r).includes(fApp as PlatformAppId)) return false;
    if (fScope !== "all" && roleDataScope(r) !== fScope) return false;
    return true;
  });

  const drawerRole = drawerKey ? getOrgRole(drawerKey) : undefined;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Roles &amp; Permissions</h2>
          <p className="text-sm mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>Control what each role can access across the platform.</p>
        </div>
        <ModuleViewToggle view={view} onChange={setView} listLabel="Roles" />
        <div className="flex-1 flex justify-end">
          {canManage && (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setBuilder({ isNew: true })}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> Create Role
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overview — KPI cards (kept off the main Roles view) */}
      {view === "overview" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Roles" value={String(roles.length)} hint="System + custom" icon={Shield} accent="#6366f1" />
          <StatCard label="Custom Roles" value={String(customCount)} hint="Created by your org" icon={ShieldCheck} accent="#0ea5e9" />
          <StatCard label="Users Assigned" value={String(activeUsers)} hint="Active accounts" icon={Users} accent="#22c55e" />
          <StatCard label="Sensitive Access" value={String(sensitiveRoles)} hint="Roles with sensitive/admin perms" icon={AlertTriangle} accent="#f59e0b" />
        </div>
      )}

      {view === "list" && (
      <>
        {/* Toolbar — tabs (left) · search + condensed Filter (right), CRM style */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <StatusTabs active={tab} onChange={setTab}
            tabs={[
              { key: "all", label: "All", count: roles.length },
              { key: "admin", label: "Has Admin", count: roles.filter(TAB_FNS.admin).length, dividerBefore: true },
              { key: "sensitive", label: "Has Sensitive", count: roles.filter(TAB_FNS.sensitive).length },
              { key: "no_users", label: "No Users", count: roles.filter(TAB_FNS.no_users).length },
            ]} />
          <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search roles..."
              className="bg-transparent text-sm outline-none w-44" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="relative">
            <button onClick={() => setFiltersOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ border: `1px solid ${activeFilters ? "var(--accent-soft-border)" : "var(--border)"}`, backgroundColor: activeFilters ? "var(--accent-soft-bg)" : "var(--bg-surface)", color: activeFilters ? "var(--accent-text)" : "var(--text-secondary)" }}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
              {activeFilters > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text)" }}>{activeFilters}</span>}
            </button>
            {filtersOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 w-72" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>
                    {activeFilters > 0 && <button onClick={clearFilters} className="text-xs" style={{ color: "var(--accent-text)" }}>Clear all</button>}
                  </div>
                  <div className="space-y-2.5">
                    <FilterField label="Role type"><UiSelect size="sm" value={fType} onChange={setFType} options={[{ value: "all", label: "All types" }, { value: "system", label: "System Default" }, { value: "custom", label: "Custom" }]} /></FilterField>
                    <FilterField label="App access"><UiSelect size="sm" value={fApp} onChange={setFApp} options={[{ value: "all", label: "Any app" }, ...APP_ORDER.filter((a) => a !== "portal").map((a) => ({ value: a, label: APP_META[a].name }))]} /></FilterField>
                    <FilterField label="Default scope"><UiSelect size="sm" value={fScope} onChange={setFScope} options={[{ value: "all", label: "Any scope" }, ...DATA_SCOPES.map((s) => ({ value: s.value, label: s.label }))]} /></FilterField>
                  </div>
                </div>
              </>
            )}
          </div>
          </div>
        </div>

        {/* Role table */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
          <div className="overflow-x-auto thin-scroll-x">
            <div style={{ minWidth: 880 }}>
              <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: COLS, color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
                <span>Role</span><span>Type</span><span>Default Scope</span><span>Apps</span>
                <span className="text-center">Users</span><span className="text-center">Sensitive</span><span>Status</span><span className="text-right">Actions</span>
              </div>
              {filtered.length === 0 ? (
                <div className="py-14 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No roles match the current filters.</p></div>
              ) : filtered.map((role, i) => (
                <RoleRow key={role.key} role={role} users={usersByRole.get(role.key) ?? 0} canManage={canManage} last={i === filtered.length - 1}
                  onOpen={() => setDrawerKey(role.key)}
                  onEdit={() => setBuilder({ initial: role, isNew: false })}
                  onDuplicate={() => { const c: RoleDefinition = JSON.parse(JSON.stringify(role)); c.key = ""; c.label = `${role.label} (Copy)`; c.system = false; c.locked = false; setBuilder({ initial: c, isNew: true }); }}
                  onReset={() => { resetRole(role.key); refresh(); }}
                  onArchive={() => { if (confirm(`Archive the "${role.label}" role? It will be removed.`)) { deleteRole(role.key); refresh(); } }}
                  onUsers={() => setDrawerKey(role.key)}
                />
              ))}
            </div>
          </div>
        </div>
      </>
      )}

      {drawerRole && (
        <RoleDrawer role={drawerRole} canManage={canManage}
          onClose={() => setDrawerKey(null)}
          onSaved={() => { refresh(); }}
          onEditFull={() => { setDrawerKey(null); setBuilder({ initial: drawerRole, isNew: false }); }}
        />
      )}
    </div>
  );
}

const COLS = "1.8fr 1fr 1fr 1.6fr 0.6fr 0.7fr 0.8fr 0.7fr";

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function RoleRow({ role, users, canManage, last, onOpen, onEdit, onDuplicate, onReset, onArchive, onUsers }: {
  role: RoleDefinition; users: number; canManage: boolean; last: boolean;
  onOpen: () => void; onEdit: () => void; onDuplicate: () => void; onReset: () => void; onArchive: () => void; onUsers: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const sens = sensitiveCount(role);
  const adm = adminCount(role);
  const status = role.status ?? "active";

  return (
    <div onClick={onOpen} className="grid px-4 py-3 items-center cursor-pointer transition-[background-color] hover:bg-[var(--bg-surface-2)]"
      style={{ gridTemplateColumns: COLS, borderBottom: "1px solid", borderBottomColor: last ? "transparent" : "var(--border-subtle)" }}>
      {/* Role */}
      <div className="min-w-0 pr-2">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{role.label}</p>
        <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{role.description}</p>
      </div>
      {/* Type */}
      <div><TypeBadge role={role} /></div>
      {/* Scope */}
      <div><ScopeBadge scope={roleDataScope(role)} /></div>
      {/* Apps */}
      <div className="pr-2"><AppBadges role={role} max={4} /></div>
      {/* Users */}
      <div className="text-center text-sm" style={{ color: users > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{users}</div>
      {/* Sensitive */}
      <div className="text-center">
        <span className="text-sm" style={{ color: sens > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{sens}</span>
        {adm > 0 && <span className="ml-1 text-[10px] font-semibold px-1 py-0.5 rounded" style={{ backgroundColor: "#ede9fe", color: "#6d28d9" }}>{adm} adm</span>}
      </div>
      {/* Status */}
      <div><StatusBadge size="sm" label={status === "draft" ? "Draft" : "Active"} color={status === "draft" ? "#9ca3af" : "#10b981"} /></div>
      {/* Actions */}
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {role.locked ? (
          <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}><Lock className="w-3 h-3" /> Locked</span>
        ) : canManage ? (
          <>
            {/* System defaults can't be edited — duplicate to customize. */}
            {!role.system && (
              <button onClick={onEdit} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            <div className="relative">
              <button onClick={() => setMenu((m) => !m)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-input)]" style={{ color: "var(--text-secondary)" }}>
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 mt-1.5 w-44 rounded-xl overflow-hidden z-50 py-1" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.2)" }}>
                    <MenuItem icon={UserCog} label="View users" onClick={() => { setMenu(false); onUsers(); }} />
                    <MenuItem icon={Copy} label="Duplicate" onClick={() => { setMenu(false); onDuplicate(); }} />
                    {role.system
                      ? <MenuItem icon={RotateCcw} label="Reset to default" onClick={() => { setMenu(false); onReset(); }} />
                      : <MenuItem icon={Trash2} label="Archive" danger onClick={() => { setMenu(false); onArchive(); }} />}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>—</span>
        )}
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Copy; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: danger ? "#dc2626" : "var(--text-primary)" }}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
