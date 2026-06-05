"use client";

import { useState } from "react";
import {
  Database, Filter, Sigma, BarChart3, Globe, Lock, Send,
  Plus, Trash2, ArrowLeft, Save,
} from "lucide-react";
import WidgetPreview from "./WidgetPreview";
import {
  DATA_SOURCE_LABELS, CALC_LABELS, VIZ_LABELS, CONTEXT_LABELS, ROLE_LABELS,
  SOURCE_FIELDS, SOURCES_WITH_DATA,
} from "@/lib/dashboard/custom-widgets/registry";
import { newWidgetId } from "@/lib/dashboard/custom-widgets/store";
import UiSelect from "@/components/ui/Select";
import type {
  CustomWidget, DataSourceKey, CalculationType, VisualizationType,
  ContextBehavior, WidgetRole, WidgetFilter, FilterOperator,
} from "@/lib/dashboard/custom-widgets/types";

const DATA_SOURCES = Object.keys(DATA_SOURCE_LABELS) as DataSourceKey[];
const CALC_TYPES   = Object.keys(CALC_LABELS) as CalculationType[];
const VIZ_TYPES    = Object.keys(VIZ_LABELS) as VisualizationType[];
const CONTEXTS     = Object.keys(CONTEXT_LABELS) as ContextBehavior[];
const ROLES        = Object.keys(ROLE_LABELS) as WidgetRole[];

const OPERATORS: { key: FilterOperator; label: string }[] = [
  { key: "is", label: "is" }, { key: "is_not", label: "is not" },
  { key: "contains", label: "contains" }, { key: "gt", label: ">" }, { key: "lt", label: "<" },
];

// Calc types that need a field selector
const FIELD_CALCS: CalculationType[] = ["sum", "average", "group_by", "trend"];

// ─── Step wrapper ─────────────────────────────────────────
function Step({ n, icon: Icon, title, desc, children }: {
  n: number; icon: typeof Database; title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-4"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: "#4f46e5", color: "#fff" }}>{n}</div>
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#4f46e5" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
        </div>
      </div>
      <p className="text-xs mb-3 -mt-1.5 ml-8" style={{ color: "var(--text-muted)" }}>{desc}</p>
      <div className="ml-8">{children}</div>
    </div>
  );
}

// Pill toggle button — glossy "tab" style (see .glossy-pill in globals.css)
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} data-active={active}
      className="glossy-pill text-xs font-medium px-2.5 py-1.5">
      {children}
    </button>
  );
}

// ─── Builder ──────────────────────────────────────────────
export default function CustomWidgetBuilder({
  initial, onSave, onCancel,
}: {
  initial: CustomWidget;
  onSave: (widget: CustomWidget, publish: boolean) => void;
  onCancel: () => void;
}) {
  const [w, setW] = useState<CustomWidget>(initial);

  function patch(p: Partial<CustomWidget>) { setW(prev => ({ ...prev, ...p })); }

  const fields = SOURCE_FIELDS[w.dataSource] ?? [];
  const numericFields = fields.filter(f => f.type === "number");
  const hasData = SOURCES_WITH_DATA.includes(w.dataSource);

  // When switching source, drop filters/calc field that no longer exist
  function changeSource(src: DataSourceKey) {
    patch({ dataSource: src, filters: [], calculation: { ...w.calculation, field: undefined } });
  }

  function addFilter() {
    const f: WidgetFilter = { id: `f-${Date.now()}`, field: fields[0]?.key ?? "", operator: "is", value: "" };
    patch({ filters: [...w.filters, f] });
  }
  function updateFilter(id: string, p: Partial<WidgetFilter>) {
    patch({ filters: w.filters.map(f => f.id === id ? { ...f, ...p } : f) });
  }
  function removeFilter(id: string) {
    patch({ filters: w.filters.filter(f => f.id !== id) });
  }

  function toggleRole(role: WidgetRole) {
    patch({ visibility: w.visibility.includes(role)
      ? w.visibility.filter(r => r !== role)
      : [...w.visibility, role] });
  }

  const calcNeedsField = FIELD_CALCS.includes(w.calculation.type);
  const fieldOptions = (w.calculation.type === "sum" || w.calculation.type === "average")
    ? numericFields : fields;
  const canSave = w.name.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onCancel}
          className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Custom Widgets
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => onSave({ ...w, status: "draft" }, false)} disabled={!canSave}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-40"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <Save className="w-3.5 h-3.5" /> Save Draft
          </button>
          <button onClick={() => onSave({ ...w, status: "published" }, true)} disabled={!canSave}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: "#4f46e5" }}>
            <Send className="w-3.5 h-3.5" /> Publish
          </button>
        </div>
      </div>

      {/* Two-column: config + live preview */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 340px" }}>
        {/* Config column */}
        <div className="space-y-4">
          {/* Name + description */}
          <div className="rounded-xl p-4 space-y-3"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Widget Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input value={w.name} onChange={e => patch({ name: e.target.value })}
                placeholder="e.g. Revenue This Month"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Description</label>
              <input value={w.description} onChange={e => patch({ description: e.target.value })}
                placeholder="What this widget shows"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
            </div>
          </div>

          {/* 1. Data source */}
          <Step n={1} icon={Database} title="Data Source" desc="Pick the records this widget reports on.">
            <div className="flex flex-wrap gap-1.5">
              {DATA_SOURCES.map(src => (
                <Pill key={src} active={w.dataSource === src} onClick={() => changeSource(src)}>
                  {DATA_SOURCE_LABELS[src]}{!SOURCES_WITH_DATA.includes(src) && " ·"}
                </Pill>
              ))}
            </div>
            {!hasData && (
              <p className="text-[11px] mt-2" style={{ color: "#d97706" }}>
                Sample data for this source isn&apos;t wired yet — the preview will be empty until Supabase is connected.
              </p>
            )}
          </Step>

          {/* 2. Filters */}
          <Step n={2} icon={Filter} title="Filters" desc="Narrow the data. All filters must match (AND).">
            {w.filters.length === 0 && (
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>No filters — includes all records.</p>
            )}
            <div className="space-y-2">
              {w.filters.map(f => {
                const fieldDef = fields.find(fd => fd.key === f.field);
                return (
                  <div key={f.id} className="flex items-center gap-2">
                    <UiSelect value={f.field} onChange={v => updateFilter(f.id, { field: v })} size="sm" className="w-36"
                      options={fields.map(fd => ({ value: fd.key, label: fd.label }))} />
                    <UiSelect value={f.operator} onChange={v => updateFilter(f.id, { operator: v as FilterOperator })} size="sm" className="w-28"
                      options={OPERATORS.map(o => ({ value: o.key, label: o.label }))} />
                    {fieldDef?.type === "enum" && fieldDef.options ? (
                      <UiSelect value={f.value} onChange={v => updateFilter(f.id, { value: v })} size="sm" className="flex-1"
                        placeholder="Select…"
                        options={fieldDef.options.map(o => ({ value: o, label: o }))} />
                    ) : (
                      <input value={f.value} onChange={e => updateFilter(f.id, { value: e.target.value })}
                        placeholder="value"
                        className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
                        style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                    )}
                    <button onClick={() => removeFilter(f.id)} className="p-1.5 rounded-lg shrink-0"
                      style={{ color: "var(--text-muted)" }} title="Remove filter">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button onClick={addFilter}
              className="flex items-center gap-1 mt-2 text-xs font-medium" style={{ color: "#4f46e5" }}>
              <Plus className="w-3 h-3" /> Add filter
            </button>
          </Step>

          {/* 3. Calculation */}
          <Step n={3} icon={Sigma} title="Calculation" desc="How the data is summarized.">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {CALC_TYPES.map(c => (
                <Pill key={c} active={w.calculation.type === c}
                  onClick={() => patch({ calculation: { type: c, field: FIELD_CALCS.includes(c) ? w.calculation.field : undefined } })}>
                  {CALC_LABELS[c]}
                </Pill>
              ))}
            </div>
            {calcNeedsField && (
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                  {w.calculation.type === "sum" || w.calculation.type === "average" ? "Numeric field" : "Group by field"}
                </label>
                <UiSelect value={w.calculation.field ?? ""}
                  onChange={v => patch({ calculation: { ...w.calculation, field: v || undefined } })}
                  size="sm" className="w-56" placeholder="Select field…"
                  options={fieldOptions.map(f => ({ value: f.key, label: f.label }))} />
                {(w.calculation.type === "sum" || w.calculation.type === "average") && numericFields.length === 0 && (
                  <p className="text-[11px] mt-1" style={{ color: "#d97706" }}>This source has no numeric fields.</p>
                )}
              </div>
            )}
          </Step>

          {/* 4. Visualization */}
          <Step n={4} icon={BarChart3} title="Visualization" desc="How the result is displayed.">
            <div className="flex flex-wrap gap-1.5">
              {VIZ_TYPES.map(v => (
                <Pill key={v} active={w.visualization === v} onClick={() => patch({ visualization: v })}>
                  {VIZ_LABELS[v]}
                </Pill>
              ))}
            </div>
          </Step>

          {/* 5. Context */}
          <Step n={5} icon={Globe} title="Context Behavior" desc="Which data scope the widget reads from.">
            <div className="flex flex-wrap gap-1.5">
              {CONTEXTS.map(c => (
                <Pill key={c} active={w.context === c} onClick={() => patch({ context: c })}>
                  {CONTEXT_LABELS[c]}
                </Pill>
              ))}
            </div>
          </Step>

          {/* 6. Visibility */}
          <Step n={6} icon={Lock} title="Visibility" desc="Which roles can see this widget.">
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map(r => (
                <Pill key={r} active={w.visibility.includes(r)} onClick={() => toggleRole(r)}>
                  {ROLE_LABELS[r]}
                </Pill>
              ))}
            </div>
            {w.visibility.length === 0 && (
              <p className="text-[11px] mt-2" style={{ color: "#d97706" }}>Select at least one role, or the widget won&apos;t be visible to anyone.</p>
            )}
          </Step>
        </div>

        {/* Live preview column (sticky) */}
        <div className="space-y-3">
          <div className="sticky top-2 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Live Preview
            </p>
            <WidgetPreview widget={w} />
            <div className="rounded-xl p-3 text-[11px] leading-relaxed"
              style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
              Preview computes against your current sample data. Save as Draft to keep working,
              or Publish to add it to the Widget Library.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { newWidgetId };
