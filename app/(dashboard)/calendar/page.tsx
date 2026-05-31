"use client";

import { useMemo, useState } from "react";
import {
  Inbox,
  ChevronLeft, ChevronRight, LayoutGrid, CalendarDays, CalendarRange,
  PanelRightClose, PanelRightOpen, GripVertical,
} from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import CalendarItemDrawer from "@/components/calendar/CalendarItemDrawer";
import { getCalendarItems, getUnscheduledItems, getTechnicians, type CalendarScope } from "@/lib/calendar/data";
import {
  LAYER_CONFIG, CALENDAR_LAYERS, DAY_START_HOUR, DAY_END_HOUR, HOUR_PX,
  type CalendarItem, type CalendarItemType, type CalendarView,
} from "@/lib/calendar/types";

// ─── Date helpers ─────────────────────────────────────────
function startOfWeek(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0); r.setDate(r.getDate() - r.getDay()); return r;
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtTime(d: Date): string { return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
function minutesFromDayStart(d: Date): number { return (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes(); }
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

export default function CalendarPage() {
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();
  const scope: CalendarScope = {
    companyId: effectiveCompanyId, locationId: effectiveLocationId, serviceAreaId: effectiveServiceAreaId,
  };

  const [view, setView]         = useState<CalendarView>("week");
  const [focus, setFocus]       = useState(() => new Date());
  const [queueOpen, setQueueOpen] = useState(true);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [hidden, setHidden]     = useState<Set<CalendarItemType>>(new Set());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rawItems    = useMemo(() => getCalendarItems(scope), [effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const unscheduled = useMemo(() => getUnscheduledItems(scope), [effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId]);

  // Apply reassignment overrides + layer visibility
  const items = useMemo(() => rawItems
    .map(i => overrides[i.id] ? { ...i, assignedTo: overrides[i.id] } : i)
    .filter(i => !hidden.has(i.type)),
    [rawItems, overrides, hidden]);

  const technicians = useMemo(() => getTechnicians(rawItems), [rawItems]);

  function reassign(tech: string) {
    if (selected) {
      setOverrides(o => ({ ...o, [selected.id]: tech }));
      setSelected({ ...selected, assignedTo: tech });
    }
  }
  function toggleLayer(type: CalendarItemType) {
    setHidden(prev => { const n = new Set(prev); n.has(type) ? n.delete(type) : n.add(type); return n; });
  }

  // Date navigation
  const step = view === "week" ? 7 : 1;
  const rangeLabel = view === "week"
    ? `${startOfWeek(focus).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(startOfWeek(focus), 6).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : focus.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Calendar</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Schedule and dispatch jobs across your team</p>
        </div>
        <button onClick={() => setQueueOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
          {queueOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          Unscheduled ({unscheduled.length})
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {/* View switch */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {([
              { key: "dispatch", icon: LayoutGrid,    label: "Dispatch" },
              { key: "day",      icon: CalendarDays,  label: "Day" },
              { key: "week",     icon: CalendarRange, label: "Week" },
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
          {/* Date nav */}
          <div className="flex items-center gap-1">
            <button onClick={() => setFocus(addDays(focus, -step))} className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setFocus(new Date())} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Today
            </button>
            <button onClick={() => setFocus(addDays(focus, step))} className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium ml-2" style={{ color: "var(--text-primary)" }}>{rangeLabel}</span>
          </div>
        </div>

        {/* Layer legend */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CALENDAR_LAYERS.filter(t => rawItems.some(i => i.type === t)).map(type => {
            const cfg = LAYER_CONFIG[type];
            const on = !hidden.has(type);
            return (
              <button key={type} onClick={() => toggleLayer(type)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-opacity"
                style={{ backgroundColor: "var(--bg-input)", color: on ? "var(--text-secondary)" : "var(--text-muted)", opacity: on ? 1 : 0.5 }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body: calendar + queue */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          {view === "week"     && <WeekView     focus={focus} items={items} onSelect={setSelected} />}
          {view === "day"      && <DayView      focus={focus} items={items} onSelect={setSelected} />}
          {view === "dispatch" && <DispatchView focus={focus} items={items} technicians={technicians} onSelect={setSelected} />}
        </div>

        {queueOpen && (
          <div className="w-72 shrink-0 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
              <Inbox className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Unscheduled</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{unscheduled.length}</span>
            </div>
            <div className="max-h-[600px] overflow-y-auto p-2 space-y-2">
              {unscheduled.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>Nothing waiting to schedule.</p>
              ) : unscheduled.map(u => (
                <div key={u.id} className="rounded-lg p-2.5 cursor-grab" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-start gap-2">
                    <GripVertical className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: u.color }} />
                        <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{u.title}</p>
                      </div>
                      {u.customerName && <p className="text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>{u.customerName}</p>}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{u.reason}</span>
                        {u.value && <span className="text-[10px] font-semibold" style={{ color: "var(--text-primary)" }}>{u.value}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <CalendarItemDrawer item={selected} technicians={technicians} onClose={() => setSelected(null)} onReassign={reassign} />
      )}
    </div>
  );
}

// ─── Item chip ────────────────────────────────────────────
function ItemChip({ item, onSelect, compact }: { item: CalendarItem; onSelect: (i: CalendarItem) => void; compact?: boolean }) {
  return (
    <button onClick={() => onSelect(item)}
      className="w-full text-left rounded-lg px-2 py-1.5 transition-opacity hover:opacity-90 overflow-hidden"
      style={{ backgroundColor: item.color + "1f", borderLeft: `3px solid ${item.color}` }}>
      <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
        {!item.allDay && <span style={{ color: item.color }}>{fmtTime(item.start)} </span>}
        {item.title}
      </p>
      {!compact && item.assignedTo && <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{item.assignedTo}</p>}
    </button>
  );
}

// ─── Week view ────────────────────────────────────────────
function WeekView({ focus, items, onSelect }: { focus: Date; items: CalendarItem[]; onSelect: (i: CalendarItem) => void }) {
  const weekStart = startOfWeek(focus);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="grid grid-cols-7">
        {days.map((day, di) => {
          const dayItems = items.filter(i => isSameDay(i.start, day)).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
          const isToday = isSameDay(day, today);
          return (
            <div key={di} style={{ borderLeft: di > 0 ? "1px solid var(--border-subtle)" : "none", minHeight: "440px" }}>
              <div className="px-2 py-2 text-center" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: isToday ? "var(--accent-soft-bg)" : "var(--bg-surface-2)" }}>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{day.toLocaleDateString("en-US", { weekday: "short" })}</p>
                <p className="text-sm font-bold" style={{ color: isToday ? "var(--accent-text)" : "var(--text-primary)" }}>{day.getDate()}</p>
              </div>
              <div className="p-1.5 space-y-1.5">
                {dayItems.length === 0
                  ? <p className="text-[10px] text-center py-3" style={{ color: "var(--text-muted)" }}>—</p>
                  : dayItems.map(i => <ItemChip key={i.id} item={i} onSelect={onSelect} compact />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day view (hourly grid) ───────────────────────────────
function DayView({ focus, items, onSelect }: { focus: Date; items: CalendarItem[]; onSelect: (i: CalendarItem) => void }) {
  const dayItems = items.filter(i => isSameDay(i.start, focus));
  const allDay = dayItems.filter(i => i.allDay);
  const timed = dayItems.filter(i => !i.allDay);
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {allDay.length > 0 && (
        <div className="p-2 space-y-1.5" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          {allDay.map(i => <ItemChip key={i.id} item={i} onSelect={onSelect} />)}
        </div>
      )}
      <div className="relative" style={{ height: `${HOURS.length * HOUR_PX}px` }}>
        {/* Hour lines */}
        {HOURS.map((h, i) => (
          <div key={h} className="absolute left-0 right-0 flex" style={{ top: `${i * HOUR_PX}px`, height: `${HOUR_PX}px`, borderTop: "1px solid var(--border-subtle)" }}>
            <span className="text-[10px] px-2 pt-1 shrink-0 w-14" style={{ color: "var(--text-muted)" }}>
              {h > 12 ? h - 12 : h}{h >= 12 ? "p" : "a"}
            </span>
          </div>
        ))}
        {/* Timed blocks */}
        {timed.map(i => {
          const top = Math.max(0, (minutesFromDayStart(i.start) / 60) * HOUR_PX);
          const height = Math.max(24, (i.durationMinutes / 60) * HOUR_PX - 2);
          return (
            <button key={i.id} onClick={() => onSelect(i)}
              className="absolute rounded-lg px-2 py-1 text-left overflow-hidden transition-opacity hover:opacity-90"
              style={{ top: `${top}px`, height: `${height}px`, left: "60px", right: "8px", backgroundColor: i.color + "22", borderLeft: `3px solid ${i.color}` }}>
              <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{i.title}</p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{fmtTime(i.start)} · {i.assignedTo ?? "Unassigned"}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dispatch view (tech rows × hour axis) ────────────────
function DispatchView({ focus, items, technicians, onSelect }: { focus: Date; items: CalendarItem[]; technicians: string[]; onSelect: (i: CalendarItem) => void }) {
  const dayItems = items.filter(i => isSameDay(i.start, focus) && !i.allDay);
  const trackWidth = HOURS.length * HOUR_PX;
  const rows = technicians.length > 0 ? technicians : ["Unassigned"];
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${trackWidth + 140}px` }}>
          {/* Hour axis */}
          <div className="flex" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
            <div className="w-[140px] shrink-0 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Technician</div>
            <div className="relative" style={{ width: `${trackWidth}px` }}>
              {HOURS.map((h, i) => (
                <span key={h} className="absolute text-[10px] pt-2" style={{ left: `${i * HOUR_PX}px`, color: "var(--text-muted)" }}>
                  {h > 12 ? h - 12 : h}{h >= 12 ? "p" : "a"}
                </span>
              ))}
            </div>
          </div>
          {/* Tech rows */}
          {rows.map((tech, ri) => {
            const techItems = dayItems.filter(i => (i.assignedTo ?? "Unassigned") === tech);
            return (
              <div key={tech} className="flex" style={{ borderBottom: ri < rows.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                <div className="w-[140px] shrink-0 px-3 py-3 flex items-center gap-2" style={{ borderRight: "1px solid var(--border-subtle)" }}>
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                    {tech.replace(/\(.*\)/, "").trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{tech}</span>
                </div>
                <div className="relative" style={{ width: `${trackWidth}px`, height: "56px" }}>
                  {/* hour gridlines */}
                  {HOURS.map((h, i) => <div key={h} className="absolute top-0 bottom-0" style={{ left: `${i * HOUR_PX}px`, borderLeft: "1px solid var(--border-subtle)" }} />)}
                  {techItems.map(i => {
                    const left = Math.max(0, (minutesFromDayStart(i.start) / 60) * HOUR_PX);
                    const width = Math.max(40, (i.durationMinutes / 60) * HOUR_PX - 3);
                    return (
                      <button key={i.id} onClick={() => onSelect(i)}
                        className="absolute top-1.5 bottom-1.5 rounded-lg px-2 text-left overflow-hidden transition-opacity hover:opacity-90"
                        style={{ left: `${left}px`, width: `${width}px`, backgroundColor: i.color + "26", borderLeft: `3px solid ${i.color}` }}>
                        <p className="text-[10px] font-semibold truncate leading-tight pt-1" style={{ color: "var(--text-primary)" }}>{i.title}</p>
                        <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{fmtTime(i.start)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
