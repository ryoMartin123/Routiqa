"use client";

// ─── Settings → Users & Roles ─────────────────────────────
// Team directory + invite/edit modal. A user holds one or more role@layer grants
// (e.g. Field Technician at two locations within a company). The role decides
// WHAT they can do; the layer decides WHICH org/company/location they operate in.
// Status is not edited directly — it follows the invite / activate / deactivate
// actions. Mutations require the `users_manage` flag; otherwise it's read-only.

import { useMemo, useState } from "react";
import { Users, Plus, Pencil, X, Trash2, ShieldCheck, Mail, RotateCcw, CheckCircle, Ban, ChevronDown } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { usePermissions } from "@/components/providers/PermissionProvider";
import { getAssignableRoles, getOrgRole, getRoleLabel } from "@/lib/roles/store";
import { assignmentError, allowedLevelsForRole } from "@/lib/roles/validate";
import type { RoleKey } from "@/lib/roles/types";
import {
  getUsers, upsertUser, setUserStatus, deleteUser,
  type AppUser, type RoleAssignment, type ScopeLevel, type UserStatus,
} from "@/lib/users/data";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A draft assignment row in the editor (ids resolved on save).
interface DraftAssignment {
  role: RoleKey;
  level: ScopeLevel;
  targetId: string;   // company/location/service-area id (empty for org level)
}

const STATUS_BADGE: Record<UserStatus, { label: string; bg: string; color: string }> = {
  active:   { label: "Active",   bg: "#d1fae5", color: "#065f46" },
  invited:  { label: "Invited",  bg: "#fef3c7", color: "#92400e" },
  inactive: { label: "Inactive", bg: "var(--bg-input)", color: "var(--text-muted)" },
};

const LEVEL_LABEL: Record<ScopeLevel, string> = {
  org: "Organization-wide", company: "Company", location: "Location", service_area: "Service Area",
};

export default function UsersSection() {
  const { allCompanies, allLocations, allServiceAreas, orgSettings } = useHierarchy();
  const { hasFlag } = usePermissions();
  const canManage = hasFlag("users_manage");

  const [version, setVersion] = useState(0);
  const users = useMemo(() => getUsers(), [version]);
  const refresh = () => setVersion(v => v + 1);

  const [editing, setEditing] = useState<AppUser | "new" | null>(null);

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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Users &amp; Roles</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Invite team members and grant a role at the right layer — organization-wide, a company, or specific locations.
          </p>
        </div>
        {canManage && (
          <button onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Invite User
          </button>
        )}
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
            {users.map(u => (
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
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: STATUS_BADGE[u.status].bg, color: STATUS_BADGE[u.status].color }}>
                    {STATUS_BADGE[u.status].label}
                  </span>
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
    if (!fullName.trim()) { setError("Name is required."); return; }
    if (!EMAIL_RE.test(email.trim())) { setError("A valid email is required."); return; }
    if (!isOwner) {
      if (rows.length === 0) { setError("Add at least one role."); return; }
      for (const r of rows) {
        const def = getOrgRole(r.role);
        if (def) { const e = assignmentError(def, r.level); if (e) { setError(e); return; } }
      }
      const resolved = rows.map(resolveAssignment);
      if (resolved.some(a => a === null)) { setError("Each role needs a layer selected."); return; }
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
      <div className="w-full max-w-lg max-h-[90vh] rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}
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
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: STATUS_BADGE[status].bg, color: STATUS_BADGE[status].color }}>
                {STATUS_BADGE[status].label}
              </span>
            )}
            <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Identity */}
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

          {/* Roles & layers */}
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

          {error && (
            <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>{error}</div>
          )}
        </div>

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
