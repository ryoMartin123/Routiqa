"use client";

// ─── Users & Access · Directory ───────────────────────────
// The day-to-day user-management view: status filters + search + a condensed
// Filter popover over a single table. Columns: User · Role · Scope/Layer ·
// App Access (compact app chips) · Status · Actions. A row (or its Edit button)
// opens the right-side user detail drawer — no separate tab to see basic access.
// Presentational: the parent owns the directory + drawer state.

import { useMemo, useState } from "react";
import { Pencil, ShieldCheck, Search, SlidersHorizontal } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { getRoleLabel } from "@/lib/roles/store";
import { appAccessForUser } from "@/lib/platform/access";
import { APP_META, APP_ORDER } from "@/lib/roles/appmap";
import type { AppUser, RoleAssignment, UserStatus } from "@/lib/users/data";

const STATUS_BADGE: Record<UserStatus, { label: string; dot: string }> = {
  active:   { label: "Active",   dot: "#10b981" },
  invited:  { label: "Invited",  dot: "#f59e0b" },
  inactive: { label: "Inactive", dot: "#9ca3af" },
};

// Grid columns — mirrors the Access Matrix table style.
const DIR_COLS = "1.9fr 1.2fr 1.3fr 1.9fr 0.9fr 0.8fr";

export default function UsersDirectory({ users, canManage, onOpenUser }: {
  users: AppUser[];
  canManage: boolean;
  onOpenUser: (u: AppUser) => void;
}) {
  const { allCompanies, allLocations, allServiceAreas } = useHierarchy();

  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fRole, setFRole] = useState("all");
  const [fCompany, setFCompany] = useState("all");
  const activeFilters = [fRole !== "all", fCompany !== "all"].filter(Boolean).length;
  function clearFilters() { setFRole("all"); setFCompany("all"); }

  const roleOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const u of users) for (const a of u.assignments) keys.add(a.role);
    return [...keys].map(k => ({ value: k, label: getRoleLabel(k) }));
  }, [users]);

  const STATUS_TABS: { key: string; label: string; match: (u: AppUser) => boolean }[] = [
    { key: "all",      label: "All",      match: () => true },
    { key: "active",   label: "Active",   match: (u) => u.status === "active" },
    { key: "invited",  label: "Invited",  match: (u) => u.status === "invited" },
    { key: "inactive", label: "Inactive", match: (u) => u.status === "inactive" },
  ];
  const tabMatch = (STATUS_TABS.find(t => t.key === tab) ?? STATUS_TABS[0]).match;

  function matchesCompany(u: AppUser): boolean {
    if (fCompany === "all") return true;
    return u.assignments.some(a => a.level === "org" || a.companyId === fCompany);
  }
  const s = search.trim().toLowerCase();
  const filtered = users.filter(u => {
    if (!tabMatch(u)) return false;
    if (s && !`${u.fullName} ${u.email}`.toLowerCase().includes(s)) return false;
    if (fRole !== "all" && !u.assignments.some(a => a.role === fRole)) return false;
    if (!matchesCompany(u)) return false;
    return true;
  });

  // ── Scope / role labels ──
  const companyName = (id?: string) => allCompanies.find(c => c.id === id)?.name ?? id ?? "—";
  const locationName = (id?: string) => allLocations.find(l => l.id === id)?.name ?? id ?? "—";
  const areaName = (id?: string) => allServiceAreas.find(a => a.id === id)?.name ?? id ?? "—";
  function scopeLabel(a: RoleAssignment): string {
    if (a.level === "org") return "Org-wide";
    if (a.level === "company") return companyName(a.companyId);
    if (a.level === "location") return locationName(a.locationId);
    return areaName(a.serviceAreaId);
  }
  function userScopes(u: AppUser): string {
    if (u.isOrgOwner) return "Organization";
    return [...new Set(u.assignments.map(scopeLabel))].join(", ") || "—";
  }
  function userRoles(u: AppUser): string {
    return [...new Set(u.assignments.map(a => getRoleLabel(a.role)))].join(", ") || "—";
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — glossy status tabs (left) · search + Filter (right) */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <StatusTabs accent="#a855f7" active={tab} onChange={setTab}
          tabs={STATUS_TABS.map(t => ({ key: t.key, label: t.label, count: users.filter(t.match).length }))} />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
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
                    <FilterField label="Role"><UiSelect size="sm" value={fRole} onChange={setFRole} options={[{ value: "all", label: "Any role" }, ...roleOptions]} /></FilterField>
                    <FilterField label="Company"><UiSelect size="sm" value={fCompany} onChange={setFCompany} options={[{ value: "all", label: "Any company" }, ...allCompanies.map(c => ({ value: c.id, label: c.name }))]} /></FilterField>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table — grid layout (matches the Access Matrix) */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="overflow-x-auto thin-scroll-x">
          <div style={{ minWidth: 880 }}>
            <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider items-center" style={{ gridTemplateColumns: DIR_COLS, gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
              <span>User</span><span>Role</span><span>Scope / Layer</span><span>App Access</span><span>Status</span><span className="text-right">Actions</span>
            </div>
            {filtered.length === 0 ? (
              <div className="py-14 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No users match the current filters.</p></div>
            ) : filtered.map((u, i) => {
              const acc = appAccessForUser(u);
              const enabledApps = APP_ORDER.filter(app => acc[app]);
              return (
                <div key={u.id} onClick={() => onOpenUser(u)}
                  className="grid px-4 py-3 items-center cursor-pointer transition-[background-color] hover:bg-[var(--bg-surface-2)]"
                  style={{ gridTemplateColumns: DIR_COLS, gap: "0.75rem", borderBottom: "1px solid", borderBottomColor: i === filtered.length - 1 ? "transparent" : "var(--border-subtle)" }}>
                  {/* User */}
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <span className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: u.isOrgOwner ? "#0f8578" : "#6b7280" }}>{u.initials}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{u.fullName}</p>
                        {u.id === "user_marcus" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>YOU</span>}
                        {u.isOrgOwner && <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "#0f8578" }} />}
                      </div>
                      <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{u.email}</p>
                    </div>
                  </div>
                  {/* Role */}
                  <div className="text-xs truncate pr-2" style={{ color: "var(--text-secondary)" }}>{userRoles(u)}</div>
                  {/* Scope / Layer */}
                  <div className="text-xs truncate pr-2" style={{ color: "var(--text-secondary)" }}>{userScopes(u)}</div>
                  {/* App Access — compact chips */}
                  <div className="flex flex-wrap gap-1">
                    {enabledApps.map(app => (
                      <span key={app} title={APP_META[app].name}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: APP_META[app].accent + "1a", color: APP_META[app].accent }}>
                        {APP_META[app].name}
                      </span>
                    ))}
                  </div>
                  {/* Status */}
                  <div><StatusBadge label={STATUS_BADGE[u.status].label} color={STATUS_BADGE[u.status].dot} /></div>
                  {/* Actions */}
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onOpenUser(u)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      <Pencil className="w-3 h-3" /> {canManage ? "Edit" : "View"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        A role sets what a member can do; the layer sets which company or locations they operate in. App access is
        inherited from the role — open a user to review or override it. Role permissions live in Roles &amp; Permissions.
      </p>
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
