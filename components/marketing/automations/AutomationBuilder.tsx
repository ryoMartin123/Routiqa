"use client";

// ─── Automation builder ───────────────────────────────────
// A modern workflow composer (not a settings form): a connected build rail on the
// left (When → If → Then → Timing → Stop if) and a sticky live-summary panel on
// the right that narrates the rule in plain English and validates it before
// activation. Light, premium surfaces; action tiles; condition rule-chips.

import { useRef, useState } from "react";
import {
  ArrowLeft, Plus, Trash2, X, Check, MessageSquare, Megaphone, CheckSquare, Tag, Users, Bell,
  Clock, ShieldAlert, Sparkles, ScrollText, Zap, SlidersHorizontal, FileText, Undo2, Pencil,
} from "lucide-react";
import { MoreActionsGlyph } from "@/components/shared/ActionsMenu";
import CatalogPicker, { type CatalogGroup } from "@/components/marketing/automations/CatalogPicker";
import Select from "@/components/ui/Select";
import NumberStepper from "@/components/ui/NumberStepper";
import {
  TRIGGERS, TRIGGER_OBJECTS, getTrigger, getAutomationById, CONDITION_FIELDS, getConditionField, opsForField,
  OP_LABEL, ACTIONS, ACTION_GROUPS, getAction, TIMING_KINDS, SAFETY_RULES, summarize,
  triggerSummary, actionSummary, saveAutomation, STATUS_CONFIG,
  type MarketingAutomation, type TriggerObject, type ActionGroup, type ConditionRow, type ConditionOp,
} from "@/lib/marketing/automations";
import { getTemplates, getCampaigns, AUDIENCES } from "@/lib/marketing/data";

const ACCENT = "#e11d48";
const ACTION_GROUP_ICON: Record<ActionGroup, typeof MessageSquare> = {
  message: MessageSquare, campaign: Megaphone, task: CheckSquare, tag: Tag, audience: Users, notify: Bell,
};
// Actions surfaced as tiles by default; the rest reveal behind "Show all actions".
const PRIMARY_ACTIONS = ["send_sms", "send_email", "add_to_campaign", "send_review", "create_task", "notify_team", "add_tag"];

// ── Trigger + action catalogs for the searchable pickers ──
const TRIGGER_GROUPS: CatalogGroup[] = (Object.keys(TRIGGER_OBJECTS) as TriggerObject[])
  .map(obj => ({
    key: obj, label: TRIGGER_OBJECTS[obj].label, icon: TRIGGER_OBJECTS[obj].icon, color: TRIGGER_OBJECTS[obj].color,
    items: TRIGGERS.filter(t => t.object === obj).map(t => ({ value: t.key, label: t.label })),
  }))
  .filter(g => g.items.length > 0);

export default function AutomationBuilder({
  initial, onDone, onCancel,
}: {
  initial: MarketingAutomation;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<MarketingAutomation>(initial);
  const [showAllActions, setShowAllActions] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const patch = (p: Partial<MarketingAutomation>) => setDraft(d => ({ ...d, ...p }));

  // New (never-saved) vs editing an existing automation, and whether anything
  // changed since open — drives the primary button's label + enabled state.
  const [isNew] = useState(() => !getAutomationById(initial.id));
  const initialJson = useRef(JSON.stringify(initial));
  const dirty = JSON.stringify(draft) !== initialJson.current;

  const trigger = getTrigger(draft.triggerKey);
  const action = getAction(draft.actionKey);
  const canActivate = Boolean(draft.name.trim() && draft.triggerKey && draft.actionKey);
  // Already-active automations "Save changes"; everything else "Activate".
  const primaryLabel = !isNew && draft.status === "active" ? "Save changes" : "Activate";
  // New automations activate once valid; edits require an actual change.
  const canPrimary = canActivate && (isNew || dirty);
  const canDraft = Boolean(draft.name.trim()) && (isNew || dirty);

  // ── Conditions ──
  function addCondition() {
    const f = CONDITION_FIELDS[0];
    const row: ConditionRow = { id: `c-${Date.now()}`, field: f.key, op: opsForField(f)[0], value: f.options?.[0]?.value ?? "" };
    patch({ conditions: [...draft.conditions, row] });
  }
  function updateCondition(id: string, p: Partial<ConditionRow>) {
    patch({ conditions: draft.conditions.map(c => c.id === id ? { ...c, ...p } : c) });
  }
  function removeCondition(id: string) { patch({ conditions: draft.conditions.filter(c => c.id !== id) }); }

  // ── Safety ──
  function toggleSafety(key: string) {
    patch({ safety: draft.safety.includes(key) ? draft.safety.filter(k => k !== key) : [...draft.safety, key] });
  }

  function save(status: MarketingAutomation["status"]) {
    saveAutomation({ ...draft, name: draft.name.trim() || "Untitled automation", status });
    onDone();
  }

  // ── Action value options ──
  const actionValueOptions = (() => {
    if (!action?.value) return null;
    switch (action.value.kind) {
      case "template": return getTemplates().map(t => ({ value: t.name, label: t.name }));
      case "campaign": return getCampaigns().map(c => ({ value: c.name, label: c.name }));
      case "audience": return AUDIENCES.map(a => ({ value: a.name, label: a.name }));
      case "tag":      return (getConditionField("tags")?.options ?? []);
      default:         return null; // text / user / none → free input
    }
  })();

  const sc = STATUS_CONFIG[draft.status];
  const subtitle = draft.triggerKey && draft.actionKey
    ? `${triggerSummary(draft)} → ${actionSummary(draft)}`
    : "Compose a marketing automation from your CRM data.";
  const timingLabel = TIMING_KINDS.find(t => t.value === draft.timing.kind)?.label ?? "Immediately";
  const tileActions = ACTIONS.filter(a => showAllActions || PRIMARY_ACTIONS.includes(a.key) || a.key === draft.actionKey);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80" style={{ color: ACCENT }}>
        <ArrowLeft className="w-4 h-4" /> Back to automations
      </button>

      {/* Title row */}
      <div className="mt-4 flex items-start gap-4 justify-between flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 shrink-0" style={{ color: draft.name.trim() ? "var(--text-muted)" : ACCENT }} />
            <input value={draft.name} onChange={e => patch({ name: e.target.value })}
              autoFocus={isNew}
              placeholder="Name this automation"
              className="flex-1 min-w-0 bg-transparent text-2xl font-bold outline-none" style={{ color: "var(--text-primary)" }} />
          </div>
          <p className="text-sm mt-1 truncate" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: sc.bg, color: sc.color, border: "1px solid var(--border)" }}>{sc.label}</span>
        </div>
      </div>

      {/* Split: build rail (left) + sticky live summary (right) */}
      <div className="mt-8 grid lg:grid-cols-[1fr_330px] gap-6 lg:gap-10 items-start">
        <div>
          {/* When */}
          <RailStep eyebrow="When" title="Trigger" desc="The CRM event that starts this automation." icon={Zap}>
            <CatalogPicker groups={TRIGGER_GROUPS} value={draft.triggerKey} onChange={k => patch({ triggerKey: k, triggerParam: getTrigger(k)?.param?.default })} placeholder="Choose a trigger…" />
            {trigger?.param && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{trigger.param.label}:</span>
                <NumberStepper size="sm" min={1} className="w-24" value={String(draft.triggerParam ?? trigger.param.default)} onChange={v => patch({ triggerParam: Number(v) })} />
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>{trigger.param.kind}</span>
              </div>
            )}
          </RailStep>

          {/* If */}
          <RailStep eyebrow="If" title="Conditions" desc="Optional filters — leave empty to apply to everyone." icon={SlidersHorizontal} optional>
            {draft.conditions.length > 0 && (
              <div className="space-y-2 mb-2">
                {draft.conditions.map((c, i) => {
                  const f = getConditionField(c.field);
                  return (
                    <div key={c.id} className="flex items-center gap-2 flex-wrap rounded-xl pl-2.5 pr-1.5 py-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
                      <span className="text-[11px] font-semibold shrink-0" style={{ color: "var(--text-muted)" }}>{i === 0 ? "Where" : "and"}</span>
                      <div className="flex-1 min-w-[130px]">
                        <Select size="sm" value={c.field} options={CONDITION_FIELDS.map(x => ({ value: x.key, label: x.label }))}
                          onChange={v => { const nf = getConditionField(v)!; updateCondition(c.id, { field: v, op: opsForField(nf)[0], value: nf.options?.[0]?.value ?? "" }); }} />
                      </div>
                      <div className="w-28 shrink-0">
                        <Select size="sm" value={c.op} options={(f ? opsForField(f) : []).map(o => ({ value: o, label: OP_LABEL[o] }))} onChange={v => updateCondition(c.id, { op: v as ConditionOp })} />
                      </div>
                      {f && f.type !== "boolean" && (
                        <div className="w-32 shrink-0">
                          {f.options ? (
                            <Select size="sm" value={c.value} options={f.options} onChange={v => updateCondition(c.id, { value: v })} />
                          ) : (
                            <NumberStepper size="sm" value={c.value} placeholder="0" prefix={f.unit === "$" ? "$" : undefined} suffix={f.unit && f.unit !== "$" ? f.unit : undefined} onChange={v => updateCondition(c.id, { value: v })} />
                          )}
                        </div>
                      )}
                      <button onClick={() => removeCondition(c.id)} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)] shrink-0 ml-auto" title="Remove">
                        <X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={addCondition} className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1px dashed var(--border)", color: ACCENT }}>
              <Plus className="w-3.5 h-3.5" /> Add condition
            </button>
          </RailStep>

          {/* Then */}
          <RailStep eyebrow="Then" title="Action" desc="What happens — focused on marketing & follow-up." icon={Sparkles}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {tileActions.map(a => (
                <ActionTile key={a.key} def={a} selected={a.key === draft.actionKey} onClick={() => patch({ actionKey: a.key, actionValue: "" })} />
              ))}
            </div>
            {!showAllActions && (
              <button onClick={() => setShowAllActions(true)} className="text-xs font-medium mt-2 transition-colors hover:opacity-80" style={{ color: "var(--text-muted)" }}>
                Show all actions →
              </button>
            )}
            {action?.value && action.value.kind !== "none" && (
              <div className="mt-3">
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{action.value.label}</label>
                {actionValueOptions ? (
                  <Select value={draft.actionValue ?? ""} options={actionValueOptions} onChange={v => patch({ actionValue: v })} placeholder={`Select ${action.value.label.toLowerCase()}…`} />
                ) : (
                  <input value={draft.actionValue ?? ""} onChange={e => patch({ actionValue: e.target.value })}
                    placeholder={action.value.kind === "user" ? "e.g. Sarah (Dispatcher)" : "Type a value…"}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                )}
              </div>
            )}
          </RailStep>

          {/* Timing */}
          <RailStep eyebrow="With" title="Timing" desc="When the action fires." icon={Clock}>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-52">
                <Select size="sm" value={draft.timing.kind} options={TIMING_KINDS.map(t => ({ value: t.value, label: t.label }))}
                  onChange={v => patch({ timing: { ...draft.timing, kind: v as MarketingAutomation["timing"]["kind"] } })} />
              </div>
              {(draft.timing.kind === "after" || draft.timing.kind === "before_due" || draft.timing.kind === "after_due" || draft.timing.kind === "wait_no_reply") && (
                <>
                  <NumberStepper size="sm" min={1} className="w-24" value={String(draft.timing.amount ?? 1)} onChange={v => patch({ timing: { ...draft.timing, amount: Number(v) } })} />
                  <div className="w-28">
                    <Select size="sm" value={draft.timing.unit ?? "days"} options={[{ value: "minutes", label: "minutes" }, { value: "hours", label: "hours" }, { value: "days", label: "days" }]}
                      onChange={v => patch({ timing: { ...draft.timing, unit: v as "minutes" | "hours" | "days" } })} />
                  </div>
                </>
              )}
              {draft.timing.kind === "on_date" && (
                <input type="date" value={draft.timing.date ?? ""} onChange={e => patch({ timing: { ...draft.timing, date: e.target.value } })}
                  className="rounded-lg px-2.5 py-1.5 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
              )}
            </div>
            <div className="mt-2">
              <ToggleRow label="During business hours only" checked={!!draft.timing.businessHoursOnly} onChange={v => patch({ timing: { ...draft.timing, businessHoursOnly: v } })} icon={Clock} />
            </div>
          </RailStep>

          {/* Stop if */}
          <RailStep eyebrow="Stop if" title="Safeguards" desc="Guardrails so the automation never over-sends." icon={ShieldAlert} last>
            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-0.5">
              {SAFETY_RULES.map(r => {
                const on = draft.safety.includes(r.key);
                return (
                  <div key={r.key}>
                    <ToggleRow label={r.label} checked={on} onChange={() => toggleSafety(r.key)} />
                    {on && r.param && (
                      <div className="flex items-center gap-2 ml-12 mb-1">
                        <NumberStepper size="sm" min={1} className="w-20" value={String(draft.dedupeDays ?? r.param.default)} onChange={v => patch({ dedupeDays: Number(v) })} />
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{r.param.label.toLowerCase()}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </RailStep>
        </div>

        {/* Sticky live summary */}
        <aside className="lg:sticky lg:top-6">
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
            <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
              <ScrollText className="w-4 h-4" style={{ color: ACCENT }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Live summary</span>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{summarize(draft)}</p>
            </div>
            <div className="px-5 pb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Required to activate</p>
              <div className="space-y-1.5">
                <Req label="Name" ok={!!draft.name.trim()} />
                <Req label="Trigger" ok={!!draft.triggerKey} />
                <Req label="Action" ok={!!draft.actionKey} />
              </div>
            </div>
            <div className="px-5 py-3 grid grid-cols-3 gap-2 text-center" style={{ borderTop: "1px solid var(--border)" }}>
              <Mini label="Conditions" value={String(draft.conditions.length)} />
              <Mini label="Timing" value={timingLabel} />
              <Mini label="Safeguards" value={String(draft.safety.length)} />
            </div>
            <div className="px-5 py-4 flex items-center gap-2" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => save("active")} disabled={!canPrimary}
                className="flex-1 text-sm font-medium text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-40" style={{ backgroundColor: ACCENT }}>
                {primaryLabel}
              </button>
              <div className="relative">
                <button onClick={() => setActionsOpen(o => !o)} title="More options" aria-haspopup="menu" aria-expanded={actionsOpen}
                  className="group flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ border: `1px solid ${actionsOpen ? ACCENT : "var(--border)"}`, color: ACCENT }}>
                  <MoreActionsGlyph open={actionsOpen} />
                </button>
                {actionsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setActionsOpen(false)} />
                    <div role="menu" className="absolute right-0 bottom-full mb-1.5 w-48 rounded-xl overflow-hidden z-50 py-1"
                      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                      <ActionMenuItem icon={FileText} label="Save as draft" disabled={!canDraft} onClick={() => { setActionsOpen(false); save("draft"); }} />
                      <ActionMenuItem icon={Undo2} label="Discard changes" onClick={() => { setActionsOpen(false); onCancel(); }} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Building blocks ──
function RailStep({ eyebrow, title, desc, icon: Icon, optional, last, children }: {
  eyebrow: string; title: string; desc?: string; icon: typeof Clock; optional?: boolean; last?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      {/* Rail node + connector */}
      <div className="flex flex-col items-center shrink-0">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <Icon className="w-4 h-4" style={{ color: ACCENT }} />
        </span>
        {!last && <span className="w-px flex-1 my-2" style={{ backgroundColor: "var(--border)" }} />}
      </div>
      <div className={`flex-1 min-w-0 ${last ? "pb-1" : "pb-8"}`}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: ACCENT }}>{eyebrow}</span>
          {optional && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>Optional</span>}
        </div>
        <h3 className="text-[15px] font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{title}</h3>
        {desc && <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--text-muted)" }}>{desc}</p>}
        {children}
      </div>
    </div>
  );
}

function ActionTile({ def, selected, onClick }: { def: (typeof ACTIONS)[number]; selected: boolean; onClick: () => void }) {
  const g = ACTION_GROUPS[def.group];
  const Icon = ACTION_GROUP_ICON[def.group];
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all"
      style={{ border: `1px solid ${selected ? ACCENT : "var(--border)"}`, backgroundColor: selected ? ACCENT + "0d" : "var(--bg-surface)", boxShadow: selected ? `0 0 0 3px ${ACCENT}1f` : "none" }}>
      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: g.color + "1a" }}>
        <Icon className="w-4 h-4" style={{ color: g.color }} />
      </span>
      <span className="text-[13px] font-medium leading-tight" style={{ color: "var(--text-primary)" }}>{def.label}</span>
    </button>
  );
}

function Req({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: ok ? "#10b98122" : "var(--bg-surface-2)" }}>
        {ok ? <Check className="w-3 h-3" style={{ color: "#10b981" }} /> : <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--text-muted)" }} />}
      </span>
      <span style={{ color: ok ? "var(--text-secondary)" : "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, icon: Icon }: { label: string; checked: boolean; onChange: (v: boolean) => void; icon?: typeof Clock }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="w-full flex items-center gap-2.5 py-1.5 text-left">
      <span className="w-9 h-5 rounded-full relative shrink-0 transition-colors" style={{ backgroundColor: checked ? ACCENT : "var(--bg-input)" }}>
        <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: checked ? "18px" : "2px" }} />
      </span>
      <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />}
        {label}
      </span>
    </button>
  );
}

function ActionMenuItem({ icon: Icon, label, onClick, disabled }: { icon: typeof FileText; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ color: "var(--text-secondary)" }}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
