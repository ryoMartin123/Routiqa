"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, Pencil, Trash2, Check, ChevronUp, ChevronDown, ChevronRight, X, Lock, Settings2,
  Star, CalendarDays, CalendarRange, Calendar, Clock, LayoutGrid, Users, Layers, Inbox, Search,
} from "lucide-react";
import { useSettingsScope } from "@/components/providers/SettingsScopeProvider";
import UiSelect from "@/components/ui/Select";
import { getBoardCandidateNames, getDispatcherCandidates, getTechnicianCandidates } from "@/lib/users/data";
import { getAssignableRoles, getRoleLabel } from "@/lib/roles/store";
import {
  getStore, saveStore, scopeKeyOf, resolveFromStore, resolveParent,
  defaultDispatchSettings, formatHour, newBlockId, newBoardId,
  BOARD_TYPE_LABELS, BOARD_TYPE_JOB_TYPE, LAYER_LABEL,
  type DispatchStore, type ScopedDispatchConfig, type DispatchSettings,
  type SettingsServiceBlock, type DispatchBoard, type BoardType,
  type ScopeLevel, type DispatchSection,
  type CalendarViewMode, type HourIncrement, type HourLabelStyle,
} from "@/lib/calendar/settings";
import { getJobTypes, jobTypeLabel } from "@/lib/job-config/data";
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

// Default-view picker options (icon cards).
const VIEW_OPTIONS: { value: CalendarViewMode; label: string; icon: typeof Clock; hint: string }[] = [
  { value: "dispatch", label: "Dispatch", icon: LayoutGrid,   hint: "Tech rows + timeline" },
  { value: "day",      label: "Day",      icon: CalendarDays,  hint: "Single-day agenda" },
  { value: "week",     label: "Week",     icon: CalendarRange, hint: "7-day overview" },
  { value: "month",    label: "Month",    icon: Calendar,      hint: "Month grid" },
];
type SectionTab = "defaults" | "blocks" | "boards" | "layers" | "queue";
const TABS: { key: SectionTab; label: string; icon: typeof Clock }[] = [
  { key: "defaults", label: "Defaults",       icon: CalendarDays },
  { key: "blocks",   label: "Service Blocks",  icon: LayoutGrid },
  { key: "boards",   label: "Dispatch Boards", icon: Users },
  { key: "queue",    label: "Queue Views",     icon: Inbox },
  { key: "layers",   label: "Calendar Layers", icon: Layers },
];

// The section is a hub: the tabs are grouped into containers (cards). Picking a
// container opens its tabs. Mirrors the Agreements settings layout.
type ContainerDef = { key: string; label: string; description: string; icon: typeof Clock; tabs: SectionTab[] };
const CONTAINERS: ContainerDef[] = [
  { key: "calendar", label: "Calendar Display", description: "Default view, working hours, service blocks, and which record layers show on the calendar.", icon: CalendarDays, tabs: ["defaults", "blocks", "layers"] },
  { key: "dispatch", label: "Dispatch & Queues", description: "Dispatch boards and the unscheduled queue views that feed them.", icon: Users, tabs: ["boards", "queue"] },
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
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
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
              : { backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            {on && <Check className="w-3 h-3 inline mr-1 -mt-0.5" />}{labels?.[opt] ?? opt}
          </button>
        );
      })}
    </div>
  );
}

// One person row inside the PeoplePicker modal.
function PersonRow({ name, checked, onToggle }: { name: string; checked: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--bg-surface-2)]"
      style={{ color: "var(--text-primary)" }}>
      <span className="w-4 h-4 rounded flex items-center justify-center shrink-0"
        style={{ border: `1.5px solid ${checked ? "#4f46e5" : "var(--border)"}`, backgroundColor: checked ? "#4f46e5" : "transparent" }}>
        {checked && <Check className="w-3 h-3 text-white" />}
      </span>
      <span className="truncate">{name}</span>
    </button>
  );
}

// Search-and-select popup for picking people on a board. Selected names show as
// removable chips; the "Add" button opens a searchable, checkable modal with the
// role-appropriate people grouped under "Suggested" — built for big teams.
function PeoplePicker({ title, allNames, suggested, selected, onToggle, emptyLabel }: {
  title: string;
  allNames: string[];
  suggested: string[];
  selected: string[];
  onToggle: (name: string) => void;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const sug = new Set(suggested);
  const ql = q.trim().toLowerCase();
  const match = (n: string) => !ql || n.toLowerCase().includes(ql);
  const suggestedList = allNames.filter(n => sug.has(n) && match(n)).sort((a, b) => a.localeCompare(b));
  const othersList = allNames.filter(n => !sug.has(n) && match(n)).sort((a, b) => a.localeCompare(b));
  const selectedNames = allNames.filter(n => selected.includes(n));

  return (
    <>
      <div className="w-full min-h-[38px] rounded-lg px-2.5 py-1.5 flex flex-wrap items-center gap-1.5"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        {selectedNames.length === 0 && <span className="text-sm" style={{ color: "var(--text-muted)" }}>{emptyLabel}</span>}
        {selectedNames.map(n => (
          <span key={n} className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>
            {n}
            <span role="button" onClick={() => onToggle(n)} className="cursor-pointer hover:opacity-70"><X className="w-2.5 h-2.5" /></span>
          </span>
        ))}
        <button type="button" onClick={() => { setQ(""); setOpen(true); }}
          className="ml-auto flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg shrink-0"
          style={{ border: "1px solid var(--border)", color: "var(--accent-text)" }}>
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
            <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
              <button onClick={() => setOpen(false)} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search people…" className="w-full text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto thin-scroll-y px-2 py-2">
              {suggestedList.length > 0 && (
                <>
                  <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Suggested</p>
                  {suggestedList.map(n => <PersonRow key={n} name={n} checked={selected.includes(n)} onToggle={() => onToggle(n)} />)}
                </>
              )}
              {othersList.length > 0 && (
                <>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{suggestedList.length > 0 ? "Everyone else" : "Team"}</p>
                  {othersList.map(n => <PersonRow key={n} name={n} checked={selected.includes(n)} onToggle={() => onToggle(n)} />)}
                </>
              )}
              {suggestedList.length === 0 && othersList.length === 0 && (
                <p className="px-3 py-3 text-xs" style={{ color: "var(--text-muted)" }}>No people match.</p>
              )}
            </div>
            <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{selected.length} selected</span>
              <button onClick={() => setOpen(false)} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Same add-from-a-list UX as PeoplePicker, but for simple string tags like job
// types: selected values show as removable chips and the "Add" button opens a
// searchable, checkable list. Keeps board Job Types consistent with how crews and
// dispatchers are added, instead of a row of toggle pills.
function TagPicker({ title, all, selected, onToggle, emptyLabel, searchPlaceholder, labels }: {
  title: string;
  all: string[];
  selected: string[];
  onToggle: (v: string) => void;
  emptyLabel: string;
  searchPlaceholder?: string;
  labels?: Record<string, string>;   // value → display label (value stays the stored key)
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const labelOf = (v: string) => labels?.[v] ?? v;
  const list = all.filter(v => !ql || labelOf(v).toLowerCase().includes(ql));
  const selectedVals = all.filter(v => selected.includes(v));

  return (
    <>
      <div className="w-full min-h-[38px] rounded-lg px-2.5 py-1.5 flex flex-wrap items-center gap-1.5"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        {selectedVals.length === 0 && <span className="text-sm" style={{ color: "var(--text-muted)" }}>{emptyLabel}</span>}
        {selectedVals.map(v => (
          <span key={v} className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>
            {labelOf(v)}
            <span role="button" onClick={() => onToggle(v)} className="cursor-pointer hover:opacity-70"><X className="w-2.5 h-2.5" /></span>
          </span>
        ))}
        <button type="button" onClick={() => { setQ(""); setOpen(true); }}
          className="ml-auto flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg shrink-0"
          style={{ border: "1px solid var(--border)", color: "var(--accent-text)" }}>
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
            <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
              <button onClick={() => setOpen(false)} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={searchPlaceholder ?? "Search…"} className="w-full text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto thin-scroll-y px-2 py-2">
              {list.length === 0
                ? <p className="px-3 py-3 text-xs" style={{ color: "var(--text-muted)" }}>No matches.</p>
                : list.map(v => <PersonRow key={v} name={labelOf(v)} checked={selected.includes(v)} onToggle={() => onToggle(v)} />)}
            </div>
            <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{selected.length} selected</span>
              <button onClick={() => setOpen(false)} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Modern multi-select: selected items show as removable chips; the dropdown is
// searchable. Used for picking dispatchers, technicians, and roles on a board.
function MultiSelect({ options, selected, onToggle, placeholder }: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selOpts = options.filter(o => selected.includes(o.value));
  const ql = q.trim().toLowerCase();
  const filtered = ql ? options.filter(o => o.label.toLowerCase().includes(ql)) : options;

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full min-h-[38px] rounded-lg px-2.5 py-1.5 flex flex-wrap items-center gap-1.5 text-left transition-colors"
        style={{ border: `1px solid ${open ? "#a5b4fc" : "var(--border)"}`, backgroundColor: "var(--bg-surface)", boxShadow: open ? "0 0 0 3px rgba(99,102,241,0.12)" : "none" }}>
        {selOpts.length === 0
          ? <span className="text-sm" style={{ color: "var(--text-muted)" }}>{placeholder}</span>
          : selOpts.map(o => (
              <span key={o.value} className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>
                {o.label}
                <span role="button" onClick={e => { e.stopPropagation(); onToggle(o.value); }} className="cursor-pointer hover:opacity-70"><X className="w-2.5 h-2.5" /></span>
              </span>
            ))}
        <ChevronDown className="w-3.5 h-3.5 ml-auto shrink-0" style={{ color: "var(--text-muted)" }} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
          {options.length > 6 && (
            <div className="flex items-center gap-2 px-2.5 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
                className="w-full text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} />
            </div>
          )}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs px-3 py-2" style={{ color: "var(--text-muted)" }}>No matches.</p>
            ) : filtered.map(o => {
              const on = selected.includes(o.value);
              return (
                <button key={o.value} type="button" onClick={() => onToggle(o.value)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ color: "var(--text-primary)" }}>
                  <span className="truncate">{o.label}</span>
                  {on && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent-text)" }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
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
export default function CalendarDispatchSection({ activeModule, onOpen, onBack }: {
  activeModule: string | null;
  onOpen: (key: string, label: string) => void;
  onBack: () => void;
}) {
  const [store, setStore] = useState<DispatchStore | null>(null);
  // Scope comes from the page-level Editing Scope (org → company → location).
  // Settings cascade and boards are scoped to the layer being edited.
  const scope = useSettingsScope();
  const level: ScopeLevel = scope.activeLayer === "service_area" ? "location" : scope.activeLayer;
  const companyId = scope.companyId;
  const locationId = scope.locationId;
  const [tab, setTab] = useState<SectionTab>("defaults");
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [editingBoard, setEditingBoard] = useState<string | null>(null);
  const [editingView, setEditingView] = useState<string | null>(null);

  useEffect(() => { setStore(getStore()); }, []);

  // Reset open editors when the editing scope changes (avoids editing a board
  // that isn't in the newly selected scope).
  useEffect(() => { setEditingBlock(null); setEditingBoard(null); setEditingView(null); }, [level, companyId, locationId]);

  // Auto-save: there's no manual Save button — every change persists immediately
  // (see update()). The "Done" buttons on the board/block editors just close them.

  if (!store) return <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>;

  // ── Hub: pick a container before any scoped settings show ──
  if (!activeModule) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Calendar / Dispatch</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Pick an area to configure its settings.
          </p>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {CONTAINERS.map(c => {
            const Icon = c.icon;
            return (
              <button key={c.key} onClick={() => onOpen(c.key, c.label)}
                className="flex items-start gap-3 p-4 rounded-xl text-left w-full transition-all group hover:shadow-md cursor-pointer"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-surface-2)" }}>
                  <Icon className="w-4 h-4" style={{ color: "#4f46e5" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{c.label}</p>
                  <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{c.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0 mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity" style={{ color: "var(--text-muted)" }} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Container open: show only its tabs ──
  const activeContainer = CONTAINERS.find(c => c.key === activeModule);
  if (!activeContainer) { onBack(); return null; }
  const containerTabs = TABS.filter(t => activeContainer.tabs.includes(t.key));
  // Snap the active tab into the open container so navigating between containers
  // never leaves a stale tab from the other one selected.
  const curTab: SectionTab = activeContainer.tabs.includes(tab) ? tab : activeContainer.tabs[0];

  const scopeKey = scopeKeyOf(level, companyId, locationId);
  const scopeCfg: ScopedDispatchConfig = store.scopes[scopeKey] ?? {};
  const parent = resolveParent(store, level, companyId, locationId);

  // Org always defines its sections; company/location override explicitly.
  const isOverridden = (section: DispatchSection) => level === "org" || scopeCfg[section] !== undefined;

  // Mutate + persist in one step — every edit is saved to the store immediately.
  function update(mut: (next: DispatchStore) => void) {
    if (!store) return;
    const next = structuredClone(store);
    mut(next);
    setStore(next);
    saveStore(next);
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
  // A board can only be created once the scope node is actually picked, otherwise
  // it would be saved with an empty company/location id and never match a real
  // context on the dispatch board.
  const scopeReady = level === "org" || (level === "company" ? !!companyId : !!companyId && !!locationId);
  // Boards shown for the layer being edited: org → org-wide boards; company →
  // that company's boards; location → that location's boards. (Empty scope shows
  // nothing rather than spuriously matching empty-id boards.)
  const boardsInScope = !scopeReady ? [] : store.boards.filter(b =>
    level === "org" ? !b.companyId
    : level === "company" ? b.companyId === companyId && !b.locationId
    : b.locationId === locationId,
  );
  function addBoard() {
    if (!scopeReady) return;
    const id = newBoardId();
    // Scope the new board to the layer being edited.
    const co = level === "org" ? "" : companyId;
    const loc = level === "location" ? locationId : "";
    update(next => {
      // The first board created for a company+location becomes that branch's
      // default — it acts as the catch-all that claims any in-scope work the
      // branch's other (Install/Service/…) boards don't. Later boards default off.
      const firstInScope = !next.boards.some(b => b.companyId === co && b.locationId === loc);
      next.boards.push({
        id, name: "New Board", companyId: co, locationId: loc, boardType: "custom",
        dispatchers: [], techNames: [], roleKeys: [], jobTypes: [], serviceAreaIds: [],
        active: true, isDefault: firstInScope,
      });
    });
    setEditingBoard(id);
  }
  function patchBoard(id: string, patch: Partial<DispatchBoard>) {
    update(next => { const b = next.boards.find(x => x.id === id); if (b) Object.assign(b, patch); });
  }
  function toggleBoardMember(id: string, field: "dispatchers" | "techNames" | "roleKeys" | "jobTypes" | "serviceAreaIds", value: string) {
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
    // The default board is permanent — there's always at least one board so
    // adding technicians / scheduling never hits a "no board" state.
    const tgt = store?.boards.find(b => b.id === id);
    if (!tgt || tgt.isDefault) return;
    update(next => { next.boards = next.boards.filter(b => b.id !== id); });
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
      {/* Header — changes auto-save; no manual Save button. */}
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{activeContainer.label}</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{activeContainer.description}</p>
      </div>

      {/* Tabs — only the ones in this container */}
      <div className="flex items-center gap-1 flex-wrap">
        {containerTabs.map(t => {
          const active = curTab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: active ? "var(--accent-soft-bg)" : "transparent", color: active ? "var(--accent-text)" : "var(--text-muted)", border: `1px solid ${active ? "var(--accent-soft-border)" : "transparent"}` }}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── DEFAULTS TAB (default view/mode + hourly grid) ── */}
      {curTab === "defaults" && (
        <>
          {/* Default view — icon cards */}
          <SettingsCard icon={CalendarDays} title="Default View" subtitle="What the Dispatching module opens to."
            action={level !== "org" ? <OverrideToggle on={isOverridden("defaults")} onChange={v => setOverride("defaults", v)} /> : undefined}>
            {!isOverridden("defaults") ? (
              <InheritedNote scope={scopeNoun} summary={`${labelView(defaultsVal.defaultView)} · ${defaultsVal.defaultDispatchMode === "hourly" ? "Hourly" : "Service blocks"}`} />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {VIEW_OPTIONS.map(o => {
                    const active = defaultsVal.defaultView === o.value;
                    return (
                      <button key={o.value} onClick={() => editSection("defaults", sc => { sc.defaults!.defaultView = o.value; })}
                        className="flex flex-col items-center text-center gap-2 rounded-xl py-4 px-2 transition-all"
                        style={{
                          border: `1.5px solid ${active ? "var(--accent-soft-border)" : "var(--border)"}`,
                          backgroundColor: active ? "var(--accent-soft-bg)" : "var(--bg-surface-2)",
                          color: active ? "var(--accent-text)" : "var(--text-secondary)",
                        }}>
                        <o.icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{o.label}</span>
                        <span className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>{o.hint}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <FieldLabel>Dispatch board mode</FieldLabel>
                  <Segmented<DispatchMode> value={defaultsVal.defaultDispatchMode}
                    onChange={v => editSection("defaults", sc => { sc.defaults!.defaultDispatchMode = v; })}
                    options={[{ value: "hourly", label: "Hourly grid" }, { value: "blocks", label: "Service blocks" }]} />
                </div>
              </>
            )}
          </SettingsCard>

          {/* Working hours */}
          <SettingsCard icon={Clock} title="Working Hours" subtitle="The schedule window and granularity shown on the hourly board."
            action={level !== "org" ? <OverrideToggle on={isOverridden("hourly")} onChange={v => setOverride("hourly", v)} /> : undefined}>
            {!isOverridden("hourly") ? (
              <InheritedNote scope={scopeNoun} summary={`${formatHour(hourlyVal.startHour)} – ${formatHour(hourlyVal.endHour)} · ${hourlyVal.increment} min`} />
            ) : (
              <>
                <div className="rounded-lg px-3 py-2 mb-4 inline-flex items-center gap-2 text-sm font-medium"
                  style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>
                  <Clock className="w-3.5 h-3.5" />
                  {formatHour(hourlyVal.startHour)} – {formatHour(hourlyVal.endHour)}
                  <span style={{ opacity: 0.6 }}>· {hourlyVal.increment}-min slots</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Day starts</FieldLabel>
                    <UiSelect value={String(hourlyVal.startHour)} onChange={v => editSection("hourly", sc => { sc.hourly!.startHour = Number(v); })} options={HOUR_OPTIONS} />
                  </div>
                  <div>
                    <FieldLabel>Day ends</FieldLabel>
                    <UiSelect value={String(hourlyVal.endHour)} onChange={v => editSection("hourly", sc => { sc.hourly!.endHour = Number(v); })} options={HOUR_OPTIONS} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <FieldLabel>Time increment</FieldLabel>
                    <Segmented<string> value={String(hourlyVal.increment)}
                      onChange={v => editSection("hourly", sc => { sc.hourly!.increment = Number(v) as HourIncrement; })}
                      options={[{ value: "15", label: "15m" }, { value: "30", label: "30m" }, { value: "60", label: "60m" }]} />
                  </div>
                  <div>
                    <FieldLabel>Time labels</FieldLabel>
                    <Segmented<HourLabelStyle> value={hourlyVal.labelStyle}
                      onChange={v => editSection("hourly", sc => { sc.hourly!.labelStyle = v; })}
                      options={[{ value: "hours", label: "Hourly" }, { value: "all", label: "Every slot" }]} />
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
      {curTab === "blocks" && (
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
                  <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", opacity: b.active ? 1 : 0.5 }}>
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
      {curTab === "boards" && (
        <SettingsCard icon={Users} title="Dispatch Boards / Teams" subtitle="Group dispatchers, technicians, and job types into a board. Assign members by user or by role."
          action={
            <button onClick={addBoard} disabled={!scopeReady} title={scopeReady ? "Add board" : "Select a company / branch first"}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-white transition-colors hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: "#4f46e5" }}>
              <Plus className="w-4 h-4" />
            </button>
          }>
          <div className="space-y-3">
            {!scopeReady ? (
              <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>
                Select a {level === "company" ? "company" : "company and branch"} in the Editing Scope above to add a board for it.
              </p>
            ) : (
              <>
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
                    No dispatch boards for {scopeNoun} yet. Add one to get started.
                  </p>
                )}
              </>
            )}
          </div>
        </SettingsCard>
      )}

      {/* ── CALENDAR LAYERS TAB ── */}
      {curTab === "layers" && (
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
                  <div key={layer.type} className="grid items-center px-1 py-2 rounded-lg" style={{ gridTemplateColumns: "1fr auto auto auto", gap: "1.5rem", borderTop: "1px solid var(--border)", opacity: layer.enabled ? 1 : 0.5 }}>
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
      {curTab === "queue" && (
        <SettingsCard icon={Inbox} title="Unscheduled Queue Views" subtitle="The core categories (Jobs, Agreements, Tasks, Quotes, Projects) are locked and always shown. Add your own views on top — each view is a filter."
          action={
            <button onClick={addQueueView} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
              <Plus className="w-3.5 h-3.5" /> Add View
            </button>
          }>
          <div className="space-y-2.5">
            {sortedViews.map((v, i) => (
              <QueueViewCard key={v.id} view={v} first={i === 0} last={i === sortedViews.length - 1}
                expanded={editingView === v.id}
                onToggleExpand={() => setEditingView(cur => (cur === v.id ? null : v.id))}
                onMove={dir => moveQueueView(v.id, dir)}
                onPatch={p => patchQueueView(v.id, p)}
                onToggleFilter={(f, val) => toggleQueueFilter(v.id, f, val)}
                onSetDue={d => setQueueDue(v.id, d)}
                onRemove={() => removeQueueView(v.id)} />
            ))}
            {sortedViews.length === 0 && <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>No queue views. Add one to create a tab.</p>}
          </div>
          <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
            Core categories are locked and always shown; each has its own settings. Custom views you add can be edited or removed. Queue views currently apply across all boards.
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
  const members = [
    ...board.techNames,
    ...(board.roleKeys ?? []).map(k => `${getRoleLabel(k)} (role)`),
  ];
  return (
    <div className="rounded-xl p-4" style={{ border: board.isDefault ? "1px solid #c7d2fe" : "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{board.name}</p>
            {board.isDefault && <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}><Star className="w-2.5 h-2.5" /> Default</span>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span><span style={{ color: "var(--text-muted)" }}>Dispatchers:</span> {board.dispatchers.length ? board.dispatchers.join(", ") : "—"}</span>
            <span><span style={{ color: "var(--text-muted)" }}>Members:</span> {members.length ? members.join(", ") : "All technicians"}</span>
            <span><span style={{ color: "var(--text-muted)" }}>Job types:</span> {board.jobTypes.length ? board.jobTypes.map(jobTypeLabel).join(", ") : "All"}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!board.isDefault && <button onClick={onSetDefault} title="Set as default" className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Star className="w-3.5 h-3.5" /></button>}
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
          {!board.isDefault && <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
      </div>
    </div>
  );
}

function BoardEditor({ board, onPatch, onToggleMember, onDone }: {
  board: DispatchBoard;
  onPatch: (p: Partial<DispatchBoard>) => void;
  onToggleMember: (field: "dispatchers" | "techNames" | "roleKeys" | "jobTypes" | "serviceAreaIds", value: string) => void;
  onDone: () => void;
}) {
  const roleDefs = getAssignableRoles();
  // Only people whose assignment scope is within this board's scope are eligible
  // (down-inclusion); role-appropriate people are suggested first in the picker.
  const bCo = board.companyId || undefined;
  const bLoc = board.locationId || undefined;
  const allStaff = getBoardCandidateNames(bCo, bLoc);
  // Job-type options come from the configured Job Types (active ones), keyed. Any
  // key already on the board is unioned in so a stale/inactive selection stays
  // visible and removable. The board stores keys; the picker shows labels.
  const jtKeys = Array.from(new Set([...getJobTypes().filter(t => t.active).map(t => t.key), ...board.jobTypes]));
  const jtLabels = Object.fromEntries(jtKeys.map(k => [k, jobTypeLabel(k)]));
  // Picking a board type stamps the type label and, when that type maps to a job
  // type (Install/Maintenance), auto-adds the matching Job Types chip so the two
  // can't drift apart. Service/Commercial/Custom leave Job Types as-is.
  function changeBoardType(t: BoardType) {
    const jt = BOARD_TYPE_JOB_TYPE[t];
    const jobTypes = jt && !board.jobTypes.includes(jt) ? [...board.jobTypes, jt] : board.jobTypes;
    onPatch({ boardType: t, jobTypes });
  }
  return (
    <div className="rounded-xl p-4 space-y-4" style={{ border: "2px solid #c7d2fe", backgroundColor: "var(--bg-surface)" }}>
      <div>
        <FieldLabel>Board Name</FieldLabel>
        <input value={board.name} onChange={e => onPatch({ name: e.target.value })}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
      </div>
      <div>
        <FieldLabel>Board Type</FieldLabel>
        <UiSelect value={board.boardType}
          onChange={v => changeBoardType(v as BoardType)}
          options={(Object.keys(BOARD_TYPE_LABELS) as BoardType[]).map(t => ({ value: t, label: BOARD_TYPE_LABELS[t] }))} />
        <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>Install and Maintenance add their matching job type below automatically. Service, Commercial, and Custom leave job types up to you.</p>
      </div>
      <div>
        <FieldLabel>Dispatchers — who runs this board</FieldLabel>
        <PeoplePicker title="Add dispatchers" allNames={allStaff} suggested={getDispatcherCandidates(bCo, bLoc)}
          selected={board.dispatchers} onToggle={v => onToggleMember("dispatchers", v)} emptyLabel="No dispatchers yet" />
      </div>
      <div>
        <FieldLabel>Members — people scheduled on this board</FieldLabel>
        <PeoplePicker title="Add members" allNames={allStaff} suggested={getTechnicianCandidates(bCo, bLoc)}
          selected={board.techNames} onToggle={v => onToggleMember("techNames", v)} emptyLabel="No members yet" />
      </div>
      <div>
        <FieldLabel>…or add members by role</FieldLabel>
        <MultiSelect options={roleDefs.map(r => ({ value: r.key, label: r.label }))} selected={board.roleKeys ?? []} onToggle={v => onToggleMember("roleKeys", v)} placeholder="Select roles…" />
        <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>Anyone holding a selected role is automatically a member. Only members (added by name or role) appear on the board — dispatchers don&apos;t, unless they&apos;re also members.</p>
      </div>
      <div>
        <FieldLabel>Job Types — work this board handles</FieldLabel>
        <TagPicker title="Add job types" all={jtKeys} labels={jtLabels} selected={board.jobTypes}
          onToggle={v => onToggleMember("jobTypes", v)} emptyLabel="Any job type" searchPlaceholder="Search job types…" />
        <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>The board claims queue items and jobs matching any of these types. Leave empty to rely on the branch&apos;s default board.</p>
      </div>
      <div className="flex justify-end pt-1">
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
  if (f.jobTypes?.length) parts.push(f.jobTypes.map(jobTypeLabel).join(", "));
  if (f.dueWithinDays != null) parts.push(f.dueWithinDays === 0 ? "Due today" : `Due ≤ ${f.dueWithinDays}d`);
  return parts.length ? parts.join(" · ") : "All items (no filter)";
}

// A queue view as an expandable card. Locked (core) views show a slim settings
// panel (their own options only); custom views show the full filter editor.
function QueueViewCard({ view, first, last, expanded, onToggleExpand, onMove, onPatch, onToggleFilter, onSetDue, onRemove }: {
  view: QueueView; first: boolean; last: boolean; expanded: boolean;
  onToggleExpand: () => void;
  onMove: (dir: -1 | 1) => void;
  onPatch: (p: Partial<QueueView>) => void;
  onToggleFilter: (field: "sourceTypes" | "priorities" | "jobTypes", value: string) => void;
  onSetDue: (days: number | undefined) => void;
  onRemove: () => void;
}) {
  const locked = !!view.system;
  return (
    <div className="rounded-xl overflow-hidden transition-colors"
      style={{ border: `1px solid ${expanded ? "var(--accent-soft-border)" : "var(--border-subtle)"}`, backgroundColor: "var(--bg-surface)" }}>
      <div className="flex items-center gap-3 px-3 py-2.5" style={{ opacity: view.active ? 1 : 0.55 }}>
        <div className="flex flex-col shrink-0">
          <button onClick={() => onMove(-1)} disabled={first} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
          <button onClick={() => onMove(1)} disabled={last} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
        </div>
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: view.color ?? "var(--border)" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{view.name}</p>
            {locked && <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}><Lock className="w-2.5 h-2.5" /> Core</span>}
            {!locked && !view.defaultVisible && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Hidden</span>}
          </div>
          <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {queueFilterSummary(view.filters)}{view.key === "agreement_visits" ? ` · ${view.leadDays ?? 30}-day lead` : ""}
          </p>
        </div>
        {!locked && <Toggle on={view.active} onChange={v => onPatch({ active: v })} />}
        <button onClick={onToggleExpand} title="Settings"
          className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: expanded ? "var(--accent-text)" : "var(--text-muted)" }}>
          <Settings2 className="w-3.5 h-3.5" />
        </button>
        {!locked && (
          <button onClick={onRemove} title="Delete view" className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}><Trash2 className="w-3.5 h-3.5" /></button>
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-3" style={{ borderTop: "1px solid var(--border)" }}>
          {locked
            ? <SystemViewSettings view={view} onPatch={onPatch} />
            : <CustomViewSettings view={view} onPatch={onPatch} onToggleFilter={onToggleFilter} onSetDue={onSetDue} />}
        </div>
      )}
    </div>
  );
}

// Tab-color swatch row, shared by both settings panels.
function ColorRow({ view, onPatch }: { view: QueueView; onPatch: (p: Partial<QueueView>) => void }) {
  return (
    <div className="flex items-center gap-1.5 pt-1">
      <button onClick={() => onPatch({ color: undefined })} title="No color"
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ border: "1px solid var(--border)", color: "var(--text-muted)", outline: !view.color ? "2px solid var(--text-primary)" : "none", outlineOffset: "1px" }}>—</button>
      {QV_SWATCHES.map(c => (
        <button key={c} onClick={() => onPatch({ color: c })}
          className="w-5 h-5 rounded-full" style={{ backgroundColor: c, outline: view.color === c ? "2px solid var(--text-primary)" : "none", outlineOffset: "1px" }} />
      ))}
    </div>
  );
}

// Settings for a locked core view — its own options only (no identity/source edits).
function SystemViewSettings({ view, onPatch }: { view: QueueView; onPatch: (p: Partial<QueueView>) => void }) {
  return (
    <div className="space-y-3 pt-3">
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Core category — always shown and can&apos;t be removed. Its source type is fixed.</p>
      {view.key === "agreement_visits" && (
        <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5" style={{ backgroundColor: "var(--bg-surface-2)" }}>
          <div className="min-w-0">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Lead time</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Days before its due date a visit enters the queue.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input type="number" min={0} value={view.leadDays ?? 30}
              onChange={e => onPatch({ leadDays: Math.max(0, parseInt(e.target.value) || 0) })}
              className="w-20 rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>days</span>
          </div>
        </div>
      )}
      <div><FieldLabel>Tab Color</FieldLabel><ColorRow view={view} onPatch={onPatch} /></div>
    </div>
  );
}

// Full editor for a custom view.
function CustomViewSettings({ view, onPatch, onToggleFilter, onSetDue }: {
  view: QueueView;
  onPatch: (p: Partial<QueueView>) => void;
  onToggleFilter: (field: "sourceTypes" | "priorities" | "jobTypes", value: string) => void;
  onSetDue: (days: number | undefined) => void;
}) {
  const sourceKeys = Object.keys(SOURCE_TYPE_LABELS) as QueueSourceType[];
  // Job-type filter options: configured active types (keyed) plus any stale key the
  // view already filters on, so it stays visible/removable. Stored as keys, shown as labels.
  const jtFilterKeys = Array.from(new Set([...getJobTypes().filter(t => t.active).map(t => t.key), ...(view.filters.jobTypes ?? [])]));
  const jtFilterLabels = Object.fromEntries(jtFilterKeys.map(k => [k, jobTypeLabel(k)]));
  return (
    <div className="space-y-4 pt-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FieldLabel>View Name</FieldLabel>
          <input value={view.name} onChange={e => onPatch({ name: e.target.value })}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <FieldLabel>Tab Color</FieldLabel>
          <ColorRow view={view} onPatch={onPatch} />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer pb-2">
            <Toggle on={view.defaultVisible} onChange={v => onPatch({ defaultVisible: v })} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Show as tab</span>
          </label>
        </div>
      </div>
      <div><FieldLabel>Source Types</FieldLabel><ChipMulti all={sourceKeys} labels={SOURCE_TYPE_LABELS} selected={view.filters.sourceTypes ?? []} onToggle={v => onToggleFilter("sourceTypes", v)} /></div>
      <div><FieldLabel>Priority</FieldLabel><ChipMulti all={PRIORITY_OPTIONS} labels={PRIORITY_LABELS} selected={view.filters.priorities ?? []} onToggle={v => onToggleFilter("priorities", v)} /></div>
      <div><FieldLabel>Job Types</FieldLabel><ChipMulti all={jtFilterKeys} labels={jtFilterLabels} selected={view.filters.jobTypes ?? []} onToggle={v => onToggleFilter("jobTypes", v)} /></div>
      <div className="flex items-center gap-3">
        <FieldLabel>Due Within</FieldLabel>
        <div className="-mt-1.5 w-44">
          <UiSelect value={view.filters.dueWithinDays == null ? "any" : String(view.filters.dueWithinDays)}
            onChange={val => onSetDue(val === "any" ? undefined : Number(val))} options={DUE_OPTIONS} />
        </div>
      </div>
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Empty filters match every queue item.</p>
    </div>
  );
}
