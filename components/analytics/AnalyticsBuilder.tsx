"use client";

// ─── Analytics Composer ───────────────────────────────────
// Guided report builder in the same modern idiom as the Marketing Automation
// Builder: a connected build rail on the left (Show me → from → over → filters →
// grouped by → shown as → save to) and a sticky live panel on the right that
// previews the chart, narrates it in plain English, warns, and validates.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown, Plus, X, Check, AlertTriangle, Info, Sparkles, PencilLine, Save,
  Hash, Database, CalendarRange, SlidersHorizontal, Layers, BarChart3,
} from "lucide-react";
import {
  DATA_SOURCES, METRICS, VIZ_TYPES, GROUPINGS, DATE_RANGES, FILTER_DEFS,
  sourceById, metricById, vizById,
} from "@/lib/analytics/catalog";
import { runReport, summarize } from "@/lib/analytics/engine";
import { saveReport } from "@/lib/analytics/store";
import type { ReportConfig, Grouping, VizType } from "@/lib/analytics/types";
import ChartView from "./ChartView";

const ACCENT = "#0f8578";

export default function AnalyticsBuilder({ initial, onSaved }: { initial: ReportConfig; onSaved?: (cfg: ReportConfig) => void }) {
  const [cfg, setCfg] = useState<ReportConfig>(initial);
  const [saved, setSaved] = useState(false);

  const source = sourceById(cfg.source)!;
  const metric = metricById(cfg.metric);
  const viz = vizById(cfg.viz);
  const result = useMemo(() => runReport(cfg), [cfg]);

  const update = (patch: Partial<ReportConfig>) => { setSaved(false); setCfg(c => ({ ...c, ...patch })); };

  function changeSource(id: string) {
    const s = sourceById(id)!;
    const metricOk = s.metrics.includes(cfg.metric) ? cfg.metric : s.metrics[0];
    const groupOk = cfg.groupBy === "none" || s.groupings.includes(cfg.groupBy) ? cfg.groupBy : s.groupings[0];
    update({ source: id, app: s.app, metric: metricOk, groupBy: groupOk, filters: cfg.filters.filter(f => s.filters.includes(f.field)) });
  }

  const metricOpts = source.metrics.map(id => ({ value: id, label: METRICS[id].label }));
  const sourceOpts = DATA_SOURCES.map(s => ({ value: s.id, label: s.label, icon: s.icon }));
  const groupOpts = [{ value: "none", label: GROUPINGS.none.label }, ...source.groupings.map(g => ({ value: g, label: GROUPINGS[g].label }))];
  const dateOpts = DATE_RANGES.map(d => ({ value: d.key, label: d.label }));
  const availFilters = source.filters.filter(f => !cfg.filters.some(cf => cf.field === f));
  const dateLabel = DATE_RANGES.find(d => d.key === cfg.dateRange)?.label ?? "";

  const errors = result.warnings.filter(w => w.level === "error");
  const canSave = cfg.name.trim().length > 0 && errors.length === 0;
  const checklist = [
    { ok: cfg.name.trim().length > 0, label: "Report has a name" },
    { ok: true, label: `Measuring ${metric?.label.toLowerCase()}` },
    { ok: errors.length === 0, label: "No blocking data issues" },
  ];

  function save() { if (!canSave) return; const out = saveReport(cfg); setSaved(true); onSaved?.(out); }

  return (
    <div>
      {/* Title */}
      <div className="flex items-center gap-2.5 mb-7">
        <PencilLine className="w-6 h-6 shrink-0" style={{ color: cfg.name.trim() ? "var(--text-muted)" : ACCENT }} />
        <input autoFocus={!cfg.name} value={cfg.name} onChange={e => update({ name: e.target.value })} placeholder="Name this widget"
          className="flex-1 min-w-0 bg-transparent text-2xl font-bold outline-none" style={{ color: "var(--text-primary)" }} />
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 lg:gap-10 items-start">
        {/* ── Build rail ── */}
        <div>
          <RailStep eyebrow="Analyze" title="Data source" desc="What you want to report on." icon={Database}>
            <SelectMenu value={cfg.source} options={sourceOpts} onChange={changeSource} big />
          </RailStep>

          <RailStep eyebrow="Show me" title="Metric" desc="The number to measure from this source." icon={Hash}>
            <SelectMenu value={cfg.metric} options={metricOpts} onChange={v => update({ metric: v })} big />
          </RailStep>

          <RailStep eyebrow="over" title="Date range" desc="The time window to measure." icon={CalendarRange}>
            <SelectMenu value={cfg.dateRange} options={dateOpts} onChange={v => update({ dateRange: v as ReportConfig["dateRange"] })} big />
          </RailStep>

          <RailStep eyebrow="Filtered by" title="Conditions" desc="Optional — leave empty to count everything." icon={SlidersHorizontal} optional>
            {cfg.filters.length > 0 && (
              <div className="space-y-2 mb-2">
                {cfg.filters.map((f, i) => {
                  const def = FILTER_DEFS[f.field];
                  return (
                    <div key={f.id} className="flex items-center gap-2 rounded-xl pl-3 pr-1.5 py-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
                      <span className="text-[11px] font-semibold shrink-0" style={{ color: "var(--text-muted)" }}>{i === 0 ? "Where" : "and"}</span>
                      <span className="text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>{def?.label ?? f.field}</span>
                      <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>is</span>
                      <div className="flex-1 min-w-0"><SelectMenu value={f.value} options={def?.options ?? []} onChange={v => update({ filters: cfg.filters.map(x => x.id === f.id ? { ...x, value: v } : x) })} /></div>
                      <button onClick={() => update({ filters: cfg.filters.filter(x => x.id !== f.id) })} className="p-1.5 rounded-lg shrink-0 transition-colors hover:bg-[var(--bg-surface-2)]"><X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></button>
                    </div>
                  );
                })}
              </div>
            )}
            {availFilters.length > 0
              ? <AddFilter fields={availFilters} onAdd={field => update({ filters: [...cfg.filters, { id: `f-${Date.now()}`, field, value: FILTER_DEFS[field]?.options[0]?.value ?? "" }] })} />
              : cfg.filters.length === 0 ? <p className="text-xs" style={{ color: "var(--text-muted)" }}>No conditions added.</p> : null}
          </RailStep>

          <RailStep eyebrow="grouped by" title="Dimension" desc="Split the metric across a dimension or time period." icon={Layers}>
            <SelectMenu value={cfg.groupBy} options={groupOpts} onChange={v => update({ groupBy: v as Grouping })} big />
          </RailStep>

          <RailStep eyebrow="shown as" title="Visualization" desc="How to display it." icon={BarChart3} last>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VIZ_TYPES.map(v => {
                const on = cfg.viz === v.id;
                return (
                  <button key={v.id} onClick={() => update({ viz: v.id as VizType })} className="flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all"
                    style={{ border: `1px solid ${on ? ACCENT : "var(--border)"}`, backgroundColor: on ? ACCENT + "0d" : "var(--bg-surface)", boxShadow: on ? `0 0 0 3px ${ACCENT}1f` : "none" }}>
                    <v.icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: on ? ACCENT : "var(--text-secondary)" }} />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{v.label}</span>
                      <span className="block text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>{v.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </RailStep>
        </div>

        {/* ── Sticky live panel ── */}
        <aside className="lg:sticky lg:top-4">
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${ACCENT}33`, backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)", backgroundColor: ACCENT + "0d" }}>
              <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Live preview</span>
              <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>{viz.label}</span>
            </div>

            <div className="px-5 pt-4">
              <p className="text-sm font-semibold mb-3 truncate" style={{ color: "var(--text-primary)" }}>{cfg.name || "Untitled widget"}</p>
              <div style={{ height: 190 }}><ChartView result={result} viz={cfg.viz} metricLabel={metric?.label ?? ""} /></div>
            </div>

            <div className="px-5 py-4">
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{summarize(cfg, dateLabel, source.label, metric?.label ?? "")}</p>
            </div>

            {result.warnings.length > 0 && (
              <div className="px-5 pb-3 space-y-1.5">
                {result.warnings.map((w, i) => {
                  const c = w.level === "error" ? "#dc2626" : w.level === "warn" ? "#f59e0b" : "#2563eb";
                  const Icon = w.level === "info" ? Info : AlertTriangle;
                  return <div key={i} className="flex items-start gap-2"><Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: c }} /><span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{w.text}</span></div>;
                })}
              </div>
            )}

            <div className="px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Checklist</p>
              <div className="space-y-1.5">
                {checklist.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: c.ok ? "#16a34a22" : "var(--bg-surface-2)" }}>
                      {c.ok ? <Check className="w-3 h-3" style={{ color: "#16a34a" }} /> : <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--text-muted)" }} />}
                    </span>
                    <span style={{ color: c.ok ? "var(--text-secondary)" : "var(--text-muted)" }}>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-3 grid grid-cols-3 gap-2 text-center" style={{ borderTop: "1px solid var(--border)" }}>
              <Mini label="Group by" value={GROUPINGS[cfg.groupBy].label.split(" ")[0]} />
              <Mini label="Filters" value={String(cfg.filters.length)} />
              <Mini label="Range" value={dateLabel} />
            </div>

            <div className="px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={save} disabled={!canSave} className="w-full min-h-[44px] rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-opacity"
                style={{ backgroundColor: ACCENT, color: "#fff", opacity: canSave ? 1 : 0.45 }}>
                {saved ? <><Check className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save widget</>}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Building blocks ──
function RailStep({ eyebrow, title, desc, icon: Icon, optional, last, children }: {
  eyebrow: string; title: string; desc?: string; icon: React.ElementType; optional?: boolean; last?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

function SelectMenu({ value, options, onChange, placeholder, big }: { value: string; options: { value: string; label: string; icon?: React.ElementType }[]; onChange: (v: string) => void; placeholder?: string; big?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const cur = options.find(o => o.value === value);
  const Icon = cur?.icon;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className={`w-full flex items-center gap-2 rounded-xl px-3 ${big ? "py-2.5" : "py-2"} text-left transition-colors`}
        style={{ border: `1px solid ${open ? ACCENT : "var(--border)"}`, backgroundColor: "var(--bg-surface)" }}>
        {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />}
        <span className={`flex-1 truncate ${big ? "text-base font-semibold" : "text-sm"}`} style={{ color: cur ? "var(--text-primary)" : "var(--text-muted)" }}>{cur?.label ?? placeholder ?? "Select…"}</span>
        <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl p-1.5 max-h-72 overflow-y-auto thin-scroll-y" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
          {options.map(o => {
            const on = o.value === value; const OIcon = o.icon;
            return (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors"
                style={{ backgroundColor: on ? ACCENT + "14" : "transparent", color: on ? ACCENT : "var(--text-primary)" }}>
                {OIcon && <OIcon className="w-4 h-4 shrink-0" style={{ color: on ? ACCENT : "var(--text-muted)" }} />}
                <span className="flex-1 text-sm truncate">{o.label}</span>
                {on && <Check className="w-4 h-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddFilter({ fields, onAdd }: { fields: string[]; onAdd: (field: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1px dashed var(--border)", color: ACCENT }}>
        <Plus className="w-3.5 h-3.5" /> Add condition
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 rounded-xl p-1.5 w-52" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
          {fields.map(f => (
            <button key={f} onClick={() => { onAdd(f); setOpen(false); }} className="w-full text-left px-2.5 py-2 rounded-lg text-sm" style={{ color: "var(--text-primary)" }}>{FILTER_DEFS[f]?.label ?? f}</button>
          ))}
        </div>
      )}
    </div>
  );
}
