"use client";

import { useState, useEffect } from "react";
import {
  Plus, Pencil, Trash2, Check, X, RotateCcw, ChevronUp, ChevronDown,
  Star, CalendarDays, Clock, LayoutGrid, Users, Layers,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import {
  getDispatchSettings, saveDispatchSettings, resetDispatchSettings,
  formatHour, newBlockId, newBoardId,
  MOCK_DISPATCHERS, MOCK_TECHS, MOCK_JOB_TYPES, LAYER_LABEL,
  type DispatchSettings, type SettingsServiceBlock, type SettingsBoard,
  type CalendarViewMode, type HourIncrement, type HourLabelStyle,
} from "@/lib/calendar/settings";
import type { DispatchMode } from "@/lib/calendar/types";

const LAYER_SWATCHES = ["#4f46e5", "#0891b2", "#059669", "#f59e0b", "#7c3aed", "#db2777", "#0d9488", "#6b7280", "#ef4444", "#3b82f6"];

// ─── Module-level primitives (defined here so they never remount) ──
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on}
      className="relative w-8 h-4 rounded-full transition-colors shrink-0"
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
    <div className="rounded-xl p-5"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
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

function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center rounded-lg overflow-hidden w-fit" style={{ border: "1px solid var(--border)" }}>
      {options.map(o => {
        const active = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            className="px-3 py-1.5 text-xs font-medium transition-colors"
            style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Toggleable chip multi-select
function ChipMulti({ all, selected, onToggle }: { all: string[]; selected: string[]; onToggle: (v: string) => void }) {
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
            {on && <Check className="w-3 h-3 inline mr-1 -mt-0.5" />}{opt}
          </button>
        );
      })}
    </div>
  );
}

const HOUR_OPTIONS = Array.from({ length: 19 }, (_, i) => i + 5) // 5 AM .. 11 PM
  .map(h => ({ value: String(h), label: formatHour(h) }));

export default function CalendarDispatchSection() {
  const [s, setS] = useState<DispatchSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [editingBoard, setEditingBoard] = useState<string | null>(null);

  useEffect(() => { setS(getDispatchSettings()); }, []);

  if (!s) return <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>;

  function update(mut: (draft: DispatchSettings) => void) {
    setS(prev => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      mut(next);
      return next;
    });
    setDirty(true); setSaved(false);
  }

  function handleSave() {
    if (s) saveDispatchSettings(s);
    setDirty(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
  function handleReset() {
    setS(resetDispatchSettings());
    setEditingBlock(null); setEditingBoard(null);
    setDirty(false); setSaved(false);
  }

  // ── Service block ops ──
  const sortedBlocks = [...s.blocks].sort((a, b) => a.order - b.order);
  function moveBlock(id: string, dir: -1 | 1) {
    update(d => {
      const sorted = [...d.blocks].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(b => b.id === id);
      const swap = idx + dir;
      if (swap < 0 || swap >= sorted.length) return;
      const o = sorted[idx].order; sorted[idx].order = sorted[swap].order; sorted[swap].order = o;
      d.blocks = sorted;
    });
  }
  function addBlock() {
    const id = newBlockId();
    update(d => {
      const maxOrder = d.blocks.length ? Math.max(...d.blocks.map(b => b.order)) : -1;
      d.blocks.push({ id, name: "New Block", startHour: 8, endHour: 10, active: true, order: maxOrder + 1 });
    });
    setEditingBlock(id);
  }
  function patchBlock(id: string, patch: Partial<SettingsServiceBlock>) {
    update(d => { const b = d.blocks.find(x => x.id === id); if (b) Object.assign(b, patch); });
  }
  function removeBlock(id: string) {
    update(d => { d.blocks = d.blocks.filter(b => b.id !== id); });
    if (editingBlock === id) setEditingBlock(null);
  }

  // ── Board ops ──
  function addBoard() {
    const id = newBoardId();
    update(d => {
      d.boards.push({ id, name: "New Board", location: "Augusta Branch", dispatchers: [], techNames: [], jobTypes: [], active: true, isDefault: d.boards.length === 0 });
    });
    setEditingBoard(id);
  }
  function patchBoard(id: string, patch: Partial<SettingsBoard>) {
    update(d => { const b = d.boards.find(x => x.id === id); if (b) Object.assign(b, patch); });
  }
  function toggleBoardMember(id: string, field: "dispatchers" | "techNames" | "jobTypes", value: string) {
    update(d => {
      const b = d.boards.find(x => x.id === id); if (!b) return;
      const arr = b[field];
      b[field] = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    });
  }
  function setDefaultBoard(id: string) {
    update(d => { d.boards.forEach(b => { b.isDefault = b.id === id; }); });
  }
  function removeBoard(id: string) {
    update(d => {
      const wasDefault = d.boards.find(b => b.id === id)?.isDefault;
      d.boards = d.boards.filter(b => b.id !== id);
      if (wasDefault && d.boards.length) d.boards[0].isDefault = true;
    });
    if (editingBoard === id) setEditingBoard(null);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Calendar / Dispatch</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Defaults for the Dispatching module. Settings here control the default view — the dispatch board controls the current view.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button onClick={handleSave} disabled={!dirty && !saved}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: saved ? "#10b981" : "#4f46e5" }}>
            <Check className="w-3.5 h-3.5" /> {saved ? "Saved" : "Save Changes"}
          </button>
        </div>
      </div>

      {dirty && (
        <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
          You have unsaved changes.
        </div>
      )}

      {/* ── 1. Default Calendar Settings ── */}
      <SettingsCard icon={CalendarDays} title="Default Calendar Settings" subtitle="The view and dispatch mode the Dispatching module opens with.">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Default View</FieldLabel>
            <UiSelect value={s.defaultView} onChange={v => update(d => { d.defaultView = v as CalendarViewMode; })}
              options={[
                { value: "dispatch", label: "Dispatch Board" },
                { value: "day", label: "Day" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ]} />
          </div>
          <div>
            <FieldLabel>Default Dispatch Mode</FieldLabel>
            <Segmented<DispatchMode> value={s.defaultDispatchMode}
              onChange={v => update(d => { d.defaultDispatchMode = v; })}
              options={[{ value: "hourly", label: "Hourly" }, { value: "blocks", label: "Service Blocks" }]} />
          </div>
        </div>
      </SettingsCard>

      {/* ── 2. Hourly View Settings ── */}
      <SettingsCard icon={Clock} title="Hourly View Settings" subtitle="Time range and granularity for the hourly dispatch grid.">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Day Start</FieldLabel>
            <UiSelect value={String(s.hourly.startHour)} onChange={v => update(d => { d.hourly.startHour = Number(v); })}
              options={HOUR_OPTIONS} />
          </div>
          <div>
            <FieldLabel>Day End</FieldLabel>
            <UiSelect value={String(s.hourly.endHour)} onChange={v => update(d => { d.hourly.endHour = Number(v); })}
              options={HOUR_OPTIONS} />
          </div>
          <div>
            <FieldLabel>Time Increment</FieldLabel>
            <Segmented<string> value={String(s.hourly.increment)}
              onChange={v => update(d => { d.hourly.increment = Number(v) as HourIncrement; })}
              options={[{ value: "15", label: "15 min" }, { value: "30", label: "30 min" }, { value: "60", label: "60 min" }]} />
          </div>
          <div>
            <FieldLabel>Time Labels</FieldLabel>
            <Segmented<HourLabelStyle> value={s.hourly.labelStyle}
              onChange={v => update(d => { d.hourly.labelStyle = v; })}
              options={[{ value: "hours", label: "Hours only" }, { value: "all", label: "Every slot" }]} />
          </div>
        </div>
        {s.hourly.endHour <= s.hourly.startHour && (
          <p className="text-xs mt-3" style={{ color: "#b45309" }}>Day end should be after day start.</p>
        )}
      </SettingsCard>

      {/* ── 3. Service Blocks ── */}
      <SettingsCard icon={LayoutGrid} title="Service Blocks" subtitle="Arrival windows shown in Service Blocks mode."
        action={
          <button onClick={addBlock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
            <Plus className="w-3.5 h-3.5" /> Add Block
          </button>
        }>
        <div className="space-y-2">
          {sortedBlocks.map((b, i) => (
            editingBlock === b.id ? (
              <div key={b.id} className="rounded-xl p-4 space-y-3" style={{ border: "2px solid #c7d2fe", backgroundColor: "var(--bg-surface)" }}>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3">
                    <FieldLabel>Block Name</FieldLabel>
                    <input value={b.name} onChange={e => patchBlock(b.id, { name: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <FieldLabel>Start</FieldLabel>
                    <UiSelect value={String(b.startHour)} onChange={v => patchBlock(b.id, { startHour: Number(v) })} options={HOUR_OPTIONS} />
                  </div>
                  <div>
                    <FieldLabel>End</FieldLabel>
                    <UiSelect value={String(b.endHour)} onChange={v => patchBlock(b.id, { endHour: Number(v) })} options={HOUR_OPTIONS} />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer pb-2">
                      <Toggle on={b.active} onChange={v => patchBlock(b.id, { active: v })} />
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setEditingBlock(null)}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>Done</button>
                </div>
              </div>
            ) : (
              <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)", opacity: b.active ? 1 : 0.5 }}>
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
                <button onClick={() => removeBlock(b.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#9ca3af")}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            )
          ))}
          {sortedBlocks.length === 0 && <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>No service blocks. Add one to use Service Blocks mode.</p>}
        </div>
      </SettingsCard>

      {/* ── 4. Dispatch Boards / Teams ── */}
      <SettingsCard icon={Users} title="Dispatch Boards / Teams" subtitle="Boards group dispatchers, techs, and job types. Mark one as the default."
        action={
          <button onClick={addBoard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
            <Plus className="w-3.5 h-3.5" /> Add Board
          </button>
        }>
        <div className="space-y-3">
          {s.boards.map(board => (
            editingBoard === board.id ? (
              <div key={board.id} className="rounded-xl p-4 space-y-4" style={{ border: "2px solid #c7d2fe", backgroundColor: "var(--bg-surface)" }}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Board Name</FieldLabel>
                    <input value={board.name} onChange={e => patchBoard(board.id, { name: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <FieldLabel>Location</FieldLabel>
                    <UiSelect value={board.location} onChange={v => patchBoard(board.id, { location: v })}
                      options={["Augusta Branch", "Evans Branch", "Columbia Branch"].map(l => ({ value: l, label: l }))} />
                  </div>
                </div>
                <div>
                  <FieldLabel>Dispatchers</FieldLabel>
                  <ChipMulti all={MOCK_DISPATCHERS} selected={board.dispatchers} onToggle={v => toggleBoardMember(board.id, "dispatchers", v)} />
                </div>
                <div>
                  <FieldLabel>Technicians / Crews</FieldLabel>
                  <ChipMulti all={MOCK_TECHS} selected={board.techNames} onToggle={v => toggleBoardMember(board.id, "techNames", v)} />
                </div>
                <div>
                  <FieldLabel>Job Types</FieldLabel>
                  <ChipMulti all={MOCK_JOB_TYPES} selected={board.jobTypes} onToggle={v => toggleBoardMember(board.id, "jobTypes", v)} />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Toggle on={board.active} onChange={v => patchBoard(board.id, { active: v })} />
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span>
                  </label>
                  <button onClick={() => setEditingBoard(null)}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>Done</button>
                </div>
              </div>
            ) : (
              <div key={board.id} className="rounded-xl p-4"
                style={{ border: board.isDefault ? "1px solid #c7d2fe" : "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)", opacity: board.active ? 1 : 0.55 }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{board.name}</p>
                      {board.isDefault && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}>
                          <Star className="w-2.5 h-2.5" /> Default
                        </span>
                      )}
                      {!board.active && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Disabled</span>}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{board.location}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <span><span style={{ color: "var(--text-muted)" }}>Dispatchers:</span> {board.dispatchers.length ? board.dispatchers.join(", ") : "—"}</span>
                      <span><span style={{ color: "var(--text-muted)" }}>Techs:</span> {board.techNames.length ? board.techNames.join(", ") : "All"}</span>
                      <span><span style={{ color: "var(--text-muted)" }}>Job types:</span> {board.jobTypes.length ? board.jobTypes.join(", ") : "All"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!board.isDefault && (
                      <button onClick={() => setDefaultBoard(board.id)} title="Set as default"
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Star className="w-3.5 h-3.5" /></button>
                    )}
                    <button onClick={() => setEditingBoard(board.id)} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeBoard(board.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")} onMouseLeave={e => (e.currentTarget.style.color = "#9ca3af")}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            )
          ))}
          {s.boards.length === 0 && <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>No dispatch boards yet.</p>}
        </div>
      </SettingsCard>

      {/* ── 5. Calendar Layers ── */}
      <SettingsCard icon={Layers} title="Calendar Layers" subtitle="Which record types appear on the calendar and their colors.">
        <div className="grid px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "1fr auto auto auto", gap: "1.5rem", color: "var(--text-muted)" }}>
          <span>Layer</span><span className="text-center w-16">Enabled</span><span className="text-center w-16">Default On</span><span className="text-center w-20">Color</span>
        </div>
        <div className="space-y-1">
          {s.layers.map(layer => (
            <div key={layer.type} className="grid items-center px-1 py-2 rounded-lg"
              style={{ gridTemplateColumns: "1fr auto auto auto", gap: "1.5rem", borderTop: "1px solid var(--border-subtle)", opacity: layer.enabled ? 1 : 0.5 }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: layer.color }} />
                <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{LAYER_LABEL(layer.type)}</span>
              </div>
              <div className="flex justify-center w-16">
                <Toggle on={layer.enabled} onChange={v => update(d => { const l = d.layers.find(x => x.type === layer.type); if (l) { l.enabled = v; if (!v) l.visibleByDefault = false; } })} />
              </div>
              <div className="flex justify-center w-16">
                <Toggle on={layer.visibleByDefault} onChange={v => update(d => { const l = d.layers.find(x => x.type === layer.type); if (l && l.enabled) l.visibleByDefault = v; })} />
              </div>
              <div className="flex items-center justify-center gap-1 w-20">
                {LAYER_SWATCHES.slice(0, 5).map(c => (
                  <button key={c} onClick={() => update(d => { const l = d.layers.find(x => x.type === layer.type); if (l) l.color = c; })}
                    className="w-4 h-4 rounded-full transition-transform"
                    style={{ backgroundColor: c, outline: layer.color === c ? "2px solid var(--text-primary)" : "none", outlineOffset: "1px" }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
          Disabled layers are hidden everywhere. &ldquo;Default On&rdquo; controls whether an enabled layer is visible when the calendar first loads — users can still toggle it from the legend.
        </p>
      </SettingsCard>
    </div>
  );
}
