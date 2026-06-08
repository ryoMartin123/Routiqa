"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  Inbox, Search, SlidersHorizontal, Eye, EyeOff,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, LayoutGrid, LayoutList, CalendarDays, CalendarRange, CalendarClock,
  Plus, Briefcase, X, Users, MapPin, Building2,
} from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import PageTitle from "@/components/shared/PageTitle";
import CalendarItemDrawer from "@/components/calendar/CalendarItemDrawer";
import StatusBadge from "@/components/shared/StatusBadge";
import ScheduleConfirmModal, { type ScheduleDraft } from "@/components/calendar/ScheduleConfirmModal";
import Select from "@/components/ui/Select";
import {
  getCalendarItems, getUnscheduledItems, getUnscheduledJobs, getSessionCalendarItems, getTechnicians, getStaffRoster, markSourceScheduled, type CalendarScope, type TechRosterEntry,
} from "@/lib/calendar/data";
import { createJob, updateJob, type JobType } from "@/lib/jobs/data";
import { getCustomer } from "@/lib/customers/data";
import { getUsersByRoles, getBoardCandidates } from "@/lib/users/data";
import {
  getAvailabilityForDay, createAvailability, removeAvailability, techStatusForKind, AVAILABILITY_CONFIG,
  type AvailabilityEvent, type NewAvailabilityInput,
} from "@/lib/calendar/availability";
import TimeOffModal from "@/components/calendar/TimeOffModal";
import JobWizard from "@/components/jobs/JobWizard";
import {
  LAYER_CONFIG, CALENDAR_LAYERS, PRIORITY_CONFIG, TECH_STATUS_CONFIG, HOUR_PX,
  type CalendarItem, type CalendarItemType, type UnscheduledItem, type DispatchMode,
} from "@/lib/calendar/types";
import {
  resolveDispatchSettings, defaultDispatchSettings, getBoardsForContext, itemMatchesBoard,
  getVisibleQueueViews,
  type DispatchSettings, type SettingsServiceBlock, type DispatchBoard,
} from "@/lib/calendar/settings";
import {
  matchesQueueView, countForView, defaultQueueViews, type QueueView,
} from "@/lib/calendar/queueViews";

type CalendarView = "dispatch" | "day" | "week" | "month";

// ─── Date helpers ─────────────────────────────────────────
function startOfWeek(d: Date): Date { const r = new Date(d); r.setHours(0,0,0,0); r.setDate(r.getDate() - r.getDay()); return r; }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function addMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function isSameDay(a: Date, b: Date): boolean { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function fmtTime(d: Date): string { return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
function ymd(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function hourLabel(h: number): string {
  const period = h >= 12 && h < 24 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:00 ${period}`;
}
// Format a Date back into the human strings the jobs store uses, so a job
// scheduled/moved on the board re-parses identically in the Jobs list + Today tab.
function jobDateStr(d: Date): string { return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function jobTimeStr(d: Date): string { return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }

// When a non-job queue source is scheduled it becomes a Job (one lifecycle); this
// maps the source to the Job's visual layer (dispatchType) and its work type.
type SourceJobMap = { dispatchType: "job" | "sales_appointment" | "agreement_visit" | "task"; jobType: JobType };
const SOURCE_TO_JOB: Record<string, SourceJobMap> = {
  approved_quote:   { dispatchType: "job",              jobType: "installation" },
  agreement_visit:  { dispatchType: "agreement_visit",  jobType: "maintenance" },
  task_follow_up:   { dispatchType: "task",             jobType: "other" },
  sales_appointment:{ dispatchType: "sales_appointment", jobType: "estimate" },
};
const SOURCE_TO_JOB_DEFAULT: SourceJobMap = { dispatchType: "job", jobType: "repair" };

export default function CalendarPage() {
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId, allCompanies, allLocations } = useHierarchy();
  const scope: CalendarScope = { companyId: effectiveCompanyId, locationId: effectiveLocationId, serviceAreaId: effectiveServiceAreaId };
  // The same module serves two routes: /dispatching (board) and /calendar
  // (month calendar). The route decides the default landing view.
  const pathname = usePathname();
  const isCalendarRoute = pathname === "/calendar";

  const [view, setView]           = useState<CalendarView>("dispatch");
  const [dispatchMode, setMode]   = useState<DispatchMode>("hourly");
  const [focus, setFocus]         = useState(() => new Date());
  const [hidden, setHidden]       = useState<Set<CalendarItemType>>(new Set());
  const [settings, setSettings]   = useState<DispatchSettings>(() => defaultDispatchSettings());
  const [boards, setBoards]       = useState<DispatchBoard[]>([]);

  // Resolve the most-specific settings for the active company/location context
  // (Organization → Company → Location), then seed view/mode/layers and load the
  // boards available for that context. Re-runs whenever the context changes or
  // the page mounts (e.g. navigating in from Settings), so changes show up here.
  useEffect(() => {
    const cfg = resolveDispatchSettings(effectiveCompanyId, effectiveLocationId);
    setSettings(cfg);
    // /calendar lands on the month view; /dispatching uses the configured default.
    setView(isCalendarRoute ? "month" : cfg.defaultView);
    setMode(cfg.defaultDispatchMode);
    setHidden(new Set<CalendarItemType>(
      cfg.layers.filter(l => !l.enabled || !l.visibleByDefault).map(l => l.type),
    ));
    setBoards(getBoardsForContext(effectiveCompanyId, effectiveLocationId));
    setBoardId("all");
    // Load the queue tabs configured in Settings → Calendar / Dispatch.
    const views = getVisibleQueueViews();
    setQueueViews(views);
    setQueueTab(prev => (views.some(v => v.key === prev) ? prev : (views[0]?.key ?? "all")));
  }, [effectiveCompanyId, effectiveLocationId, isCalendarRoute]);
  // Per-item edits made on the board: reassignment, moved time, resized duration.
  const [edits, setEdits]         = useState<Record<string, { start?: Date; durationMinutes?: number; assignedTo?: string }>>({});
  const [boardId, setBoardId]     = useState("all");

  // Scheduling state
  const [removed, setRemoved]     = useState<Set<string>>(new Set());
  const [confirm, setConfirm]     = useState<{ item: UnscheduledItem; draft: ScheduleDraft } | null>(null);
  // Bumped after a job is persisted (updateJob/createJob) or availability changes
  // so the board/queue re-read the store (the single source of truth).
  const [refreshKey, setRefreshKey] = useState(0);
  // Technician availability for the focused day — loaded client-side (effect).
  const [availability, setAvailability] = useState<AvailabilityEvent[]>([]);
  const [timeOffOpen, setTimeOffOpen]   = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [showJobWizard, setShowJobWizard]   = useState(false);

  // Jobs created in-session (New Job form / quote conversion) live in the session
  // store; load them client-side so they merge into the queue (unscheduled) and
  // the board/calendar (scheduled) without a hydration gap.
  const [sessionUnscheduled, setSessionUnscheduled] = useState<UnscheduledItem[]>([]);
  const [sessionItems, setSessionItems] = useState<CalendarItem[]>([]);
  // Technician roster is derived from the user directory (localStorage-backed),
  // so load it client-side here rather than during render.
  const [roster, setRoster] = useState<TechRosterEntry[]>([]);
  // The roster loads in an effect (localStorage), so guard the "no technicians"
  // empty state until that first load completes — otherwise it flashes on mount.
  const [rosterReady, setRosterReady] = useState(false);
  useEffect(() => {
    const s: CalendarScope = { companyId: effectiveCompanyId, locationId: effectiveLocationId, serviceAreaId: effectiveServiceAreaId };
    setSessionUnscheduled(getUnscheduledJobs(s));
    setSessionItems(getSessionCalendarItems(s));
    setRoster(getStaffRoster());
    setRosterReady(true);
  }, [effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId, refreshKey]);

  // Availability is per-day — reload when the focused day or data changes.
  useEffect(() => { setAvailability(getAvailabilityForDay(ymd(focus))); }, [focus, refreshKey]);

  // Live-refresh the resolved settings (hour window, blocks, layers) when the
  // user returns from Settings or another tab saves — WITHOUT resetting their
  // current view/mode/board. Fixes "changed the dispatch time but the board
  // didn't update".
  useEffect(() => {
    const reread = () => setSettings(resolveDispatchSettings(effectiveCompanyId, effectiveLocationId));
    window.addEventListener("focus", reread);
    window.addEventListener("storage", reread);
    document.addEventListener("visibilitychange", reread);
    return () => {
      window.removeEventListener("focus", reread);
      window.removeEventListener("storage", reread);
      document.removeEventListener("visibilitychange", reread);
    };
  }, [effectiveCompanyId, effectiveLocationId]);

  // Selection (drawer)
  const [selScheduled, setSelScheduled]     = useState<CalendarItem | null>(null);
  const [selUnscheduled, setSelUnscheduled] = useState<UnscheduledItem | null>(null);

  // Queue triage — tabs are saved "queue views" resolved from settings, not
  // hardcoded. `queueTab` holds the active view's key.
  const [queueViews, setQueueViews] = useState<QueueView[]>(() => defaultQueueViews().filter(v => v.defaultVisible));
  const [queueTab, setQueueTab]   = useState<string>("all");
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rawItems    = useMemo(() => getCalendarItems(scope), [effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allUnscheduled = useMemo(() => getUnscheduledItems(scope), [effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId]);
  // Technician filter mirrors the viewing scope (down-inclusion), plus anyone
  // already assigned to an in-scope item.
  const technicians = useMemo(
    () => Array.from(new Set([...getBoardCandidates(effectiveCompanyId, effectiveLocationId).map(u => u.fullName), ...getTechnicians(rawItems)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawItems, effectiveCompanyId, effectiveLocationId],
  );
  // No technicians on the roster → nothing can be scheduled or created here yet.
  // Only after the first roster load, so the empty state doesn't flash on mount.
  const noTechs = rosterReady && roster.length === 0;

  // Dispatch board / team selector — boards belong to a company + location and
  // are scoped to the current context. Selecting a board filters the technician
  // rows, scheduled items, and the unscheduled queue to that board.
  const boardOptions = [{ value: "all", label: "All Boards" }, ...boards.map(b => ({ value: b.id, label: b.name }))];
  const activeBoardDef = boards.find(b => b.id === boardId);
  // When the chosen board is narrower than the current viewing scope (e.g. org-wide
  // viewer picks Augusta's board), surface a quiet reminder that they're looking at
  // a location/company-specific board even though their global scope is broader.
  // Shows the most specific level that the scope doesn't already pin.
  const boardScopeNotice = (() => {
    if (!activeBoardDef) return null;
    if (activeBoardDef.locationId && !effectiveLocationId) {
      const loc = allLocations.find(l => l.id === activeBoardDef.locationId);
      if (loc) return { level: "location" as const, name: loc.name };
    }
    if (activeBoardDef.companyId && !effectiveCompanyId) {
      const co = allCompanies.find(c => c.id === activeBoardDef.companyId);
      if (co) return { level: "company" as const, name: co.name };
    }
    return null;
  })();
  // Board rows are the board's EXPLICIT members only — people added by name plus
  // holders of the board's assigned roles (within that board's scope). There's no
  // implicit "everyone", so e.g. dispatchers don't show unless they're members.
  // "All Boards" shows the union of members across every board in the view.
  const boardRoster = (() => {
    const membersOf = (b: (typeof boards)[number]): string[] => {
      const bCo = b.companyId || undefined;
      const bLoc = b.locationId || undefined;
      const names = new Set<string>(b.techNames);
      getUsersByRoles(b.roleKeys ?? [], bCo, bLoc).forEach(u => names.add(u.fullName));
      return Array.from(names);
    };
    const names = new Set<string>();
    if (activeBoardDef) membersOf(activeBoardDef).forEach(n => names.add(n));
    else boards.forEach(b => membersOf(b).forEach(n => names.add(n)));
    return Array.from(names).map(name =>
      roster.find(r => r.name === name) ?? { name, initials: initials(name), status: "available" as const },
    );
  })();
  const activeDispatcherLabel = activeBoardDef?.dispatchers.join(", ");

  // Selecting a board seeds its default view/mode (still overridable afterward).
  function selectBoard(id: string) {
    setBoardId(id);
    const b = boards.find(x => x.id === id);
    if (b?.defaultView) setView(b.defaultView);
    if (b?.defaultDispatchMode) setMode(b.defaultDispatchMode);
  }

  // Hourly grid + service blocks come straight from the resolved settings.
  const hourly = settings.hourly;
  const activeBlocks = settings.blocks.filter(b => b.active).sort((a, b) => a.order - b.order);

  const items = useMemo(() => [...rawItems, ...sessionItems]
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
    [rawItems, sessionItems, edits, hidden, fTech, fType, fPrio]);

  // Narrow scheduled items + queue to the selected board (All Boards = no narrowing).
  const boardItems  = activeBoardDef ? items.filter(i => itemMatchesBoard(i, activeBoardDef)) : items;
  const unscheduled = [...allUnscheduled, ...sessionUnscheduled]
    .filter(u => !removed.has(u.id))
    .filter(u => !activeBoardDef || itemMatchesBoard(u, activeBoardDef));
  const jobTypes = useMemo(() => Array.from(new Set(rawItems.map(i => i.jobType).filter(Boolean))) as string[], [rawItems]);
  const availableLayers = CALENDAR_LAYERS.filter(t => ["job","agreement_visit","task","project_milestone"].includes(t) && rawItems.some(i => i.type === t));
  const activeLayerCount = availableLayers.filter(t => !hidden.has(t)).length;
  const layersFiltered = activeLayerCount < availableLayers.length;
  const activeFilters = [fTech !== "all", fType !== "all", fPrio !== "all", boardId !== "all", layersFiltered].filter(Boolean).length;

  function toggleLayer(t: CalendarItemType) { setHidden(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; }); }
  function showAllLayers() { setHidden(p => { const n = new Set(p); availableLayers.forEach(t => n.delete(t)); return n; }); }
  function reassign(tech: string) {
    if (!selScheduled) return;
    // Jobs persist to the store; other sources (tasks/agreements) stay board-local.
    if (selScheduled.sourceModule === "jobs" && selScheduled.sourceId) {
      updateJob(selScheduled.sourceId, { assignedTo: tech, assignedToInitials: initials(tech) });
      setRefreshKey(k => k + 1);
    } else {
      setEdits(e => ({ ...e, [selScheduled.id]: { ...e[selScheduled.id], assignedTo: tech } }));
    }
    setSelScheduled({ ...selScheduled, assignedTo: tech });
  }
  // Commit a drag-move or drag-resize from the board (tech set when moved across rows).
  function applyMoveResize(id: string, start: Date, durationMinutes: number, tech?: string) {
    const item = items.find(i => i.id === id);
    if (item?.sourceModule === "jobs" && item.sourceId) {
      updateJob(item.sourceId, {
        scheduledDate: jobDateStr(start), scheduledTime: jobTimeStr(start), durationMinutes,
        ...(tech ? { assignedTo: tech, assignedToInitials: initials(tech) } : {}),
      });
      setRefreshKey(k => k + 1);
      return;
    }
    setEdits(e => ({ ...e, [id]: { ...e[id], start, durationMinutes, ...(tech ? { assignedTo: tech } : {}) } }));
  }

  // ── Scheduling ──
  function openConfirm(u: UnscheduledItem, tech: string, day: Date, hour: number, minute = 0) {
    if (noTechs) return;   // can't schedule without technicians (banner explains)
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

    // A job from the queue → persist the schedule to the job record so it stays
    // on the board (and shows as Scheduled in the Jobs list) across navigation.
    if (u.sourceModule === "jobs" && u.sourceId) {
      updateJob(u.sourceId, {
        status: "scheduled",
        scheduledDate: jobDateStr(start), scheduledTime: jobTimeStr(start),
        durationMinutes: d.durationMinutes,
        assignedTo: d.tech || "", assignedToInitials: d.tech ? initials(d.tech) : "",
      });
      setRefreshKey(k => k + 1);   // re-reads store: item moves out of queue, onto board
      setConfirm(null);
      return;
    }

    // Any other source (approved quote, agreement visit, follow-up task) becomes a
    // real Job linked back to its origin, so everything on the board lives under
    // the one job lifecycle. dispatchType keeps its original color/label.
    const map = SOURCE_TO_JOB[u.sourceType] ?? SOURCE_TO_JOB_DEFAULT;
    const cust = u.accountId ? getCustomer(u.accountId) : undefined;
    createJob({
      companyId: u.companyId, locationId: u.locationId, serviceAreaId: u.serviceAreaId,
      accountId: u.accountId ?? cust?.id ?? "",
      customerName: u.customerName ?? cust?.name ?? u.title,
      customerInitials: cust?.initials ?? initials(u.customerName ?? u.title),
      locationName: cust?.locationName ?? "",
      title: u.title, type: map.jobType,
      propertyAddress: u.address,
      scheduledDate: jobDateStr(start), scheduledTime: jobTimeStr(start),
      durationMinutes: d.durationMinutes,
      assignedTo: d.tech || "", assignedToInitials: d.tech ? initials(d.tech) : "",
      dispatchType: map.dispatchType,
      sourceModule: u.sourceModule as "quotes" | "agreements" | "tasks" | "projects",
      sourceRefId: u.sourceId,
    });
    markSourceScheduled(u.sourceModule, u.sourceId);  // drop the source from the queue for good
    setRemoved(r => new Set(r).add(u.id));             // instant hide before the reload
    setRefreshKey(k => k + 1);
    setConfirm(null);
  }

  // ── Availability ──
  function handleAddTimeOff(input: NewAvailabilityInput) {
    createAvailability(input);
    setRefreshKey(k => k + 1);   // reloads availability for the focused day
    setTimeOffOpen(false);
  }
  function handleRemoveTimeOff(id: string) {
    removeAvailability(id);
    setRefreshKey(k => k + 1);
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
          <PageTitle title="Dispatching" description="Dispatch command center — schedule and assign jobs" />
          {boardScopeNotice && (
            <button onClick={() => selectBoard("all")}
              title="Viewing a scoped board — click to return to all boards"
              className="group inline-flex items-center gap-1.5 mt-1.5 pl-2 pr-1.5 py-0.5 rounded-full text-[11px] font-medium transition-colors"
              style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)", border: "1px solid var(--accent-soft-border)" }}>
              {boardScopeNotice.level === "location" ? <MapPin className="w-3 h-3 shrink-0" /> : <Building2 className="w-3 h-3 shrink-0" />}
              <span>Viewing {boardScopeNotice.level} board · {boardScopeNotice.name}</span>
              <X className="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
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
          {/* Create — add a schedulable job or technician time off to the board */}
          <div className="relative">
            <button onClick={() => !noTechs && setCreateMenuOpen(o => !o)} disabled={noTechs}
              title={noTechs ? "Add technicians in Settings → Users & Roles first" : "Add to board"}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-haspopup="menu" aria-expanded={createMenuOpen}>
              <Plus className="w-4 h-4" />
            </button>
            {createMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCreateMenuOpen(false)} />
                <div role="menu" className="absolute right-0 mt-1.5 w-52 rounded-xl overflow-hidden z-50 py-1"
                  style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest px-3 pt-2 pb-1" style={{ color: "var(--text-muted)" }}>Add to board</p>
                  <button onClick={() => { setCreateMenuOpen(false); setShowJobWizard(true); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)" }}>
                      <Briefcase className="w-4 h-4" style={{ color: "var(--accent-text)" }} />
                    </div>
                    <div className="min-w-0"><p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>New Job</p><p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Schedulable work</p></div>
                  </button>
                  <button onClick={() => { setCreateMenuOpen(false); setTimeOffOpen(true); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)" }}>
                      <CalendarClock className="w-4 h-4" style={{ color: "var(--accent-text)" }} />
                    </div>
                    <div className="min-w-0"><p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Time Off</p><p className="text-[11px]" style={{ color: "var(--text-muted)" }}>PTO / blocked time</p></div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Filter — Board is the first filter; layers fold in here too */}
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
                  {activeFilters > 0 && <button onClick={() => { setBoardId("all"); setFTech("all"); setFType("all"); setFPrio("all"); showAllLayers(); }} className="text-xs" style={{ color: "var(--accent-text)" }}>Clear all</button>}
                </div>
                <div className="space-y-2.5">
                  <FilterField label="Dispatch Board">
                    <Select size="sm" value={boardId} onChange={selectBoard} options={boardOptions} />
                    {activeDispatcherLabel && <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Dispatcher: {activeDispatcherLabel}</p>}
                  </FilterField>
                  <FilterField label="Technician"><Select size="sm" value={fTech} onChange={setFTech} options={[{ value: "all", label: "All Technicians" }, ...technicians.map(t => ({ value: t, label: t }))]} /></FilterField>
                  <FilterField label="Job Type"><Select size="sm" value={fType} onChange={setFType} options={[{ value: "all", label: "All Types" }, ...jobTypes.map(t => ({ value: t, label: t }))]} /></FilterField>
                  <FilterField label="Priority"><Select size="sm" value={fPrio} onChange={setFPrio} options={[{ value: "all", label: "Any Priority" }, { value: "urgent", label: "Urgent" }, { value: "high", label: "High" }, { value: "normal", label: "Normal" }, { value: "low", label: "Low" }]} /></FilterField>

                  {/* Layers — show/hide item types on the board */}
                  {availableLayers.length > 0 && (
                    <div className="pt-1.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Layers</p>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{activeLayerCount}/{availableLayers.length} shown</span>
                      </div>
                      <div className="space-y-0.5">
                        {availableLayers.map(type => {
                          const cfg = LAYER_CONFIG[type]; const on = !hidden.has(type);
                          return (
                            <button key={type} onClick={() => toggleLayer(type)}
                              className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors hover:bg-[var(--bg-surface-2)]">
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                                <span className="truncate" style={{ color: on ? "var(--text-primary)" : "var(--text-muted)" }}>{cfg.label}</span>
                              </span>
                              {on ? <Eye className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent-text)" }} /> : <EyeOff className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* No technicians → can't schedule or create work here yet */}
      {noTechs && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: "#fef3c7", border: "1px solid #fde68a" }}>
          <Users className="w-4 h-4 shrink-0" style={{ color: "#92400e" }} />
          <p className="text-xs font-medium" style={{ color: "#92400e" }}>
            No team members yet — add people in Settings → Users &amp; Roles before scheduling or creating jobs here.
          </p>
        </div>
      )}

      {/* Board */}
      {view === "dispatch" && <DispatchBoard focus={focus} mode={dispatchMode} items={boardItems} roster={boardRoster} availability={availability} dayStart={hourly.startHour} dayEnd={hourly.endHour} increment={hourly.increment} blocks={activeBlocks} onSelect={setSelScheduled} onMoveResize={applyMoveResize} onRemoveAvailability={handleRemoveTimeOff} onDropItem={(uid, tech, hour, minute) => { const u = unscheduled.find(x => x.id === uid); if (u) openConfirm(u, tech, focus, hour, minute); }} />}
      {view === "week"     && <WeekView  focus={focus} items={boardItems} onSelect={setSelScheduled} />}
      {view === "day"      && <DayView   focus={focus} items={boardItems} dayStart={hourly.startHour} dayEnd={hourly.endHour} onSelect={setSelScheduled} />}
      {view === "month"    && <MonthView focus={focus} items={boardItems} onSelect={setSelScheduled} />}

      {/* Unscheduled queue — BELOW the board */}
      <UnscheduledQueue
        items={unscheduled} views={queueViews} tab={queueTab} setTab={setQueueTab}
        search={queueSearch} setSearch={setQueueSearch} onSelect={setSelUnscheduled}
      />

      {/* Drawer */}
      {selScheduled && <CalendarItemDrawer scheduled={selScheduled} technicians={technicians} onClose={() => setSelScheduled(null)} onReassign={reassign} />}
      {selUnscheduled && <CalendarItemDrawer unscheduled={selUnscheduled} technicians={technicians} onClose={() => setSelUnscheduled(null)} onSchedule={() => scheduleFromDrawer(selUnscheduled)} />}

      {/* Confirm modal */}
      {confirm && <ScheduleConfirmModal item={confirm.item} draft={confirm.draft} technicians={technicians} dayStart={hourly.startHour} dayEnd={hourly.endHour} onConfirm={confirmSchedule} onClose={() => setConfirm(null)} />}

      {/* Time off / availability modal */}
      {timeOffOpen && <TimeOffModal technicians={technicians} defaultDate={ymd(focus)} onClose={() => setTimeOffOpen(false)} onSave={handleAddTimeOff} />}

      {/* Create a job straight from the board — refreshes so it lands on the grid / queue */}
      {showJobWizard && <JobWizard onClose={() => setShowJobWizard(false)} onCreated={() => { setShowJobWizard(false); setRefreshKey(k => k + 1); }} />}
    </div>
  );
}

function initials(name: string): string {
  const p = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length-1][0] : name.slice(0,2)).toUpperCase();
}

// ─── Dispatch board ───────────────────────────────────────
const ROW_H = 64;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function DispatchBoard({ focus, mode, items, roster, availability, dayStart, dayEnd, increment, blocks, onSelect, onMoveResize, onRemoveAvailability, onDropItem }: {
  focus: Date; mode: DispatchMode; items: CalendarItem[];
  roster: TechRosterEntry[];
  availability: AvailabilityEvent[];
  dayStart: number; dayEnd: number; increment: number; blocks: SettingsServiceBlock[];
  onSelect: (i: CalendarItem) => void;
  onMoveResize: (id: string, start: Date, durationMinutes: number, tech?: string) => void;
  onRemoveAvailability: (id: string) => void;
  onDropItem: (uid: string, tech: string, hour: number, minute: number) => void;
}) {
  const dayItems = items.filter(i => isSameDay(i.start, focus) && !i.allDay);

  // Board rows = the roster, plus a single "Unassigned" lane that catches any job
  // with no tech OR a job assigned to someone who isn't on the roster (e.g. a
  // removed tech). We no longer spawn a phantom row per off-roster name — those
  // jobs stay visible in the Unassigned lane instead.
  const rosterNames = new Set(roster.map(r => r.name));
  const isOrphan = (i: CalendarItem) => { const a = (i.assignedTo ?? "").trim(); return !a || !rosterNames.has(a); };
  const hasUnassigned = dayItems.some(isOrphan);
  const rows = [
    ...(hasUnassigned ? [{ name: "", initials: "—", status: "available" as const }] : []),
    ...roster,
  ];

  // Hourly grid + drag snapping derived from the configured day window.
  const totalMin = Math.max(60, (dayEnd - dayStart) * 60);
  const hours = Array.from({ length: Math.max(1, dayEnd - dayStart) }, (_, i) => dayStart + i);
  const subPerHour = Math.max(1, Math.round(60 / increment));
  const snap = (v: number) => Math.round(v / increment) * increment;
  const startMinOf = (i: CalendarItem) => (i.start.getHours() - dayStart) * 60 + i.start.getMinutes();
  const minToTime = (min: number) => { const h = dayStart + Math.floor(min / 60); const m = min % 60; return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")}${h >= 12 ? "p" : "a"}`; };
  // Availability overlay geometry — all-day spans the whole row; timed uses hours.
  const availSpan = (a: AvailabilityEvent) => {
    const s = a.allDay ? 0 : Math.max(0, ((a.startHour ?? dayStart) - dayStart) * 60);
    const e = a.allDay ? totalMin : Math.min(totalMin, ((a.endHour ?? dayEnd) - dayStart) * 60);
    return { left: clamp((s / totalMin) * 100, 0, 100), width: clamp(((e - s) / totalMin) * 100, 0, 100) };
  };

  // Live preview while moving / resizing a block (tech = target row); queue-drag row.
  const [preview, setPreview] = useState<{ id: string; startMin: number; durationMinutes: number; tech: string } | null>(null);
  const [dragTech, setDragTech] = useState<string | null>(null);

  // "Now" indicator — the user's LOCAL current time, ticked each minute. Computed
  // client-side (new Date() is the browser's local zone) so it's hydration-safe
  // and always matches the viewer's clock.
  const [now, setNow] = useState<{ min: number; label: string } | null>(null);
  useEffect(() => {
    const update = () => {
      const d = new Date();
      if (!isSameDay(d, focus)) { setNow(null); return; }
      const min = (d.getHours() - dayStart) * 60 + d.getMinutes();
      if (min < 0 || min > totalMin) { setNow(null); return; }
      const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
      setNow({ min, label: `${h12}:${String(d.getMinutes()).padStart(2, "0")}` });
    };
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [focus, dayStart, totalMin]);

  const labels = mode === "blocks"
    ? blocks.map(b => ({ key: b.id, label: b.name, span: b.endHour - b.startHour }))
    : hours.map(h => ({ key: `h${h}`, label: hourLabel(h), span: 1 }));
  const gridCells = mode === "blocks"
    ? blocks.map(b => ({ key: b.id, span: (b.endHour - b.startHour) * 60, half: false }))
    : hours.flatMap(h => Array.from({ length: subPerHour }, (_, k) => ({ key: `${h}:${k}`, span: increment, half: k > 0 })));

  function commitFromX(clientX: number, track: HTMLElement): number {
    const rect = track.getBoundingClientRect();
    return clamp(((clientX - rect.left) / rect.width) * totalMin, 0, totalMin);
  }

  // Pointer-driven move (drag body, across rows) / resize (drag right edge).
  function beginDrag(e: React.MouseEvent, item: CalendarItem, kind: "move" | "resize") {
    e.preventDefault(); e.stopPropagation();
    const blockEl = (e.currentTarget as HTMLElement).closest("[data-block]") as HTMLElement | null;
    const track   = blockEl?.closest("[data-track]") as HTMLElement | null;
    if (!track || !blockEl) return;
    const base = startMinOf(item); const dur0 = item.durationMinutes;
    const grab = commitFromX(e.clientX, track) - base;
    const startX = e.clientX, startY = e.clientY;     // for click-vs-drag detection
    const originTech = item.assignedTo ?? "";
    let moved = false; let curStart = base; let curDur = dur0; let curTech = originTech;
    document.body.style.userSelect = "none";
    if (kind === "move") blockEl.style.pointerEvents = "none"; // so elementFromPoint sees the row below
    const onMove = (ev: MouseEvent) => {
      const mm = commitFromX(ev.clientX, track);
      // Treat it as a drag once the cursor travels past a small threshold in
      // EITHER axis — a near-vertical drag to another tech's row barely changes
      // X, so an X-only test would misread it as a click and open the drawer.
      if (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4) moved = true;
      if (kind === "move") {
        curStart = clamp(snap(mm - grab), 0, totalMin - dur0); curDur = dur0;
        const overTrack = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest("[data-track]") as HTMLElement | null;
        if (overTrack?.dataset.tech) curTech = overTrack.dataset.tech;
      } else { curDur = clamp(snap(mm - base), 30, totalMin - base); curStart = base; }
      // Reassigning to a different tech is always a move, never a click.
      if (curTech !== originTech) moved = true;
      setPreview({ id: item.id, startMin: curStart, durationMinutes: curDur, tech: curTech });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      blockEl.style.pointerEvents = "";
      setPreview(null);
      if (moved) {
        const nd = new Date(focus); nd.setHours(dayStart + Math.floor(curStart / 60), curStart % 60, 0, 0);
        onMoveResize(item.id, nd, curDur, kind === "move" ? curTech : undefined);
      } else {
        onSelect(item);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className="relative" style={{ paddingTop: "20px" }}>
      {/* Current-time box — OUTSIDE the board container (which clips), pinned above
          it and aligned to the now-line. Offset by the 180px technician column so
          its x matches the dashed line inside the grid. */}
      {now != null && (
        <div className="absolute z-30 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap pointer-events-none"
          style={{ top: 0, left: `calc(180px + (100% - 180px) * ${now.min / totalMin})`, transform: "translateX(-50%)", backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)", border: "1px solid var(--accent-soft-border)" }}>
          {now.label}
        </div>
      )}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        {/* Header */}
        <div className="flex" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          <div className="w-[180px] shrink-0 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Technician</div>
        <div className="flex-1 flex relative">
          {labels.map(l => (
            <div key={l.key} className="px-1 py-1.5 text-[10px] font-semibold text-center whitespace-nowrap" style={{ flex: l.span, color: "var(--text-muted)", borderLeft: "1px solid var(--border-subtle)" }}>{l.label}</div>
          ))}
          {/* Now-line continues through the time-header row */}
          {now != null && (
            <div className="absolute top-0 bottom-0 pointer-events-none z-10" style={{ left: `${(now.min / totalMin) * 100}%` }}>
              <div className="h-full" style={{ borderLeft: "1.5px dashed rgba(124, 58, 237, 0.45)" }} />
            </div>
          )}
        </div>
      </div>

      {/* Tech rows */}
      {rows.length === 0 ? (
        <div className="py-12 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No technicians on this board.</p></div>
      ) : rows.map((tech, ri) => {
        const isUnassigned = tech.name === "";
        const techItems = isUnassigned ? dayItems.filter(isOrphan) : dayItems.filter(i => (i.assignedTo ?? "").trim() === tech.name);
        // Availability for this tech today drives the row's status chip + overlays.
        const techAvail = availability.filter(a => a.techName === tech.name);
        const allDayOff = techAvail.find(a => a.allDay && AVAILABILITY_CONFIG[a.kind].blocksWork);
        const onCall    = techAvail.find(a => a.kind === "on_call");
        const dayStatus = allDayOff ? techStatusForKind(allDayOff.kind) : onCall ? "on_call" : tech.status;
        const sc = TECH_STATUS_CONFIG[dayStatus];
        const bookedMin = techItems.reduce((s, i) => s + i.durationMinutes, 0);
        const openHrs = Math.max(0, Math.round((totalMin - bookedMin) / 60));
        const isDropTarget = dragTech === tech.name || (preview != null && preview.tech === tech.name);
        return (
          <div key={tech.name || "__unassigned"} className="flex" style={{ borderBottom: ri < rows.length - 1 ? "1px solid var(--border-subtle)" : "none", backgroundColor: isUnassigned ? "var(--warning-soft-bg)" : undefined }}>
            {/* Tech cell */}
            <div className="w-[180px] shrink-0 px-3 py-2.5 flex items-start gap-2" style={{ borderRight: "1px solid var(--border-subtle)" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                style={{ backgroundColor: isUnassigned ? "var(--warning-soft-border)" : "#4f46e5", color: isUnassigned ? "var(--warning-text)" : "#fff" }}>{tech.initials}</div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: isUnassigned ? "var(--warning-text)" : "var(--text-primary)" }}>{isUnassigned ? "Unassigned" : tech.name}</p>
                {isUnassigned ? (
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--warning-icon)" }}>Needs a technician</p>
                ) : (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.color }} />
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{sc.label}</span>
                  </div>
                )}
                <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>{techItems.length} job{techItems.length===1?"":"s"}{isUnassigned ? "" : ` · ~${openHrs}h open`}</p>
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
                const mm = Math.round(commitFromX(e.clientX, e.currentTarget) / increment) * increment;
                const safe = clamp(mm, 0, totalMin - increment);
                onDropItem(id, tech.name, dayStart + Math.floor(safe / 60), safe % 60);
              }}>
              {/* Gridlines (visual only) */}
              <div className="absolute inset-0 flex pointer-events-none">
                {gridCells.map(c => <div key={c.key} className="h-full" style={{ flex: c.span, borderLeft: `1px ${c.half ? "dashed" : "solid"} var(--border-subtle)` }} />)}
              </div>

              {/* Availability overlays — PTO / time off / training / blocked (behind jobs) */}
              {techAvail.filter(a => AVAILABILITY_CONFIG[a.kind].blocksWork).map(a => {
                const cfg = AVAILABILITY_CONFIG[a.kind]; const { left, width } = availSpan(a);
                return (
                  <div key={a.id} className="absolute top-0 bottom-0 flex items-center justify-center pointer-events-none overflow-hidden"
                    style={{ left: `${left}%`, width: `${width}%`, backgroundColor: cfg.color + "14",
                      backgroundImage: `repeating-linear-gradient(45deg, ${cfg.color}40 0, ${cfg.color}40 5px, transparent 5px, transparent 11px)`,
                      borderLeft: `2px solid ${cfg.color}` }}>
                    <span className="text-[9px] font-bold uppercase tracking-wide px-1 truncate" style={{ color: cfg.color }}>
                      {cfg.label}{a.note ? ` · ${a.note}` : ""}
                    </span>
                    {/* Remove this blocked/time-off span */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveAvailability(a.id); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title={`Remove ${cfg.label}`}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
                      style={{ pointerEvents: "auto", backgroundColor: "var(--bg-surface)", color: cfg.color, border: `1px solid ${cfg.color}55`, zIndex: 25 }}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}

              {/* "Now" line — dashed, translucent purple; non-interactive, spans all rows */}
              {now != null && (
                <div className="absolute top-0 bottom-0 pointer-events-none z-10" style={{ left: `${(now.min / totalMin) * 100}%` }}>
                  <div className="h-full" style={{ borderLeft: "1.5px dashed rgba(124, 58, 237, 0.45)" }} />
                </div>
              )}

              {/* Job blocks */}
              {techItems.map(i => {
                const p = preview?.id === i.id ? preview : null;
                const sm = p ? p.startMin : startMinOf(i);
                const dur = p ? p.durationMinutes : i.durationMinutes;
                const left = clamp((sm / totalMin) * 100, 0, 100);
                const width = Math.max(3, (Math.min(dur, totalMin - sm) / totalMin) * 100);
                const prio = i.priority && i.priority !== "normal" ? PRIORITY_CONFIG[i.priority] : null;
                const movingAway = p && p.tech !== (i.assignedTo ?? "");  // dragging to another tech
                // Lane = where the job is in its lifecycle → visual treatment.
                // Color still tells you what it is; the lane tells you its state.
                const lane = i.lane ?? "scheduled";
                const accent = lane === "blocked" ? "#f59e0b" : i.color;
                const laneBg = lane === "blocked"
                  ? "repeating-linear-gradient(45deg, rgba(245,158,11,0.20) 0, rgba(245,158,11,0.20) 6px, transparent 6px, transparent 12px)"
                  : undefined;
                const laneShadow = lane === "active" ? `0 0 0 2px ${i.color}, 0 2px 10px ${i.color}66` : undefined;
                const laneOpacity = lane === "done" ? 0.5 : lane === "fell_through" ? 0.45 : 1;
                return (
                  <div key={i.id} data-block
                    onMouseDown={e => beginDrag(e, i, "move")}
                    title="Drag to move (across techs) · drag right edge to resize"
                    className="absolute top-1.5 bottom-1.5 rounded-lg px-2 overflow-hidden select-none"
                    style={{ left: `${left}%`, width: `${width}%`, backgroundColor: i.color + "26", backgroundImage: laneBg, borderLeft: `3px solid ${accent}`, cursor: p ? "grabbing" : "grab", boxShadow: p ? "0 4px 14px rgba(0,0,0,0.25)" : laneShadow, opacity: movingAway ? 0.55 : laneOpacity, zIndex: p ? 20 : 1 }}>
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] font-semibold truncate leading-tight pt-0.5" style={{ color: "var(--text-primary)", textDecoration: lane === "fell_through" ? "line-through" : "none" }}>{lane === "done" ? "✓ " : ""}{i.customerName ?? i.title}</p>
                      {movingAway && <span className="text-[8px] font-bold px-1 rounded shrink-0" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text)" }}>→ {p!.tech}</span>}
                      {!movingAway && lane === "blocked" && <span className="text-[8px] font-bold px-1 rounded shrink-0" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>BLOCKED</span>}
                      {!movingAway && lane !== "blocked" && prio && <span className="text-[8px] font-bold px-1 rounded shrink-0" style={{ backgroundColor: prio.bg, color: prio.color }}>{prio.label}</span>}
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
    </div>
  );
}

// ─── Unscheduled queue (triage, below board) ──────────────
// Tabs are config-driven "queue views" (saved filters) resolved from settings —
// not a hardcoded list — so admins can add/edit custom tabs.
function UnscheduledQueue({ items, views, tab, setTab, search, setSearch, onSelect }: {
  items: UnscheduledItem[];
  views: QueueView[];
  tab: string; setTab: (t: string) => void;
  search: string; setSearch: (s: string) => void;
  onSelect: (u: UnscheduledItem) => void;
}) {
  const activeView = views.find(v => v.key === tab) ?? views[0];

  const filtered = items
    .filter(u => activeView ? matchesQueueView(u, activeView) : true)
    .filter(u => { if (!search) return true; const q = search.toLowerCase(); return u.title.toLowerCase().includes(q) || (u.customerName ?? "").toLowerCase().includes(q) || u.reason.toLowerCase().includes(q); });

  const [collapsed, setCollapsed] = useState(false);
  const [layout, setLayout] = useState<"cards" | "list">("cards");

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap" style={{ borderBottom: collapsed ? "none" : "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Unscheduled Queue</p>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{items.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {!collapsed && (
            <>
              <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search queue…" className="bg-transparent text-sm outline-none w-40" style={{ color: "var(--text-primary)" }} />
              </div>
              {/* Card / List layout toggle */}
              <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {([{ key: "cards", icon: LayoutGrid }, { key: "list", icon: LayoutList }] as const).map(o => {
                  const active = layout === o.key;
                  return (
                    <button key={o.key} onClick={() => setLayout(o.key)} title={o.key === "cards" ? "Card view" : "List view"}
                      className="px-2 py-1.5 transition-colors"
                      style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-muted)" }}>
                      <o.icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {/* Minimize / expand */}
          <button onClick={() => setCollapsed(c => !c)} title={collapsed ? "Expand queue" : "Minimize queue"}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-input)]"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {!collapsed && (
        <>
          {/* Triage tabs — one per configured queue view */}
          <div className="flex items-center gap-0.5 px-3 py-2 flex-wrap" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            {views.map(v => {
              const active = (activeView?.key ?? tab) === v.key; const c = countForView(items, v);
              // Configured views are curated in Settings (active + "Show as tab"),
              // so always render them — even at 0 — rather than auto-hiding empties.
              return (
                <button key={v.key} onClick={() => setTab(v.key)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{ backgroundColor: active ? "var(--accent-soft-bg)" : "transparent", color: active ? "var(--accent-text)" : "var(--text-muted)", border: `1px solid ${active ? "var(--accent-soft-border)" : "transparent"}` }}>
                  {v.color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: v.color }} />}
                  {v.name}<span className="text-[10px] font-bold px-1 py-0.5 rounded-full" style={{ backgroundColor: active ? "var(--accent-soft-2-bg)" : "var(--bg-input)", color: active ? "var(--accent-text)" : "var(--text-muted)" }}>{c}</span>
                </button>
              );
            })}
          </div>
          {/* Body — cards grid or compact list */}
          <div className="p-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Nothing to triage here.</p>
            ) : layout === "cards" ? (
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                {filtered.map(u => <QueueCard key={u.id} item={u} onSelect={onSelect} />)}
              </div>
            ) : (
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
                {filtered.map((u, i) => <QueueRow key={u.id} item={u} onSelect={onSelect} last={i === filtered.length - 1} />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Compact list row for the queue's List layout — draggable like the card.
function QueueRow({ item: u, onSelect, last }: { item: UnscheduledItem; onSelect: (u: UnscheduledItem) => void; last: boolean }) {
  const cfg = LAYER_CONFIG[u.type]; const prio = PRIORITY_CONFIG[u.priority];
  return (
    <div draggable onDragStart={e => e.dataTransfer.setData("text/plain", u.id)}
      onClick={() => onSelect(u)}
      className="flex items-center gap-3 px-3 py-2.5 cursor-grab active:cursor-grabbing transition-colors hover:bg-[var(--bg-surface-2)]"
      style={{ borderBottom: last ? "none" : "1px solid var(--border-subtle)", borderLeft: `3px solid ${u.color}` }}>
      <StatusBadge label={cfg.label} color={cfg.color} size="sm" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{u.title}</p>
        <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{u.customerName ?? u.reason}{u.city ? ` · ${u.city}` : ""}</p>
      </div>
      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: prio.bg, color: prio.color }}>{prio.label}</span>
      {u.value && <span className="text-xs font-bold shrink-0 w-16 text-right" style={{ color: "var(--text-primary)" }}>{u.value}</span>}
      <span className="text-[10px] shrink-0 w-24 text-right" style={{ color: "var(--text-muted)" }}>{u.durationMinutes}m{u.preferredDate ? ` · ${u.preferredDate}` : ""}</span>
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
          <StatusBadge label={cfg.label} color={cfg.color} size="sm" className="shrink-0" />
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

function DayView({ focus, items, dayStart, dayEnd, onSelect }: { focus: Date; items: CalendarItem[]; dayStart: number; dayEnd: number; onSelect: (i: CalendarItem) => void }) {
  const dayItems = items.filter(i => isSameDay(i.start, focus)); const allDay = dayItems.filter(i => i.allDay); const timed = dayItems.filter(i => !i.allDay);
  const hours = Array.from({ length: Math.max(1, dayEnd - dayStart) }, (_, i) => dayStart + i);
  const minutesFromStart = (d: Date) => (d.getHours() - dayStart) * 60 + d.getMinutes();
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {allDay.length > 0 && <div className="p-2 space-y-1.5" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>{allDay.map(i => <ItemChip key={i.id} item={i} onSelect={onSelect} />)}</div>}
      <div className="relative" style={{ height: `${hours.length * HOUR_PX}px` }}>
        {hours.map((h, i) => <div key={h} className="absolute left-0 right-0 flex" style={{ top: `${i*HOUR_PX}px`, height: `${HOUR_PX}px`, borderTop: "1px solid var(--border-subtle)" }}><span className="text-[10px] px-2 pt-1 shrink-0 w-14" style={{ color: "var(--text-muted)" }}>{hourLabel(h)}</span></div>)}
        {timed.map(i => {
          const top = Math.max(0, (minutesFromStart(i.start)/60)*HOUR_PX); const height = Math.max(24, (i.durationMinutes/60)*HOUR_PX - 2);
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
