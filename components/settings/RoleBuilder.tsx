"use client";

// ─── Guided Role Builder (Create / Edit role) ─────────────
// Replaces the giant blank permission matrix with progressive disclosure across
// four tabs — Basics, Access, Permissions, Review. New roles start from an
// immersive "Start From" picker: pick a starting role and see exactly which apps,
// data scope, module permissions, and sensitive access it grants before
// committing. The full action matrix only appears per-module under Advanced/Custom.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Shield, Sparkles, FileStack, AlertCircle, AlertTriangle, Rows3, Grid3x3 } from "lucide-react";
import { pingSaved } from "@/components/shared/SavedPill";
import {
  AppAccessCards, DataScopeField, PermissionAccordions, PermissionMatrix, SensitiveAccess, AppBadges, ScopeBadge,
} from "@/components/settings/rolesUi";
import {
  START_PRESETS, draftFromPreset, roleApps, roleDataScope, appLevelOf, APP_META, APP_LEVELS,
  sensitiveCount, adminCount, DATA_SCOPES,
} from "@/lib/roles/appmap";
import { MASK_LABELS, FLAG_LABELS } from "@/lib/roles/catalog";
import { getOrgRoles, upsertRole, roleKeyFromLabel } from "@/lib/roles/store";
import { roleErrors } from "@/lib/roles/validate";
import type { RoleDefinition } from "@/lib/roles/types";

type Tab = "basics" | "access" | "permissions" | "review";
const TABS: { key: Tab; label: string }[] = [
  { key: "basics", label: "Basics" },
  { key: "access", label: "Access" },
  { key: "permissions", label: "Permissions" },
  { key: "review", label: "Review" },
];

function blankRole(): RoleDefinition {
  return {
    key: "", label: "", description: "", system: false, scopeTier: "employee",
    dataScope: "assigned", apps: ["portal"], allAccess: false, capabilities: {},
    masks: [], flags: [], status: "active",
  };
}

export default function RoleBuilder({ initial, isNew, onSaved }: {
  initial?: RoleDefinition; isNew: boolean; onCancel?: () => void; onSaved: () => void;
}) {
  const [draft, setDraft] = useState<RoleDefinition>(() => initial ? JSON.parse(JSON.stringify(initial)) : blankRole());
  const [tab, setTab] = useState<Tab>("basics");
  const [permView, setPermView] = useState<"simple" | "matrix">("simple");
  const [errors, setErrors] = useState<string[]>([]);
  const [startId, setStartId] = useState<string | null>(isNew ? null : "existing");
  const others = useMemo(() => getOrgRoles().filter((r) => r.key !== initial?.key), [initial?.key]);

  // ── Auto-save ──
  // No Save/Cancel buttons — changes persist live. The key is fixed on first
  // commit (so a later rename updates the same record instead of forking one).
  const committedKey = useRef<string>(isNew ? "" : (initial?.key ?? ""));
  const lastSnap = useRef<string | null>(null);

  function applyStart(base: RoleDefinition, id: string) {
    setStartId(id);
    // Preserve anything the admin already typed.
    setDraft((d) => ({ ...base, label: d.label, description: d.description || base.description, status: d.status ?? "active" }));
  }

  // Persist on every valid change. Until a role name is entered there's nothing
  // meaningful to save, so we hold off (and surface a hint in the header).
  useEffect(() => {
    if (!draft.label.trim()) { setErrors([]); return; }
    const key = committedKey.current || roleKeyFromLabel(draft.label);
    const toSave: RoleDefinition = { ...draft, key };
    const errs = roleErrors(toSave, others);
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    upsertRole(toSave);
    committedKey.current = key;
    // Skip the initial no-op persist (mount / StrictMode) — only ping on real edits.
    const snap = JSON.stringify(toSave);
    if (lastSnap.current === null) { lastSnap.current = snap; return; }
    if (lastSnap.current === snap) return;
    lastSnap.current = snap;
    pingSaved();
  }, [draft, others]);

  // Leaving the builder — refresh the list to reflect everything auto-saved.
  function done() { onSaved(); }

  // Wizard step navigation.
  const stepIndex = TABS.findIndex((t) => t.key === tab);
  const isLastStep = stepIndex === TABS.length - 1;
  const goNext = () => (isLastStep ? done() : setTab(TABS[stepIndex + 1].key));
  const goBack = () => { if (stepIndex > 0) setTab(TABS[stepIndex - 1].key); };

  return (
    <div className="space-y-5 pb-4">
      {/* Sticky header — auto-save (no Save/Cancel) */}
      <div className="sticky top-0 z-20 -mx-6 px-6 py-3 flex items-center justify-between gap-3"
        style={{ backgroundColor: "var(--bg-page)", borderBottom: "1px solid var(--border)" }}>
        <button onClick={done} className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Done
        </button>
        <AutoSaveStatus hasLabel={Boolean(draft.label.trim())} errorCount={errors.length} />
      </div>

      <div>
        <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{isNew ? "New Role" : `Edit "${initial?.label}"`}</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Create a role by choosing a starting point, app access, data scope, and permissions.
        </p>
      </div>

      {errors.length > 0 && (
        <div className="px-3 py-2.5 rounded-lg space-y-1" style={{ backgroundColor: "#fee2e2", border: "1px solid #fecaca" }}>
          {errors.map((e, i) => <p key={i} className="text-xs" style={{ color: "#991b1b" }}>• {e}</p>)}
        </div>
      )}

      {/* Wizard stepper — click a step to jump, or use Back / Next below */}
      <Stepper steps={TABS} current={tab} onStep={setTab} />

      {tab === "basics" && (
        <BasicsTab draft={draft} setDraft={setDraft} isNew={isNew} startId={startId} applyStart={applyStart} />
      )}
      {tab === "access" && (
        <div className="space-y-4">
          <SectionHead title="App Access" sub="Choose which apps this role can open. My Portal is always available." />
          <AppAccessCards draft={draft} onChange={setDraft} />
          <SectionHead title="Data Scope" sub="The default visibility window for users with this role." />
          <DataScopeField draft={draft} onChange={setDraft} />
        </div>
      )}
      {tab === "permissions" && (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <SectionHead title="Permissions" sub={permView === "simple"
              ? "Set a simple level per module. Open Advanced for the full action matrix."
              : "Every action on every module, grouped by app. Click a cell to cycle — / Own / All."} />
            <PermViewToggle view={permView} onChange={setPermView} />
          </div>
          {permView === "simple"
            ? <PermissionAccordions draft={draft} onChange={setDraft} />
            : <PermissionMatrix draft={draft} onChange={setDraft} />}
          <SectionHead title="Sensitive Access" sub="Kept separate from normal permissions." />
          <SensitiveAccess draft={draft} onChange={setDraft} />
        </div>
      )}
      {tab === "review" && <ReviewTab draft={draft} />}

      {/* Wizard footer — Back / Next (Finish on the last step) */}
      <div className="flex items-center justify-between gap-2 pt-2">
        <button onClick={goBack} disabled={stepIndex === 0}
          className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg transition-colors disabled:opacity-40"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={goNext}
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg text-white transition-colors"
          style={{ backgroundColor: "#4f46e5" }}>
          {isLastStep ? <><Check className="w-4 h-4" /> Finish</> : <>Next <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );
}

// ─── Wizard stepper ───────────────────────────────────────
function Stepper({ steps, current, onStep }: { steps: { key: Tab; label: string }[]; current: Tab; onStep: (k: Tab) => void }) {
  const currentIndex = steps.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <Fragment key={s.key}>
            <button onClick={() => onStep(s.key)} className="flex items-center gap-2 shrink-0">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors"
                style={{
                  backgroundColor: done || active ? "#4f46e5" : "var(--bg-input)",
                  color: done || active ? "#fff" : "var(--text-muted)",
                  boxShadow: active ? "0 0 0 3px var(--accent-soft-bg)" : "none",
                }}>
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className="text-sm font-medium whitespace-nowrap" style={{ color: active ? "var(--text-primary)" : done ? "var(--text-secondary)" : "var(--text-muted)" }}>
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span className="flex-1 h-px" style={{ minWidth: 16, backgroundColor: i < currentIndex ? "#4f46e5" : "var(--border)" }} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ─── Permissions Simple / Matrix view toggle ──────────────
function PermViewToggle({ view, onChange }: { view: "simple" | "matrix"; onChange: (v: "simple" | "matrix") => void }) {
  const opts: { key: "simple" | "matrix"; label: string; icon: typeof Rows3 }[] = [
    { key: "simple", label: "Simple", icon: Rows3 },
    { key: "matrix", label: "Matrix", icon: Grid3x3 },
  ];
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg shrink-0" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      {opts.map((o) => {
        const on = view === o.key;
        const Icon = o.icon;
        return (
          <button key={o.key} onClick={() => onChange(o.key)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{ backgroundColor: on ? "var(--bg-surface)" : "transparent", color: on ? "var(--text-primary)" : "var(--text-muted)", boxShadow: on ? "var(--shadow-card)" : "none" }}>
            <Icon className="w-3.5 h-3.5" /> {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Auto-save status pill ────────────────────────────────
// Contextual validation hint only — save feedback lives in the global SavedPill.
function AutoSaveStatus({ hasLabel, errorCount }: { hasLabel: boolean; errorCount: number }) {
  if (!hasLabel) {
    return (
      <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
        <AlertCircle className="w-4 h-4" /> Add a role name to save
      </span>
    );
  }
  if (errorCount > 0) {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "#dc2626" }}>
        <AlertCircle className="w-4 h-4" /> {errorCount} {errorCount === 1 ? "issue" : "issues"} to fix
      </span>
    );
  }
  return null;
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{sub}</p>
    </div>
  );
}

// ─── Basics + Start From ──────────────────────────────────
interface StartOption { id: string; label: string; description: string; icon: typeof Shield }

function BasicsTab({ draft, setDraft, isNew, startId, applyStart }: {
  draft: RoleDefinition; setDraft: (r: RoleDefinition) => void; isNew: boolean;
  startId: string | null; applyStart: (base: RoleDefinition, id: string) => void;
}) {
  // Build each starting point's full role draft once so we can preview exactly
  // what it grants (apps, scope, modules, sensitive access).
  const starts = useMemo<{ option: StartOption; role: RoleDefinition }[]>(() => [
    { option: { id: "blank", label: "Start Blank", description: "An empty custom role — build permissions from scratch.", icon: Sparkles }, role: blankRole() },
    ...START_PRESETS.map((p) => ({
      option: { id: p.id, label: p.label, description: p.description, icon: Shield },
      role: draftFromPreset(p.id),
    })),
  ], []);

  // Which starting point is shown in the detail pane (browse without committing).
  const [previewId, setPreviewId] = useState<string>(startId && startId !== "existing" ? startId : "blank");
  const current = starts.find((s) => s.option.id === previewId) ?? starts[0];

  return (
    <div className="space-y-5">
      {isNew && (
        <div>
          <SectionHead title="Start From" sub="Pick a starting point and review exactly what it can access. You can fine-tune everything afterward." />
          <div className="grid lg:grid-cols-[260px_1fr] gap-3 mt-3">
            {/* Left — selectable list of starting points */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
              {starts.map(({ option }, i) => {
                const isPreview = option.id === previewId;
                const isChosen = option.id === startId;
                const Icon = option.icon;
                return (
                  <button key={option.id} onClick={() => setPreviewId(option.id)}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors"
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--border)",
                      backgroundColor: isPreview ? "var(--accent-soft-bg)" : "transparent",
                    }}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: isPreview ? "#e0e7ff" : "var(--bg-input)" }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: isPreview ? "#4f46e5" : "var(--text-muted)" }} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="text-sm font-medium block truncate" style={{ color: isPreview ? "var(--accent-text)" : "var(--text-primary)" }}>{option.label}</span>
                    </span>
                    {isChosen && <Check className="w-4 h-4 shrink-0" style={{ color: "#10b981" }} />}
                  </button>
                );
              })}
            </div>

            {/* Right — immersive detail of the previewed starting point */}
            <StartDetail option={current.option} role={current.role}
              chosen={current.option.id === startId}
              onUse={() => applyStart(JSON.parse(JSON.stringify(current.role)), current.option.id)} />
          </div>
        </div>
      )}

      <div className="rounded-xl p-4 grid sm:grid-cols-2 gap-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <LField label="Role name">
          <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Service Manager"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" }} />
        </LField>
        <LField label="Role type">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
            <FileStack className="w-3.5 h-3.5" /> {draft.system ? "System Default" : "Custom"}
          </div>
        </LField>
        <div className="sm:col-span-2">
          <LField label="Description">
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What this role is for"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-primary)" }} />
          </LField>
        </div>
      </div>
    </div>
  );
}

// ─── Start From — detail / preview pane ───────────────────
function StartDetail({ option, role, chosen, onUse }: {
  option: StartOption; role: RoleDefinition; chosen: boolean; onUse: () => void;
}) {
  const [permView, setPermView] = useState<"simple" | "matrix">("simple");
  const apps = roleApps(role).filter((a) => a !== "portal");
  const scope = roleDataScope(role);
  const scopeHint = DATA_SCOPES.find((s) => s.value === scope)?.hint;
  const sensitive = [
    ...role.masks.map((m) => MASK_LABELS[m].label),
    ...role.flags.map((f) => FLAG_LABELS[f].label),
  ];
  const Icon = option.icon;

  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
      {/* Header */}
      <div className="px-4 py-3.5 flex items-start justify-between gap-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#e0e7ff" }}>
            <Icon className="w-4 h-4" style={{ color: "#4f46e5" }} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{option.label}</p>
            <p className="text-xs leading-snug mt-0.5" style={{ color: "var(--text-muted)" }}>{option.description}</p>
          </div>
        </div>
        <button onClick={onUse} disabled={chosen}
          className="shrink-0 flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:cursor-default"
          style={chosen
            ? { backgroundColor: "#d1fae5", color: "#065f46" }
            : { backgroundColor: "#4f46e5", color: "#fff" }}>
          {chosen ? <><Check className="w-3.5 h-3.5" /> Selected</> : "Use this start"}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Apps + scope */}
        <div className="grid sm:grid-cols-2 gap-4">
          <DetailBlock label="Apps enabled">
            {apps.length === 0 ? (
              <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>My Portal only</span>
            ) : <AppBadges role={role} />}
          </DetailBlock>
          <DetailBlock label="Default data scope">
            <ScopeBadge scope={scope} />
            {scopeHint && <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{scopeHint}</p>}
          </DetailBlock>
        </div>

        {/* Permissions — same Simple / Matrix views as the builder, read-only */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Permissions</p>
            {!role.allAccess && apps.length > 0 && <PermViewToggle view={permView} onChange={setPermView} />}
          </div>
          {role.allAccess ? (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Full access — every module across enabled apps (except Billing) within scope.</p>
          ) : apps.length === 0 ? (
            <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>No module permissions yet. Build them on the Permissions step.</p>
          ) : permView === "simple" ? (
            <PermissionAccordions draft={role} onChange={() => {}} readOnly />
          ) : (
            <PermissionMatrix draft={role} onChange={() => {}} readOnly />
          )}
        </div>

        {/* Sensitive access */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Sensitive &amp; administrative</p>
          {sensitive.length === 0 ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>None — no sensitive or administrative permissions.</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {sensitive.map((label) => (
                <span key={label} className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}>
                  <AlertTriangle className="w-2.5 h-2.5" /> {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</p>
      {children}
    </div>
  );
}

function LField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Review ───────────────────────────────────────────────
function ReviewTab({ draft }: { draft: RoleDefinition }) {
  const apps = roleApps(draft).filter((a) => a !== "portal" && APP_META[a]);
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{draft.label || "Untitled role"}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{draft.description || "No description"}</p>
      </div>
      <ReviewRow label="Apps enabled"><AppBadges role={draft} /></ReviewRow>
      <ReviewRow label="Default data scope"><ScopeBadge scope={roleDataScope(draft)} /></ReviewRow>
      <ReviewRow label="Permission level by app">
        <div className="flex flex-col gap-1 items-end">
          {apps.length === 0 ? <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>No apps enabled</span> :
            apps.map((a) => (
              <span key={a} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {APP_META[a].name}: <span className="font-medium">{draft.allAccess ? "Full access" : (APP_LEVELS.find((l) => l.value === appLevelOf(draft, a))?.label ?? "Custom")}</span>
              </span>
            ))}
        </div>
      </ReviewRow>
      <ReviewRow label="Sensitive permissions"><Count n={sensitiveCount(draft)} /></ReviewRow>
      <ReviewRow label="Administrative permissions"><Count n={adminCount(draft)} /></ReviewRow>
    </div>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="text-sm font-semibold" style={{ color: n > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{n}</span>;
}
