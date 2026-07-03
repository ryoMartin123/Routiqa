"use client";

// ─── Users & Access · Invite User wizard ──────────────────
// A guided, multi-step setup for inviting a new login account (replaces the
// side-panel for the create flow; editing an existing user still uses the
// detail drawer). Steps: Profile → Role & Scope → App Access → Review. App
// access is derived from the chosen role(s) and can be overridden before the
// invite is sent. All state is local/mock — Send Invite creates an "invited"
// user (and writes any app-access override) via the users store.

import { useMemo, useState } from "react";
import {
  X, Check, ArrowLeft, ArrowRight, User as UserIcon, UserCog, ClipboardCheck,
  Mail, Phone, Plus, Trash2, Send, ShieldCheck,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { getAssignableRoles, getOrgRole, getRoleLabel } from "@/lib/roles/store";
import { assignmentError, allowedLevelsForRole } from "@/lib/roles/validate";
import { roleDataScope, SCOPE_LABEL, APP_META, APP_ORDER } from "@/lib/roles/appmap";
import { roleDefaultAccess, type AppAccess } from "@/lib/platform/access";
import {
  upsertUser, type AppUser, type RoleAssignment, type ScopeLevel,
} from "@/lib/users/data";
import type { RoleKey } from "@/lib/roles/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEVEL_LABEL: Record<ScopeLevel, string> = {
  org: "Organization-wide", company: "Company", location: "Location", service_area: "Service Area",
};

type StepKey = "profile" | "role" | "review";
const STEPS: { key: StepKey; label: string; icon: typeof UserIcon }[] = [
  { key: "profile", label: "Profile", icon: UserIcon },
  { key: "role", label: "Role & Scope", icon: UserCog },
  { key: "review", label: "Review", icon: ClipboardCheck },
];

interface DraftAssignment { role: RoleKey; level: ScopeLevel; targetId: string }

export default function InviteUserWizard({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (user: AppUser) => void;
}) {
  const { allCompanies, allLocations, allServiceAreas, orgSettings } = useHierarchy();

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Profile
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Role & scope
  const [rows, setRows] = useState<DraftAssignment[]>([{ role: "field_technician", level: "location", targetId: "" }]);

  // ── Hierarchy option lists ──
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

  function updateRow(i: number, patch: Partial<DraftAssignment>) { setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r))); }
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
    if (r.level === "company") return r.targetId ? { role: r.role, level: "company", companyId: r.targetId } : null;
    if (r.level === "location") {
      const loc = locations.find(l => l.id === r.targetId);
      return loc ? { role: r.role, level: "location", locationId: loc.id, companyId: loc.companyId } : null;
    }
    const area = areas.find(a => a.id === r.targetId);
    return area ? { role: r.role, level: "service_area", serviceAreaId: area.id, locationId: area.locationId, companyId: area.companyId } : null;
  }

  // ── App access derived from the chosen roles (shown read-only in Review;
  //    the user simply inherits it from their role — no per-user step) ──
  const resolvedForAccess = useMemo<RoleAssignment[]>(
    () => rows.map((r, i) => ({ id: `tmp-${i}`, role: r.role, level: r.level })),
    [rows],
  );
  const baseline = useMemo<AppAccess>(
    () => roleDefaultAccess({ id: "", fullName: "", initials: "", email: "", status: "invited", assignments: resolvedForAccess, createdAt: "" }),
    [resolvedForAccess],
  );

  // ── Step validation ──
  function validate(stepIdx: number): string | null {
    if (stepIdx === 0) {
      if (!fullName.trim()) return "Name is required.";
      if (!EMAIL_RE.test(email.trim())) return "A valid email is required.";
    }
    if (stepIdx === 1) {
      if (rows.length === 0) return "Add at least one role.";
      for (const r of rows) {
        const def = getOrgRole(r.role);
        if (def) { const e = assignmentError(def, r.level); if (e) return e; }
      }
      if (rows.map(resolveAssignment).some(a => a === null)) return "Each role needs a layer selected.";
    }
    return null;
  }

  function next() {
    const err = validate(step);
    if (err) { setError(err); return; }
    setError(null);
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  }
  function back() { setError(null); setStep(s => Math.max(s - 1, 0)); }

  function send() {
    for (let i = 0; i <= 1; i++) { const err = validate(i); if (err) { setError(err); setStep(i); return; } }
    const resolved = rows.map(resolveAssignment).filter(Boolean) as Omit<RoleAssignment, "id">[];
    // No app-access override — the user inherits app access from their role(s).
    const created = upsertUser({ fullName: fullName.trim(), email: email.trim(), phone: phone.trim() || undefined, assignments: resolved });
    onCreated(created);
  }

  const stepKey = STEPS[step].key;
  const dataScope = [...new Set(rows.map(r => { const d = getOrgRole(r.role); return d ? SCOPE_LABEL[roleDataScope(d)] : "—"; }))].join(", ") || "—";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[92vh] rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#e0e7ff" }}>
              <UserIcon className="w-4 h-4" style={{ color: "#a855f7" }} />
            </div>
            <div>
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Invite User</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Set up a new login account and its access</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Stepper */}
        <div className="px-5 pt-4 pb-3 shrink-0">
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const done = i < step, active = i === step;
              return (
                <div key={s.key} className="flex items-center" style={{ flex: i === STEPS.length - 1 ? "0 0 auto" : "1 1 0%" }}>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: active ? "#a855f7" : done ? "#a855f733" : "var(--bg-input)", color: active ? "#fff" : done ? "#a855f7" : "var(--text-muted)" }}>
                      {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </span>
                    <span className="text-xs font-medium hidden sm:block" style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <span className="h-px flex-1 mx-2" style={{ backgroundColor: done ? "#a855f7" : "var(--border)" }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {stepKey === "profile" && (
            <div className="space-y-3 max-w-xl mx-auto w-full py-2">
              <Field label="Full name *">
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Jordan Lee" className={inp} style={inpStyle} autoFocus />
              </Field>
              <Field label="Email *">
                <IconInput icon={Mail}><input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="name@company.com" className="w-full py-2 text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} /></IconInput>
              </Field>
              <Field label="Phone" hint="Optional">
                <IconInput icon={Phone}><input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="+1 (555) 000-0000" className="w-full py-2 text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} /></IconInput>
              </Field>
              <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>An invitation email will be sent to this address when you finish.</p>
            </div>
          )}

          {stepKey === "role" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Roles &amp; Layers</p>
                <button onClick={addRow} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-text)" }}><Plus className="w-3.5 h-3.5" /> Add</button>
              </div>
              <div className="space-y-2">
                {rows.map((r, i) => (
                  <div key={i} className="rounded-lg p-3 space-y-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><UiSelect value={r.role} onChange={v => changeRole(i, v as RoleKey)} options={roleOptions} size="sm" /></div>
                      {rows.length > 1 && <button onClick={() => removeRow(i)} title="Remove" className="p-1.5 rounded-md" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-40 shrink-0"><UiSelect value={r.level} onChange={v => updateRow(i, { level: v as ScopeLevel, targetId: "" })} options={levelOptionsFor(r.role)} size="sm" /></div>
                      <div className="flex-1">
                        {r.level === "org" ? <p className="text-xs px-2.5 py-1.5" style={{ color: "var(--text-muted)" }}>{LEVEL_LABEL.org}</p>
                          : <UiSelect value={r.targetId} onChange={v => updateRow(i, { targetId: v })} options={targetOptions(r.level)} placeholder={`Select ${LEVEL_LABEL[r.level].toLowerCase()}…`} size="sm" />}
                      </div>
                    </div>
                    <p className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>{getOrgRole(r.role)?.description}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>A role sets <strong>what</strong> they can do; the layer sets <strong>which</strong> company or locations. Add a row per layer.</p>
            </div>
          )}

          {stepKey === "review" && (
            <div className="space-y-5 max-w-xl mx-auto w-full">
              {/* Profile — label left, value gets the full right column (wraps, no squish) */}
              <ReviewSection label="Profile">
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  {([["Name", fullName || "—"], ["Email", email || "—"], ...(phone.trim() ? [["Phone", phone] as [string, string]] : [])] as [string, string][]).map(([l, v], i) => (
                    <div key={l} className="grid grid-cols-[92px_1fr] gap-4 px-4 py-2.5 items-baseline"
                      style={{ borderTop: i ? "1px solid var(--border)" : "none", backgroundColor: "var(--bg-surface)" }}>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{l}</span>
                      <span className="text-sm font-medium break-words min-w-0" style={{ color: "var(--text-primary)" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </ReviewSection>

              <ReviewSection label="Roles & scope" hint={`Data scope: ${dataScope}`}>
                <div className="space-y-1.5">
                  {rows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto] gap-3 items-center rounded-lg px-4 py-2.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
                      <span className="text-sm font-medium min-w-0 truncate" style={{ color: "var(--text-primary)" }}>{getRoleLabel(r.role)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full text-right" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                        {r.level === "org" ? "Org-wide" : (targetOptions(r.level).find(o => o.value === r.targetId)?.label ?? LEVEL_LABEL[r.level])}
                      </span>
                    </div>
                  ))}
                </div>
              </ReviewSection>

              <ReviewSection label="App access" hint="Inherited from role">
                <div className="flex flex-wrap gap-1.5">
                  {APP_ORDER.filter(a => baseline[a]).map(a => (
                    <span key={a} className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: APP_META[a].accent + "1a", color: APP_META[a].accent }}>{APP_META[a].name}</span>
                  ))}
                </div>
              </ReviewSection>

              <div className="rounded-lg px-3.5 py-2.5 flex items-start gap-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#a855f7" }} />
                <p className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>The user will be created as <strong>Invited</strong> and emailed an invitation to set their password.</p>
              </div>
            </div>
          )}
        </div>

        {error && <div className="mx-5 mb-3 px-3 py-2 rounded-lg text-xs shrink-0" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>{error}</div>}

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 flex items-center justify-between gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={step === 0 ? onClose : back} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>
            {step === 0 ? "Cancel" : <><ArrowLeft className="w-3.5 h-3.5" /> Back</>}
          </button>
          {stepKey === "review" ? (
            <button onClick={send} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: "#a855f7" }}><Send className="w-3.5 h-3.5" /> Send Invite</button>
          ) : (
            <button onClick={next} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: "#a855f7" }}>Continue <ArrowRight className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── bits ─────────────────────────────────────────────────
const inp = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inpStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" };

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
function IconInput({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-3" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
      {children}
    </div>
  );
}
function ReviewSection({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
        {hint && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{hint}</p>}
      </div>
      {children}
    </div>
  );
}
