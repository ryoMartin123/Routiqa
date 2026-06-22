"use client";

// ─── Roles · shared UI primitives ─────────────────────────
// Visual building blocks shared by the Roles page table, the role detail drawer,
// and the guided Role Builder: app badges, scope badge, type badge, app-access
// cards, data-scope field, grouped permission accordions, and the sensitive-
// access card. All operate on a RoleDefinition draft via value/onChange so the
// same controls power both the drawer and the builder.

import { useState } from "react";
import {
  ChevronDown, ChevronRight, Shield, ShieldCheck, Lock, AlertTriangle, SlidersHorizontal,
} from "lucide-react";
import { RESOURCE_LABELS, ACTION_ORDER, ACTION_LABELS, MASK_LABELS, FLAG_LABELS } from "@/lib/roles/catalog";
import {
  APP_META, APP_ORDER, roleApps, resourcesForApp, DATA_SCOPES, SCOPE_LABEL,
  roleDataScope, MODULE_LEVEL_LABELS, levelOfRow, applyAppLevel,
  appLevelOf, SENSITIVE_MASK_ORDER, MANAGE_FLAG_ORDER,
  type ModuleLevel, type AppLevel,
} from "@/lib/roles/appmap";
import type { AccessLevel, Action, DataScope, FieldMask, Resource, RoleDefinition, SensitiveFlag } from "@/lib/roles/types";
import type { PlatformAppId } from "@/lib/platform/apps";

// ─── Badges ───────────────────────────────────────────────
export function AppBadges({ role, max = 6 }: { role: RoleDefinition; max?: number }) {
  const apps = roleApps(role);
  const shown = apps.slice(0, max);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((a) => (
        <span key={a} className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: APP_META[a].accent + "1f", color: APP_META[a].accent }}>
          {APP_META[a].name}
        </span>
      ))}
      {apps.length > shown.length && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
          +{apps.length - shown.length}
        </span>
      )}
    </div>
  );
}

export function ScopeBadge({ scope }: { scope: DataScope }) {
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
      {SCOPE_LABEL[scope]}
    </span>
  );
}

export function TypeBadge({ role }: { role: RoleDefinition }) {
  if (role.locked) {
    return <Badge icon={Lock} label="Locked" bg="#fef3c7" color="#92400e" />;
  }
  return role.system
    ? <Badge icon={ShieldCheck} label="System Default" bg="var(--bg-input)" color="var(--text-secondary)" />
    : <Badge icon={Shield} label="Custom" bg="#e0e7ff" color="#4f46e5" />;
}

function Badge({ icon: Icon, label, bg, color }: { icon: typeof Shield; label: string; bg: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: bg, color }}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

// ─── Toggle switch ────────────────────────────────────────
export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!on)} disabled={disabled} role="switch" aria-checked={on}
      className="relative w-9 h-5 rounded-full transition-colors shrink-0"
      style={{ backgroundColor: on ? "#4f46e5" : "var(--bg-input)", border: "1px solid var(--border)", opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
      <span className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform" style={{ transform: on ? "translateX(16px)" : "none" }} />
    </button>
  );
}

// ─── Data scope ───────────────────────────────────────────
export function DataScopeField({ draft, onChange }: { draft: RoleDefinition; onChange: (r: RoleDefinition) => void }) {
  const scope = roleDataScope(draft);
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {DATA_SCOPES.map((s) => {
        const on = scope === s.value;
        return (
          <button key={s.value} type="button" onClick={() => onChange({ ...draft, dataScope: s.value })}
            className="text-left rounded-xl px-3.5 py-3 flex items-start gap-2.5 transition-all"
            style={{ border: `1.5px solid ${on ? "#4f46e5" : "var(--border-subtle)"}`, backgroundColor: on ? "#f5f3ff" : "var(--bg-surface)" }}>
            <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
              style={{ border: `1.5px solid ${on ? "#4f46e5" : "var(--border)"}`, backgroundColor: on ? "#4f46e5" : "transparent" }}>
              {on && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </span>
            <span className="min-w-0">
              <span className="text-sm font-medium block" style={{ color: on ? "#4f46e5" : "var(--text-primary)" }}>{s.label}</span>
              <span className="text-[11px] block leading-snug" style={{ color: "var(--text-muted)" }}>{s.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── App access cards ─────────────────────────────────────
// Step 2 of the builder. Each app: a clear on/off toggle, and when on a row of
// level pills (View → Standard → Manager → Full) instead of a dropdown. A
// "Custom" pill appears when the level was fine-tuned on the Permissions step.
const APP_LEVEL_PILLS: AppLevel[] = ["view", "standard", "manager", "full"];
const PILL_LABEL: Record<AppLevel, string> = { none: "None", view: "View", standard: "Standard", manager: "Manager", full: "Full", custom: "Custom" };

export function AppAccessCards({ draft, onChange }: { draft: RoleDefinition; onChange: (r: RoleDefinition) => void }) {
  const apps = new Set(roleApps(draft));
  const scopeAccess: AccessLevel = ["self", "assigned"].includes(roleDataScope(draft)) ? "own" : "all";

  function toggleApp(app: PlatformAppId, on: boolean) {
    if (app === "portal") return; // always on
    const next = new Set(apps);
    on ? next.add(app) : next.delete(app);
    let role: RoleDefinition = { ...draft, apps: APP_ORDER.filter((a) => a === "portal" || next.has(a)) };
    if (!on) role = applyAppLevel(role, app, "none");
    // A freshly-enabled app defaults to Standard access so it isn't empty.
    if (on && resourcesForApp(app).length > 0 && appLevelOf(role, app) === "none") {
      role = applyAppLevel(role, app, "standard", scopeAccess);
    }
    onChange(role);
  }
  function setLevel(app: PlatformAppId, level: AppLevel) {
    onChange(applyAppLevel({ ...draft, apps: APP_ORDER.filter((a) => a === "portal" || apps.has(a) || a === app) }, app, level, scopeAccess));
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {APP_ORDER.map((app) => {
        const on = app === "portal" || apps.has(app);
        const meta = APP_META[app];
        const hasModules = resourcesForApp(app).length > 0;
        const lvl = appLevelOf(draft, app);
        return (
          <div key={app} className="rounded-xl p-3.5 transition-all"
            style={{ backgroundColor: "var(--bg-surface)", border: `1.5px solid ${on ? "var(--accent-soft-border)" : "var(--border-subtle)"}` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: meta.accent + "1f" }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.accent }} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{meta.name}</p>
                  <p className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>{meta.description}</p>
                </div>
              </div>
              <Toggle on={on} onChange={(v) => toggleApp(app, v)} disabled={app === "portal"} />
            </div>

            {app === "portal" ? (
              <p className="text-[10px] mt-2.5" style={{ color: "var(--text-muted)" }}>Always available to every role.</p>
            ) : on && hasModules ? (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Access level</p>
                <div className="flex flex-wrap gap-1">
                  {APP_LEVEL_PILLS.map((l) => {
                    const sel = lvl === l;
                    return (
                      <button key={l} type="button" onClick={() => setLevel(app, l)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
                        style={sel ? { backgroundColor: "#4f46e5", color: "#fff" } : { backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                        {PILL_LABEL[l]}
                      </button>
                    );
                  })}
                  {lvl === "custom" && (
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-medium" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>Custom</span>
                  )}
                </div>
                {lvl === "custom" && <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>Fine-tuned on the Permissions step.</p>}
              </div>
            ) : on && !hasModules ? (
              <p className="text-[10px] mt-2.5" style={{ color: "var(--text-muted)" }}>Full access — this app has no granular modules yet.</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ─── Permission accordions (grouped by app) ───────────────
export function PermissionAccordions({ draft, onChange, readOnly }: { draft: RoleDefinition; onChange: (r: RoleDefinition) => void; readOnly?: boolean }) {
  const apps = roleApps(draft).filter((a) => a !== "portal");
  const [open, setOpen] = useState<Set<string>>(() => new Set(apps.slice(0, 1)));

  if (draft.allAccess) {
    return (
      <div className="rounded-xl p-4 flex items-center gap-2.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <ShieldCheck className="w-4 h-4" style={{ color: "#4f46e5" }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Full access — every module across enabled apps (except Billing) within scope.</p>
      </div>
    );
  }

  function toggle(app: string) {
    setOpen((p) => { const n = new Set(p); n.has(app) ? n.delete(app) : n.add(app); return n; });
  }
  function cycleAction(res: keyof typeof RESOURCE_LABELS, act: Action) {
    const caps = { ...draft.capabilities };
    const row = { ...(caps[res] ?? {}) };
    const cur: AccessLevel = row[act] ?? "none";
    const next: AccessLevel = cur === "none" ? "own" : cur === "own" ? "all" : "none";
    if (next === "none") delete row[act]; else row[act] = next;
    if (act !== "view" && next !== "none") {
      const rank = { none: 0, own: 1, all: 2 };
      if (rank[row.view ?? "none"] < rank[next]) row.view = next;
    }
    if (Object.keys(row).length === 0) delete caps[res]; else caps[res] = row;
    onChange({ ...draft, capabilities: caps });
  }

  if (apps.length === 0) {
    return <p className="text-sm italic px-1" style={{ color: "var(--text-muted)" }}>Enable an app in App Access to configure its permissions.</p>;
  }

  return (
    <div className="space-y-2">
      {apps.map((app) => {
        const resources = resourcesForApp(app);
        const expanded = open.has(app);
        const granted = resources.filter((r) => levelOfRow(draft.capabilities[r]) !== "none").length;
        return (
          <div key={app} className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <button onClick={() => toggle(app)} className="w-full flex items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-[var(--bg-surface-2)]">
              <span className="flex items-center gap-2">
                {expanded ? <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} /> : <ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: APP_META[app].accent }} />
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{APP_META[app].name} Permissions</span>
              </span>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {resources.length === 0 ? "App access only" : `${granted}/${resources.length} modules`}
              </span>
            </button>
            {expanded && (
              <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
                {resources.length === 0 ? (
                  <p className="text-xs px-4 py-3" style={{ color: "var(--text-muted)" }}>No granular modules yet — controlled by app access.</p>
                ) : resources.map((res) => (
                  <ModuleRow key={res} res={res} level={levelOfRow(draft.capabilities[res])}
                    row={draft.capabilities[res]} onCycle={(a) => cycleAction(res, a)} readOnly={readOnly} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const ACT_STYLE: Record<AccessLevel, { label: string; bg: string; color: string }> = {
  none: { label: "—", bg: "var(--bg-input)", color: "var(--text-muted)" },
  own:  { label: "Own", bg: "#fef3c7", color: "#92400e" },
  all:  { label: "All", bg: "#d1fae5", color: "#065f46" },
};

const MODULE_BADGE_STYLE: Record<ModuleLevel, { bg: string; color: string }> = {
  none:        { bg: "var(--bg-input)", color: "var(--text-muted)" },
  view:        { bg: "var(--bg-input)", color: "var(--text-secondary)" },
  create_edit: { bg: "#e0e7ff", color: "#4338ca" },
  manage:      { bg: "#d1fae5", color: "#065f46" },
  custom:      { bg: "#fef3c7", color: "#92400e" },
};

function ModuleLevelBadge({ level }: { level: ModuleLevel }) {
  if (level === "none") return <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>No access</span>;
  const s = MODULE_BADGE_STYLE[level];
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{MODULE_LEVEL_LABELS[level]}</span>;
}

// One module row: the level as a badge, and a sliders icon that expands the
// per-action toggles inline (the only control — no dropdown). Read-only mode
// still expands to inspect, but the action cells aren't editable.
function ModuleRow({ res, level, row, onCycle, readOnly }: {
  res: keyof typeof RESOURCE_LABELS; level: ModuleLevel;
  row?: Partial<Record<Action, AccessLevel>>; onCycle: (a: Action) => void; readOnly?: boolean;
}) {
  const [adv, setAdv] = useState(level === "custom");
  const showMatrix = adv || level === "custom";
  return (
    <div className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{RESOURCE_LABELS[res]}</span>
        <div className="flex items-center gap-2.5 shrink-0">
          <ModuleLevelBadge level={level} />
          <button onClick={() => setAdv((a) => !a)} title={showMatrix ? "Hide actions" : "Show actions"}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
            style={{ border: "1px solid var(--border)", color: showMatrix ? "var(--accent-text)" : "var(--text-muted)", backgroundColor: showMatrix ? "var(--accent-soft-bg)" : "var(--bg-surface)" }}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {showMatrix && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {ACTION_ORDER.map((a) => {
            const s = ACT_STYLE[row?.[a] ?? "none"];
            return (
              <button key={a} onClick={() => !readOnly && onCycle(a)} disabled={readOnly}
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors"
                style={{ backgroundColor: s.bg, color: s.color, minWidth: 52, cursor: readOnly ? "default" : "pointer" }}>
                <span className="text-[9px] uppercase tracking-wide" style={{ opacity: 0.7 }}>{ACTION_LABELS[a]}</span>
                {s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Permission matrix (resources × actions, grouped by app) ──
// The "Matrix" view of the Permissions step — every action on every module of
// each enabled app, as clickable none → own → all cells. Same edit model as the
// per-module Advanced matrix, laid out as a full grid for power users.
const MATRIX_COLS = "minmax(120px, 1.4fr) repeat(8, minmax(42px, 1fr))";

export function PermissionMatrix({ draft, onChange, readOnly }: { draft: RoleDefinition; onChange: (r: RoleDefinition) => void; readOnly?: boolean }) {
  const apps = roleApps(draft).filter((a) => a !== "portal");

  if (draft.allAccess) {
    return (
      <div className="rounded-xl p-4 flex items-center gap-2.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <ShieldCheck className="w-4 h-4" style={{ color: "#4f46e5" }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Full access — every module across enabled apps (except Billing) within scope.</p>
      </div>
    );
  }
  if (apps.length === 0) {
    return <p className="text-sm italic px-1" style={{ color: "var(--text-muted)" }}>Enable an app in App Access to configure its permissions.</p>;
  }

  function cycle(res: Resource, act: Action) {
    const caps = { ...draft.capabilities };
    const row = { ...(caps[res] ?? {}) };
    const cur: AccessLevel = row[act] ?? "none";
    const next: AccessLevel = cur === "none" ? "own" : cur === "own" ? "all" : "none";
    if (next === "none") delete row[act]; else row[act] = next;
    // Granting any action implies at least the same level of view.
    if (act !== "view" && next !== "none") {
      const rank = { none: 0, own: 1, all: 2 };
      if (rank[row.view ?? "none"] < rank[next]) row.view = next;
    }
    if (Object.keys(row).length === 0) delete caps[res]; else caps[res] = row;
    onChange({ ...draft, capabilities: caps });
  }

  return (
    <div className="space-y-3">
      {apps.map((app) => {
        const resources = resourcesForApp(app);
        return (
          <div key={app} className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: APP_META[app].accent }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{APP_META[app].name}</span>
            </div>
            {resources.length === 0 ? (
              <p className="text-xs px-4 py-3" style={{ color: "var(--text-muted)" }}>No granular modules yet — controlled by app access.</p>
            ) : (
              <div className="overflow-x-auto thin-scroll-x">
                <div style={{ minWidth: 560 }}>
                  {/* Action header */}
                  <div className="grid items-center px-3 py-2 text-[10px] font-semibold uppercase tracking-wide" style={{ gridTemplateColumns: MATRIX_COLS, color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
                    <span>Module</span>
                    {ACTION_ORDER.map((a) => <span key={a} className="text-center truncate">{ACTION_LABELS[a]}</span>)}
                  </div>
                  {resources.map((res, i) => (
                    <div key={res} className="grid items-center px-3 py-1.5" style={{ gridTemplateColumns: MATRIX_COLS, borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)" }}>
                      <span className="text-sm truncate pr-2" style={{ color: "var(--text-primary)" }}>{RESOURCE_LABELS[res]}</span>
                      {ACTION_ORDER.map((a) => {
                        const s = ACT_STYLE[draft.capabilities[res]?.[a] ?? "none"];
                        return (
                          <button key={a} onClick={() => !readOnly && cycle(res, a)} disabled={readOnly} title={`${RESOURCE_LABELS[res]} · ${ACTION_LABELS[a]}`}
                            className="mx-auto w-11 py-1 rounded-md text-[10px] font-semibold transition-colors"
                            style={{ backgroundColor: s.bg, color: s.color, cursor: readOnly ? "default" : "pointer" }}>
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!readOnly && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Click a cell to cycle — / Own / All. Granting an action also grants at least View.</p>}
    </div>
  );
}

// ─── Sensitive access card (warning styling) ──────────────
export function SensitiveAccess({ draft, onChange }: { draft: RoleDefinition; onChange: (r: RoleDefinition) => void }) {
  function toggleMask(m: FieldMask) {
    onChange({ ...draft, masks: draft.masks.includes(m) ? draft.masks.filter((x) => x !== m) : [...draft.masks, m] });
  }
  function toggleFlag(f: SensitiveFlag) {
    onChange({ ...draft, flags: draft.flags.includes(f) ? draft.flags.filter((x) => x !== f) : [...draft.flags, f] });
  }
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #fcd34d", backgroundColor: "var(--bg-surface)" }}>
      <div className="px-4 py-3 flex items-start gap-2.5" style={{ backgroundColor: "#fffbeb", borderBottom: "1px solid #fde68a" }}>
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#b45309" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "#92400e" }}>Sensitive Access</p>
          <p className="text-xs" style={{ color: "#b45309" }}>These permissions expose financial, payroll, internal, or administrative information.</p>
        </div>
      </div>
      <div>
        <GroupLabel>Data visibility</GroupLabel>
        {SENSITIVE_MASK_ORDER.map((m) => (
          <SensRow key={m} on={draft.masks.includes(m)} onChange={() => toggleMask(m)}
            label={MASK_LABELS[m].label} desc={MASK_LABELS[m].description} prefix="View" />
        ))}
        <GroupLabel>Administrative</GroupLabel>
        {MANAGE_FLAG_ORDER.map((f) => (
          <SensRow key={f} on={draft.flags.includes(f)} onChange={() => toggleFlag(f)}
            label={FLAG_LABELS[f].label} desc={FLAG_LABELS[f].description} />
        ))}
      </div>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest px-4 pt-3 pb-1.5" style={{ color: "var(--text-muted)" }}>{children}</p>;
}

function SensRow({ on, onChange, label, desc, prefix }: { on: boolean; onChange: () => void; label: string; desc: string; prefix?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{prefix ? `${prefix} ${label.toLowerCase()}` : label}</p>
        <p className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>{desc}</p>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}
