"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  Inbox, Search, SlidersHorizontal, Layers, Eye, EyeOff,
  ChevronLeft, ChevronRight, LayoutGrid, CalendarDays, CalendarRange, CalendarClock,
} from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import CalendarItemDrawer from "@/components/calendar/CalendarItemDrawer";
import ScheduleConfirmModal, { type ScheduleDraft } from "@/components/calendar/ScheduleConfirmModal";
import Select from "@/components/ui/Select";
import {
  getCalendarItems, getUnscheduledItems, getTechnicians, getTechRoster, getDispatchBoards, type CalendarScope,
} from "@/lib/calendar/data";
import {
  LAYER_CONFIG, CALENDAR_LAYERS, PRIORITY_CONFIG, TECH_STATUS_CONFIG, SERVICE_BLOCKS,
  DAY_START_HOUR, DAY_END_HOUR, HOUR_PX,
  type CalendarItem, type CalendarItemType, type UnscheduledItem, type DispatchMode,
} from "@/lib/calendar/types";
import { getDispatchSettings } from "@/lib/calendar/settings";

type CalendarView = "dispatch" | "day" | "week" | "month";

// ─── Date helpers ─────────────────────────────────────────
function startOfWeek(d: Date): Date { const r = new Date(d); r.setHours(0,0,0,0); r.setDate(r.getDate() - r.getDay()); return r; }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function addMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function isSameDay(a: Date, b: Date): boolean { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function fmtTime(d: Date): string { return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
function ymd(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function minutesFromDayStart(d: Date): number { return (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes(); }
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
function hourLabel(h: number): string { return `${h > 12 ? h - 12 : h}${h >= 12 ? "p" : "a"}`; }

export default function CalendarPage() {
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();
  const scope: CalendarScope = { companyId: effectiveCompanyId, locationId: effectiveLocationId, serviceAreaId: effectiveServiceAreaId };

  const [view, setView]           = useState<CalendarView>("dispatch");
  const [dispatchMode, setMode]   = useState<DispatchMode>("hourly");
  const [focus, setFocus]         = useState(() => new Date());
  const [hidden, setHidden]       = useState<Set<CalendarItemType>>(new Set());

  // Seed the initial view, mode, and layer visibility from saved Settings
  // → Operations → Calendar / Dispatch. Settings define the *defaults*; once the
  // board is open the controls below take over. Runs once on mount.
  useEffect(() => {
    const cfg = getDispatchSettings();
    setView(cfg.defaultView);
    setMode(cfg.defaultDispatchMode);
    const off = new Set<CalendarItemType>(
      cfg.layers.filter(l => !l.enabled || !l.visibleByDefault).map(l => l.type),
    );
    if (off.size) setHidden(off);
  }, []);
  // Per-item edits made on the board: reassignment, moved time, resized duration.
  const [edits, setEdits]         = useState<Record<string, { start?: Date; durationMinutes?: number; assignedTo?: string }>>({});
  const [boardId, setBoardId]     = useState("all");

  // Scheduling state
  const [extra, setExtra]         = useState<CalendarItem[]>([]);
  const [removed, setRemoved]     = useState<Set<string>>(new Set());
  const [confirm, setConfirm]     = useState<{ item: UnscheduledItem; draft: ScheduleDraft } | null>(null);

  // Selection (drawer)
  const [selScheduled, setSelScheduled]     = useState<CalendarItem | null>(null);
  const [selUnscheduled, setSelUnscheduled] = useState<UnscheduledItem | null>(null);

  // Queue triage
  const [queueTab, setQueueTab]   = useState<"all" | "urgent" | CalendarItemType>("all");
  const [queueSearch, setQueueSearch] = useState("");

  // Advanced filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const [fTech, setFTech] = useState("all");
  const [fType, setFType] = useState("all");
  const [fPrio, setFPrio] = useState("all");

  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e: MouseEvent) => { if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filtersOpen]);

  // Combined layers legend popover
  const [layersOpen, setLayersOpen] = useState(false);
  const layersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!layersOpen) return;
    const onDown = (e: MouseEvent) => { if (layersRef.current && !layersRef.current.contains(e.target as Node)) setLayersOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [layersOpen]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rawItems    = useMemo(() => getCalendarItems(scope), [effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allUnscheduled = useMemo(() => getUnscheduledItems(scope), [effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId]);
  const roster      = getTechRoster();
  const technicians = useMemo(() => Array.from(new Set([...roster.map(r => r.name), ...getTechnicians(rawItems)])), [rawItems, roster]);

  // Dispatch board / team selector — filters which technician rows show.
  const boards      = getDispatchBoards();
  const activeBoard = boards.find(b => b.id === boardId) ?? boards[0];
  const boardRoster = activeBoard.techNames.length === 0
    ? roster
    : roster.filter(r => activeBoard.techNames.includes(r.name));

  const items = useMemo(() => [...rawItems, ...extra]
    .map(i => {
      const e = edits[i.id];
      if (!e) return i;
      const start = e.start ?? i.start;
      const durationMinutes = e.durationMinutes ?? i.durationMinutes;
      return { ...i, start, end: new Date(start.getTime() + durationMinutes * 60_000), durationMinutes, assignedTo: e.assignedTo ?? i.assignedTo };
    })
    .filter(i => !hidden.has(i.type))
    .filter(i => fTech === "all" || i.assignedTo === fTech)
    .filter(i => fType === "all" || i.jobType === fType)
    .filter(i => fPrio === "all" || i.priority === fPrio),
    [rawItems, extra, edits, hidden, fTech, fType, fPrio]);

  const unscheduled = allUnscheduled.filter(u => !removed.has(u.id));
  const jobTypes = useMemo(() => Array.from(new Set(rawItems.map(i => i.jobType).filter(Boolean))) as string[], [rawItems]);
  const activeFilters = [fTech !== "all", fType !== "all", fPrio !== "all", boardId !== "all"].filter(Boolean).length;
  const availableLayers = CALENDAR_LAYERS.filter(t => ["job","agreement_visit","task","project_milestone"].includes(t) && rawItems.some(i => i.type === t));
  const activeLayerCount = availableLayers.filter(t => !hidden.has(t)).length;

  function toggleLayer(t: CalendarItemType) { setHidden(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; }); }
  function reassign(tech: string) {
    if (selScheduled) { setEdits(e => ({ ...e, [selScheduled.id]: { ...e[selScheduled.id], assignedTo: tech } })); setSelScheduled({ ...selScheduled, assignedTo: tech }); }
  }
  // Commit a drag-move or drag-resize from the board (tech set when moved across rows).
  function applyMoveResize(id: string, start: Date, durationMinutes: number, tech?: string) {
    setEdits(e => ({ ...e, [id]: { ...e[id], start, durationMinutes, ...(tech ? { assignedTo: tech } : {}) } }));
  }

  // ── Scheduling ──
  function openConfirm(u: UnscheduledItem, tech: string, day: Date, hour: number, minute = 0) {
    setConfirm({ item: u, draft: { tech, date: ymd(day), time: `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`, durationMinutes: u.durationMinutes } });
  }
  function scheduleFromDrawer(u: UnscheduledItem) {
    setSelUnscheduled(null);
    openConfirm(u, "", focus, 9);
  }
  function confirmSchedule(d: ScheduleDraft) {
    if (!confirm) return;
    const u = confirm.item;
    const start = new Date(`${d.date}T${d.time}`);
    const end = new Date(start.getTime() + d.durationMinutes * 60_000);
    const newItem: CalendarItem = {
      id: `sched-${u.id}`, type: u.type === "job" ? "job" : u.type, title: u.title,
      start, end, allDay: false, durationMinutes: d.durationMinutes,
      assignedTo: d.tech || undefined, assignedToInitials: d.tech ? initials(d.tech) : undefined,
      companyId: u.companyId, locationId: u.locationId,
      sourceId: u.sourceId, sourceModule: u.sourceModule,
      status: "Scheduled", color: u.color,
      customerName: u.customerName, address: u.address, city: u.city,
      jobType: u.jobType, priority: u.priority,
    };
    setExtra(e => [...e, newItem]);
    setRemoved(r => new Set(r).add(u.id));
    setConfirm(null);
  }

  // Date nav
  const step = view === "week" ? 7 : 1;
  function navigate(dir: number) { setFocus(f => view === "month" ? addMonths(f, dir) : addDays(f, dir * step)); }
  const rangeLabel = view === "week"
    ? `${startOfWeek(focus).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(startOfWeek(focus), 6).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : view === "month"
    ? focus.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : focus.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="p-6 space-y-4">
      {/* Header — title (left) · centered date nav (date above arrows) · Hourly toggle (right) */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Dispatching</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Dispatch command center — schedule and assign jobs</p>
        </div>

        {/* Center: date label above the arrows, centered */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{rangeLabel}</span>
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <button onClick={() => navigate(-1)} title="Previous" className="px-2.5 py-1.5 transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setFocus(new Date())} className="px-4 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)", borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>Today</button>
            <button onClick={() => navigate(1)} title="Next" className="px-2.5 py-1.5 transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Right: Hourly / Service Blocks toggle */}
        <div className="flex-1 flex justify-end min-w-0">
          {view === "dispatch" && (
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {([{ key: "hourly", label: "Hourly View" }, { key: "blocks", label: "Service Blocks" }] as const).map(m => {
                const active = dispatchMode === m.key;
                return (
                  <button key={m.key} onClick={() => setMode(m.key)} className="px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-muted)" }}>
                    {m.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Controls — view switch (left) · Layers legend + Filter (right) */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {([
            { key: "dispatch", icon: LayoutGrid,    label: "Dispatch" },
            { key: "day",      icon: CalendarDays,  label: "Day" },
            { key: "week",     icon: CalendarRange, label: "Week" },
            { key: "month",    icon: CalendarClock, label: "Month" },
          ] as const).map(v => {
            const active = view === v.key;
            return (
              <button key={v.key} onClick={() => setView(v.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
                style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)" }}>
                <v.icon className="w-3.5 h-3.5" /> {v.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Combined Layers legend */}
          {availableLayers.length > 0 && (
            <div className="relative" ref={layersRef}>
              <button onClick={() => setLayersOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)" }}>
                <Layers className="w-3.5 h-3.5" /> Layers
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{activeLayerCount}/{availableLayers.length}</span>
              </button>
              {layersOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-3 w-56" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Visible Layers</p>
                  <div className="space-y-0.5">
                    {availableLayers.map(type => {
                      const cfg = LAYER_CONFIG[type]; const on = !hidden.has(type);
                      return (
                        <button key={type} onClick={() => toggleLayer(type)}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors hover:bg-[var(--bg-surface-2)]">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                            <span className="truncate" style={{ color: "var(--text-primary)" }}>{cfg.label}</span>
                          </span>
                          {on ? <Eye className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent-text)" }} /> : <EyeOff className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Filter — Board is the first filter */}
          <div className="relative" ref={filtersRef}>
            <button onClick={() => setFiltersOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ border: `1px solid ${activeFilters ? "var(--accent-soft-border)" : "var(--border)"}`, backgroundColor: activeFilters ? "var(--accent-soft-bg)" : "var(--bg-surface)", color: activeFilters ? "var(--accent-text)" : "var(--text-secondary)" }}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
              {activeFilters > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text)" }}>{activeFilters}</span>}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 w-72" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>
                  {activeFilters > 0 && <button onClick={() => { setBoardId("all"); setFTech("all"); setFType("all"); setFPrio("all"); }} className="text-xs" style={{ color: "var(--accent-text)" }}>Clear all</button>}
                </div>
                <div className="space-y-2.5">
                  <FilterField label="Dispatch Board">
                    <Select size="sm" value={boardId} onChange={setBoardId} options={boards.map(b => ({ value: b.id, label: b.name }))} />
                    {activeBoard.dispatcher && <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Dispatcher: {activeBoard.dispatcher}</p>}
                  </FilterField>
                  <FilterField label="Technician"><Select size="sm" value={fTech} onChange={setFTech} options={[{ value: "all", label: "All Technicians" }, ...technicians.map(t => ({ value: t, label: t }))]} /></FilterField>
                  <FilterField label="Job Type"><Select size="sm" value={fType} onChange={setFType} options={[{ value: "all", label: "All Types" }, ...jobTypes.map(t => ({ value: t, label: t }))]} /></FilterField>
                  <FilterField label="Priority"><Select size="sm" value={fPrio} onChange={setFPrio} options={[{ value: "all", label: "Any Priority" }, { value: "urgent", label: "Urgent" }, { value: "high", label: "High" }, { value: "normal", label: "Normal" }, { value: "low", label: "Low" }]} /></FilterField>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Board */}
      {view === "dispatch" && <DispatchBoard focus={focus} mode={dispatchMode} items={items} roster={boardRoster} onSelect={setSelScheduled} onMoveResize={applyMoveResize} onDropItem={(uid, tech, hour, minute) => { const u = unscheduled.find(x => x.id === uid); if (u) openConfirm(u, tech, focus, hour, minute); }} />}
      {view === "week"     && <WeekView  focus={focus} items={items} onSelect={setSelScheduled} />}
      {view === "day"      && <DayView   focus={focus} items={items} onSelect={setSelScheduled} />}
      {view === "month"    && <MonthView focus={focus} items={items} onSelect={setSelScheduled} />}

      {/* Unscheduled queue — BELOW the board */}
      <UnscheduledQueue
        items={unscheduled} tab={queueTab} setTab={setQueueTab}
        search={queueSearch} setSearch={setQueueSearch} onSelect={setSelUnscheduled}
      />

      {/* Drawer */}
      {selScheduled && <CalendarItemDrawer scheduled={selScheduled} technicians={technicians} onClose={() => setSelScheduled(null)} onReassign={reassign} />}
      {selUnscheduled && <CalendarItemDrawer unscheduled={selUnscheduled} technicians={technicians} onClose={() => setSelUnscheduled(null)} onSchedule={() => scheduleFromDrawer(selUnscheduled)} />}

      {/* Confirm modal */}
      {confirm && <ScheduleConfirmModal item={confirm.item} draft={confirm.draft} technicians={technicians} onConfirm={confirmSchedule} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function initials(name: string): string {
  const p = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length-1][0] : name.slice(0,2)).toUpperCase();
}

// ─── Dispatch board ───────────────────────────────────────
const TOTAL_MIN = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const ROW_H = 64;

const SNAP = 15;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
function startMinOf(i: CalendarItem) { return (i.start.getHours() - DAY_START_HOUR) * 60 + i.start.getMinutes(); }
function minToTime(min: number) { const h = DAY_START_HOUR + Math.floor(min / 60); const m = min % 60; return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")}${h >= 12 ? "p" : "a"}`; }

function DispatchBoard({ focus, mode, items, roster, onSelect, onMoveResize, onDropItem }: {
  focus: Date; mode: DispatchMode; items: CalendarItem[];
  roster: ReturnType<typeof getTechRoster>;
  onSelect: (i: CalendarItem) => void;
  onMoveResize: (id: string, start: Date, durationMinutes: number, tech?: string) => void;
  onDropItem: (uid: string, tech: string, hour: number, minute: number) => void;
}) {
  const dayItems = items.filter(i => isSameDay(i.start, focus) && !i.allDay);

  // Live preview while moving / resizing a block (tech = target row); queue-drag row.
  const [preview, setPreview] = useState<{ id: string; startMin: number; durationMinutes: number; tech: string } | null>(null);
  const [dragTech, setDragTech] = useState<string | null>(null);

  const labels = mode === "blocks"
    ? SERVICE_BLOCKS.map(b => ({ key: b.key, label: b.label, span: b.endHour - b.startHour }))
    : HOURS.map(h => ({ key: `h${h}`, label: hourLabel(h), span: 1 }));
  const gridCells = mode === "blocks"
    ? SERVICE_BLOCKS.map(b => ({ key: b.key, span: (b.endHour - b.startHour) * 60, half: false }))
    : HOURS.flatMap(h => [{ key: `${h}:00`, span: 30, half: false }, { key: `${h}:30`, span: 30, half: true }]);

  function commitFromX(clientX: number, track: HTMLElement): number {
    const rect = track.getBoundingClientRect();
    return clamp(((clientX - rect.left) / rect.width) * TOTAL_MIN, 0, TOTAL_MIN);
  }

  // Pointer-driven move (drag body, across rows) / resize (drag right edge).
  function beginDrag(e: React.MouseEvent, item: CalendarItem, kind: "move" | "resize") {
    e.preventDefault(); e.stopPropagation();
    const blockEl = (e.currentTarget as HTMLElement).closest("[data-block]") as HTMLElement | null;
    const track   = blockEl?.closest("[data-track]") as HTMLElement | null;
    if (!track || !blockEl) return;
    const base = startMinOf(item); const dur0 = item.durationMinutes;
    const grab = commitFromX(e.clientX, track) - base;
    let moved = false; let curStart = base; let curDur = dur0; let curTech = item.assignedTo ?? "";
    document.body.style.userSelect = "none";
    if (kind === "move") blockEl.style.pointerEvents = "none"; // so elementFromPoint sees the row below
    const onMove = (ev: MouseEvent) => {
      const mm = commitFromX(ev.clientX, track);
      if (Math.abs(mm - (base + grab)) > 2) moved = true;
      if (kind === "move") {
        curStart = clamp(snap(mm - grab), 0, TOTAL_MIN - dur0); curDur = dur0;
        const overTrack = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest("[data-track]") as HTMLElement | null;
        if (overTrack?.dataset.tech) curTech = overTrack.dataset.tech;
      } else { curDur = clamp(snap(mm - base), 30, TOTAL_MIN - base); curStart = base; }
      setPreview({ id: item.id, startMin: curStart, durationMinutes: curDur, tech: curTech });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      blockEl.style.pointerEvents = "";
      setPreview(null);
      if (moved) {
        const nd = new Date(focus); nd.setHours(DAY_START_HOUR + Math.floor(curStart / 60), curStart % 60, 0, 0);
        onMoveResize(item.id, nd, curDur, kind === "move" ? curTech : undefined);
      } else {
        onSelect(item);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {/* Header */}
      <div className="flex" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <div className="w-[180px] shrink-0 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Technician</div>
        <div className="flex-1 flex">
          {labels.map(l => (
            <div key={l.key} className="px-2 py-2 text-[10px] font-semibold text-center" style={{ flex: l.span, color: "var(--text-muted)", borderLeft: "1px solid var(--border-subtle)" }}>{l.label}</div>
          ))}
        </div>
      </div>

      {/* Tech rows */}
      {roster.length === 0 ? (
        <div className="py-12 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No technicians on this board.</p></div>
      ) : roster.map((tech, ri) => {
        const techItems = dayItems.filter(i => (i.assignedTo ?? "") === tech.name);
        const sc = TECH_STATUS_CONFIG[tech.status];
        const bookedMin = techItems.reduce((s, i) => s + i.durationMinutes, 0);
        const openHrs = Math.max(0, Math.round((TOTAL_MIN - bookedMin) / 60));
        const isDropTarget = dragTech === tech.name || (preview != null && preview.tech === tech.name);
        return (
          <div key={tech.name} className="flex" style={{ borderBottom: ri < roster.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
            {/* Tech cell */}
            <div className="w-[180px] shrink-0 px-3 py-2.5 flex items-start gap-2" style={{ borderRight: "1px solid var(--border-subtle)" }}>
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">{tech.initials}</div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{tech.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.color }} />
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{sc.label}</span>
                </div>
                <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>{techItems.length} job{techItems.length===1?"":"s"} · ~{openHrs}h open</p>
              </div>
            </div>

            {/* Time track — drop target (queue → schedule) + interactive blocks */}
            <div data-track data-tech={tech.name}
              className="flex-1 relative transition-colors"
              style={{ height: `${ROW_H}px`, backgroundColor: isDropTarget ? "var(--accent-soft-bg)" : undefined }}
              onDragOver={e => { e.preventDefault(); if (dragTech !== tech.name) setDragTech(tech.name); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragTech(null); }}
              onDrop={e => {
                e.preventDefault(); setDragTech(null);
                const id = e.dataTransfer.getData("text/plain"); if (!id) return;
                const mm = Math.round(commitFromX(e.clientX, e.currentTarget) / 30) * 30;
                const safe = clamp(mm, 0, TOTAL_MIN - 30);
                onDropItem(id, tech.name, DAY_START_HOUR + Math.floor(safe / 60), safe % 60);
              }}>
              {/* Gridlines (visual only) */}
              <div className="absolute inset-0 flex pointer-events-none">
                {gridCells.map(c => <div key={c.key} className="h-full" style={{ flex: c.span, borderLeft: `1px ${c.half ? "dashed" : "solid"} var(--border-subtle)` }} />)}
              </div>

              {/* Job blocks */}
              {techItems.map(i => {
                const p = preview?.id === i.id ? preview : null;
                const sm = p ? p.startMin : startMinOf(i);
                const dur = p ? p.durationMinutes : i.durationMinutes;
                const left = clamp((sm / TOTAL_MIN) * 100, 0, 100);
                const width = Math.max(3, (Math.min(dur, TOTAL_MIN - sm) / TOTAL_MIN) * 100);
                const prio = i.priority && i.priority !== "normal" ? PRIORITY_CONFIG[i.priority] : null;
                const movingAway = p && p.tech !== (i.assignedTo ?? "");  // dragging to another tech
                return (
                  <div key={i.id} data-block
                    onMouseDown={e => beginDrag(e, i, "move")}
                    title="Drag to move (across techs) · drag right edge to resize"
                    className="absolute top-1.5 bottom-1.5 rounded-lg px-2 overflow-hidden select-none"
                    style={{ left: `${left}%`, width: `${width}%`, backgroundColor: i.color + "26", borderLeft: `3px solid ${i.color}`, cursor: p ? "grabbing" : "grab", boxShadow: p ? "0 4px 14px rgba(0,0,0,0.25)" : undefined, opacity: movingAway ? 0.55 : 1, zIndex: p ? 20 : 1 }}>
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] font-semibold truncate leading-tight pt-0.5" style={{ color: "var(--text-primary)" }}>{i.customerName ?? i.title}</p>
                      {movingAway && <span className="text-[8px] font-bold px-1 rounded shrink-0" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text)" }}>→ {p!.tech}</span>}
                      {!movingAway && prio && <span className="text-[8px] font-bold px-1 rounded shrink-0" style={{ backgroundColor: prio.bg, color: prio.color }}>{prio.label}</span>}
                    </div>
                    <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>
                      {p ? `${minToTime(sm)} · ${dur}m` : `${fmtTime(i.start)} · ${i.jobType ?? ""}${i.city ? ` · ${i.city}` : ""}`}
                    </p>
                    {/* Resize handle (right edge) */}
                    <div onMouseDown={e => beginDrag(e, i, "resize")}
                      className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize"
                      style={{ borderRight: `2px solid ${i.color}` }} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Unscheduled queue (triage, below board) ──────────────
function UnscheduledQueue({ items, tab, setTab, search, setSearch, onSelect }: {
  items: UnscheduledItem[];
  tab: "all" | "urgent" | CalendarItemType; setTab: (t: "all" | "urgent" | CalendarItemType) => void;
  search: string; setSearch: (s: string) => void;
  onSelect: (u: UnscheduledItem) => void;
}) {
  const TABS = [
    { key: "all",                label: "All" },
    { key: "urgent",             label: "Urgent" },
    { key: "job",                label: "Jobs" },
    { key: "agreement_visit",    label: "Agreement Visits" },
    { key: "sales_appointment",  label: "Sales Appointments" },
    { key: "task",               label: "Tasks" },
    { key: "project_milestone",  label: "Project Milestones" },
  ] as const;

  const filtered = items
    .filter(u => tab === "all" ? true : tab === "urgent" ? u.priority === "urgent" : u.type === tab)
    .filter(u => { if (!search) return true; const q = search.toLowerCase(); return u.title.toLowerCase().includes(q) || (u.customerName ?? "").toLowerCase().includes(q) || u.reason.toLowerCase().includes(q); });

  const count = (key: string) => key === "all" ? items.length : key === "urgent" ? items.filter(u => u.priority === "urgent").length : items.filter(u => u.type === key).length;

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Unscheduled Queue</p>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{items.length}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search queue…" className="bg-transparent text-sm outline-none w-40" style={{ color: "var(--text-primary)" }} />
        </div>
      </div>
      {/* Triage tabs */}
      <div className="flex items-center gap-0.5 px-3 py-2 flex-wrap" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        {TABS.map(t => {
          const active = tab === t.key; const c = count(t.key);
          if (c === 0 && t.key !== "all") return null;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{ backgroundColor: active ? "var(--accent-soft-bg)" : "transparent", color: active ? "var(--accent-text)" : "var(--text-muted)", border: `1px solid ${active ? "var(--accent-soft-border)" : "transparent"}` }}>
              {t.label}<span className="text-[10px] font-bold px-1 py-0.5 rounded-full" style={{ backgroundColor: active ? "var(--accent-soft-2-bg)" : "var(--bg-input)", color: active ? "var(--accent-text)" : "var(--text-muted)" }}>{c}</span>
            </button>
          );
        })}
      </div>
      {/* Cards grid */}
      <div className="p-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Nothing to triage here.</p>
        ) : (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {filtered.map(u => <QueueCard key={u.id} item={u} onSelect={onSelect} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function QueueCard({ item: u, onSelect }: { item: UnscheduledItem; onSelect: (u: UnscheduledItem) => void }) {
  const cfg = LAYER_CONFIG[u.type]; const prio = PRIORITY_CONFIG[u.priority];
  return (
    <div draggable onDragStart={e => e.dataTransfer.setData("text/plain", u.id)}
      onClick={() => onSelect(u)}
      className="rounded-lg p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderLeft: `3px solid ${u.color}` }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color + "22", color: cfg.color }}>{cfg.label}</span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: prio.bg, color: prio.color }}>{prio.label}</span>
        </div>
        {u.value && <span className="text-xs font-bold shrink-0" style={{ color: "var(--text-primary)" }}>{u.value}</span>}
      </div>
      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{u.title}</p>
      {u.customerName && <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{u.customerName}{u.city ? ` · ${u.city}` : ""}</p>}
      <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <span className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{u.reason}</span>
        <span className="text-[10px] shrink-0 ml-2" style={{ color: "var(--text-muted)" }}>{u.durationMinutes}m{u.preferredDate ? ` · ${u.preferredDate}` : ""}</span>
      </div>
    </div>
  );
}

// ─── Week / Day / Month views ─────────────────────────────
function ItemChip({ item, onSelect }: { item: CalendarItem; onSelect: (i: CalendarItem) => void }) {
  return (
    <button onClick={() => onSelect(item)} className="w-full text-left rounded-lg px-2 py-1.5 transition-opacity hover:opacity-90 overflow-hidden" style={{ backgroundColor: item.color + "1f", borderLeft: `3px solid ${item.color}` }}>
      <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{!item.allDay && <span style={{ color: item.color }}>{fmtTime(item.start)} </span>}{item.title}</p>
    </button>
  );
}

function WeekView({ focus, items, onSelect }: { focus: Date; items: CalendarItem[]; onSelect: (i: CalendarItem) => void }) {
  const weekStart = startOfWeek(focus); const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)); const today = new Date();
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="grid grid-cols-7">
        {days.map((day, di) => {
          const dayItems = items.filter(i => isSameDay(i.start, day)).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
          const isToday = isSameDay(day, today);
          return (
            <div key={di} style={{ borderLeft: di > 0 ? "1px solid var(--border-subtle)" : "none", minHeight: "400px" }}>
              <div className="px-2 py-2 text-center" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: isToday ? "var(--accent-soft-bg)" : "var(--bg-surface-2)" }}>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{day.toLocaleDateString("en-US", { weekday: "short" })}</p>
                <p className="text-sm font-bold" style={{ color: isToday ? "var(--accent-text)" : "var(--text-primary)" }}>{day.getDate()}</p>
              </div>
              <div className="p-1.5 space-y-1.5">{dayItems.length === 0 ? <p className="text-[10px] text-center py-3" style={{ color: "var(--text-muted)" }}>—</p> : dayItems.map(i => <ItemChip key={i.id} item={i} onSelect={onSelect} />)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ focus, items, onSelect }: { focus: Date; items: CalendarItem[]; onSelect: (i: CalendarItem) => void }) {
  const dayItems = items.filter(i => isSameDay(i.start, focus)); const allDay = dayItems.filter(i => i.allDay); const timed = dayItems.filter(i => !i.allDay);
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {allDay.length > 0 && <div className="p-2 space-y-1.5" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>{allDay.map(i => <ItemChip key={i.id} item={i} onSelect={onSelect} />)}</div>}
      <div className="relative" style={{ height: `${HOURS.length * HOUR_PX}px` }}>
        {HOURS.map((h, i) => <div key={h} className="absolute left-0 right-0 flex" style={{ top: `${i*HOUR_PX}px`, height: `${HOUR_PX}px`, borderTop: "1px solid var(--border-subtle)" }}><span className="text-[10px] px-2 pt-1 shrink-0 w-14" style={{ color: "var(--text-muted)" }}>{hourLabel(h)}</span></div>)}
        {timed.map(i => {
          const top = Math.max(0, (minutesFromDayStart(i.start)/60)*HOUR_PX); const height = Math.max(24, (i.durationMinutes/60)*HOUR_PX - 2);
          return (
            <button key={i.id} onClick={() => onSelect(i)} className="absolute rounded-lg px-2 py-1 text-left overflow-hidden transition-opacity hover:opacity-90" style={{ top: `${top}px`, height: `${height}px`, left: "60px", right: "8px", backgroundColor: i.color + "22", borderLeft: `3px solid ${i.color}` }}>
              <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{i.title}</p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{fmtTime(i.start)} · {i.assignedTo ?? "Unassigned"}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ focus, items, onSelect }: { focus: Date; items: CalendarItem[]; onSelect: (i: CalendarItem) => void }) {
  const monthStart = startOfMonth(focus); const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)); const today = new Date();
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="grid grid-cols-7" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: "var(--text-muted)" }}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, di) => {
          const inMonth = day.getMonth() === focus.getMonth(); const isToday = isSameDay(day, today);
          const dayItems = items.filter(i => isSameDay(i.start, day));
          return (
            <div key={di} className="p-1" style={{ minHeight: "92px", borderLeft: di % 7 > 0 ? "1px solid var(--border-subtle)" : "none", borderTop: di >= 7 ? "1px solid var(--border-subtle)" : "none", opacity: inMonth ? 1 : 0.4 }}>
              <p className="text-[10px] font-bold text-right px-1" style={{ color: isToday ? "var(--accent-text)" : "var(--text-muted)" }}>{day.getDate()}</p>
              <div className="space-y-0.5 mt-0.5">
                {dayItems.slice(0, 3).map(i => (
                  <button key={i.id} onClick={() => onSelect(i)} className="w-full text-left rounded px-1 py-0.5 truncate text-[9px] font-medium transition-opacity hover:opacity-80" style={{ backgroundColor: i.color + "22", color: "var(--text-primary)" }}>{i.title}</button>
                ))}
                {dayItems.length > 3 && <p className="text-[9px] px-1" style={{ color: "var(--text-muted)" }}>+{dayItems.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>{children}</div>;
}
