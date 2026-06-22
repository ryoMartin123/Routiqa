"use client";

// ─── Admin · App Access matrix ────────────────────────────
// An audit/control view — NOT a second role builder. Roles & Permissions defines
// each role's *default* app access; this page reads that model and shows, across
// three lenses, who can open each platform app:
//   • By User — every user, their role/scope, a check per app, override + status
//   • By Role — every role, users assigned, default scope, a check per app, edit
//   • By App  — each app with the roles and users that can open it
// My Portal is always on for everyone. User-level overrides are surfaced with a
// "Custom override" badge. All state is local/mock — no Supabase.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppWindow, Check, Minus, Pencil, Users as UsersIcon, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { PageHeader, StatCard } from "@/components/platform/ui";
import StatusTabs from "@/components/shared/StatusTabs";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import UiSelect from "@/components/ui/Select";
import StatusBadge from "@/components/shared/StatusBadge";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { getUsers, type AppUser, type RoleAssignment } from "@/lib/users/data";
import { getOrgRoles, getOrgRole, getRoleLabel } from "@/lib/roles/store";
import { appAccessForUser, type AppAccess } from "@/lib/platform/access";
import { roleApps, roleDataScope, SCOPE_LABEL, APP_META, APP_ORDER } from "@/lib/roles/appmap";
import type { PlatformAppId } from "@/lib/platform/apps";
import type { RoleDefinition } from "@/lib/roles/types";

// Apps shown as matrix columns / summary cards (Portal first — always on).
const MATRIX_APPS = APP_ORDER; // portal, crm, hr, accounting, documents, admin
const SUMMARY_APPS: PlatformAppId[] = ["crm", "hr", "accounting", "documents", "admin"];

const STATUS_BADGE: Record<string, { label: string; dot: string }> = {
  active:   { label: "Active",   dot: "#10b981" },
  invited:  { label: "Invited",  dot: "#f59e0b" },
  inactive: { label: "Inactive", dot: "#9ca3af" },
};

// Empty access map (portal forced on) — the override-comparison baseline.
const NONE: AppAccess = { portal: true, crm: false, hr: false, accounting: false, documents: false, admin: false };

export default function AppAccessMatrix({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const { allCompanies, allLocations, allServiceAreas } = useHierarchy();

  const users = useMemo(() => getUsers(), []);
  const roles = useMemo(() => getOrgRoles(), []);

  // Matrix = the working tables (default); Overview = the KPI cards.
  const [view, setView] = useState<ModuleView>("list");
  const [tab, setTab] = useState("by_user");

  // Search + condensed Filter (right side, CRM-style).
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fApp, setFApp] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const activeFilters = [fApp !== "all", fStatus !== "all"].filter(Boolean).length;
  function clearFilters() { setFApp("all"); setFStatus("all"); }

  // ── Scope label helpers ──
  const companyName = (id?: string) => allCompanies.find((c) => c.id === id)?.name ?? id ?? "—";
  const locationName = (id?: string) => allLocations.find((l) => l.id === id)?.name ?? id ?? "—";
  const areaName = (id?: string) => allServiceAreas.find((a) => a.id === id)?.name ?? id ?? "—";

  function assignmentScope(a: RoleAssignment): string {
    if (a.level === "org") return "Org-wide";
    if (a.level === "company") return companyName(a.companyId);
    if (a.level === "location") return locationName(a.locationId);
    return areaName(a.serviceAreaId);
  }
  function userScope(u: AppUser): string {
    if (u.isOrgOwner) return "Organization";
    const labels = [...new Set(u.assignments.map(assignmentScope))];
    return labels.length ? labels.join(", ") : "—";
  }
  function userRoles(u: AppUser): string {
    const labels = [...new Set(u.assignments.map((a) => getRoleLabel(a.role)))];
    return labels.length ? labels.join(", ") : "—";
  }

  // Role-derived default access (ignores the user's explicit override) — the
  // baseline we diff against to flag a custom override.
  function roleDefaultAccess(u: AppUser): AppAccess {
    if (u.isOrgOwner) return { portal: true, crm: true, hr: true, accounting: true, documents: true, admin: true };
    const out: AppAccess = { ...NONE };
    for (const a of u.assignments) {
      const def = getOrgRole(a.role);
      if (!def) continue;
      for (const app of roleApps(def)) out[app] = true;
    }
    out.portal = true;
    return out;
  }
  function hasOverride(u: AppUser): boolean {
    const resolved = appAccessForUser(u);
    const base = roleDefaultAccess(u);
    return MATRIX_APPS.some((app) => resolved[app] !== base[app]);
  }

  // ── Summary: how many users can open each app ──
  const usersWithApp = (app: PlatformAppId) => users.filter((u) => appAccessForUser(u)[app]).length;

  // ── Search + filter applied per tab ──
  const s = search.trim().toLowerCase();
  const filteredUsers = users.filter((u) => {
    if (s && !`${u.fullName} ${u.email} ${userRoles(u)}`.toLowerCase().includes(s)) return false;
    if (fApp !== "all" && !appAccessForUser(u)[fApp as PlatformAppId]) return false;
    if (fStatus !== "all" && u.status !== fStatus) return false;
    return true;
  });
  const filteredRoles = roles.filter((r) => {
    if (s && !`${r.label} ${r.description}`.toLowerCase().includes(s)) return false;
    if (fApp !== "all" && !roleApps(r).includes(fApp as PlatformAppId)) return false;
    return true;
  });
  const filteredApps = MATRIX_APPS.filter((app) => {
    if (fApp !== "all" && app !== fApp) return false;
    if (s) {
      const appRoles = (app === "portal" ? roles : roles.filter((r) => roleApps(r).includes(app))).map((r) => r.label).join(" ");
      const appUsers = users.filter((u) => appAccessForUser(u)[app]).map((u) => u.fullName).join(" ");
      if (!`${APP_META[app].name} ${appRoles} ${appUsers}`.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header — title · centered Overview/Matrix toggle · spacer.
          When embedded under Users & Access the title is supplied by the parent. */}
      <div className="flex items-center justify-between gap-4">
        {embedded ? <div className="flex-1" /> : (
          <div className="flex-1 min-w-0">
            <PageHeader
              title="App Access"
              subtitle="Audit and manage which users and roles can open each platform app."
              accent="#a855f7"
            />
          </div>
        )}
        <ModuleViewToggle view={view} onChange={setView} listLabel="Matrix" />
        <div className="flex-1" />
      </div>

      {/* Overview — KPI cards (kept off the main Matrix view) */}
      {view === "overview" && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {SUMMARY_APPS.map((app) => (
            <StatCard
              key={app}
              label={`${APP_META[app].name} Access`}
              value={String(usersWithApp(app))}
              hint="Users with access"
              icon={AppWindow}
              accent={APP_META[app].accent}
            />
          ))}
        </div>
      )}

      {view === "list" && (
      <>
        {/* Toolbar — tabs (left) · search + condensed Filter (right) */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <StatusTabs active={tab} onChange={setTab}
            tabs={[
              { key: "by_user", label: "By User", count: users.length },
              { key: "by_role", label: "By Role", count: roles.length },
              { key: "by_app", label: "By App", count: MATRIX_APPS.length },
            ]} />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search access..."
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
                      <FilterField label="App access"><UiSelect size="sm" value={fApp} onChange={setFApp} options={[{ value: "all", label: "Any app" }, ...MATRIX_APPS.map((a) => ({ value: a, label: APP_META[a].name }))]} /></FilterField>
                      <FilterField label="User status"><UiSelect size="sm" value={fStatus} onChange={setFStatus} options={[{ value: "all", label: "Any status" }, { value: "active", label: "Active" }, { value: "invited", label: "Invited" }, { value: "inactive", label: "Inactive" }]} /></FilterField>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {tab === "by_user" && (
          <ByUser
            users={filteredUsers}
            userRoles={userRoles}
            userScope={userScope}
            access={appAccessForUser}
            hasOverride={hasOverride}
            onUser={(id) => router.push(`/admin/users?user=${id}`)}
          />
        )}

        {tab === "by_role" && (
          <ByRole
            roles={filteredRoles}
            usersByRole={countUsersByRole(users)}
            onEdit={(key) => router.push(`/admin/roles?role=${key}`)}
          />
        )}

        {tab === "by_app" && (
          <ByApp apps={filteredApps} roles={roles} users={users} />
        )}
      </>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function countUsersByRole(users: AppUser[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const u of users) for (const a of u.assignments) m.set(a.role, (m.get(a.role) ?? 0) + 1);
  return m;
}

// ─── Matrix cell — granted check / not-granted dash ───────
function AccessCell({ on, always }: { on: boolean; always?: boolean }) {
  return (
    <div className="flex items-center justify-center" title={always ? "Always on" : on ? "Has access" : "No access"}>
      {on ? (
        <span className="w-5 h-5 rounded-md flex items-center justify-center"
          style={{ backgroundColor: always ? "var(--bg-input)" : "#10b98122" }}>
          <Check className="w-3.5 h-3.5" style={{ color: always ? "var(--text-muted)" : "#10b981" }} />
        </span>
      ) : (
        <Minus className="w-3.5 h-3.5" style={{ color: "var(--text-muted)", opacity: 0.5 }} />
      )}
    </div>
  );
}

function AppHeaderCells() {
  return (
    <>
      {MATRIX_APPS.map((app) => (
        <span key={app} className="text-center truncate" title={APP_META[app].name}>{APP_META[app].name}</span>
      ))}
    </>
  );
}

// ─── By User ──────────────────────────────────────────────
const USER_COLS = "1.6fr 1.3fr 1.2fr repeat(6, 0.7fr) 1fr 0.8fr";

function ByUser({ users, userRoles, userScope, access, hasOverride, onUser }: {
  users: AppUser[];
  userRoles: (u: AppUser) => string;
  userScope: (u: AppUser) => string;
  access: (u: AppUser) => AppAccess;
  hasOverride: (u: AppUser) => boolean;
  onUser: (id: string) => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="overflow-x-auto thin-scroll-x">
        <div style={{ minWidth: 1120 }}>
          <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider items-center" style={{ gridTemplateColumns: USER_COLS, color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
            <span>User</span><span>Role</span><span>Company / Location</span>
            <AppHeaderCells />
            <span className="text-center">Overrides</span><span>Status</span>
          </div>
          {users.length === 0 && (
            <div className="py-14 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No users match the current search or filter.</p></div>
          )}
          {users.map((u, i) => {
            const acc = access(u);
            const override = hasOverride(u);
            const sb = STATUS_BADGE[u.status] ?? STATUS_BADGE.active;
            return (
              <div key={u.id} onClick={() => onUser(u.id)}
                className="grid px-4 py-3 items-center cursor-pointer transition-[background-color] hover:bg-[var(--bg-surface-2)]"
                style={{ gridTemplateColumns: USER_COLS, borderBottom: "1px solid", borderBottomColor: i === users.length - 1 ? "transparent" : "var(--border-subtle)" }}>
                {/* User */}
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: u.isOrgOwner ? "#4f46e5" : "#6b7280" }}>{u.initials}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{u.fullName}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{u.email}</p>
                  </div>
                </div>
                {/* Role */}
                <div className="text-xs truncate pr-2" style={{ color: "var(--text-secondary)" }}>{userRoles(u)}</div>
                {/* Scope */}
                <div className="text-xs truncate pr-2" style={{ color: "var(--text-secondary)" }}>{userScope(u)}</div>
                {/* App cells */}
                {MATRIX_APPS.map((app) => <AccessCell key={app} on={acc[app]} always={app === "portal"} />)}
                {/* Overrides */}
                <div className="flex justify-center">
                  {override ? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>Custom override</span>
                  ) : (
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </div>
                {/* Status */}
                <div onClick={(e) => e.stopPropagation()}><StatusBadge size="sm" label={sb.label} color={sb.dot} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── By Role ──────────────────────────────────────────────
const ROLE_COLS = "1.6fr 0.8fr 1.1fr repeat(6, 0.7fr) 0.9fr";

function ByRole({ roles, usersByRole, onEdit }: {
  roles: RoleDefinition[];
  usersByRole: Map<string, number>;
  onEdit: (key: string) => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="overflow-x-auto thin-scroll-x">
        <div style={{ minWidth: 1040 }}>
          <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider items-center" style={{ gridTemplateColumns: ROLE_COLS, color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
            <span>Role</span><span className="text-center">Users</span><span>Default Scope</span>
            <AppHeaderCells />
            <span className="text-right">Action</span>
          </div>
          {roles.length === 0 && (
            <div className="py-14 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No roles match the current search or filter.</p></div>
          )}
          {roles.map((r, i) => {
            const apps = new Set(roleApps(r));
            const count = usersByRole.get(r.key) ?? 0;
            return (
              <div key={r.key}
                className="grid px-4 py-3 items-center"
                style={{ gridTemplateColumns: ROLE_COLS, borderBottom: "1px solid", borderBottomColor: i === roles.length - 1 ? "transparent" : "var(--border-subtle)" }}>
                {/* Role */}
                <div className="min-w-0 pr-2">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{r.label}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{r.description}</p>
                </div>
                {/* Users assigned */}
                <div className="text-center text-sm" style={{ color: count > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{count}</div>
                {/* Default data scope */}
                <div className="pr-2">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                    {SCOPE_LABEL[roleDataScope(r)]}
                  </span>
                </div>
                {/* App cells */}
                {MATRIX_APPS.map((app) => <AccessCell key={app} on={app === "portal" || apps.has(app)} always={app === "portal"} />)}
                {/* Edit Role */}
                <div className="flex justify-end">
                  <button onClick={() => onEdit(r.key)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    <Pencil className="w-3 h-3" /> Edit Role
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── By App ───────────────────────────────────────────────
function ByApp({ apps, roles, users }: { apps: PlatformAppId[]; roles: RoleDefinition[]; users: AppUser[] }) {
  if (apps.length === 0) {
    return (
      <div className="rounded-xl py-14 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No apps match the current search or filter.</p>
      </div>
    );
  }
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      {apps.map((app) => {
        const meta = APP_META[app];
        const always = app === "portal";
        const appRoles = always ? roles : roles.filter((r) => roleApps(r).includes(app));
        const appUsers = users.filter((u) => appAccessForUser(u)[app]);
        return (
          <div key={app} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: meta.accent + "1f" }}>
                  <AppWindow className="w-4.5 h-4.5" style={{ color: meta.accent, width: 18, height: 18 }} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{meta.name}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{meta.description}</p>
                </div>
              </div>
              {always && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Always on</span>
              )}
            </div>

            {/* Roles with access */}
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
              Roles · {appRoles.length}
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {appRoles.length === 0 ? (
                <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>No roles grant access.</span>
              ) : appRoles.map((r) => (
                <span key={r.key} className="text-[11px] font-medium px-2 py-1 rounded-md" style={{ backgroundColor: meta.accent + "1a", color: meta.accent }}>{r.label}</span>
              ))}
            </div>

            {/* Users with access */}
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
              Users · {appUsers.length}
            </p>
            {appUsers.length === 0 ? (
              <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>No users with access.</span>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {appUsers.slice(0, 8).map((u) => (
                    <span key={u.id} title={u.fullName}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
                      style={{ backgroundColor: "#e0e7ff", color: "#4f46e5", boxShadow: "0 0 0 2px var(--bg-surface)" }}>{u.initials}</span>
                  ))}
                </div>
                <span className="text-xs flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                  <UsersIcon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  {appUsers.length} {appUsers.length === 1 ? "user" : "users"}
                  {appUsers.length > 8 ? ` (+${appUsers.length - 8})` : ""}
                </span>
                <ChevronRight className="w-3.5 h-3.5 ml-auto" style={{ color: "var(--text-muted)" }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
