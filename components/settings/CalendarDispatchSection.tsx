"use client";

import { useState, useEffect } from "react";
import {
  Plus, Pencil, Trash2, Check, RotateCcw, ChevronUp, ChevronDown,
  Star, CalendarDays, Clock, LayoutGrid, Users, Layers, Building2, MapPin, Inbox,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import {
  getStore, saveStore, resetStore, scopeKeyOf, resolveFromStore, resolveParent,
  defaultDispatchSettings, formatHour, newBlockId, newBoardId,
  MOCK_DISPATCHERS, MOCK_TECHS, MOCK_JOB_TYPES, BOARD_TYPE_LABELS, LAYER_LABEL,
  type DispatchStore, type ScopedDispatchConfig, type DispatchSettings,
  type SettingsServiceBlock, type DispatchBoard, type BoardType,
  type ScopeLevel, type DispatchSection,
  type CalendarViewMode, type HourIncrement, type HourLabelStyle,
} from "@/lib/calendar/settings";
import {
  SOURCE_TYPE_LABELS, newQueueViewId,
  type QueueView, type QueueFilters, type QueueSourceType,
} from "@/lib/calendar/queueViews";
import type { DispatchMode, ItemPriority } from "@/lib/calendar/types";
import { companies, locations, serviceAreas } from "@/lib/hierarchy/data";

const PRIORITY_OPTIONS: ItemPriority[] = ["urgent", "high", "normal", "low"];
const DUE_OPTIONS = [
  { value: "any", label: "Any time" },
  { value: "0", label: "Due today" },
  { value: "7", label: "Due this week" },
  { value: "30", label: "Due this month" },
];

const LAYER_SWATCHES = ["#4f46e5", "#0891b2", "#059669", "#f59e0b", "#7c3aed"];
type SectionTab = "defaults" | "blocks" | "boards" | "layers" | "queue";
const TABS: { key: SectionTab; label: string; icon: typeof Clock }[] = [
  { key: "defaults", label: "Defaults",       icon: CalendarDays },
  { key: "blocks",   label: "Service Blocks",  icon: LayoutGrid },
  { key: "boards",   label: "Dispatch Boards", icon: Users },
  { key: "queue",    label: "Queue Views",     icon: Inbox },
  { key: "layers",   label: "Calendar Layers", icon: Layers },
];

// ─── Primitives ───────────────────────────────────────────
function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!on)} role="switch" aria-checked={on} disabled={disabled}
      className="relative w-8 h-4 rounded-full transition-colors shrink-0 disabled:opacity-50"
      style={{ backgroundColor: on ? "#4f46e5" : "var(--bg-input)", border: "1px solid var(--border)" }}>
      <span className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}

function SettingsCard({ icon: Icon, title, subtitle, children, action }: {
  icon: typeof Clock; title: string; subtitle: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-surface-2)" }}>
            <Icon className="w-4 h-4" style={{ color: "#4f46e5" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{children}</label>;
}

function Segmented<T extends string>({ value, options, onChange, disabled }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center rounded-lg overflow-hidden w-fit" style={{ border: "1px solid var(--border)", opacity: disabled ? 0.5 : 1 }}>
      {options.map(o => {
        const active = value === o.value;
        return (
          <button key={o.value} onClick={() => !disabled && onChange(o.value)} disabled={disabled}
            className="px-3 py-1.5 text-xs font-medium transition-colors"
            style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ChipMulti({ all, selected, onToggle, labels }: { all: string[]; selected: string[]; onToggle: (v: string) => void; labels?: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map(opt => {
        const on = selected.includes(opt);
        return (
          <button key={opt} onClick={() => onToggle(opt)}
            className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
            style={on
              ? { backgroundColor: "#e0e7ff", color: "#3730a3", border: "1px solid #c7d2fe" }
              : { backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
            {on && <Check className="w-3 h-3 inline mr-1 -mt-0.5" />}{labels?.[opt] ?? opt}
          </button>
        );
      })}
    </div>
  );
}

const HOUR_OPTIONS = Array.from({ length: 19 }, (_, i) => i + 5).map(h => ({ value: String(h), label: formatHour(h) }));

function firstLocationOf(companyId: string): string {
  return locations.find(l => l.companyId === companyId)?.id ?? "";
}

// ─── Section helpers ──────────────────────────────────────
function cloneSection(section: DispatchSection, src: DispatchSettings): ScopedDispatchConfig[DispatchSection] {
  switch (section) {
    case "defaults": return { defaultView: src.defaultView, defaultDispatchMode: src.defaultDispatchMode };
    case "hourly":   return { ...src.hourly };
    case "blocks":   return src.blocks.map(b => ({ ...b }));
    case "layers":   return src.layers.map(l => ({ ...l }));
  }
}

// ─── Section ──────────────────────────────────────────────
export default function CalendarDispatchSection() {
  const [store, setStore] = useState<DispatchStore | null>(null);
  const [level, setLevel] = useState<ScopeLevel>("org");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [locationId, setLocationId] = useState(firstLocationOf(companies[0]?.id ?? ""));
  const [tab, setTab] = useState<SectionTab>("defaults");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [editingBoard, setEditingBoard] = useState<string | null>(null);
  const [editingView, setEditingView] = useState<string | null>(null);

  useEffect(() => { setStore(getStore()); }, []);
  if (!store) return <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const scopeKey = scopeKeyOf(level, companyId, locationId);
  const scopeCfg: ScopedDispatchConfig = store.scopes[scopeKey] ?? {};
  const parent = resolveParent(store, level, companyId, locationId);

  // Org always defines its sections; company/location override explicitly.
  const isOverridden = (section: DispatchSection) => level === "org" || scopeCfg[section] !== undefined;

  function update(mut: (next: DispatchStore) => void) {
    setStore(prev => { if (!prev) return prev; const next = structuredClone(prev); mut(next); return next; });
    setDirty(true); setSaved(false);
  }

  // Edit a section's content, materializing it from the parent on first touch.
  function editSection(section: DispatchSection, apply: (sc: ScopedDispatchConfig) => void) {
    update(next => {
      const sc = (next.scopes[scopeKey] ??= {});
      if (sc[section] === undefined) {
        const src = level === "org" ? defaultDispatchSettings() : resolveParent(next, level, companyId, locationId);
        // @ts-expect-error indexed assignment across the union is safe here
        sc[section] = cloneSection(section, src);
      }
      apply(sc);
    });
  }

  function setOverride(section: DispatchSection, on: boolean) {
    update(next => {
      const sc = (next.scopes[scopeKey] ??= {});
      if (on) {
        if (sc[section] === undefined) {
          const src = resolveParent(next, level, companyId, locationId);
          // @ts-expect-error indexed assignment across the union is safe here
          sc[section] = cloneSection(section, src);
        }
      } else {
        delete sc[section];
        if (Object.keys(sc).length === 0) delete next.scopes[scopeKey];
      }
    });
    if (section === "blocks") setEditingBlock(null);
  }

  // Resolved values to render for the active scope+section.
  const defaultsVal = scopeCfg.defaults ?? { defaultView: parent.defaultView, defaultDispatchMode: parent.defaultDispatchMode };
  const hourlyVal   = scopeCfg.hourly ?? parent.hourly;
  const blocksVal   = scopeCfg.blocks ?? parent.blocks;
  const layersVal   = scopeCfg.layers ?? parent.layers;

  function handleSave() { if (store) saveStore(store); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  function handleReset() { setStore(resetStore()); setEditingBlock(null); setEditingBoard(null); setEditingView(null); setDirty(false); setSaved(false); }

  // ── Scope selector handlers ──
  function pickLevel(l: ScopeLevel) {
    setLevel(l); setEditingBlock(null); setEditingBoard(null);
    if (l !== "org" && !companyId) { const c = companies[0]?.id ?? ""; setCompanyId(c); setLocationId(firstLocationOf(c)); }
    if (l === "location" && !locations.some(loc => loc.id === locationId && loc.companyId === companyId)) {
      setLocationId(firstLocationOf(companyId));
    }
  }
  function pickCompany(id: string) { setCompanyId(id); setLocationId(firstLocationOf(id)); setEditingBlock(null); setEditingBoard(null); }
  function pickLocation(id: string) { setLocationId(id); setEditingBlock(null); setEditingBoard(null); }

  // ── Service block ops ──
  const sortedBlocks = [...blocksVal].sort((a, b) => a.order - b.order);
  function moveBlock(id: string, dir: -1 | 1) {
    editSection("blocks", sc => {
      const sorted = [...sc.blocks!].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(b => b.id === id); const swap = idx + dir;
      if (swap < 0 || swap >= sorted.length) return;
      const o = sorted[idx].order; sorted[idx].order = sorted[swap].order; sorted[swap].order = o;
      sc.blocks = sorted;
    });
  }
  function addBlock() {
    const id = newBlockId();
    editSection("blocks", sc => {
      const maxOrder = sc.blocks!.length ? Math.max(...sc.blocks!.map(b => b.order)) : -1;
      sc.blocks!.push({ id, name: "New Block", startHour: 8, endHour: 10, active: true, order: maxOrder + 1 });
    });
    setEditingBlock(id);
  }
  function patchBlock(id: string, patch: Partial<SettingsServiceBlock>) {
    editSection("blocks", sc => { const b = sc.blocks!.find(x => x.id === id); if (b) Object.assign(b, patch); });
  }
  function removeBlock(id: string) {
    editSection("blocks", sc => { sc.blocks = sc.blocks!.filter(b => b.id !== id); });
    if (editingBlock === id) setEditingBlock(null);
  }

  // ── Board ops (scoped to the current company/location context) ──
  const boardsInScope = store.boards.filter(b =>
    (level === "org" || b.companyId === companyId) &&
    (level !== "location" || b.locationId === locationId),
  );
  function addBoard() {
    const id = newBoardId();
    const co = level === "org" ? (companies[0]?.id ?? "") : companyId;
    const loc = level === "location" ? locationId : firstLocationOf(co);
    update(next => {
      const siblingDefault = next.boards.some(b => b.companyId === co && b.locationId === loc && b.isDefault);
      next.boards.push({
        id, name: "New Board", companyId: co, locationId: loc, boardType: "custom",
        dispatchers: [], techNames: [], jobTypes: [], serviceAreaIds: [],
        active: true, isDefault: !siblingDefault,
      });
    });
    setEditingBoard(id);
  }
  function patchBoard(id: string, patch: Partial<DispatchBoard>) {
    update(next => { const b = next.boards.find(x => x.id === id); if (b) Object.assign(b, patch); });
  }
  function toggleBoardMember(id: string, field: "dispatchers" | "techNames" | "jobTypes" | "serviceAreaIds", value: string) {
    update(next => {
      const b = next.boards.find(x => x.id === id); if (!b) return;
      const arr = b[field];
      b[field] = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    });
  }
  function setDefaultBoard(id: string) {
    update(next => {
      const target = next.boards.find(b => b.id === id); if (!target) return;
      next.boards.forEach(b => { if (b.companyId === target.companyId && b.locationId === target.locationId) b.isDefault = b.id === id; });
    });
  }
  function removeBoard(id: string) {
    update(next => {
      const tgt = next.boards.find(b => b.id === id);
      next.boards = next.boards.filter(b => b.id !== id);
      if (tgt?.isDefault) {
        const sib = next.boards.find(b => b.companyId === tgt.companyId && b.locationId === tgt.locationId);
        if (sib) sib.isDefault = true;
      }
    });
    if (editingBoard === id) setEditingBoard(null);
  }

  // ── Queue view ops (global for now — not scoped) ──
  const sortedViews = [...store.queueViews].sort((a, b) => a.order - b.order);
  function addQueueView() {
    const id = newQueueViewId();
    update(next => {
      const maxOrder = next.queueViews.length ? Math.max(...next.queueViews.map(v => v.order)) : -1;
      next.queueViews.push({ id, key: id, name: "New View", order: maxOrder + 1, active: true, defaultVisible: true, filters: {} });
    });
    setEditingView(id);
  }
  function patchQueueView(id: string, patch: Partial<QueueView>) {
    update(next => { const v = next.queueViews.find(x => x.id === id); if (v) Object.assign(v, patch); });
  }
  // Toggle a value in an array-valued filter (sourceTypes / priorities / jobTypes).
  function toggleQueueFilter(id: string, key: "sourceTypes" | "priorities" | "jobTypes", value: string) {
    update(next => {
      const v = next.queueViews.find(x => x.id === id); if (!v) return;
      const arr = (v.filters[key] as string[] | undefined) ?? [];
      const nextArr = arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value];
      v.filters = { ...v.filters, [key]: nextArr.length ? nextArr : undefined };
    });
  }
  function setQueueDue(id: string, days: number | undefined) {
    update(next => { const v = next.queueViews.find(x => x.id === id); if (v) v.filters = { ...v.filters, dueWithinDays: days }; });
  }
  function moveQueueView(id: string, dir: -1 | 1) {
    update(next => {
      const sorted = [...next.queueViews].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(v => v.id === id); const swap = idx + dir;
      if (swap < 0 || swap >= sorted.length) return;
      const o = sorted[idx].order; sorted[idx].order = sorted[swap].order; sorted[swap].order = o;
      next.queueViews = sorted;
    });
  }
  function removeQueueView(id: string) {
    update(next => { next.queueViews = next.queueViews.filter(v => v.id !== id); });
    if (editingView === id) setEditingView(null);
  }

  const scopeNoun = level === "org" ? "the organization" : level === "company" ? "this company" : "this location";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Calendar / Dispatch</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Settings cascade Organization → Company → Location. The dispatch board uses the most specific settings for the current context.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset All
          </button>
          <button onClick={handleSave} disabled={!dirty && !saved}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: saved ? "#10b981" : "#4f46e5" }}>
            <Check className="w-3.5 h-3.5" /> {saved ? "Saved" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Scope selector */}
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Configure settings for</p>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented<ScopeLevel> value={level} onChange={pickLevel}
            options={[
              { value: "org", label: "Organization Default" },
              { value: "company", label: "Company" },
              { value: "location", label: "Company / Location" },
            ]} />
          {level !== "org" && (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <UiSelect value={companyId} onChange={pickCompany}
                options={companies.map(c => ({ value: c.id, label: c.name }))} />
            </div>
          )}
          {level === "location" && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <UiSelect value={locationId} onChange={pickLocation}
                options={locations.filter(l => l.companyId === companyId).map(l => ({ value: l.id, label: l.name }))} />
            </div>
          )}
        </div>
        <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
          {level === "org"
            ? "Organization defaults are the fallback for every company and location."
            : "Unoverridden sections inherit from the parent scope."}
        </p>
      </div>

      {dirty && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
          You have unsaved changes.
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)", border: `1px solid ${active ? "#4f46e5" : "var(--border)"}` }}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── DEFAULTS TAB (default view/mode + hourly grid) ── */}
      {tab === "defaults" && (
        <>
          <SettingsCard icon={CalendarDays} title="Default Calendar Settings" subtitle="The view and dispatch mode the Dispatching module opens with."
            action={level !== "org" ? <OverrideToggle on={isOverridden("defaults")} onChange={v => setOverride("defaults", v)} /> : undefined}>
            {!isOverridden("defaults") ? (
              <InheritedNote scope={scopeNoun} summary={`View: ${labelView(defaultsVal.defaultView)} · Mode: ${defaultsVal.defaultDispatchMode === "hourly" ? "Hourly" : "Service Blocks"}`} />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Default View</FieldLabel>
                  <UiSelect value={defaultsVal.defaultView} onChange={v => editSection("defaults", sc => { sc.defaults!.defaultView = v as CalendarViewMode; })}
                    options={[{ value: "dispatch", label: "Dispatch Board" }, { value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
                </div>
                <div>
                  <FieldLabel>Default Dispatch Mode</FieldLabel>
                  <Segmented<DispatchMode> value={defaultsVal.defaultDispatchMode}
                    onChange={v => editSection("defaults", sc => { sc.defaults!.defaultDispatchMode = v; })}
                    options={[{ value: "hourly", label: "Hourly" }, { value: "blocks", label: "Service Blocks" }]} />
                </div>
              </div>
            )}
          </SettingsCard>

          <SettingsCard icon={Clock} title="Hourly View Settings" subtitle="Visible schedule hours and granularity for the hourly grid."
            action={level !== "org" ? <OverrideToggle on={isOverridden("hourly")} onChange={v => setOverride("hourly", v)} /> : undefined}>
            {!isOverridden("hourly") ? (
              <InheritedNote scope={scopeNoun} summary={`${formatHour(hourlyVal.startHour)} – ${formatHour(hourlyVal.endHour)} · ${hourlyVal.increment} min`} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Day Start</FieldLabel>
                    <UiSelect value={String(hourlyVal.startHour)} onChange={v => editSection("hourly", sc => { sc.hourly!.startHour = Number(v); })} options={HOUR_OPTIONS} />
                  </div>
                  <div>
                    <FieldLabel>Day End</FieldLabel>
                    <UiSelect value={String(hourlyVal.endHour)} onChange={v => editSection("hourly", sc => { sc.hourly!.endHour = Number(v); })} options={HOUR_OPTIONS} />
                  </div>
                  <div>
                    <FieldLabel>Time Increment</FieldLabel>
                    <Segmented<string> value={String(hourlyVal.increment)}
                      onChange={v => editSection("hourly", sc => { sc.hourly!.increment = Number(v) as HourIncrement; })}
                      options={[{ value: "15", label: "15 min" }, { value: "30", label: "30 min" }, { value: "60", label: "60 min" }]} />
                  </div>
                  <div>
                    <FieldLabel>Time Labels</FieldLabel>
                    <Segmented<HourLabelStyle> value={hourlyVal.labelStyle}
                      onChange={v => editSection("hourly", sc => { sc.hourly!.labelStyle = v; })}
                      options={[{ value: "hours", label: "Hours only" }, { value: "all", label: "Every slot" }]} />
                  </div>
                </div>
                {hourlyVal.endHour <= hourlyVal.startHour && (
                  <p className="text-xs mt-3" style={{ color: "#b45309" }}>Day end should be after day start.</p>
                )}
              </>
            )}
          </SettingsCard>
        </>
      )}

      {/* ── SERVICE BLOCKS TAB ── */}
      {tab === "blocks" && (
        <SettingsCard icon={LayoutGrid} title="Service Blocks" subtitle="Arrival windows shown in Service Blocks mode."
          action={
            <div className="flex items-center gap-2">
              {level !== "org" && <OverrideToggle on={isOverridden("blocks")} onChange={v => setOverride("blocks", v)} />}
              {isOverridden("blocks") && (
                <button onClick={addBlock} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
                  <Plus className="w-3.5 h-3.5" /> Add Block
                </button>
              )}
            </div>
          }>
          {!isOverridden("blocks") ? (
            <InheritedNote scope={scopeNoun} summary={`${blocksVal.filter(b => b.active).length} active block${blocksVal.filter(b => b.active).length === 1 ? "" : "s"}`} />
          ) : (
            <div className="space-y-2">
              {sortedBlocks.map((b, i) => (
                editingBlock === b.id ? (
                  <div key={b.id} className="rounded-xl p-4 space-y-3" style={{ border: "2px solid #c7d2fe", backgroundColor: "var(--bg-surface)" }}>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-3">
                        <FieldLabel>Block Name</FieldLabel>
                        <input value={b.name} onChange={e => patchBlock(b.id, { name: e.target.value })}
                          className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                      </div>
                      <div><FieldLabel>Start</FieldLabel><UiSelect value={String(b.startHour)} onChange={v => patchBlock(b.id, { startHour: Number(v) })} options={HOUR_OPTIONS} /></div>
                      <div><FieldLabel>End</FieldLabel><UiSelect value={String(b.endHour)} onChange={v => patchBlock(b.id, { endHour: Number(v) })} options={HOUR_OPTIONS} /></div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer pb-2">
                          <Toggle on={b.active} onChange={v => patchBlock(b.id, { active: v })} />
                          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button onClick={() => setEditingBlock(null)} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>Done</button>
                    </div>
                  </div>
                ) : (
                  <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)", opacity: b.active ? 1 : 0.5 }}>
                    <div className="flex flex-col">
                      <button onClick={() => moveBlock(b.id, -1)} disabled={i === 0} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => moveBlock(b.id, 1)} disabled={i === sortedBlocks.length - 1} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{b.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{formatHour(b.startHour)} – {formatHour(b.endHour)}</p>
                    </div>
                    {!b.active && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Disabled</span>}
                    <Toggle on={b.active} onChange={v => patchBlock(b.id, { active: v })} />
                    <button onClick={() => setEditingBlock(b.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeBlock(b.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )
              ))}
              {sortedBlocks.length === 0 && <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>No service blocks. Add one to use Service Blocks mode.</p>}
            </div>
          )}
        </SettingsCard>
      )}

      {/* ── DISPATCH BOARDS TAB ── */}
      {tab === "boards" && (
        <SettingsCard icon={Users} title="Dispatch Boards / Teams" subtitle="Boards belong to a company + location and group dispatchers, techs, and job types."
          action={
            <button onClick={addBoard} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
              <Plus className="w-3.5 h-3.5" /> Add Board
            </button>
          }>
          <div className="space-y-3">
            {boardsInScope.map(board => (
              editingBoard === board.id ? (
                <BoardEditor key={board.id} board={board}
                  onPatch={p => patchBoard(board.id, p)}
                  onToggleMember={(f, v) => toggleBoardMember(board.id, f, v)}
                  onDone={() => setEditingBoard(null)} />
              ) : (
                <BoardRow key={board.id} board={board}
                  onEdit={() => setEditingBoard(board.id)} onRemove={() => removeBoard(board.id)} onSetDefault={() => setDefaultBoard(board.id)} />
              )
            ))}
            {boardsInScope.length === 0 && (
              <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>
                No dispatch boards {level === "location" ? "for this location" : level === "company" ? "for this company" : "yet"}. Add one to get started.
              </p>
            )}
          </div>
        </SettingsCard>
      )}

      {/* ── CALENDAR LAYERS TAB ── */}
      {tab === "layers" && (
        <SettingsCard icon={Layers} title="Calendar Layers" subtitle="Which record types appear on the calendar and their colors."
          action={level !== "org" ? <OverrideToggle on={isOverridden("layers")} onChange={v => setOverride("layers", v)} /> : undefined}>
          {!isOverridden("layers") ? (
            <InheritedNote scope={scopeNoun} summary={`${layersVal.filter(l => l.enabled).length} of ${layersVal.length} layers enabled`} />
          ) : (
            <>
              <div className="grid px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ gridTemplateColumns: "1fr auto auto auto", gap: "1.5rem", color: "var(--text-muted)" }}>
                <span>Layer</span><span className="text-center w-16">Enabled</span><span className="text-center w-16">Default On</span><span className="text-center w-20">Color</span>
              </div>
              <div className="space-y-1">
                {layersVal.map(layer => (
                  <div key={layer.type} className="grid items-center px-1 py-2 rounded-lg" style={{ gridTemplateColumns: "1fr auto auto auto", gap: "1.5rem", borderTop: "1px solid var(--border-subtle)", opacity: layer.enabled ? 1 : 0.5 }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: layer.color }} />
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{LAYER_LABEL(layer.type)}</span>
                    </div>
                    <div className="flex justify-center w-16">
                      <Toggle on={layer.enabled} onChange={v => editSection("layers", sc => { const l = sc.layers!.find(x => x.type === layer.type); if (l) { l.enabled = v; if (!v) l.visibleByDefault = false; } })} />
                    </div>
                    <div className="flex justify-center w-16">
                      <Toggle on={layer.visibleByDefault} onChange={v => editSection("layers", sc => { const l = sc.layers!.find(x => x.type === layer.type); if (l && l.enabled) l.visibleByDefault = v; })} />
                    </div>
                    <div className="flex items-center justify-center gap-1 w-20">
                      {LAYER_SWATCHES.map(c => (
                        <button key={c} onClick={() => editSection("layers", sc => { const l = sc.layers!.find(x => x.type === layer.type); if (l) l.color = c; })}
                          className="w-4 h-4 rounded-full" style={{ backgroundColor: c, outline: layer.color === c ? "2px solid var(--text-primary)" : "none", outlineOffset: "1px" }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </SettingsCard>
      )}

      {/* ── QUEUE VIEWS TAB ── */}
      {tab === "queue" && (
        <SettingsCard icon={Inbox} title="Unscheduled Queue Views" subtitle="Saved tabs for the Unscheduled Queue. Each view is a filter; admins can add, reorder, hide, or edit them."
          action={
            <button onClick={addQueueView} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
              <Plus className="w-3.5 h-3.5" /> Add View
            </button>
          }>
          <div className="space-y-2">
            {sortedViews.map((v, i) => (
              editingView === v.id ? (
                <QueueViewEditor key={v.id} view={v}
                  onPatch={p => patchQueueView(v.id, p)}
                  onToggleFilter={(f, val) => toggleQueueFilter(v.id, f, val)}
                  onSetDue={d => setQueueDue(v.id, d)}
                  onDone={() => setEditingView(null)} />
              ) : (
                <QueueViewRow key={v.id} view={v} first={i === 0} last={i === sortedViews.length - 1}
                  onMove={dir => moveQueueView(v.id, dir)}
                  onEdit={() => setEditingView(v.id)}
                  onToggleActive={val => patchQueueView(v.id, { active: val })}
                  onRemove={() => removeQueueView(v.id)} />
              )
            ))}
            {sortedViews.length === 0 && <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>No queue views. Add one to create a tab.</p>}
          </div>
          <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
            Queue views currently apply across all boards. Board-specific views can be added later.
          </p>
        </SettingsCard>
      )}
    </div>
  );
}

// ─── Small shared bits ────────────────────────────────────
function labelView(v: CalendarViewMode): string {
  return v === "dispatch" ? "Dispatch Board" : v.charAt(0).toUpperCase() + v.slice(1);
}

function OverrideToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <span className="text-xs font-medium" style={{ color: on ? "var(--accent-text)" : "var(--text-muted)" }}>Override for this scope</span>
      <Toggle on={on} onChange={onChange} />
    </label>
  );
}

function InheritedNote({ scope, summary }: { scope: string; summary: string }) {
  return (
    <div className="rounded-lg px-3 py-2.5 flex items-center justify-between gap-3" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px dashed var(--border)" }}>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Using parent defaults for {scope}.</span>
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{summary}</span>
    </div>
  );
}

// ─── Board row + editor ───────────────────────────────────
function locName(id: string): string { return locations.find(l => l.id === id)?.name ?? id; }
function coName(id: string): string { return companies.find(c => c.id === id)?.name ?? id; }

function BoardRow({ board, onEdit, onRemove, onSetDefault }: {
  board: DispatchBoard; onEdit: () => void; onRemove: () => void; onSetDefault: () => void;
}) {
  return (
    <div className="rounded-xl p-4" style={{ border: board.isDefault ? "1px solid #c7d2fe" : "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)", opacity: board.active ? 1 : 0.55 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{board.name}</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{BOARD_TYPE_LABELS[board.boardType]}</span>
            {board.isDefault && <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}><Star className="w-2.5 h-2.5" /> Default</span>}
            {!board.active && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Disabled</span>}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{coName(board.companyId)} · {locName(board.locationId)}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span><span style={{ color: "var(--text-muted)" }}>Dispatchers:</span> {board.dispatchers.length ? board.dispatchers.join(", ") : "—"}</span>
            <span><span style={{ color: "var(--text-muted)" }}>Techs:</span> {board.techNames.length ? board.techNames.join(", ") : "All"}</span>
            <span><span style={{ color: "var(--text-muted)" }}>Job types:</span> {board.jobTypes.length ? board.jobTypes.join(", ") : "All"}</span>
            {board.serviceAreaIds.length > 0 && <span><span style={{ color: "var(--text-muted)" }}>Areas:</span> {board.serviceAreaIds.map(id => serviceAreas.find(s => s.id === id)?.name ?? id).join(", ")}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!board.isDefault && <button onClick={onSetDefault} title="Set as default" className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Star className="w-3.5 h-3.5" /></button>}
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

function BoardEditor({ board, onPatch, onToggleMember, onDone }: {
  board: DispatchBoard;
  onPatch: (p: Partial<DispatchBoard>) => void;
  onToggleMember: (field: "dispatchers" | "techNames" | "jobTypes" | "serviceAreaIds", value: string) => void;
  onDone: () => void;
}) {
  const companyLocations = locations.filter(l => l.companyId === board.companyId);
  const areaOptions = serviceAreas.filter(s => s.locationId === board.locationId);
  return (
    <div className="rounded-xl p-4 space-y-4" style={{ border: "2px solid #c7d2fe", backgroundColor: "var(--bg-surface)" }}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FieldLabel>Board Name</FieldLabel>
          <input value={board.name} onChange={e => onPatch({ name: e.target.value })}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <FieldLabel>Company</FieldLabel>
          <UiSelect value={board.companyId} onChange={v => {
            const loc = locations.find(l => l.companyId === v)?.id ?? "";
            onPatch({ companyId: v, locationId: loc, serviceAreaIds: [] });
          }} options={companies.map(c => ({ value: c.id, label: c.name }))} />
        </div>
        <div>
          <FieldLabel>Location</FieldLabel>
          <UiSelect value={board.locationId} onChange={v => onPatch({ locationId: v, serviceAreaIds: [] })}
            options={companyLocations.map(l => ({ value: l.id, label: l.name }))} />
        </div>
        <div>
          <FieldLabel>Board Type</FieldLabel>
          <UiSelect value={board.boardType} onChange={v => onPatch({ boardType: v as BoardType })}
            options={(Object.keys(BOARD_TYPE_LABELS) as BoardType[]).map(t => ({ value: t, label: BOARD_TYPE_LABELS[t] }))} />
        </div>
        <div>
          <FieldLabel>Default View (optional)</FieldLabel>
          <UiSelect value={board.defaultView ?? "inherit"} onChange={v => onPatch({ defaultView: v === "inherit" ? undefined : v as CalendarViewMode })}
            options={[{ value: "inherit", label: "Inherit" }, { value: "dispatch", label: "Dispatch Board" }, { value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
        </div>
      </div>
      <div><FieldLabel>Dispatchers</FieldLabel><ChipMulti all={MOCK_DISPATCHERS} selected={board.dispatchers} onToggle={v => onToggleMember("dispatchers", v)} /></div>
      <div><FieldLabel>Technicians / Crews</FieldLabel><ChipMulti all={MOCK_TECHS} selected={board.techNames} onToggle={v => onToggleMember("techNames", v)} /></div>
      <div><FieldLabel>Job Types</FieldLabel><ChipMulti all={MOCK_JOB_TYPES} selected={board.jobTypes} onToggle={v => onToggleMember("jobTypes", v)} /></div>
      {areaOptions.length > 0 && (
        <div><FieldLabel>Service Areas (optional)</FieldLabel><ChipMulti all={areaOptions.map(a => a.name)}
          selected={board.serviceAreaIds.map(id => areaOptions.find(a => a.id === id)?.name ?? id)}
          onToggle={name => { const a = areaOptions.find(x => x.name === name); if (a) onToggleMember("serviceAreaIds", a.id); }} /></div>
      )}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Toggle on={board.active} onChange={v => onPatch({ active: v })} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span>
          </label>
          <div className="flex items-center gap-2">
            <FieldLabel>Mode</FieldLabel>
            <div className="-mt-1.5">
              <Segmented<string> value={board.defaultDispatchMode ?? "inherit"}
                onChange={v => onPatch({ defaultDispatchMode: v === "inherit" ? undefined : v as DispatchMode })}
                options={[{ value: "inherit", label: "Inherit" }, { value: "hourly", label: "Hourly" }, { value: "blocks", label: "Blocks" }]} />
            </div>
          </div>
        </div>
        <button onClick={onDone} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>Done</button>
      </div>
    </div>
  );
}

// ─── Queue view row + editor ──────────────────────────────
const QV_SWATCHES = ["#4f46e5", "#dc2626", "#059669", "#f59e0b", "#0891b2", "#7c3aed"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const PRIORITY_LABELS: Record<string, string> = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" };

function queueFilterSummary(f: QueueFilters): string {
  const parts: string[] = [];
  if (f.sourceTypes?.length) parts.push(f.sourceTypes.map(s => SOURCE_TYPE_LABELS[s]).join(", "));
  if (f.priorities?.length) parts.push(f.priorities.map(cap).join("/"));
  if (f.jobTypes?.length) parts.push(f.jobTypes.join(", "));
  if (f.dueWithinDays != null) parts.push(f.dueWithinDays === 0 ? "Due today" : `Due ≤ ${f.dueWithinDays}d`);
  return parts.length ? parts.join(" · ") : "All items (no filter)";
}

function QueueViewRow({ view, first, last, onMove, onEdit, onToggleActive, onRemove }: {
  view: QueueView; first: boolean; last: boolean;
  onMove: (dir: -1 | 1) => void; onEdit: () => void; onToggleActive: (v: boolean) => void; onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)", opacity: view.active ? 1 : 0.55 }}>
      <div className="flex flex-col">
        <button onClick={() => onMove(-1)} disabled={first} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
        <button onClick={() => onMove(1)} disabled={last} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
      </div>
      {view.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: view.color }} />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{view.name}</p>
          {view.system && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}>System</span>}
          {!view.defaultVisible && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Hidden</span>}
        </div>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{queueFilterSummary(view.filters)}</p>
      </div>
      <Toggle on={view.active} onChange={onToggleActive} />
      <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
      <button onClick={onRemove} disabled={view.system} title={view.system ? "System views can't be deleted" : "Delete view"}
        className="p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-20 disabled:cursor-not-allowed" style={{ color: "#9ca3af" }}><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function QueueViewEditor({ view, onPatch, onToggleFilter, onSetDue, onDone }: {
  view: QueueView;
  onPatch: (p: Partial<QueueView>) => void;
  onToggleFilter: (field: "sourceTypes" | "priorities" | "jobTypes", value: string) => void;
  onSetDue: (days: number | undefined) => void;
  onDone: () => void;
}) {
  const sourceKeys = Object.keys(SOURCE_TYPE_LABELS) as QueueSourceType[];
  return (
    <div className="rounded-xl p-4 space-y-4" style={{ border: "2px solid #c7d2fe", backgroundColor: "var(--bg-surface)" }}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FieldLabel>View Name</FieldLabel>
          <input value={view.name} onChange={e => onPatch({ name: e.target.value })}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <FieldLabel>Tab Color</FieldLabel>
          <div className="flex items-center gap-1.5 pt-1">
            <button onClick={() => onPatch({ color: undefined })} title="No color"
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ border: "1px solid var(--border)", color: "var(--text-muted)", outline: !view.color ? "2px solid var(--text-primary)" : "none", outlineOffset: "1px" }}>—</button>
            {QV_SWATCHES.map(c => (
              <button key={c} onClick={() => onPatch({ color: c })}
                className="w-5 h-5 rounded-full" style={{ backgroundColor: c, outline: view.color === c ? "2px solid var(--text-primary)" : "none", outlineOffset: "1px" }} />
            ))}
          </div>
        </div>
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-2 cursor-pointer pb-2">
            <Toggle on={view.active} onChange={v => onPatch({ active: v })} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer pb-2">
            <Toggle on={view.defaultVisible} onChange={v => onPatch({ defaultVisible: v })} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Show as tab</span>
          </label>
        </div>
      </div>

      <div><FieldLabel>Source Types</FieldLabel><ChipMulti all={sourceKeys} labels={SOURCE_TYPE_LABELS} selected={view.filters.sourceTypes ?? []} onToggle={v => onToggleFilter("sourceTypes", v)} /></div>
      <div><FieldLabel>Priority</FieldLabel><ChipMulti all={PRIORITY_OPTIONS} labels={PRIORITY_LABELS} selected={view.filters.priorities ?? []} onToggle={v => onToggleFilter("priorities", v)} /></div>
      <div><FieldLabel>Job Types</FieldLabel><ChipMulti all={MOCK_JOB_TYPES} selected={view.filters.jobTypes ?? []} onToggle={v => onToggleFilter("jobTypes", v)} /></div>
      <div className="flex items-center gap-3">
        <FieldLabel>Due Within</FieldLabel>
        <div className="-mt-1.5 w-44">
          <UiSelect value={view.filters.dueWithinDays == null ? "any" : String(view.filters.dueWithinDays)}
            onChange={val => onSetDue(val === "any" ? undefined : Number(val))} options={DUE_OPTIONS} />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Empty filters match every queue item.</p>
        <button onClick={onDone} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>Done</button>
      </div>
    </div>
  );
}
