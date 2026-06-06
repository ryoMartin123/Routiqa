"use client";

// ─── Settings → Users & Roles ─────────────────────────────
// Team directory + invite/edit slide-over. Each user holds one or more
// role@scope assignments (the "multiple assignments" model). Mutations require
// the `users_manage` flag; otherwise the screen is read-only.

import { useMemo, useState } from "react";
import { Users, Plus, Pencil, X, Trash2, ShieldCheck, Mail, RotateCcw } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { serviceAreas as ALL_SERVICE_AREAS } from "@/lib/hierarchy/data";
import { usePermissions } from "@/components/providers/PermissionProvider";
import { getAssignableRoles, getOrgRole, getRoleLabel } from "@/lib/roles/store";
import { assignmentError, allowedLevelsForRole } from "@/lib/roles/validate";
import type { RoleKey } from "@/lib/roles/types";
import {
  getUsers, upsertUser, setUserStatus,
  type AppUser, type RoleAssignment, type ScopeLevel, type UserStatus,
} from "@/lib/users/data";

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
  const { allCompanies, allLocations, orgSettings } = useHierarchy();
  const { hasFlag } = usePermissions();
  const canManage = hasFlag("users_manage");

  const [version, setVersion] = useState(0);
  const users = useMemo(() => getUsers(), [version]);
  const refresh = () => setVersion(v => v + 1);

  // Drawer: null = closed; otherwise the user being edited (or a blank draft).
  const [editing, setEditing] = useState<AppUser | "new" | null>(null);

  // ── Scope option builders ───────────────────────────────
  const companyName = (id?: string) => allCompanies.find(c => c.id === id)?.name ?? id ?? "—";
  const locationName = (id?: string) => allLocations.find(l => l.id === id)?.name ?? id ?? "—";
  const areaName = (id?: string) => ALL_SERVICE_AREAS.find(a => a.id === id)?.name ?? id ?? "—";

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
            Invite team members and grant roles per company, location, or territory.
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
              {["User", "Roles & Scope", "Status", ""].map((h, i) => (
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
                {/* Roles & scope */}
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
        Roles control what each member can do; scope controls which records they can see. A user can hold
        more than one role across different companies or locations.
      </p>

      {/* Drawer */}
      {editing && (
        <UserDrawer
          user={editing === "new" ? null : editing}
          companies={allCompanies.filter(c => c.status === "active")}
          locations={allLocations.filter(l => l.status === "active")}
          areas={orgSettings.serviceAreasEnabled ? ALL_SERVICE_AREAS.filter(a => a.status === "active") : []}
          serviceAreasEnabled={orgSettings.serviceAreasEnabled}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
          onStatus={(id, s) => { setUserStatus(id, s); setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Invite / edit slide-over ─────────────────────────────
function UserDrawer({
  user, companies, locations, areas, serviceAreasEnabled, onClose, onSaved, onStatus,
}: {
  user: AppUser | null;
  companies: { id: string; name: string }[];
  locations: { id: string; name: string; companyId: string }[];
  areas: { id: string; name: string; locationId: string; companyId: string }[];
  serviceAreasEnabled: boolean;
  onClose: () => void;
  onSaved: () => void;
  onStatus: (id: string, status: UserStatus) => void;
}) {
  const isOwner = !!user?.isOrgOwner;
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail]       = useState(user?.email ?? "");
  const [status, setStatus]     = useState<UserStatus>(user?.status ?? "invited");
  const [rows, setRows] = useState<DraftAssignment[]>(
    user
      ? user.assignments.map(a => ({
          role: a.role, level: a.level,
          targetId: a.level === "company" ? a.companyId ?? ""
                  : a.level === "location" ? a.locationId ?? ""
                  : a.level === "service_area" ? a.serviceAreaId ?? "" : "",
        }))
      : [{ role: "salesperson", level: "location", targetId: "" }],
  );
  const [error, setError] = useState<string | null>(null);

  // ── Scope option lists ──────────────────────────────────
  // Every level the org structure supports; per-role lists are filtered from
  // this by allowedLevelsForRole (so an org-level role can't be scoped to a branch).
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

  // When the role changes, snap the scope level back into the allowed range.
  function changeRole(i: number, role: RoleKey) {
    const def = getOrgRole(role);
    const allowed = def ? allowedLevelsForRole(def) : (["org", "company", "location", "service_area"] as ScopeLevel[]);
    setRows(rs => rs.map((r, idx) => {
      if (idx !== i) return r;
      const level = allowed.includes(r.level) ? r.level : allowed[0];
      return { ...r, role, level, targetId: level === r.level ? r.targetId : "" };
    }));
  }
  function removeRow(i: number) { setRows(rs => rs.filter((_, idx) => idx !== i)); }

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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("A valid email is required."); return; }
    if (!isOwner) {
      if (rows.length === 0) { setError("Add at least one role assignment."); return; }
      // Catch impossible role@scope grants (e.g. an org-level role on one branch).
      for (const r of rows) {
        const def = getOrgRole(r.role);
        if (def) { const e = assignmentError(def, r.level); if (e) { setError(e); return; } }
      }
      const resolved = rows.map(resolveAssignment);
      if (resolved.some(a => a === null)) { setError("Each assignment needs a scope selected."); return; }
      upsertUser({ id: user?.id, fullName: fullName.trim(), email: email.trim(), status, assignments: resolved as Omit<RoleAssignment, "id">[] });
    } else {
      // Owner: name/email/status only; assignments are locked.
      upsertUser({ id: user?.id, fullName: fullName.trim(), email: email.trim(), status, assignments: user!.assignments });
    }
    onSaved();
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
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{user ? "Update details and role assignments" : "Send an invite and assign roles"}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
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
            <Field label="Status">
              <UiSelect value={status} onChange={v => setStatus(v as UserStatus)}
                options={[
                  { value: "invited", label: "Invited" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]} />
            </Field>
          </div>

          {/* Assignments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Role Assignments</p>
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
                Organization Owner — full access to everything. This grant can&apos;t be changed.
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((r, i) => (
                  <div key={i} className="rounded-lg p-3 space-y-2" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <UiSelect value={r.role} onChange={v => changeRole(i, v as RoleKey)} options={roleOptions} size="sm" />
                      </div>
                      <button onClick={() => removeRow(i)} title="Remove" className="p-1.5 rounded-md" style={{ color: "var(--text-muted)" }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                {rows.length === 0 && (
                  <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>No assignments yet — add one.</p>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 flex items-center justify-between gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div>
            {user && !isOwner && (
              user.status === "inactive" ? (
                <button onClick={() => onStatus(user.id, "active")}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <RotateCcw className="w-3.5 h-3.5" /> Reactivate
                </button>
              ) : (
                <button onClick={() => onStatus(user.id, "inactive")}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg"
                  style={{ border: "1px solid #fecaca", color: "#b91c1c" }}>
                  <Trash2 className="w-3.5 h-3.5" /> Deactivate
                </button>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={save} className="text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: "#4f46e5" }}>
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
