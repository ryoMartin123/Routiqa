"use client";

// ─── Settings → Users & Roles ─────────────────────────────
// Team directory + invite/edit modal. A user holds one or more role@layer grants
// (e.g. Field Technician at two locations within a company). The role decides
// WHAT they can do; the layer decides WHICH org/company/location they operate in.
// Status is not edited directly — it follows the invite / activate / deactivate
// actions. Mutations require the `users_manage` flag; otherwise it's read-only.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Users, Plus, Pencil, X, Trash2, ShieldCheck, Mail, RotateCcw, CheckCircle, Ban, ChevronDown, Search, SlidersHorizontal, UserCheck, Clock } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { usePermissions } from "@/components/providers/PermissionProvider";
import StatusBadge from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/platform/ui";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import StatusTabs from "@/components/shared/StatusTabs";
import { getAssignableRoles, getOrgRole, getRoleLabel } from "@/lib/roles/store";
import UserPermissionPreview from "@/components/settings/UserPermissionPreview";
import { assignmentError, allowedLevelsForRole } from "@/lib/roles/validate";
import type { RoleKey } from "@/lib/roles/types";
import {
  getUsers, getUser, upsertUser, setUserStatus, deleteUser,
  type AppUser, type RoleAssignment, type ScopeLevel, type UserStatus,
} from "@/lib/users/data";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A draft assignment row in the editor (ids resolved on save).
interface DraftAssignment {
  role: RoleKey;
  level: ScopeLevel;
  targetId: string;   // company/location/service-area id (empty for org level)
}

// Status colors for the dot+text StatusBadge (the dot carries the saturated hue).
const STATUS_BADGE: Record<UserStatus, { label: string; dot: string }> = {
  active:   { label: "Active",   dot: "#10b981" },
  invited:  { label: "Invited",  dot: "#f59e0b" },
  inactive: { label: "Inactive", dot: "#9ca3af" },
};

const LEVEL_LABEL: Record<ScopeLevel, string> = {
  org: "Organization-wide", company: "Company", location: "Location", service_area: "Service Area",
};

// Invite/Edit modal steps: identity → role@layer grants → effective-permission preview.
type UserModalTab = "details" | "roles" | "permissions";
const USER_MODAL_TABS: { key: UserModalTab; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "roles", label: "Roles & Layers" },
  { key: "permissions", label: "Permissions" },
];

export default function UsersSection({ embedded = false }: { embedded?: boolean }) {
  const { allCompanies, allLocations, allServiceAreas, orgSettings } = useHierarchy();
  const { hasFlag } = usePermissions();
  const canManage = hasFlag("users_manage");

  const [version, setVersion] = useState(0);
  const users = useMemo(() => getUsers(), [version]);
  const refresh = () => setVersion(v => v + 1);

  const [editing, setEditing] = useState<AppUser | "new" | null>(null);

  // Deep link from App Access ("open this user") — ?user=<id> opens the editor.
  const searchParams = useSearchParams();
  useEffect(() => {
    const id = searchParams.get("user");
    if (id) { const u = getUser(id); if (u) setEditing(u); }
  }, [searchParams]);

  // Users = the working table (default); Overview = the KPI cards.
  const [view, setView] = useState<ModuleView>("list");

  // Status tabs + search + condensed Filter (CRM-style).
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fRole, setFRole] = useState("all");
  const [fCompany, setFCompany] = useState("all");
  const activeFilters = [fRole !== "all", fCompany !== "all"].filter(Boolean).length;
  function clearFilters() { setFRole("all"); setFCompany("all"); }

  // Role options — distinct roles actually held across the directory.
  const roleOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const u of users) for (const a of u.assignments) keys.add(a.role);
    return [...keys].map(k => ({ value: k, label: getRoleLabel(k) }));
  }, [users]);

  // ── Filter predicates ──
  const TAB_FNS: Record<string, (u: AppUser) => boolean> = {
    all: () => true,
    active: (u) => u.status === "active",
    invited: (u) => u.status === "invited",
    inactive: (u) => u.status === "inactive",
  };
  const tabFn = TAB_FNS[tab] ?? TAB_FNS.all;

  function matchesCompany(u: AppUser): boolean {
    if (fCompany === "all") return true;
    return u.assignments.some(a => a.level === "org" || a.companyId === fCompany);
  }

  const filteredUsers = users.filter(u => {
    if (!tabFn(u)) return false;
    if (search && !(`${u.fullName} ${u.email}`.toLowerCase().includes(search.toLowerCase()))) return false;
    if (fRole !== "all" && !u.assignments.some(a => a.role === fRole)) return false;
    if (!matchesCompany(u)) return false;
    return true;
  });

  // ── Summary counts ──
  const totalUsers = users.length;
  const activeCount = users.filter(u => u.status === "active").length;
  const invitedCount = users.filter(u => u.status === "invited").length;
  const rolesAssigned = useMemo(() => {
    const keys = new Set<string>();
    for (const u of users) for (const a of u.assignments) keys.add(a.role);
    return keys.size;
  }, [users]);

  // ── Scope label builders ────────────────────────────────
  const companyName = (id?: string) => allCompanies.find(c => c.id === id)?.name ?? id ?? "—";
  const locationName = (id?: string) => allLocations.find(l => l.id === id)?.name ?? id ?? "—";
  const areaName = (id?: string) => allServiceAreas.find(a => a.id === id)?.name ?? id ?? "—";

  function scopeLabel(a: RoleAssignment): string {
    if (a.level === "org") return "Org-wide";
    if (a.level === "company") return companyName(a.companyId);
    if (a.level === "location") return locationName(a.locationId);
    return areaName(a.serviceAreaId);
  }

  return (
    <div className="space-y-5">
      {/* Header — when embedded under Users & Access the title is supplied by the parent. */}
      <div className="flex items-center justify-between gap-4">
        {embedded ? <div className="flex-1" /> : (
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Users</h2>
            <p className="text-sm mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
              Invite team members and grant a role at the right layer — organization-wide, a company, or specific locations.
            </p>
          </div>
        )}
        <ModuleViewToggle view={view} onChange={setView} listLabel="Users" />
        <div className="flex-1 flex justify-end">
          {canManage && (
            <button onClick={() => setEditing("new")}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors shrink-0">
              <Plus className="w-4 h-4" /> Invite User
            </button>
          )}
        </div>
      </div>

      {/* Overview — KPI cards (kept off the main Users view) */}
      {view === "overview" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Users" value={String(totalUsers)} hint="In the directory" icon={Users} accent="#6366f1" />
          <StatCard label="Active" value={String(activeCount)} hint="Active accounts" icon={UserCheck} accent="#22c55e" />
          <StatCard label="Invited" value={String(invitedCount)} hint="Pending invites" icon={Clock} accent="#f59e0b" />
          <StatCard label="Roles Assigned" value={String(rolesAssigned)} hint="Distinct roles in use" icon={ShieldCheck} accent="#0ea5e9" />
        </div>
      )}

      {view === "list" && (
      <>
      {/* Toolbar — status tabs (left) · search + condensed Filter (right) */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <StatusTabs active={tab} onChange={setTab}
          tabs={[
            { key: "all", label: "All", count: users.length },
            { key: "active", label: "Active", count: users.filter(TAB_FNS.active).length },
            { key: "invited", label: "Invited", count: users.filter(TAB_FNS.invited).length },
            { key: "inactive", label: "Inactive", count: users.filter(TAB_FNS.inactive).length },
          ]} />
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

      {/* Users table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <table className="w-full text-sm" style={{ backgroundColor: "var(--bg-surface)" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              {["User", "Roles & Layer", "Status", ""].map((h, i) => (
                <th key={i} className="text-left font-semibold px-4 py-2.5 text-[11px] uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-14 text-center text-sm" style={{ color: "var(--text-muted)" }}>No users match the current filters.</td></tr>
            ) : filteredUsers.map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {/* User */}
                <td className="px-4 py-3 align-top">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: u.isOrgOwner ? "#4f46e5" : "#6b7280" }}>{u.initials}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{u.fullName}</p>
                        {u.id === "user_marcus" && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>YOU</span>
                        )}
                        {u.isOrgOwner && <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#4f46e5" }} />}
                      </div>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{u.email}</p>
                    </div>
                  </div>
                </td>
                {/* Roles & layer */}
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-wrap gap-1.5">
                    {u.assignments.map(a => (
                      <span key={a.id} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md"
                        style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>
                        {getRoleLabel(a.role)}
                        <span style={{ opacity: 0.6 }}>· {scopeLabel(a)}</span>
                      </span>
                    ))}
                  </div>
                </td>
                {/* Status */}
                <td className="px-4 py-3 align-top">
                  <StatusBadge label={STATUS_BADGE[u.status].label} color={STATUS_BADGE[u.status].dot} />
                </td>
                {/* Actions */}
                <td className="px-4 py-3 align-top text-right">
                  {canManage && (
                    <button onClick={() => setEditing(u)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                      style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        A role sets what a member can do; the layer sets which company or locations they operate in. Grant the same role at
        more than one location if they cover several. Role permissions are configured in Settings → Roles &amp; Permissions.
      </p>
      </>
      )}

      {editing && (
        <UserModal
          user={editing === "new" ? null : editing}
          companies={allCompanies.filter(c => c.status === "active")}
          locations={allLocations.filter(l => l.status === "active")}
          areas={orgSettings.serviceAreasEnabled ? allServiceAreas.filter(a => a.status === "active") : []}
          serviceAreasEnabled={orgSettings.serviceAreasEnabled}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
          onStatus={(id, s) => { setUserStatus(id, s); setEditing(null); refresh(); }}
          onDelete={(id) => { deleteUser(id); setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Invite / edit modal ──────────────────────────────────
function UserModal({
  user, companies, locations, areas, serviceAreasEnabled, onClose, onSaved, onStatus, onDelete,
}: {
  user: AppUser | null;
  companies: { id: string; name: string }[];
  locations: { id: string; name: string; companyId: string }[];
  areas: { id: string; name: string; locationId: string; companyId: string }[];
  serviceAreasEnabled: boolean;
  onClose: () => void;
  onSaved: () => void;
  onStatus: (id: string, status: UserStatus) => void;
  onDelete: (id: string) => void;
}) {
  const isOwner = !!user?.isOrgOwner;
  // Status follows actions (invite / activate / deactivate); not edited in the form.
  const status: UserStatus = user?.status ?? "invited";
  const initialFullName = user?.fullName ?? "";
  const initialEmail    = user?.email ?? "";
  const initialRows: DraftAssignment[] = user
    ? user.assignments.map(a => ({
        role: a.role, level: a.level,
        targetId: a.level === "company" ? a.companyId ?? ""
                : a.level === "location" ? a.locationId ?? ""
                : a.level === "service_area" ? a.serviceAreaId ?? "" : "",
      }))
    : [{ role: "field_technician", level: "location", targetId: "" }];
  const [fullName, setFullName] = useState(initialFullName);
  const [email, setEmail]       = useState(initialEmail);
  const [rows, setRows]         = useState<DraftAssignment[]>(initialRows);
  const initialKey = JSON.stringify({ fullName: initialFullName, email: initialEmail, rows: initialRows });
  const dirty = JSON.stringify({ fullName, email, rows }) !== initialKey;
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalTab, setModalTab] = useState<UserModalTab>("details");

  // Scope option lists — per-role levels are filtered so an org-level role can't
  // be scoped to a single branch.
  const allLevelOptions = useMemo(() => {
    const opts: { value: ScopeLevel; label: string }[] = [{ value: "org", label: "Organization-wide" }];
    if (companies.length) opts.push({ value: "company", label: "Company" });
    if (locations.length) opts.push({ value: "location", label: "Location" });
    if (serviceAreasEnabled && areas.length) opts.push({ value: "service_area", label: "Service Area" });
    return opts;
  }, [companies.length, locations.length, areas.length, serviceAreasEnabled]);

  function levelOptionsFor(role: RoleKey) {
    const def = getOrgRole(role);
    const allowed = def ? allowedLevelsForRole(def) : (["org", "company", "location", "service_area"] as ScopeLevel[]);
    return allLevelOptions.filter(o => allowed.includes(o.value));
  }

  const roleOptions = getAssignableRoles().map(r => ({ value: r.key, label: r.label }));

  function targetOptions(level: ScopeLevel) {
    if (level === "company") return companies.map(c => ({ value: c.id, label: c.name }));
    if (level === "location") return locations.map(l => ({ value: l.id, label: `${l.name} · ${companies.find(c => c.id === l.companyId)?.name ?? ""}` }));
    if (level === "service_area") return areas.map(a => ({ value: a.id, label: `${a.name} · ${locations.find(l => l.id === a.locationId)?.name ?? ""}` }));
    return [];
  }

  function updateRow(i: number, patch: Partial<DraftAssignment>) {
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() { setRows(rs => [...rs, { role: "field_technician", level: "location", targetId: "" }]); }
  function removeRow(i: number) { setRows(rs => rs.filter((_, idx) => idx !== i)); }

  // When the role changes, snap the layer back into the role's allowed range.
  function changeRole(i: number, role: RoleKey) {
    const def = getOrgRole(role);
    const allowed = def ? allowedLevelsForRole(def) : (["org", "company", "location", "service_area"] as ScopeLevel[]);
    setRows(rs => rs.map((r, idx) => {
      if (idx !== i) return r;
      const level = allowed.includes(r.level) ? r.level : allowed[0];
      return { ...r, role, level, targetId: level === r.level ? r.targetId : "" };
    }));
  }

  function resolveAssignment(r: DraftAssignment): Omit<RoleAssignment, "id"> | null {
    if (r.level === "org") return { role: r.role, level: "org" };
    if (r.level === "company") {
      if (!r.targetId) return null;
      return { role: r.role, level: "company", companyId: r.targetId };
    }
    if (r.level === "location") {
      const loc = locations.find(l => l.id === r.targetId);
      if (!loc) return null;
      return { role: r.role, level: "location", locationId: loc.id, companyId: loc.companyId };
    }
    const area = areas.find(a => a.id === r.targetId);
    if (!area) return null;
    return { role: r.role, level: "service_area", serviceAreaId: area.id, locationId: area.locationId, companyId: area.companyId };
  }

  function save() {
    if (!fullName.trim()) { setError("Name is required."); setModalTab("details"); return; }
    if (!EMAIL_RE.test(email.trim())) { setError("A valid email is required."); setModalTab("details"); return; }
    if (!isOwner) {
      if (rows.length === 0) { setError("Add at least one role."); setModalTab("roles"); return; }
      for (const r of rows) {
        const def = getOrgRole(r.role);
        if (def) { const e = assignmentError(def, r.level); if (e) { setError(e); setModalTab("roles"); return; } }
      }
      const resolved = rows.map(resolveAssignment);
      if (resolved.some(a => a === null)) { setError("Each role needs a layer selected."); setModalTab("roles"); return; }
      upsertUser({ id: user?.id, fullName: fullName.trim(), email: email.trim(), status, assignments: resolved as Omit<RoleAssignment, "id">[] });
    } else {
      upsertUser({ id: user?.id, fullName: fullName.trim(), email: email.trim(), status, assignments: user!.assignments });
    }
    onSaved();
  }

  function handleDelete() {
    if (!user) return;
    if (confirm(`Remove ${user.fullName} from the team? This can't be undone.`)) onDelete(user.id);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#e0e7ff" }}>
              <Users className="w-4 h-4" style={{ color: "#4f46e5" }} />
            </div>
            <div>
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{user ? "Edit User" : "Invite User"}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{user ? "Update details, roles, and layers" : "Send an invite and grant roles"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <StatusBadge label={STATUS_BADGE[status].label} color={STATUS_BADGE[status].dot} />
            )}
            <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Tab nav — Details · Roles & Layers · Permissions */}
        <div className="px-5 pt-3 shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
            {USER_MODAL_TABS.map((t, i) => (
              <button key={t.key} onClick={() => setModalTab(t.key)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: modalTab === t.key ? "var(--bg-surface)" : "transparent", color: modalTab === t.key ? "var(--text-primary)" : "var(--text-muted)", boxShadow: modalTab === t.key ? "var(--shadow-card)" : "none" }}>
                <span className="text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: modalTab === t.key ? "#4f46e5" : "var(--bg-input)", color: modalTab === t.key ? "#fff" : "var(--text-muted)" }}>{i + 1}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Details */}
          {modalTab === "details" && (
            <div className="space-y-3">
              <Field label="Full name">
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Jordan Lee"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" }} />
              </Field>
              <Field label="Email">
                <div className="flex items-center gap-2 rounded-lg px-3" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                  <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" type="email"
                    className="w-full py-2 text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} />
                </div>
              </Field>
            </div>
          )}

          {/* Roles & layers */}
          {modalTab === "roles" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Roles &amp; Layers</p>
                {!isOwner && (
                  <button onClick={addRow} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-text)" }}>
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                )}
              </div>

              {isOwner ? (
                <div className="rounded-lg px-3 py-3 text-xs flex items-center gap-2"
                  style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)" }}>
                  <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: "#4f46e5" }} />
                  Organization Owner — full access to everything. This can&apos;t be changed.
                </div>
              ) : (
                <div className="space-y-2">
                  {rows.map((r, i) => (
                    <div key={i} className="rounded-lg p-3 space-y-2" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <UiSelect value={r.role} onChange={v => changeRole(i, v as RoleKey)} options={roleOptions} size="sm" />
                        </div>
                        {rows.length > 1 && (
                          <button onClick={() => removeRow(i)} title="Remove" className="p-1.5 rounded-md" style={{ color: "var(--text-muted)" }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-40 shrink-0">
                          <UiSelect value={r.level}
                            onChange={v => updateRow(i, { level: v as ScopeLevel, targetId: "" })}
                            options={levelOptionsFor(r.role)} size="sm" />
                        </div>
                        <div className="flex-1">
                          {r.level === "org" ? (
                            <p className="text-xs px-2.5 py-1.5" style={{ color: "var(--text-muted)" }}>{LEVEL_LABEL.org}</p>
                          ) : (
                            <UiSelect value={r.targetId} onChange={v => updateRow(i, { targetId: v })}
                              options={targetOptions(r.level)} placeholder={`Select ${LEVEL_LABEL[r.level].toLowerCase()}…`} size="sm" />
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>
                        {getOrgRole(r.role)?.description}
                      </p>
                    </div>
                  ))}
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Add a row per layer — e.g. the same role at two locations within a company.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Permissions preview */}
          {modalTab === "permissions" && (
            <UserPermissionPreview roleKeys={rows.map(r => r.role)} isOwner={isOwner} />
          )}
        </div>

        {error && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-lg text-xs shrink-0" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>{error}</div>
        )}

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 flex items-center justify-between gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {/* Secondary actions tucked into one menu */}
          <div className="relative">
            {user && !isOwner ? (
              <>
                <button onClick={() => setMenuOpen(o => !o)}
                  className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  Actions <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {menuOpen && (
                  <>
                    <button aria-hidden tabIndex={-1} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                    <div className="absolute left-0 bottom-full mb-1.5 z-50 w-48 rounded-xl overflow-hidden py-1"
                      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                      {status === "inactive" ? (
                        <MenuItem icon={RotateCcw} label="Reactivate" onClick={() => { setMenuOpen(false); onStatus(user.id, "active"); }} />
                      ) : (
                        <>
                          {status === "invited" && (
                            <MenuItem icon={CheckCircle} label="Mark Active" onClick={() => { setMenuOpen(false); onStatus(user.id, "active"); }} />
                          )}
                          <MenuItem icon={Ban} label="Deactivate" onClick={() => { setMenuOpen(false); onStatus(user.id, "inactive"); }} />
                        </>
                      )}
                      <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
                      <MenuItem icon={Trash2} label="Delete user" danger onClick={() => { setMenuOpen(false); handleDelete(); }} />
                    </div>
                  </>
                )}
              </>
            ) : <span />}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={save} disabled={!dirty}
              className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
              {user ? "Save Changes" : "Send Invite"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {children}
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

function MenuItem({ icon: Icon, label, onClick, danger }: {
  icon: typeof Trash2; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]"
      style={{ color: danger ? "#dc2626" : "var(--text-primary)" }}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
