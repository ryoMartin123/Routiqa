"use client";

// ─── Settings → Roles & Permissions ───────────────────────
// List the org's roles (HVAC defaults + custom), and a full-page editor with a
// resource × action permission matrix, field masks, sensitive flags, and a scope
// tier. Editing a role and creating one share the same editor. Validation blocks
// impossible role definitions.

import { useMemo, useState } from "react";
import {
  Shield, ShieldCheck, Plus, Pencil, Trash2, RotateCcw, ArrowLeft, Lock, Check,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { usePermissions } from "@/components/providers/PermissionProvider";
import {
  RESOURCE_ORDER, RESOURCE_LABELS, ACTION_ORDER, ACTION_LABELS, MASK_LABELS, FLAG_LABELS,
} from "@/lib/roles/catalog";
import {
  getOrgRoles, getOrgRole, upsertRole, deleteRole, isSystemRole, resetRole, resetAllRoles, roleKeyFromLabel,
} from "@/lib/roles/store";
import { roleErrors } from "@/lib/roles/validate";
import type {
  AccessLevel, Action, FieldMask, Resource, RoleDefinition, SensitiveFlag,
} from "@/lib/roles/types";
import type { HierarchyRole } from "@/lib/hierarchy/types";

const TIER_OPTIONS: { value: HierarchyRole; label: string; hint: string }[] = [
  { value: "org_admin",        label: "Organization",        hint: "Granted org-wide only" },
  { value: "company_admin",    label: "Company / Branch",    hint: "Granted to a company (or org-wide)" },
  { value: "location_manager", label: "Location",            hint: "Granted to a location, company, or org-wide" },
  { value: "employee",         label: "Individual / Member", hint: "Granted at any scope" },
];

const LEVEL_STYLE: Record<AccessLevel, { label: string; bg: string; color: string }> = {
  none: { label: "—",    bg: "var(--bg-input)", color: "var(--text-muted)" },
  own:  { label: "Own",  bg: "#fef3c7",         color: "#92400e" },
  all:  { label: "All",  bg: "#d1fae5",         color: "#065f46" },
};
const NEXT_LEVEL: Record<AccessLevel, AccessLevel> = { none: "own", own: "all", all: "none" };

function blankRole(): RoleDefinition {
  return {
    key: "", label: "", description: "", system: false, scopeTier: "employee",
    allAccess: false, capabilities: {}, masks: [], flags: [],
  };
}

export default function RolesSection() {
  const { hasFlag } = usePermissions();
  const canManage = hasFlag("roles_manage");

  const [version, setVersion] = useState(0);
  const roles = useMemo(() => getOrgRoles(), [version]);
  const refresh = () => setVersion(v => v + 1);

  const [editingKey, setEditingKey] = useState<string | "new" | null>(null);

  if (editingKey) {
    const role = editingKey === "new" ? blankRole() : getOrgRole(editingKey) ?? blankRole();
    return (
      <RoleEditor
        initial={role}
        isNew={editingKey === "new"}
        onCancel={() => setEditingKey(null)}
        onSaved={() => { setEditingKey(null); refresh(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Roles &amp; Permissions</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Control what each role can access. Edit the defaults or create your own; assign them to people under Users &amp; Roles.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button onClick={() => { if (confirm("Reset all roles to the shipped defaults? Custom roles will be removed.")) { resetAllRoles(); refresh(); } }}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
            </button>
            <button onClick={() => setEditingKey("new")}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> Create Role
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {roles.map(role => {
          const tier = TIER_OPTIONS.find(t => t.value === role.scopeTier);
          const summary = role.allAccess
            ? "Full access to all modules"
            : `${Object.keys(role.capabilities).length} modules · ${role.flags.length} sensitive permissions`;
          const isOwner = role.key === "org_owner";
          return (
            <div key={role.key} className="rounded-xl p-4 flex flex-col" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#e0e7ff" }}>
                    {isOwner ? <ShieldCheck className="w-4.5 h-4.5" style={{ color: "#4f46e5" }} /> : <Shield className="w-4 h-4" style={{ color: "#4f46e5" }} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{role.label}</p>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
                        {role.system ? "DEFAULT" : "CUSTOM"}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{role.description}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
                <span className="font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>{tier?.label ?? role.scopeTier}</span>
                <span>· {summary}</span>
              </div>
              {canManage && (
                <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  {isOwner ? (
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      <Lock className="w-3 h-3" /> The owner role can&apos;t be changed.
                    </span>
                  ) : (
                    <>
                      <button onClick={() => setEditingKey(role.key)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      {role.system ? (
                        <button onClick={() => { resetRole(role.key); refresh(); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                          <RotateCcw className="w-3 h-3" /> Reset
                        </button>
                      ) : (
                        <button onClick={() => { if (confirm(`Delete the "${role.label}" role?`)) { deleteRole(role.key); refresh(); } }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                          style={{ border: "1px solid #fecaca", color: "#dc2626" }}>
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Role editor (the "separate page") ────────────────────
function RoleEditor({ initial, isNew, onCancel, onSaved }: {
  initial: RoleDefinition; isNew: boolean; onCancel: () => void; onSaved: () => void;
}) {
  const [draft, setDraft] = useState<RoleDefinition>(() => JSON.parse(JSON.stringify(initial)));
  const [initialKey] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<string[]>([]);
  const others = useMemo(() => getOrgRoles().filter(r => r.key !== initial.key), [initial.key]);
  const dirty = JSON.stringify(draft) !== initialKey;

  function cellLevel(res: Resource, act: Action): AccessLevel {
    return draft.capabilities[res]?.[act] ?? "none";
  }
  function cycleCell(res: Resource, act: Action) {
    setDraft(d => {
      const caps = { ...d.capabilities };
      const row = { ...(caps[res] ?? {}) };
      const next = NEXT_LEVEL[row[act] ?? "none"];
      if (next === "none") delete row[act];
      else row[act] = next;
      // Coherence: any non-view grant implies View at least at that level.
      if (act !== "view" && next !== "none") {
        const viewRank = { none: 0, own: 1, all: 2 }[row.view ?? "none"];
        const nextRank = { none: 0, own: 1, all: 2 }[next];
        if (viewRank < nextRank) row.view = next;
      }
      if (Object.keys(row).length === 0) delete caps[res];
      else caps[res] = row;
      return { ...d, capabilities: caps };
    });
  }
  function toggleMask(m: FieldMask) {
    setDraft(d => ({ ...d, masks: d.masks.includes(m) ? d.masks.filter(x => x !== m) : [...d.masks, m] }));
  }
  function toggleFlag(f: SensitiveFlag) {
    setDraft(d => ({ ...d, flags: d.flags.includes(f) ? d.flags.filter(x => x !== f) : [...d.flags, f] }));
  }

  function save() {
    const key = draft.key || roleKeyFromLabel(draft.label);
    const toSave: RoleDefinition = { ...draft, key };
    const errs = roleErrors(toSave, others);
    if (errs.length) { setErrors(errs); return; }
    upsertRole(toSave);
    onSaved();
  }

  const tierHint = TIER_OPTIONS.find(t => t.value === draft.scopeTier)?.hint;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Roles
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} disabled={!dirty}
            className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
            {isNew ? "Create Role" : "Save Role"}
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {isNew ? "New Role" : `Edit "${initial.label}"`}
        </h2>
        {draft.system && !isNew && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Default role — your edits override the shipped defaults; use Reset to restore.</p>
        )}
      </div>

      {errors.length > 0 && (
        <div className="px-3 py-2.5 rounded-lg space-y-1" style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca" }}>
          {errors.map((e, i) => <p key={i} className="text-xs" style={{ color: "#991b1b" }}>• {e}</p>)}
        </div>
      )}

      {/* Identity */}
      <div className="rounded-xl p-4 grid grid-cols-2 gap-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <Field label="Role name">
          <input value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} placeholder="e.g. Service Manager"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" }} />
        </Field>
        <Field label="Scope tier" hint={tierHint}>
          <UiSelect value={draft.scopeTier} onChange={v => setDraft(d => ({ ...d, scopeTier: v as HierarchyRole }))}
            options={TIER_OPTIONS.map(t => ({ value: t.value, label: t.label }))} />
        </Field>
        <div className="col-span-2">
          <Field label="Description">
            <input value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="What this role is for"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" }} />
          </Field>
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-2.5 cursor-pointer select-none rounded-lg p-3" style={{ backgroundColor: "var(--bg-surface-2)" }}>
            <input type="checkbox" checked={!!draft.allAccess} onChange={e => setDraft(d => ({ ...d, allAccess: e.target.checked }))} className="accent-indigo-600" />
            <span>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Full access</span>
              <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>Grants every action on every module (except Billing) within scope. Turn off to set the matrix below.</span>
            </span>
          </label>
        </div>
      </div>

      {/* Permission matrix */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", opacity: draft.allAccess ? 0.45 : 1, pointerEvents: draft.allAccess ? "none" : "auto" }}>
        <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Module permissions <span className="font-normal normal-case">— click a cell to cycle None → Own → All</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 640 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <th className="text-left font-semibold px-3 py-2 text-[11px] uppercase tracking-wide sticky left-0" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-surface)" }}>Module</th>
                {ACTION_ORDER.map(a => (
                  <th key={a} className="px-2 py-2 text-[10px] font-semibold text-center" style={{ color: "var(--text-muted)" }}>{ACTION_LABELS[a]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RESOURCE_ORDER.map(res => (
                <tr key={res} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td className="px-3 py-1.5 text-xs font-medium sticky left-0" style={{ color: "var(--text-primary)", backgroundColor: "var(--bg-surface)" }}>{RESOURCE_LABELS[res]}</td>
                  {ACTION_ORDER.map(act => {
                    const lvl = cellLevel(res, act);
                    const s = LEVEL_STYLE[lvl];
                    return (
                      <td key={act} className="px-1 py-1 text-center">
                        <button onClick={() => cycleCell(res, act)}
                          className="w-12 py-1 rounded-md text-[10px] font-semibold transition-colors"
                          style={{ backgroundColor: s.bg, color: s.color }}>
                          {s.label}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sensitive data masks */}
      <ToggleCard title="Sensitive data" subtitle="Reveal otherwise-hidden financial and internal fields.">
        {(Object.keys(MASK_LABELS) as FieldMask[]).map(m => (
          <ToggleRow key={m} checked={draft.masks.includes(m)} onChange={() => toggleMask(m)}
            label={MASK_LABELS[m].label} desc={MASK_LABELS[m].description} />
        ))}
      </ToggleCard>

      {/* Sensitive action flags */}
      <ToggleCard title="Administrative permissions" subtitle="High-trust actions, granted on top of module permissions.">
        {(Object.keys(FLAG_LABELS) as SensitiveFlag[]).map(f => (
          <ToggleRow key={f} checked={draft.flags.includes(f)} onChange={() => toggleFlag(f)}
            label={FLAG_LABELS[f].label} desc={FLAG_LABELS[f].description} />
        ))}
      </ToggleCard>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label}{hint && <span className="font-normal ml-1.5" style={{ color: "var(--text-muted)" }}>· {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function ToggleCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function ToggleRow({ checked, onChange, label, desc }: { checked: boolean; onChange: () => void; label: string; desc: string }) {
  return (
    <label className="flex items-start gap-3 px-4 py-2.5 cursor-pointer" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <button type="button" onClick={onChange}
        className="w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors"
        style={{ backgroundColor: checked ? "#4f46e5" : "var(--bg-input)", border: `1px solid ${checked ? "#4f46e5" : "var(--border)"}` }}>
        {checked && <Check className="w-3 h-3 text-white" />}
      </button>
      <span>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</span>
        <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{desc}</span>
      </span>
    </label>
  );
}
