"use client";

// ─── Users & Access · user detail drawer ──────────────────
// Right-side slide-over for one login account, opened from the Directory or the
// Access Matrix. Five sections, no nested role builder:
//   • Profile     — name, email, phone, employee link, status (+ status actions)
//   • Role & Scope — assigned role(s) at their layer, manager, data-scope summary
//   • App Access  — per-app toggles showing inherited-from-role vs Custom override
//   • Security    — last login, MFA / reset / revoke placeholders, resend invite
//   • Activity    — a mock audit trail (invite, role, access, status changes)
// Profile + Role & Scope are saved together (footer). App-access toggles persist
// immediately so the Directory chips update live. All state is local/mock.

import { useMemo, useState } from "react";
import {
  X, User as UserIcon, ShieldCheck, Mail, Phone, Plus, Trash2, ChevronDown,
  RotateCcw, CheckCircle, Ban, KeyRound, MonitorSmartphone, Send, Link2,
  Clock, UserCog, AppWindow, History,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import StatusBadge from "@/components/shared/StatusBadge";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { usePermissions } from "@/components/providers/PermissionProvider";
import { getAssignableRoles, getOrgRole, getRoleLabel } from "@/lib/roles/store";
import { assignmentError, allowedLevelsForRole } from "@/lib/roles/validate";
import { roleApps, roleDataScope, SCOPE_LABEL, APP_META, APP_ORDER } from "@/lib/roles/appmap";
import {
  appAccessForUser, roleDefaultAccess, type AppAccess,
} from "@/lib/platform/access";
import { setUserAppAccess } from "@/lib/users/data";
import type { PlatformAppId } from "@/lib/platform/apps";
import type { RoleKey } from "@/lib/roles/types";
import {
  upsertUser, type AppUser, type RoleAssignment, type ScopeLevel, type UserStatus,
} from "@/lib/users/data";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATUS_BADGE: Record<UserStatus, { label: string; dot: string }> = {
  active:   { label: "Active",   dot: "#10b981" },
  invited:  { label: "Invited",  dot: "#f59e0b" },
  inactive: { label: "Inactive", dot: "#9ca3af" },
};

const LEVEL_LABEL: Record<ScopeLevel, string> = {
  org: "Organization-wide", company: "Company", location: "Location", service_area: "Service Area",
};

type Tab = "profile" | "roles" | "access" | "security" | "activity";
const TABS: { key: Tab; label: string; icon: typeof UserIcon }[] = [
  { key: "profile",  label: "Profile",      icon: UserIcon },
  { key: "roles",    label: "Role & Scope", icon: UserCog },
  { key: "access",   label: "App Access",   icon: AppWindow },
  { key: "security", label: "Security",     icon: ShieldCheck },
  { key: "activity", label: "Activity",     icon: History },
];

// A draft assignment row in the editor (ids resolved on save).
interface DraftAssignment {
  role: RoleKey;
  level: ScopeLevel;
  targetId: string;
}

export default function UserDetailDrawer({
  user: userProp, onClose, onSaved, onRefresh, onStatus, onDelete,
}: {
  user: AppUser | "new";
  onClose: () => void;
  onSaved: () => void;            // close + refresh the parent list
  onRefresh: () => void;          // refresh the parent list, keep the drawer open
  onStatus: (id: string, status: UserStatus) => void;
  onDelete: (id: string) => void;
}) {
  const isNew = userProp === "new";
  const user = isNew ? null : userProp;
  const { allCompanies, allLocations, allServiceAreas, orgSettings } = useHierarchy();
  const { hasFlag } = usePermissions();
  const canManage = hasFlag("users_manage");

  const isOwner = !!user?.isOrgOwner;
  const editable = canManage && !isOwner;
  const status: UserStatus = user?.status ?? "invited";

  const [tab, setTab] = useState<Tab>("profile");
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // ── Editable profile + assignment draft ──
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail]       = useState(user?.email ?? "");
  const [phone, setPhone]       = useState(user?.phone ?? "");
  const initialRows: DraftAssignment[] = user
    ? user.assignments.map(a => ({
        role: a.role, level: a.level,
        targetId: a.level === "company" ? a.companyId ?? ""
                : a.level === "location" ? a.locationId ?? ""
                : a.level === "service_area" ? a.serviceAreaId ?? "" : "",
      }))
    : [{ role: "field_technician", level: "location", targetId: "" }];
  const [rows, setRows] = useState<DraftAssignment[]>(initialRows);

  const initialKey = JSON.stringify({ fullName: user?.fullName ?? "", email: user?.email ?? "", phone: user?.phone ?? "", rows: initialRows });
  const dirty = JSON.stringify({ fullName, email, phone, rows }) !== initialKey;

  // ── Active hierarchy option lists ──
  const companies = useMemo(() => allCompanies.filter(c => c.status === "active"), [allCompanies]);
  const locations = useMemo(() => allLocations.filter(l => l.status === "active"), [allLocations]);
  const areas = useMemo(() => orgSettings.serviceAreasEnabled ? allServiceAreas.filter(a => a.status === "active") : [], [allServiceAreas, orgSettings.serviceAreasEnabled]);

  const allLevelOptions = useMemo(() => {
    const opts: { value: ScopeLevel; label: string }[] = [{ value: "org", label: "Organization-wide" }];
    if (companies.length) opts.push({ value: "company", label: "Company" });
    if (locations.length) opts.push({ value: "location", label: "Location" });
    if (orgSettings.serviceAreasEnabled && areas.length) opts.push({ value: "service_area", label: "Service Area" });
    return opts;
  }, [companies.length, locations.length, areas.length, orgSettings.serviceAreasEnabled]);

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
    setError(null);
    if (!fullName.trim()) { setError("Name is required."); setTab("profile"); return; }
    if (!EMAIL_RE.test(email.trim())) { setError("A valid email is required."); setTab("profile"); return; }
    if (!isOwner) {
      if (rows.length === 0) { setError("Add at least one role."); setTab("roles"); return; }
      for (const r of rows) {
        const def = getOrgRole(r.role);
        if (def) { const e = assignmentError(def, r.level); if (e) { setError(e); setTab("roles"); return; } }
      }
      const resolved = rows.map(resolveAssignment);
      if (resolved.some(a => a === null)) { setError("Each role needs a layer selected."); setTab("roles"); return; }
      upsertUser({ id: user?.id, fullName: fullName.trim(), email: email.trim(), phone: phone.trim() || undefined, status, assignments: resolved as Omit<RoleAssignment, "id">[] });
    } else {
      upsertUser({ id: user?.id, fullName: fullName.trim(), email: email.trim(), phone: phone.trim() || undefined, status, assignments: user!.assignments });
    }
    onSaved();
  }

  function handleDelete() {
    if (!user) return;
    if (confirm(`Remove ${user.fullName} from the team? This can't be undone.`)) onDelete(user.id);
  }

  // ── Scope label helpers (for the Role & Scope summary) ──
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[540px] h-full flex flex-col" style={{ backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border)", boxShadow: "-16px 0 48px -12px rgba(0,0,0,0.3)" }}>
        {/* Header */}
        <div className="px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: isOwner ? "#4f46e5" : "#6b7280" }}>{user?.initials ?? "—"}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{isNew ? "Invite User" : user!.fullName}</p>
                  {isOwner && <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: "#4f46e5" }} />}
                </div>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{isNew ? "Send an invite and grant access" : user!.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {user && <StatusBadge label={STATUS_BADGE[status].label} color={STATUS_BADGE[status].dot} />}
              <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}><X className="w-4 h-4" /></button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex items-center gap-1 mt-3 overflow-x-auto thin-scroll-x">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                style={{ backgroundColor: tab === t.key ? "var(--accent-soft-bg)" : "transparent", color: tab === t.key ? "var(--accent-text)" : "var(--text-muted)" }}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "profile" && (
            <ProfileTab
              editable={editable} isOwner={isOwner} isNew={isNew} status={status}
              fullName={fullName} setFullName={setFullName}
              email={email} setEmail={setEmail}
              phone={phone} setPhone={setPhone}
            />
          )}

          {tab === "roles" && (
            <div className="space-y-4">
              {isOwner ? (
                <div className="rounded-lg px-3 py-3 text-xs flex items-center gap-2" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)" }}>
                  <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: "#4f46e5" }} />
                  Organization Owner — full access to everything across the platform. This can&apos;t be changed.
                </div>
              ) : editable ? (
                <RoleEditor
                  rows={rows} roleOptions={roleOptions} levelOptionsFor={levelOptionsFor}
                  targetOptions={targetOptions} onChange={updateRow} onChangeRole={changeRole}
                  onAdd={addRow} onRemove={removeRow}
                />
              ) : (
                <div className="space-y-2">
                  {(user?.assignments ?? []).map(a => (
                    <div key={a.id} className="rounded-lg px-3 py-2.5 flex items-center justify-between gap-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{getRoleLabel(a.role)}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{scopeLabel(a)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Manager (optional) + data-scope summary — read context, not edited here. */}
              {!isOwner && (
                <div className="grid grid-cols-2 gap-3">
                  <ReadField label="Reports to" value="Not set" hint="Optional" />
                  <ReadField label="Data scope" value={user ? dataScopeSummary(user) : roleScopeSummaryFromRows(rows)} />
                </div>
              )}
              <p className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>
                A role sets <strong>what</strong> a member can do; the layer sets <strong>which</strong> company or
                locations they operate in. Role permissions are configured in Roles &amp; Permissions.
              </p>
            </div>
          )}

          {tab === "access" && (
            user ? (
              <AppAccessTab user={user} editable={editable} onRefresh={onRefresh} />
            ) : (
              <Placeholder icon={AppWindow} text="App access becomes available once the invite is sent. New users start with the access their role grants." />
            )
          )}

          {tab === "security" && (
            user ? (
              <SecurityTab user={user} editable={editable} status={status} onStatus={onStatus} />
            ) : (
              <Placeholder icon={ShieldCheck} text="Security details (sign-in, MFA, sessions) appear after the user accepts their invite." />
            )
          )}

          {tab === "activity" && (
            user ? <ActivityTab user={user} /> : <Placeholder icon={History} text="Activity will be recorded once the invite is sent." />
          )}
        </div>

        {error && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-lg text-xs shrink-0" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>{error}</div>
        )}

        {/* Footer — secondary actions menu (left) · Save (right). Only when the
            Profile/Role draft can change; App Access saves itself on toggle. */}
        {(editable || isNew) && (
          <div className="shrink-0 px-5 py-3 flex items-center justify-between gap-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="relative">
              {user && editable ? (
                <>
                  <button onClick={() => setMenuOpen(o => !o)}
                    className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    Actions <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {menuOpen && (
                    <>
                      <button aria-hidden tabIndex={-1} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                      <div className="absolute left-0 bottom-full mb-1.5 z-50 w-48 rounded-xl overflow-hidden py-1" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                        {status === "inactive" ? (
                          <MenuItem icon={RotateCcw} label="Reactivate" onClick={() => { setMenuOpen(false); onStatus(user.id, "active"); }} />
                        ) : (
                          <>
                            {status === "invited" && <MenuItem icon={CheckCircle} label="Mark Active" onClick={() => { setMenuOpen(false); onStatus(user.id, "active"); }} />}
                            <MenuItem icon={Ban} label="Deactivate" onClick={() => { setMenuOpen(false); onStatus(user.id, "inactive"); }} />
                          </>
                        )}
                        <div style={{ borderTop: "1px solid var(--border)" }} />
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
                className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-40" style={{ backgroundColor: "#a855f7" }}>
                {isNew ? "Send Invite" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────
function ProfileTab({ editable, isOwner, isNew, status, fullName, setFullName, email, setEmail, phone, setPhone }: {
  editable: boolean; isOwner: boolean; isNew: boolean; status: UserStatus;
  fullName: string; setFullName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
}) {
  const readOnly = !editable && !isNew;
  return (
    <div className="space-y-3">
      <Field label="Full name">
        <input value={fullName} onChange={e => setFullName(e.target.value)} readOnly={readOnly} placeholder="e.g. Jordan Lee"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-60"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" }} />
      </Field>
      <Field label="Email">
        <IconInput icon={Mail}><input value={email} onChange={e => setEmail(e.target.value)} readOnly={readOnly} type="email" placeholder="name@company.com"
          className="w-full py-2 text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} /></IconInput>
      </Field>
      <Field label="Phone" hint="Optional">
        <IconInput icon={Phone}><input value={phone} onChange={e => setPhone(e.target.value)} readOnly={readOnly} type="tel" placeholder="+1 (555) 000-0000"
          className="w-full py-2 text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} /></IconInput>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Employee record" hint="Optional">
          <button className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <span className="flex items-center gap-2"><Link2 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /> Not linked</span>
          </button>
        </Field>
        <Field label="Status">
          <div className="flex items-center h-[38px] px-3 rounded-lg" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
            <StatusBadge label={isNew ? "Invited (pending)" : STATUS_BADGE[status].label} color={STATUS_BADGE[status].dot} />
          </div>
        </Field>
      </div>
      {isOwner && (
        <p className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#4f46e5" }} /> The organization owner account can&apos;t be deactivated or removed.
        </p>
      )}
    </div>
  );
}

// ─── Role & Scope editor (reused row model) ───────────────
function RoleEditor({ rows, roleOptions, levelOptionsFor, targetOptions, onChange, onChangeRole, onAdd, onRemove }: {
  rows: DraftAssignment[];
  roleOptions: { value: string; label: string }[];
  levelOptionsFor: (role: RoleKey) => { value: ScopeLevel; label: string }[];
  targetOptions: (level: ScopeLevel) => { value: string; label: string }[];
  onChange: (i: number, patch: Partial<DraftAssignment>) => void;
  onChangeRole: (i: number, role: RoleKey) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Roles &amp; Layers</p>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-text)" }}>
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="rounded-lg p-3 space-y-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
            <div className="flex items-center gap-2">
              <div className="flex-1"><UiSelect value={r.role} onChange={v => onChangeRole(i, v as RoleKey)} options={roleOptions} size="sm" /></div>
              {rows.length > 1 && (
                <button onClick={() => onRemove(i)} title="Remove" className="p-1.5 rounded-md" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-40 shrink-0">
                <UiSelect value={r.level} onChange={v => onChange(i, { level: v as ScopeLevel, targetId: "" })} options={levelOptionsFor(r.role)} size="sm" />
              </div>
              <div className="flex-1">
                {r.level === "org" ? (
                  <p className="text-xs px-2.5 py-1.5" style={{ color: "var(--text-muted)" }}>{LEVEL_LABEL.org}</p>
                ) : (
                  <UiSelect value={r.targetId} onChange={v => onChange(i, { targetId: v })} options={targetOptions(r.level)} placeholder={`Select ${LEVEL_LABEL[r.level].toLowerCase()}…`} size="sm" />
                )}
              </div>
            </div>
            <p className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>{getOrgRole(r.role)?.description}</p>
          </div>
        ))}
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Add a row per layer — e.g. the same role at two locations within a company.</p>
      </div>
    </div>
  );
}

// ─── App Access ───────────────────────────────────────────
function AppAccessTab({ user, editable, onRefresh }: { user: AppUser; editable: boolean; onRefresh: () => void }) {
  // Effective access is held locally so toggles reflect immediately; the baseline
  // (role-derived default) tells us per app whether it's inherited or overridden.
  const baseline = useMemo<AppAccess>(() => roleDefaultAccess(user), [user]);
  const [effective, setEffective] = useState<AppAccess>(() => appAccessForUser(user));

  // Which assigned role grants an app (for the "inherited from …" caption).
  function sourceRole(app: PlatformAppId): string | null {
    if (user.isOrgOwner) return "Organization Owner";
    for (const a of user.assignments) {
      const def = getOrgRole(a.role);
      if (def && roleApps(def).includes(app)) return getRoleLabel(a.role);
    }
    return null;
  }

  function toggle(app: PlatformAppId) {
    if (!editable || app === "portal" || user.isOrgOwner) return;
    const next: AppAccess = { ...effective, [app]: !effective[app], portal: true };
    setEffective(next);
    // Back to exactly the role default → drop the override entirely.
    const matchesDefault = APP_ORDER.every((a) => next[a] === baseline[a]);
    setUserAppAccess(user.id, matchesDefault ? undefined : next);
    onRefresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>
        Users inherit app access from their role. Toggle an app to set a <strong>user-level override</strong> — overrides
        should be rare and are clearly flagged. My Portal is always on for everyone.
      </p>
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {APP_ORDER.map((app, i) => {
          const meta = APP_META[app];
          const on = effective[app];
          const always = app === "portal";
          const overridden = !user.isOrgOwner && !always && on !== baseline[app];
          const src = sourceRole(app);
          const caption = always ? "Always on for every user"
            : user.isOrgOwner ? "Full access (owner)"
            : overridden ? (on ? "Enabled · user override" : "Disabled · user override")
            : on ? (src ? `Inherited from ${src}` : "Enabled") : "Disabled";
          return (
            <div key={app} className="flex items-center gap-3 px-3 py-2.5"
              style={{ borderBottom: i === APP_ORDER.length - 1 ? "none" : "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: meta.accent + "1f" }}>
                <AppWindow className="w-4 h-4" style={{ color: meta.accent }} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{meta.name}</p>
                  {overridden && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>Custom override</span>
                  )}
                </div>
                <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{caption}</p>
              </div>
              <Switch on={on} disabled={!editable || always || user.isOrgOwner} onClick={() => toggle(app)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Security ─────────────────────────────────────────────
function SecurityTab({ user, editable, status, onStatus }: {
  user: AppUser; editable: boolean; status: UserStatus; onStatus: (id: string, status: UserStatus) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <ReadField label="Last sign-in" value={user.lastLoginAt ? formatDate(user.lastLoginAt) : status === "invited" ? "Never (pending)" : "—"} />
        <ReadField label="Multi-factor" value="Not configured" hint="Placeholder" />
      </div>
      <div className="space-y-2 pt-1">
        {status === "invited" && (
          <SecurityAction icon={Send} label="Resend invite" hint="Send the invitation email again" disabled={!editable} onClick={() => alert("Invite re-sent (mock).")} />
        )}
        <SecurityAction icon={KeyRound} label="Reset password" hint="Email a password-reset link" disabled={!editable} onClick={() => alert("Password reset link sent (mock).")} />
        <SecurityAction icon={MonitorSmartphone} label="Revoke sessions" hint="Sign the user out everywhere" disabled={!editable} onClick={() => alert("All sessions revoked (mock).")} />
        {editable && status !== "inactive" && !user.isOrgOwner && (
          <SecurityAction icon={Ban} label="Deactivate account" hint="Blocks sign-in; keeps the record" danger disabled={false} onClick={() => onStatus(user.id, "inactive")} />
        )}
      </div>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Security controls are placeholders in this build — no email or session changes are sent.</p>
    </div>
  );
}

// ─── Activity (mock audit trail) ──────────────────────────
function ActivityTab({ user }: { user: AppUser }) {
  const roleLabel = user.assignments[0] ? getRoleLabel(user.assignments[0].role) : "a role";
  const events: { icon: typeof Clock; label: string; when: string }[] = [
    { icon: Send, label: "Invite sent", when: formatDate(user.createdAt) },
    { icon: UserCog, label: `Role assigned — ${roleLabel}`, when: formatDate(user.createdAt) },
    ...(user.appAccess ? [{ icon: AppWindow, label: "App access changed (override set)", when: formatDate(user.createdAt) }] : []),
    ...(user.status === "active" ? [{ icon: CheckCircle, label: "Account activated", when: user.lastLoginAt ? formatDate(user.lastLoginAt) : formatDate(user.createdAt) }] : []),
    ...(user.status === "inactive" ? [{ icon: Ban, label: "Account deactivated", when: "—" }] : []),
  ];
  return (
    <div className="space-y-0">
      {events.map((e, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              <e.icon className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
            </span>
            {i < events.length - 1 && <span className="w-px flex-1 my-1" style={{ backgroundColor: "var(--border-subtle)" }} />}
          </div>
          <div className="pb-4 min-w-0">
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>{e.label}</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{e.when}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Small shared bits ────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label}{hint && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function ReadField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label}{hint && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· {hint}</span>}
      </label>
      <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{value}</p>
    </div>
  );
}

function IconInput({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
      {children}
    </div>
  );
}

function Switch({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-pressed={on}
      className="relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ backgroundColor: on ? "#a855f7" : "var(--border)" }}>
      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ left: 2, transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

function SecurityAction({ icon: Icon, label, hint, danger, disabled, onClick }: {
  icon: typeof KeyRound; label: string; hint: string; danger?: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-[var(--bg-surface-2)] disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ border: "1px solid var(--border)" }}>
      <Icon className="w-4 h-4 shrink-0" style={{ color: danger ? "#dc2626" : "var(--text-secondary)" }} />
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: danger ? "#dc2626" : "var(--text-primary)" }}>{label}</p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{hint}</p>
      </div>
    </button>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Trash2; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: danger ? "#dc2626" : "var(--text-primary)" }}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function Placeholder({ icon: Icon, text }: { icon: typeof AppWindow; text: string }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ border: "1px dashed var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
      <Icon className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{text}</p>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────
function dataScopeSummary(user: AppUser): string {
  if (user.isOrgOwner) return "All data";
  const scopes = [...new Set(user.assignments.map(a => { const d = getOrgRole(a.role); return d ? SCOPE_LABEL[roleDataScope(d)] : "—"; }))];
  return scopes.join(", ") || "—";
}
function roleScopeSummaryFromRows(rows: DraftAssignment[]): string {
  const scopes = [...new Set(rows.map(r => { const d = getOrgRole(r.role); return d ? SCOPE_LABEL[roleDataScope(d)] : "—"; }))];
  return scopes.join(", ") || "—";
}
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
