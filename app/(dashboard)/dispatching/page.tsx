"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  Search, Eye, EyeOff,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, LayoutGrid, LayoutList, CalendarDays, CalendarRange, CalendarClock,
  Plus, Briefcase, X, Users, MapPin, Building2, Check, Globe, Map as MapIcon, RotateCcw, Link2, Navigation,
} from "lucide-react";
import DispatchMap from "@/components/dispatch-map/DispatchMap";
import { geocode, driveMinutes, getMapTechnicians } from "@/lib/dispatch-map/data";
import SlidersGlyph from "@/components/shared/SlidersGlyph";
import DatePicker from "@/components/ui/DatePicker";
import TimePicker from "@/components/ui/TimePicker";
import { todayYMD } from "@/lib/utils/schedule";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import PageTitle from "@/components/shared/PageTitle";
import CalendarItemDrawer from "@/components/calendar/CalendarItemDrawer";
import { pingError } from "@/components/shared/SavedPill";
import StatusBadge from "@/components/shared/StatusBadge";
import ScheduleConfirmModal, { type ScheduleDraft } from "@/components/calendar/ScheduleConfirmModal";
import ScheduleVisitModal, { type VisitScheduleDraft } from "@/components/calendar/ScheduleVisitModal";
import Select from "@/components/ui/Select";
import {
  getCalendarItems, getUnscheduledItems, getUnscheduledJobs, getSessionCalendarItems, getTechnicians, getStaffRoster, markSourceScheduled, getSchedulableVisits, type CalendarScope, type TechRosterEntry, type SchedulableVisit,
} from "@/lib/calendar/data";
import { createJob, updateJob, getJob, resolveJobTypeColor, type JobType } from "@/lib/jobs/data";
import { updateAppointment } from "@/lib/appointments/data";
import { scheduleExistingJob } from "@/lib/jobs/serviceCall";
import { syncAgreementVisitFromJob, materializeVisitJob } from "@/lib/agreements/data";
import JobStageControl from "@/components/jobs/JobStageControl";
import { getCustomer } from "@/lib/customers/data";
import { getUsersByRoles, getBoardCandidates } from "@/lib/users/data";
import { MoreActionsGlyph } from "@/components/shared/ActionsMenu";
import {
  getAvailabilityForDay, createAvailability, removeAvailability, techStatusForKind, AVAILABILITY_CONFIG,
  type AvailabilityEvent, type NewAvailabilityInput,
} from "@/lib/calendar/availability";
import TimeOffModal from "@/components/calendar/TimeOffModal";
import JobWizard from "@/components/jobs/JobWizard";
import ReturnVisitModal from "@/components/jobs/ReturnVisitModal";
import {
  LAYER_CONFIG, CALENDAR_LAYERS, PRIORITY_CONFIG, TECH_STATUS_CONFIG, HOUR_PX,
  type CalendarItem, type CalendarItemType, type UnscheduledItem, type DispatchMode,
} from "@/lib/calendar/types";
import {
  resolveDispatchSettings, defaultDispatchSettings, getBoardsForContext, itemMatchesBoard,
  getVisibleQueueViews, getAgreementLeadDays, BOARD_TYPE_LABELS,
  type DispatchSettings, type SettingsServiceBlock, type DispatchBoard, type BoardMembers,
} from "@/lib/calendar/settings";
import {
  matchesQueueView, countForView, defaultQueueViews, type QueueView,
} from "@/lib/calendar/queueViews";
import { jobTypeLabel } from "@/lib/job-config/data";

type CalendarView = "dispatch" | "day" | "week" | "month" | "map";

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
  agreement_visit:  { dispatchType: "agreement_visit",  jobType: "agreement_visit" },
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
  // Map-tab date filter (Today / Custom range) — rendered inline with the view
  // tabs and passed into the embedded DispatchMap.
  const [mapDateMode, setMapDateMode] = useState<"today" | "custom">("today");
  const [mapCustomOpen, setMapCustomOpen] = useState(false);
  const [mapFromDate, setMapFromDate] = useState(todayYMD());
  const [mapToDate, setMapToDate]     = useState(todayYMD());
  const [mapFromTime, setMapFromTime] = useState("");
  const [mapToTime, setMapToTime]     = useState("");
  const [hidden, setHidden]       = useState<Set<CalendarItemType>>(new Set());
  const [settings, setSettings]   = useState<DispatchSettings>(() => defaultDispatchSettings());
  const [boards, setBoards]       = useState<DispatchBoard[]>([]);
  const [agreementLeadDays, setAgreementLeadDays] = useState(30);

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
    setAgreementLeadDays(getAgreementLeadDays());
    setBoardId("all");
    // Load the queue tabs configured in Settings → Calendar / Dispatch.
    const views = getVisibleQueueViews();
    setQueueViews(views);
    setQueueTab(prev => (views.some(v => v.key === prev) ? prev : (views[0]?.key ?? "all")));
  }, [effectiveCompanyId, effectiveLocationId, isCalendarRoute]);
  // Per-item edits made on the board: reassignment, moved time, resized duration.
  const [edits, setEdits]         = useState<Record<string, { start?: Date; durationMinutes?: number; assignedTo?: string }>>({});
  const [boardId, setBoardId]     = useState("all");

  // The board currently selected in the board picker (undefined = "All Boards").
  const activeBoardDef = boards.find(b => b.id === boardId);
  // Dispatch settings (hour window, increments, layers) follow the active board's
  // scope when it's narrower than the hierarchy selector — so a location board
  // reflects that location's overrides even when viewed from a broader org/company
  // scope. Falls back to the hierarchy scope when no specific board is selected.
  const settingsCompanyId  = effectiveCompanyId  || activeBoardDef?.companyId  || undefined;
  const settingsLocationId = effectiveLocationId || activeBoardDef?.locationId || undefined;

  // Scheduling state
  const [removed, setRemoved]     = useState<Set<string>>(new Set());
  const [confirm, setConfirm]     = useState<{ item: UnscheduledItem; draft: ScheduleDraft } | null>(null);
  // Bumped after a job is persisted (updateJob/createJob) or availability changes
  // so the board/queue re-read the store (the single source of truth).
  const [refreshKey, setRefreshKey] = useState(0);
  // Cursor-follow card while dragging from the queue. We suppress the native drag
  // ghost and show this instead — but ONLY when not hovering a valid board slot
  // (off-board or over a conflicting slot), so the board's own slot preview reads
  // clean when you can actually drop.
  const [qDragPos, setQDragPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const onOver = (e: DragEvent) => {
      if (!draggedQueueItem) return;
      // Mark the whole document a valid drop target while dragging from the queue.
      // Without this, releasing over a non-droppable area triggers the browser's
      // snap-back animation, which DELAYS `dragend` (and `drop` never fires) — so
      // the cursor-follow card lingers. Allowing the drop everywhere makes the
      // release fire immediately, clearing the preview at once.
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      setQDragPos({ x: e.clientX, y: e.clientY });
    };
    const onEnd = () => { setQDragPos(null); overValidSlot = false; };
    document.addEventListener("dragover", onOver);
    document.addEventListener("drop", onEnd);
    document.addEventListener("dragend", onEnd);
    return () => {
      document.removeEventListener("dragover", onOver);
      document.removeEventListener("drop", onEnd);
      document.removeEventListener("dragend", onEnd);
    };
  }, []);
  // Technician availability for the focused day — loaded client-side (effect).
  const [availability, setAvailability] = useState<AvailabilityEvent[]>([]);
  const [timeOffOpen, setTimeOffOpen]   = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [boardMenuOpen, setBoardMenuOpen]   = useState(false);
  const [showJobWizard, setShowJobWizard]   = useState(false);
  const [showReturnVisit, setShowReturnVisit] = useState(false);
  const [showVisitScheduler, setShowVisitScheduler] = useState(false);
  const [visitSchedErr, setVisitSchedErr] = useState<string | null>(null);

  // Jobs created in-session (New Job form / quote conversion) live in the session
  // store; load them client-side so they merge into the queue (unscheduled) and
  // the board/calendar (scheduled) without a hydration gap.
  const [sessionUnscheduled, setSessionUnscheduled] = useState<UnscheduledItem[]>([]);
  const [sessionItems, setSessionItems] = useState<CalendarItem[]>([]);
  // Planned agreement visits available to book from the board (client-side: reads
  // the localStorage-backed agreements store).
  const [schedulable, setSchedulable] = useState<SchedulableVisit[]>([]);
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
    setSchedulable(getSchedulableVisits(s));
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
    const reread = () => { setSettings(resolveDispatchSettings(settingsCompanyId, settingsLocationId)); setAgreementLeadDays(getAgreementLeadDays()); };
    reread();   // re-resolve now when the board scope changes, not only on focus
    window.addEventListener("focus", reread);
    window.addEventListener("storage", reread);
    document.addEventListener("visibilitychange", reread);
    return () => {
      window.removeEventListener("focus", reread);
      window.removeEventListener("storage", reread);
      document.removeEventListener("visibilitychange", reread);
    };
  }, [settingsCompanyId, settingsLocationId]);

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

  // refreshKey re-derives after writes (status changes from the drawer, scheduling, etc.).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rawItems    = useMemo(() => getCalendarItems(scope), [effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId, refreshKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allUnscheduled = useMemo(() => getUnscheduledItems(scope, agreementLeadDays), [effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId, refreshKey, agreementLeadDays]);
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
  // Board is the primary lens, scoped to the active location/branch. When a single
  // location is in view the "all" option names it ("All Augusta Boards") so it's
  // clear you're switching crews within that branch, not across branches.
  const activeLocationName = effectiveLocationId ? allLocations.find(l => l.id === effectiveLocationId)?.name : undefined;
  const allBoardsLabel = activeLocationName ? `All ${activeLocationName} Boards` : "All Boards";
  // Each board's hierarchy layer (org / company / location) and its lane (board
  // type), shown under the name in the picker so it's clear what a board covers.
  // Location is the most specific; an org-wide board (no company/location) claims
  // everything. The lane prefix is dropped for "custom" boards (no meaningful type).
  type ScopeLevel = "org" | "company" | "location";
  function boardScopeMeta(b: DispatchBoard): { level: ScopeLevel; scope: string } {
    if (b.locationId) return { level: "location", scope: allLocations.find(l => l.id === b.locationId)?.name ?? "Location" };
    if (b.companyId)  return { level: "company",  scope: allCompanies.find(c => c.id === b.companyId)?.name ?? "Company" };
    return { level: "org", scope: "Organization-wide" };
  }
  function boardSubline(b: DispatchBoard): string {
    const { scope } = boardScopeMeta(b);
    const lane = b.boardType !== "custom" ? BOARD_TYPE_LABELS[b.boardType] : "";
    return lane ? `${lane} · ${scope}` : scope;
  }
  const boardOptions = [
    { value: "all", label: allBoardsLabel, level: (activeLocationName ? "location" : "org") as ScopeLevel, sub: activeLocationName ? "Every board in this branch" : "Every board across the org" },
    ...boards.map(b => ({ value: b.id, label: b.name, level: boardScopeMeta(b).level, sub: boardSubline(b) })),
  ];
  const SCOPE_ICON: Record<ScopeLevel, typeof Globe> = { org: Globe, company: Building2, location: MapPin };
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
  // A board's members = people added by name PLUS holders of its assigned roles
  // (within the board's scope). This one resolver feeds BOTH the board rows and the
  // item-routing (itemMatchesBoard), so "who shows up" and "whose jobs land here"
  // can't drift apart. Keyed by board id; an assigned job follows its tech onto
  // every board whose member set includes them.
  const membersByBoard = useMemo<BoardMembers>(() => {
    const map: BoardMembers = {};
    for (const b of boards) {
      const names = new Set<string>(b.techNames);
      getUsersByRoles(b.roleKeys ?? [], b.companyId || undefined, b.locationId || undefined)
        .forEach(u => names.add(u.fullName));
      map[b.id] = names;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards, refreshKey]);

  // Board rows are the board's EXPLICIT members only — there's no implicit
  // "everyone", so e.g. dispatchers don't show unless they're members. "All Boards"
  // shows the union of members across every board in the view.
  const boardRoster = (() => {
    const names = new Set<string>();
    const collect = (b: DispatchBoard) => (membersByBoard[b.id] ?? new Set<string>()).forEach(n => names.add(n));
    if (activeBoardDef) collect(activeBoardDef);
    else boards.forEach(collect);
    // Only current staffed users appear as rows — a name left over in a board's
    // members from a since-deleted user is dropped (any jobs they still hold fall
    // into the Unassigned lane via isOrphan).
    return Array.from(names)
      .map(name => roster.find(r => r.name === name))
      .filter((r): r is TechRosterEntry => Boolean(r));
  })();
  const activeDispatcherLabel = activeBoardDef?.dispatchers.join(", ");
  // Primary/secondary text for the board switcher control (header, top-right).
  const boardMenuLabel = activeBoardDef ? activeBoardDef.name : "All Boards";
  const boardMenuSub   = activeBoardDef
    ? (activeDispatcherLabel || activeLocationName || "Dispatch board")
    : (activeLocationName || "All branches");

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
  const boardItems  = activeBoardDef ? items.filter(i => itemMatchesBoard(i, activeBoardDef, boards, membersByBoard)) : items;
  const unscheduled = [...allUnscheduled, ...sessionUnscheduled]
    .filter(u => !removed.has(u.id))
    .filter(u => !activeBoardDef || itemMatchesBoard(u, activeBoardDef, boards, membersByBoard))
    // Job Type / Priority from the Filter popover narrow the queue too, so the
    // filter reads consistently across board + queue. Technician is intentionally
    // NOT applied here — queue work is unassigned, and hiding it on a tech filter
    // would defeat dragging that work onto the chosen tech's lane.
    .filter(u => fType === "all" || u.jobType === fType)
    .filter(u => fPrio === "all" || u.priority === fPrio);
  const jobTypes = useMemo(() => Array.from(new Set(rawItems.map(i => i.jobType).filter(Boolean))) as string[], [rawItems]);
  const availableLayers = CALENDAR_LAYERS.filter(t => ["job","agreement_visit","task","project_milestone"].includes(t) && rawItems.some(i => i.type === t));
  const activeLayerCount = availableLayers.filter(t => !hidden.has(t)).length;
  const layersFiltered = activeLayerCount < availableLayers.length;
  // Board selection is a primary lens (its own toolbar control), not a narrowing
  // filter, so it no longer counts toward the Filters badge.
  const activeFilters = [fTech !== "all", fType !== "all", fPrio !== "all", layersFiltered].filter(Boolean).length;

  function toggleLayer(t: CalendarItemType) { setHidden(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; }); }
  function showAllLayers() { setHidden(p => { const n = new Set(p); availableLayers.forEach(t => n.delete(t)); return n; }); }
  function reassign(tech: string) {
    if (!selScheduled) return;
    // Jobs persist to the store; other sources (tasks/agreements) stay board-local.
    if (selScheduled.sourceModule === "jobs" && selScheduled.sourceId) {
      const updated = updateJob(selScheduled.sourceId, { assignedTo: tech, assignedToInitials: initials(tech) });
      if (updated) syncAgreementVisitFromJob(updated);
      setRefreshKey(k => k + 1);
    } else if (selScheduled.sourceModule === "appointments" && selScheduled.sourceId) {
      // Reassign the appointment; mirror the primary tech onto the job for
      // job-centric views (mobile, jobs list). The work order is untouched.
      const appt = updateAppointment(selScheduled.sourceId, { techIds: tech ? [tech] : [] });
      if (appt) updateJob(appt.jobId, { assignedTo: tech, assignedToInitials: initials(tech) });
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
      const updated = updateJob(item.sourceId, {
        scheduledDate: jobDateStr(start), scheduledTime: jobTimeStr(start), durationMinutes,
        ...(tech ? { assignedTo: tech, assignedToInitials: initials(tech) } : {}),
      });
      // If this job is a booked agreement visit, mirror the new date/tech back onto
      // the linked visit so the agreement's plan stays in step (no-op for plain jobs).
      if (updated) syncAgreementVisitFromJob(updated);
      setRefreshKey(k => k + 1);
      return;
    }
    if (item?.sourceModule === "appointments" && item.sourceId) {
      // Move/resize the appointment (the dispatch event); mirror schedule + tech
      // onto the job so job-centric views stay in step. Work order untouched.
      const appt = updateAppointment(item.sourceId, {
        scheduledDate: jobDateStr(start), scheduledTime: jobTimeStr(start), durationMinutes,
        ...(tech ? { techIds: [tech] } : {}),
      });
      if (appt) updateJob(appt.jobId, {
        scheduledDate: appt.scheduledDate, scheduledTime: appt.scheduledTime, durationMinutes,
        ...(tech ? { assignedTo: tech, assignedToInitials: initials(tech) } : {}),
      });
      setRefreshKey(k => k + 1);
      return;
    }
    setEdits(e => ({ ...e, [id]: { ...e[id], start, durationMinutes, ...(tech ? { assignedTo: tech } : {}) } }));
  }

  // ── Scheduling ──
  // True if the proposed schedule would overlap another job in that tech's lane
  // that day — used to block the confirm modal (jobs can't double-book a tech).
  function slotConflict(d: ScheduleDraft): boolean {
    if (!d.tech) return false;
    const start = new Date(`${d.date}T${d.time}`);
    if (isNaN(start.getTime())) return false;
    const end = start.getTime() + d.durationMinutes * 60_000;
    const excludeId = confirm?.item.sourceId;
    return boardItems.some(i => {
      if (i.allDay || (i.assignedTo ?? "") !== d.tech) return false;
      if (excludeId && i.sourceId === excludeId) return false;
      if (!isSameDay(i.start, start)) return false;
      const s = i.start.getTime();
      return start.getTime() < s + i.durationMinutes * 60_000 && end > s;
    });
  }
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
      // Convert to the appointment model — the job now dispatches via a work-order
      // appointment (the board renders that; the job stays the container).
      scheduleExistingJob(u.sourceId, {
        scheduledDate: jobDateStr(start), scheduledTime: jobTimeStr(start),
        durationMinutes: d.durationMinutes, techIds: d.tech ? [d.tech] : [],
      });
      setRefreshKey(k => k + 1);   // re-reads store: item moves out of queue, onto board
      setConfirm(null);
      return;
    }

    // Agreement visit from the queue → materialize THAT planned visit into a Job so
    // the visit is flipped to scheduled and linked (write-back works on completion).
    if (u.sourceModule === "agreements" && u.agreementId) {
      const res = materializeVisitJob(u.agreementId, u.sourceId, {
        companyId: u.companyId, locationId: u.locationId, serviceAreaId: u.serviceAreaId,
        scheduledDate: jobDateStr(start), scheduledTime: jobTimeStr(start),
        assignedTo: d.tech || undefined, durationMinutes: d.durationMinutes,
      });
      if (!res.error) { setRemoved(r => new Set(r).add(u.id)); setRefreshKey(k => k + 1); }
      setConfirm(null);
      return;
    }

    // Any other source (approved quote, follow-up task) becomes a real Job linked
    // back to its origin, so everything on the board lives under the one job
    // lifecycle. dispatchType keeps its original color/label.
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

  // Book a planned agreement visit from the Create menu. Materializes it into a Job
  // (it counts as a visit on the agreement) and drops it onto the board.
  function confirmScheduleVisit(d: VisitScheduleDraft) {
    const entry = schedulable.find(s => s.agreement.id === d.agreementId && s.visit.id === d.visitId);
    const start = new Date(`${d.date}T${d.time}`);
    const res = materializeVisitJob(d.agreementId, d.visitId, {
      companyId: entry?.companyId || effectiveCompanyId || "",
      locationId: entry?.locationId || effectiveLocationId || "",
      serviceAreaId: effectiveServiceAreaId ?? undefined,
      scheduledDate: jobDateStr(start), scheduledTime: jobTimeStr(start),
      assignedTo: d.tech || undefined,
      durationMinutes: d.durationMinutes,
    });
    if (res.error) { setVisitSchedErr(res.error); return; }
    setShowVisitScheduler(false);
    setRefreshKey(k => k + 1);
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
          <PageTitle
            title={view === "map" ? "Dispatch Map" : "Dispatching"}
            description={view === "map"
              ? "See jobs, routes, technicians, and AI routing suggestions in one live view."
              : "Schedule jobs, assign technicians, and manage unscheduled work."} />
          {boardScopeNotice && (
            <button onClick={() => selectBoard("all")}
              title="Viewing a scoped board — click to return to all boards"
              className="group inline-flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors"
              style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)", border: "1px solid var(--accent-soft-border)" }}>
              {boardScopeNotice.level === "location" ? <MapPin className="w-3 h-3 shrink-0" /> : <Building2 className="w-3 h-3 shrink-0" />}
              <span>Viewing {boardScopeNotice.level} board · {boardScopeNotice.name}</span>
              <X className="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>

        {/* Center: date label above a quiet nav — ghost icon buttons + a subtle
            Today link, no heavy segmented container, integrated with the dark UI. */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{rangeLabel}</span>
          <div className="flex items-center gap-0.5">
            <button onClick={() => navigate(-1)} title="Previous" className="p-1 rounded-md transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setFocus(new Date())} className="px-2 py-0.5 rounded-md text-xs font-medium transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}>Today</button>
            <button onClick={() => navigate(1)} title="Next" className="p-1 rounded-md transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Right: board switcher — the primary lens (Hourly / Service Blocks now
            lives in the Filters popover). */}
        <div className="flex-1 flex justify-end items-center gap-2 min-w-0">
          {/* Board switcher — the main control. Styled as a primary context picker
              (icon tile · board name · context sub-line · chevron), not a bare
              dropdown, so it reads as "which board am I dispatching?". */}
          <div className="relative shrink-0">
            <button onClick={() => setBoardMenuOpen(o => !o)}
              title="Switch dispatch board"
              className="group flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}
              aria-haspopup="menu" aria-expanded={boardMenuOpen}>
              <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors"
                style={{ backgroundColor: boardMenuOpen ? "var(--accent-soft-2-bg)" : "var(--accent-soft-bg)", color: boardMenuOpen ? "var(--accent-text-strong)" : "var(--accent-text)" }}>
                <MoreActionsGlyph open={boardMenuOpen} />
              </div>
              <div className="min-w-0 text-left max-w-[180px]">
                <p className="text-sm font-semibold leading-tight truncate" style={{ color: "var(--text-primary)" }}>{boardMenuLabel}</p>
                <p className="text-[10px] leading-tight truncate" style={{ color: "var(--text-muted)" }}>{boardMenuSub}</p>
              </div>
              <ChevronDown className="w-4 h-4 shrink-0" style={{ color: boardMenuOpen ? "var(--accent-text)" : "var(--text-muted)", transition: "color 0.18s ease" }} />
            </button>
            {boardMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setBoardMenuOpen(false)} />
                <div role="menu" className="absolute right-0 mt-1.5 w-60 rounded-xl overflow-hidden z-50 p-1"
                  style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest px-2.5 pt-1.5 pb-1" style={{ color: "var(--text-muted)" }}>Dispatch board</p>
                  {boardOptions.map(o => {
                    const sel = o.value === boardId;
                    const ScopeIcon = SCOPE_ICON[o.level];
                    return (
                      <button key={o.value} role="menuitemradio" aria-checked={sel}
                        onClick={() => { selectBoard(o.value); setBoardMenuOpen(false); }}
                        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                        <span className="min-w-0">
                          <span className="block text-sm truncate" style={{ color: sel ? "#4f46e5" : "var(--text-secondary)", fontWeight: sel ? 600 : 400 }}>{o.label}</span>
                          <span className="flex items-center gap-1 text-[10px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                            <ScopeIcon className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{o.sub}</span>
                          </span>
                        </span>
                        {sel && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#4f46e5" }} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

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
            { key: "map",      icon: MapIcon,       label: "Map" },
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
        {/* Map tab: Today / Custom date+time range (inline with the view tabs) */}
        {view === "map" && (
          <div className="relative">
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button onClick={() => { setMapDateMode("today"); setMapCustomOpen(false); }} className="px-3 py-1.5 text-sm transition-colors"
                style={{ backgroundColor: mapDateMode === "today" ? "#4f46e5" : "var(--bg-surface)", color: mapDateMode === "today" ? "#fff" : "var(--text-secondary)" }}>
                Today
              </button>
              <button onClick={() => { setMapDateMode("custom"); setMapCustomOpen(o => !o); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
                style={{ backgroundColor: mapDateMode === "custom" ? "#4f46e5" : "var(--bg-surface)", color: mapDateMode === "custom" ? "#fff" : "var(--text-secondary)", borderLeft: "1px solid var(--border)" }}>
                <CalendarDays className="w-3.5 h-3.5" /> Custom <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            {mapCustomOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-[1000] rounded-xl p-4 w-72" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Date range</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-[10px] mb-1" style={{ color: "var(--text-secondary)" }}>From</label>
                    <DatePicker size="sm" value={mapFromDate} onChange={v => { setMapFromDate(v); if (v > mapToDate) setMapToDate(v); }} min={todayYMD()} /></div>
                  <div><label className="block text-[10px] mb-1" style={{ color: "var(--text-secondary)" }}>To</label>
                    <DatePicker size="sm" value={mapToDate} onChange={setMapToDate} min={mapFromDate || todayYMD()} /></div>
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mt-3 mb-2" style={{ color: "var(--text-muted)" }}>Time range <span className="font-normal normal-case">· board hours only</span></p>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-[10px] mb-1" style={{ color: "var(--text-secondary)" }}>From</label>
                    <TimePicker size="sm" value={mapFromTime} onChange={setMapFromTime} placeholder="Any" startHour={Math.floor(hourly.startHour)} endHour={Math.ceil(hourly.endHour)} /></div>
                  <div><label className="block text-[10px] mb-1" style={{ color: "var(--text-secondary)" }}>To</label>
                    <TimePicker size="sm" value={mapToTime} onChange={setMapToTime} placeholder="Any" startHour={Math.floor(hourly.startHour)} endHour={Math.ceil(hourly.endHour)} /></div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <button onClick={() => { setMapFromTime(""); setMapToTime(""); }} className="text-[11px]" style={{ color: "var(--text-muted)" }}>Clear times</button>
                  <button onClick={() => setMapCustomOpen(false)} className="text-xs font-medium text-white px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#4f46e5" }}>Apply</button>
                </div>
              </div>
            )}
          </div>
        )}

        {view !== "map" && (
        <div className="flex items-center gap-2">
          {/* Create — add a schedulable job or technician time off to the board */}
          <div className="relative">
            <button onClick={() => !noTechs && setCreateMenuOpen(o => !o)} disabled={noTechs}
              title={noTechs ? "Add technicians in Settings → Users & Roles first" : "Add to board"}
              className="plus-glow flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              aria-haspopup="menu" aria-expanded={createMenuOpen}
              data-open={createMenuOpen || showJobWizard || showReturnVisit || showVisitScheduler || timeOffOpen}>
              <Plus className="w-4 h-4" />
            </button>
            {createMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCreateMenuOpen(false)} />
                <div role="menu" className="absolute right-0 mt-1.5 w-52 rounded-xl overflow-hidden z-50 py-1"
                  style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest px-3 pt-2 pb-1" style={{ color: "var(--text-muted)" }}>Add to board</p>
                  {([
                    { label: "New Job", sub: "Schedulable work", icon: Briefcase, onClick: () => { setCreateMenuOpen(false); setShowJobWizard(true); } },
                    { label: "Return Visit", sub: "2nd visit on an existing job", icon: RotateCcw, onClick: () => { setCreateMenuOpen(false); setShowReturnVisit(true); } },
                    { label: "Agreement Visit", sub: "Book a planned visit", icon: CalendarDays, onClick: () => { setCreateMenuOpen(false); setVisitSchedErr(null); setShowVisitScheduler(true); } },
                    { label: "Time Off", sub: "PTO / blocked time", icon: CalendarClock, onClick: () => { setCreateMenuOpen(false); setTimeOffOpen(true); } },
                  ] as const).map(entry => (
                    <button key={entry.label} onClick={entry.onClick}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)" }}>
                        <entry.icon className="w-4 h-4" style={{ color: "var(--accent-text)" }} />
                      </div>
                      <div className="min-w-0"><p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{entry.label}</p><p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{entry.sub}</p></div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Filter — Board is the first filter; layers fold in here too */}
          <div className="relative" ref={filtersRef}>
            <button onClick={() => setFiltersOpen(o => !o)}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 active:scale-95 hover:brightness-[0.98]"
              style={{ border: `1px solid ${activeFilters || filtersOpen ? "var(--accent-soft-border)" : "var(--border)"}`, backgroundColor: activeFilters || filtersOpen ? "var(--accent-soft-bg)" : "var(--bg-surface)", color: activeFilters || filtersOpen ? "var(--accent-text)" : "var(--text-secondary)" }}>
              {/* Sliders whose knobs slide into place — on hover, and while open. */}
              <SlidersGlyph active={filtersOpen} /> Filter
              {activeFilters > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-[pulse_1.6s_ease-in-out_2]" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text)" }}>{activeFilters}</span>}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 w-72" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>
                  {activeFilters > 0 && <button onClick={() => { setFTech("all"); setFType("all"); setFPrio("all"); showAllLayers(); }} className="text-xs" style={{ color: "var(--accent-text)" }}>Clear all</button>}
                </div>
                <div className="space-y-2.5">
                  {/* Board moved out to its own toolbar control; these narrow WITHIN the selected board. */}
                  {/* Dispatch layout — hourly grid vs service blocks (dispatch view only). */}
                  {view === "dispatch" && (
                    <FilterField label="Dispatch Layout">
                      <div className="flex items-center rounded-lg overflow-hidden w-full" style={{ border: "1px solid var(--border)" }}>
                        {([{ key: "hourly", label: "Hourly" }, { key: "blocks", label: "Service Blocks" }] as const).map(m => {
                          const active = dispatchMode === m.key;
                          return (
                            <button key={m.key} onClick={() => setMode(m.key)} className="flex-1 px-3 py-1.5 text-xs font-medium transition-colors"
                              style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-muted)" }}>
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </FilterField>
                  )}
                  <FilterField label="Technician"><Select size="sm" value={fTech} onChange={setFTech} options={[{ value: "all", label: "All Technicians" }, ...technicians.map(t => ({ value: t, label: t }))]} /></FilterField>
                  <FilterField label="Job Type"><Select size="sm" value={fType} onChange={setFType} options={[{ value: "all", label: "All Types" }, ...jobTypes.map(t => ({ value: t, label: jobTypeLabel(t) }))]} /></FilterField>
                  <FilterField label="Priority"><Select size="sm" value={fPrio} onChange={setFPrio} options={[{ value: "all", label: "Any Priority" }, { value: "urgent", label: "Urgent" }, { value: "high", label: "High" }, { value: "normal", label: "Normal" }, { value: "low", label: "Low" }]} /></FilterField>

                  {/* Layers — show/hide item types on the board */}
                  {availableLayers.length > 0 && (
                    <div className="pt-1.5" style={{ borderTop: "1px solid var(--border)" }}>
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
        )}
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
      {view === "dispatch" && <DispatchBoard focus={focus} mode={dispatchMode} items={boardItems} roster={boardRoster} availability={availability} dayStart={hourly.startHour} dayEnd={hourly.endHour} increment={hourly.increment} blocks={activeBlocks} onSelect={setSelScheduled} onMoveResize={applyMoveResize} onRemoveAvailability={handleRemoveTimeOff} onDropItem={(uid, tech, hour, minute) => { const u = unscheduled.find(x => x.id === uid); if (u) openConfirm(u, tech, focus, hour, minute); }} onItemChanged={() => setRefreshKey(k => k + 1)} />}
      {view === "week"     && <WeekView  focus={focus} items={boardItems} onSelect={setSelScheduled} />}
      {view === "day"      && <DayView   focus={focus} items={boardItems} dayStart={hourly.startHour} dayEnd={hourly.endHour} onSelect={setSelScheduled} />}
      {view === "month"    && <MonthView focus={focus} items={boardItems} onSelect={setSelScheduled} />}
      {view === "map"      && <DispatchMap dateFilter={{ mode: mapDateMode, fromDate: mapFromDate, toDate: mapToDate, fromTime: mapFromTime, toTime: mapToTime }} />}

      {/* Unscheduled queue — BELOW the board (not in map view; the map has its own) */}
      {view !== "map" && (
        <UnscheduledQueue
          items={unscheduled} views={queueViews} tab={queueTab} setTab={setQueueTab}
          search={queueSearch} setSearch={setQueueSearch} onSelect={setSelUnscheduled}
        />
      )}

      {/* Drawer */}
      {selScheduled && <CalendarItemDrawer scheduled={selScheduled} technicians={technicians} onClose={() => setSelScheduled(null)} onReassign={reassign}
        increment={hourly.increment} onChanged={() => { setRefreshKey(k => k + 1); setSelScheduled(null); }} />}
      {selUnscheduled && <CalendarItemDrawer unscheduled={selUnscheduled} technicians={technicians} onClose={() => setSelUnscheduled(null)} onSchedule={() => scheduleFromDrawer(selUnscheduled)} />}

      {/* Confirm modal */}
      {confirm && <ScheduleConfirmModal item={confirm.item} draft={confirm.draft} technicians={technicians} dayStart={hourly.startHour} dayEnd={hourly.endHour} increment={hourly.increment} onConfirm={confirmSchedule} onClose={() => setConfirm(null)} checkOverlap={slotConflict} />}

      {/* Time off / availability modal */}
      {timeOffOpen && <TimeOffModal technicians={technicians} defaultDate={ymd(focus)} onClose={() => setTimeOffOpen(false)} onSave={handleAddTimeOff} />}

      {/* Create a job straight from the board — refreshes so it lands on the grid / queue */}
      {showJobWizard && <JobWizard onClose={() => setShowJobWizard(false)} onCreated={() => { setShowJobWizard(false); setRefreshKey(k => k + 1); }} />}
      {showReturnVisit && <ReturnVisitModal onClose={() => setShowReturnVisit(false)} onScheduled={() => setRefreshKey(k => k + 1)} />}

      {/* Book a planned agreement visit → materializes into a Job on the board */}
      {showVisitScheduler && (
        <ScheduleVisitModal
          visits={schedulable} technicians={technicians}
          defaultDate={ymd(focus)} dayStart={hourly.startHour} dayEnd={hourly.endHour} increment={hourly.increment}
          checkOverlap={slotConflict} error={visitSchedErr}
          onConfirm={confirmScheduleVisit}
          onClose={() => setShowVisitScheduler(false)}
        />
      )}

      {/* Cursor-follow card while dragging from the queue — shown only when there's
          no valid board slot under the cursor (off-board or over a taken slot). */}
      {qDragPos && draggedQueueItem && !overValidSlot && (
        <div className="fixed z-[100] pointer-events-none rounded-lg p-2.5 w-56"
          style={{ left: qDragPos.x + 14, top: qDragPos.y + 14, backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${draggedQueueItem.color}`, boxShadow: "0 8px 24px rgba(0,0,0,0.22)" }}>
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{draggedQueueItem.title}</p>
          {draggedQueueItem.customerName && <p className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>{draggedQueueItem.customerName}</p>}
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{draggedQueueItem.durationMinutes}m · drop on a free slot</p>
        </div>
      )}
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

function DispatchBoard({ focus, mode, items, roster, availability, dayStart, dayEnd, increment, blocks, onSelect, onMoveResize, onRemoveAvailability, onDropItem, onItemChanged }: {
  focus: Date; mode: DispatchMode; items: CalendarItem[];
  roster: TechRosterEntry[];
  availability: AvailabilityEvent[];
  dayStart: number; dayEnd: number; increment: number; blocks: SettingsServiceBlock[];
  onSelect: (i: CalendarItem) => void;
  onMoveResize: (id: string, start: Date, durationMinutes: number, tech?: string) => void;
  onRemoveAvailability: (id: string) => void;
  onDropItem: (uid: string, tech: string, hour: number, minute: number) => void;
  onItemChanged: () => void;   // refresh after an in-card status change
}) {
  const dayItems = items.filter(i => isSameDay(i.start, focus) && !i.allDay);

  // Tech live/base positions → drive-time between a lane's stops (ETA on the board).
  const techPos = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>();
    for (const t of getMapTechnicians()) m.set(t.name, t.current ?? t.base);
    return m;
  }, []);

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
  // kind "move" renders as a dashed ghost at the target slot (origin block stays
  // put, dimmed) — same language for same-lane and cross-tech; "resize" tracks
  // live on the block itself. `committed` = the drop was accepted but the board's
  // data hasn't re-rendered yet — hold the ghost so the block never flashes at
  // its OLD slot across the commit gap (session items load via an effect).
  const [preview, setPreview] = useState<{ id: string; startMin: number; durationMinutes: number; tech: string; kind: "move" | "resize"; committed?: boolean } | null>(null);

  // Release a committed drag-ghost once the moved item actually renders at its
  // new slot (data lands a commit after the drop) — never before, or the block
  // would flash at the old position for a frame.
  useEffect(() => {
    if (!preview?.committed) return;
    const it = items.find(i => i.id === preview.id);
    const landed = !it || (
      startMinOf(it) === preview.startMin &&
      (preview.kind === "move" ? (it.assignedTo ?? "") === preview.tech : it.durationMinutes === preview.durationMinutes)
    );
    if (landed) setPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, preview]);
  const [dragTech, setDragTech] = useState<string | null>(null);
  // Live drop preview while dragging a queue job onto a lane (which lane + slot).
  const [queuePreview, setQueuePreview] = useState<{ tech: string; startMin: number } | null>(null);
  useEffect(() => {
    const onEnd = () => { setQueuePreview(null); setDragTech(null); };
    document.addEventListener("dragend", onEnd);
    return () => document.removeEventListener("dragend", onEnd);
  }, []);
  // Rejected move/drop (overlap, past, visit order) → the app-wide notice host
  // (bottom-right, same anchor as Saved) so all transient feedback lives in one place.
  function flashOverlap(msg = "Jobs can't overlap — that slot is already taken.") {
    pingError(msg);
  }

  // A linked visit must stay in order: a later visit can't start before an earlier
  // visit of the same job ends, and an earlier visit can't run past a later one.
  // Visit order is stable (creation order via visitIndex), so this never flips.
  function visitOrderViolation(item: CalendarItem, startMin: number, durationMinutes: number): boolean {
    if (!item.jobId || !item.visitIndex) return false;
    const end = startMin + durationMinutes;
    return dayItems.some(s => {
      if (s.id === item.id || s.jobId !== item.jobId || !s.visitIndex) return false;
      const sStart = startMinOf(s), sEnd = sStart + s.durationMinutes;
      if (s.visitIndex < item.visitIndex!) return startMin < sEnd;   // must start after the earlier visit ends
      if (s.visitIndex > item.visitIndex!) return end > sStart;      // must end before the later visit starts
      return false;
    });
  }

  // Would a block of [startMin, startMin+dur) overlap another timed item in the
  // same tech lane today? Jobs can't sit on top of one another.
  function laneOverlap(tech: string, startMin: number, durationMinutes: number, excludeId: string): boolean {
    const end = startMin + durationMinutes;
    return dayItems.some(i => {
      // All-day items (reminders/reviews) aren't slot bookings — same rule as slotConflict.
      if (i.allDay || i.id === excludeId || (i.assignedTo ?? "") !== tech) return false;
      const s = startMinOf(i);
      return startMin < s + i.durationMinutes && end > s;
    });
  }
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

  // ─── Now-line rule ────────────────────────────────────────
  // The now-line is a wall: nothing schedules INTO the past. Moves clamp so the
  // start never lands before now (a job can slip later, never earlier — and a
  // missed job can be picked up and moved forward). Resizes can't make a running
  // job end before now. Off-today (now == null) there's no wall.
  const nowFloor = now == null ? 0 : Math.min(Math.ceil(now.min / increment) * increment, totalMin - increment);

  // Pointer-driven move (drag body, across rows) / resize (drag right edge).
  function beginDrag(e: React.MouseEvent, item: CalendarItem, kind: "move" | "resize") {
    e.preventDefault(); e.stopPropagation();
    const blockEl = (e.currentTarget as HTMLElement).closest("[data-block]") as HTMLElement | null;
    const track   = blockEl?.closest("[data-track]") as HTMLElement | null;
    if (!track || !blockEl) return;
    const base = startMinOf(item); const dur0 = item.durationMinutes;
    // A visit that already ENDED is history — it can't be dragged around the
    // board. Rebooking a missed/past visit goes through Reschedule in the visit
    // panel, which validates the sequence properly. (Click still opens the panel.)
    const lockedPast = now != null && base + dur0 <= now.min;
    const startX = e.clientX, startY = e.clientY;     // for click-vs-drag detection
    const originTech = item.assignedTo ?? "";
    let moved = false; let curStart = base; let curDur = dur0; let curTech = originTech;
    let warnedPast = false;   // one past-drag notice per gesture, not per mousemove
    document.body.style.userSelect = "none";
    if (kind === "move") blockEl.style.pointerEvents = "none"; // so elementFromPoint sees the row below
    // Fast drags fire mousemove faster than the board can render. Dedupe (snapping
    // means most events resolve to the SAME slot) and coalesce updates into one
    // per animation frame — without this the whole board re-renders per event and
    // the tracked card stutters/flickers, worst on cross-lane moves where the
    // card also swaps between "tracking" and "ghost" rendering.
    let lastKey = ""; let raf = 0;
    const pushPreview = () => {
      const key = `${curStart}:${curDur}:${curTech}`;
      if (key === lastKey) return;
      lastKey = key;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPreview({ id: item.id, startMin: curStart, durationMinutes: curDur, tech: curTech, kind }));
    };
    // Listener/style teardown only — each release path decides what happens to
    // the preview (rejects clear it; a successful drop HOLDS it, see onUp).
    const cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      document.body.style.userSelect = "";
      blockEl.style.pointerEvents = "";
    };
    // Escape aborts the drag outright — the card returns to where it was.
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      cleanup();
      setPreview(null);
    };
    const onMove = (ev: MouseEvent) => {
      const mm = commitFromX(ev.clientX, track);
      // Treat it as a drag once the cursor travels past a small threshold in
      // EITHER axis — a near-vertical drag to another tech's row barely changes
      // X, so an X-only test would misread it as a click and open the drawer.
      if (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4) moved = true;
      // Ended visits are locked: the first real drag movement ends the gesture
      // with an explanation instead of tracking.
      if (lockedPast) {
        if (moved) { cleanup(); flashOverlap("This visit already ended — it can't be dragged. Use Reschedule in the visit panel to rebook it."); }
        return;
      }
      if (kind === "move") {
        curDur = dur0;
        const overTrack = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest("[data-track]") as HTMLElement | null;
        if (overTrack?.dataset.tech) curTech = overTrack.dataset.tech;
        // EVERY move — same lane or cross-tech — behaves like a queue drop: the
        // ghost snaps its START to the slot boundary under the cursor (the grab
        // offset is ignored). One snap feel everywhere.
        const slot = Math.floor(mm / increment) * increment;
        // A visit that already STARTED (12:00 start, it's 12:01) can still slip
        // forward — but its ORIGINAL slot always stays legal: dragging back to /
        // past its own start snaps the ghost home, and releasing there changes
        // nothing. Without this, one accidental grab forces the visit forward
        // with no way to put it back.
        const restore = curTech === originTech && base < nowFloor && slot <= base;
        // Aiming at the past (and not restoring home) → the ghost stops at the
        // now-line; say why, once per gesture.
        if (now != null && !restore && slot < nowFloor && moved && !warnedPast) {
          warnedPast = true;
          flashOverlap("That time is in the past — visits can only move from now forward.");
        }
        curStart = restore ? base : clamp(slot, nowFloor, totalMin - dur0);
      } else {
        // A job that already started can't be shrunk to end before now.
        const minDur = Math.max(30, base < nowFloor ? nowFloor - base : 30);
        const rawDur = mm - base;
        const snappedDur = clamp(snap(rawDur), minDur, totalMin - base);
        // Same hysteresis on the resize edge.
        if (snappedDur !== curDur && Math.abs(rawDur - curDur) >= increment * 0.55) curDur = snappedDur;
        curStart = base;
      }
      // Reassigning to a different tech is always a move, never a click.
      if (curTech !== originTech) moved = true;
      // Only enter the live "tracking" preview once it's an actual drag. A click
      // carries a few px of jitter; without this guard that jitter flips the card
      // into tracking mode and flickers its subline (customer → time readout)
      // before the click resolves to a selection.
      if (moved) pushPreview();
    };
    const onUp = () => {
      cleanup();
      if (lockedPast) { setPreview(null); if (!moved) onSelect(item); return; }
      if (moved) {
        // Nothing actually changed (dropped back on its own slot) → a no-op,
        // not a move: no write, no validation, the card is simply back.
        if (curStart === base && curDur === dur0 && curTech === originTech) { setPreview(null); return; }
        const targetTech = kind === "move" ? curTech : originTech;
        // Reject a move/resize that would overlap another job in the lane — revert.
        if (laneOverlap(targetTech, curStart, curDur, item.id)) { setPreview(null); flashOverlap(); return; }
        // A linked/return visit must stay after the first visit — never let a drag
        // reorder the visits of the same job.
        if (visitOrderViolation(item, curStart, curDur)) {
          setPreview(null);
          flashOverlap(item.visitIndex === 1
            ? "The first visit must stay before the return visit."
            : "A return visit must stay after the first visit.");
          return;
        }
        // Accepted: HOLD the ghost (committed) across the commit gap — the board's
        // data re-renders one commit later, and clearing now would flash the block
        // at its old slot. The items-effect clears it once the move lands; the
        // timeout is a safety net so a mismatch can never strand the ghost.
        setPreview({ id: item.id, startMin: curStart, durationMinutes: curDur, tech: curTech, kind, committed: true });
        window.setTimeout(() => setPreview(prev => (prev?.committed ? null : prev)), 400);
        const nd = new Date(focus); nd.setHours(dayStart + Math.floor(curStart / 60), curStart % 60, 0, 0);
        onMoveResize(item.id, nd, curDur, kind === "move" ? curTech : undefined);
      } else {
        setPreview(null);
        onSelect(item);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKey);
  }

  return (
    <div className="relative">
      {/* Current-time box — OUTSIDE the board container (which clips), pinned above
          it and aligned to the now-line. Offset by the 180px technician column so
          its x matches the dashed line inside the grid. */}
      {now != null && (
        <div className="absolute z-30 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap pointer-events-none"
          style={{ top: -17, left: `calc(180px + (100% - 180px) * ${now.min / totalMin})`, transform: "translateX(-50%)", backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)", border: "1px solid var(--accent-soft-border)" }}>
          {now.label}
        </div>
      )}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        {/* Header */}
        <div className="flex" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <div className="w-[180px] shrink-0 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Technician</div>
        <div className="flex-1 flex relative">
          {labels.map(l => (
            <div key={l.key} className="px-1 py-1.5 text-[10px] font-semibold text-center whitespace-nowrap" style={{ flex: l.span, color: "var(--text-muted)", borderLeft: "1px solid var(--border)" }}>{l.label}</div>
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
        // Drive-time along this lane's route: from the tech's live position to the
        // first stop, then between consecutive stops. legMin[id] = minutes to reach it.
        const legMin: Record<string, number> = {};
        let routeMin = 0;
        if (!isUnassigned) {
          const ordered = [...techItems].sort((a, b) => startMinOf(a) - startMinOf(b));
          let origin = techPos.get(tech.name) ?? null;
          for (const it of ordered) {
            const loc = geocode(it.sourceId || it.id, it.serviceAreaId);
            if (origin) { const mn = driveMinutes(origin, loc); legMin[it.id] = mn; routeMin += mn; }
            origin = loc;
          }
        }
        const isDropTarget = dragTech === tech.name || (preview != null && preview.tech === tech.name);
        return (
          <div key={tech.name || "__unassigned"} className="flex" style={{ borderBottom: ri < rows.length - 1 ? "1px solid var(--border)" : "none", backgroundColor: isUnassigned ? "var(--warning-soft-bg)" : undefined }}>
            {/* Tech cell */}
            <div className="w-[180px] shrink-0 px-3 py-2.5 flex items-start gap-2" style={{ borderRight: "1px solid var(--border)" }}>
              {/* People wear the swiss-coffee circle (same as contact avatars);
                  the unassigned lane keeps its warning tile — it's a state, not a person. */}
              <div className={`w-7 h-7 ${isUnassigned ? "rounded-lg" : "rounded-full"} flex items-center justify-center text-[9px] font-bold shrink-0`}
                style={{ backgroundColor: isUnassigned ? "var(--warning-soft-border)" : "#e5e0db", color: isUnassigned ? "var(--warning-text)" : "#5c5545" }}>{tech.initials}</div>
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
                {/* One line, truncated — wrapping makes this cell taller than the
                    64px track and un-levels the lane rows. */}
                <p className="text-[9px] mt-0.5 truncate whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{techItems.length} job{techItems.length===1?"":"s"}{isUnassigned ? "" : ` · ~${openHrs}h open`}{!isUnassigned && routeMin > 0 ? ` · ~${routeMin}m drive` : ""}</p>
              </div>
            </div>

            {/* Time track — drop target (queue → schedule) + interactive blocks */}
            {/* minHeight (not height) so the track stretches to the full row when
                the tech cell is taller — otherwise gridlines, the now-line, and
                the drop highlight stop short and the lane looks broken mid-drag. */}
            <div data-track data-tech={tech.name}
              className="flex-1 relative transition-colors self-stretch"
              style={{ minHeight: `${ROW_H}px`, backgroundColor: isDropTarget ? "var(--accent-soft-bg)" : undefined }}
              onDragOver={e => {
                e.preventDefault();
                if (dragTech !== tech.name) setDragTech(tech.name);
                if (draggedQueueItem) {
                  const mm = Math.floor(commitFromX(e.clientX, e.currentTarget) / increment) * increment;
                  // Floor at the now-line — a queue job can't be aimed at the past.
                  const startMin = clamp(mm, nowFloor, totalMin - increment);
                  // ALWAYS show the board ghost while over a lane — red when the slot
                  // is taken (mirrors the move-preview). Toggling between the ghost
                  // and the cursor card per-slot made the drag flicker ("glitchy").
                  overValidSlot = true;
                  if (!queuePreview || queuePreview.tech !== tech.name || queuePreview.startMin !== startMin) setQueuePreview({ tech: tech.name, startMin });
                }
              }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDragTech(null); setQueuePreview(null); overValidSlot = false; } }}
              onDrop={e => {
                e.preventDefault(); setDragTech(null); setQueuePreview(null); overValidSlot = false;
                const id = e.dataTransfer.getData("text/plain"); if (!id) return;
                const mm = Math.floor(commitFromX(e.clientX, e.currentTarget) / increment) * increment;
                const safe = clamp(mm, nowFloor, totalMin - increment);
                // Don't drop onto a span already taken by another job in this lane —
                // the same overlap test that turns the ghost red.
                const dropDur = draggedQueueItem?.durationMinutes || increment;
                if (laneOverlap(tech.name, safe, dropDur, "")) { flashOverlap(); return; }
                onDropItem(id, tech.name, dayStart + Math.floor(safe / 60), safe % 60);
              }}>
              {/* Gridlines (visual only) */}
              <div className="absolute inset-0 flex pointer-events-none">
                {gridCells.map(c => <div key={c.key} className="h-full" style={{ flex: c.span, borderLeft: `1px ${c.half ? "dashed" : "solid"} var(--border-subtle)` }} />)}
              </div>

              {/* Live drop preview — ghost of the dragged job at the slot under the
                  cursor; red with "· taken" when that slot conflicts (same language
                  as the move-preview, and no flickery ghost↔cursor-card swapping). */}
              {queuePreview && queuePreview.tech === tech.name && draggedQueueItem && (() => {
                const dur = draggedQueueItem.durationMinutes || increment;
                const left = clamp((queuePreview.startMin / totalMin) * 100, 0, 100);
                const width = clamp((dur / totalMin) * 100, 1, 100 - left);
                const invalid = laneOverlap(tech.name, queuePreview.startMin, dur, "");
                const c = invalid ? "#ef4444" : draggedQueueItem.color;
                return (
                  <div className="absolute top-1 bottom-1 rounded-lg pointer-events-none overflow-hidden flex flex-col justify-center px-2 z-30"
                    style={{ left: `${left}%`, width: `${width}%`, backgroundColor: c + "26", border: `1.5px dashed ${c}` }}>
                    <p className="text-[10px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{draggedQueueItem.title}</p>
                    <p className="text-[9px] truncate" style={{ color: invalid ? "#ef4444" : "var(--text-muted)" }}>{minToTime(queuePreview.startMin)} – {minToTime(queuePreview.startMin + dur)}{invalid ? " · taken" : ""}</p>
                  </div>
                );
              })()}

              {/* Live MOVE preview — dashed ghost of the dragged job at the slot it
                  lands in (same lane OR another tech's row; the origin block stays
                  put, dimmed). Mirrors the queue-drag ghost so every move reads the
                  same: ghost = where it's going. */}
              {preview && preview.kind === "move" && preview.tech === tech.name && (() => {
                const mv = dayItems.find(x => x.id === preview.id);
                if (!mv) return null;
                const dur = preview.durationMinutes;
                const left = clamp((preview.startMin / totalMin) * 100, 0, 100);
                const width = clamp((dur / totalMin) * 100, 1, 100 - left);
                const invalid = laneOverlap(tech.name, preview.startMin, dur, mv.id);
                const job = mv.sourceModule === "jobs" ? getJob(mv.sourceId) : (mv.jobId ? getJob(mv.jobId) : undefined);
                const c = invalid ? "#ef4444" : (job ? resolveJobTypeColor(job.type) : mv.color);
                return (
                  <div className="absolute top-1 bottom-1 rounded-lg pointer-events-none overflow-hidden flex flex-col justify-center px-2 z-30"
                    style={{ left: `${left}%`, width: `${width}%`, backgroundColor: c + "26", border: `1.5px dashed ${c}` }}>
                    <p className="text-[10px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{mv.customerName ?? mv.title}</p>
                    <p className="text-[9px] truncate" style={{ color: invalid ? "#ef4444" : "var(--text-muted)" }}>{minToTime(preview.startMin)} – {minToTime(preview.startMin + dur)}{invalid ? " · taken" : ""}</p>
                  </div>
                );
              })()}

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
                // MOVE → the origin block stays put (dimmed) and a dashed ghost
                // previews the target slot — same language whether the move is
                // within the lane or to another tech. RESIZE → the block's right
                // edge tracks the cursor live.
                const movingAway = !!p && p.kind === "move";
                const crossTech = movingAway && p!.tech !== (i.assignedTo ?? "");
                // Same-lane move → the ghost IS the card; hide the origin so the
                // lane doesn't show the job twice. Cross-tech keeps the dimmed
                // origin ("→ tech") so it's clear where it's coming from.
                if (movingAway && !crossTech) return null;
                const tracking = !!p && p.kind === "resize";
                const sm = tracking ? p!.startMin : startMinOf(i);
                const dur = tracking ? p!.durationMinutes : i.durationMinutes;
                const left = clamp((sm / totalMin) * 100, 0, 100);
                const width = Math.max(3, (Math.min(dur, totalMin - sm) / totalMin) * 100);
                const prio = i.priority && i.priority !== "normal" ? PRIORITY_CONFIG[i.priority] : null;
                // Card body shade = the JOB TYPE; the full-height left section is the
                // status stage icon. While dragging in-lane, flag an overlapping drop in red.
                const job = i.sourceModule === "jobs" ? getJob(i.sourceId) : (i.jobId ? getJob(i.jobId) : undefined);
                const typeColor = job ? resolveJobTypeColor(job.type) : i.color;
                const invalid = tracking && laneOverlap(p!.tech, p!.startMin, p!.durationMinutes, i.id);
                return (
                  <div key={i.id} data-block
                    onMouseDown={e => beginDrag(e, i, "move")}
                    title="Drag to move (across techs) · drag right edge to resize"
                    className="absolute top-1.5 bottom-1.5 rounded-lg overflow-hidden select-none flex"
                    // NO left/width transition here: the drag previews via the dashed
                    // ghost (which snaps slot-to-slot), and on drop the block must
                    // appear AT the new time — a transition makes it visibly slide
                    // from the old slot to the new one across the commit.
                    style={{ left: `${left}%`, width: `${width}%`, backgroundColor: invalid ? "#ef444426" : typeColor + "26", cursor: p ? "grabbing" : "grab", boxShadow: tracking ? (invalid ? "0 0 0 2px #ef4444, 0 4px 14px rgba(0,0,0,0.25)" : "0 4px 14px rgba(0,0,0,0.25)") : undefined, opacity: movingAway ? 0.55 : 1, zIndex: tracking ? 20 : 1 }}>
                    {/* Stage icon as the full-height left section, colored by status —
                        click it to change status. */}
                    {/* Appointment cards carry the job id separately (sourceId is the
                        appointment); legacy job cards fall back to sourceId. */}
                    <JobStageControl variant="bar" jobId={i.jobId ?? i.sourceId} statusKey={i.status} onChanged={onItemChanged} size={16} />
                    <div className="flex-1 min-w-0 px-1.5 py-0.5 flex flex-col justify-center gap-0.5">
                      {i.visitCount && i.visitCount > 1 && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold leading-none" title={`Visit ${i.visitIndex} of ${i.visitCount} — same job, separate visit`} style={{ color: "var(--accent-text)" }}>
                          <Link2 className="w-2 h-2" />{i.visitIndex}/{i.visitCount}
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <p className="text-[10px] font-semibold truncate leading-tight flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>{i.customerName ?? i.title}</p>
                        {i.techIds && i.techIds.length > 1 && <span className="text-[8px] font-bold px-1 rounded shrink-0" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)" }}>+{i.techIds.length - 1}</span>}
                        {crossTech && <span className="text-[8px] font-bold px-1 rounded shrink-0" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text)" }}>→ {p!.tech}</span>}
                        {!movingAway && prio && <span className="text-[8px] font-bold px-1 rounded shrink-0" style={{ backgroundColor: prio.bg, color: prio.color }}>{prio.label}</span>}
                        {!tracking && legMin[i.id] != null && (
                          <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold shrink-0" title={`~${legMin[i.id]} min drive from the previous stop`} style={{ color: "var(--accent-text)" }}>
                            <Navigation className="w-2 h-2" />{legMin[i.id]}m
                          </span>
                        )}
                      </div>
                      {/* Lead the subline with the work-order scope when present, else job type. */}
                      <p className="text-[9px] truncate leading-tight" style={{ color: "var(--text-muted)" }}>
                        {tracking ? `${minToTime(sm)} · ${dur}m` : `${fmtTime(i.start)} · ${i.workOrderTitle ?? (i.jobType ? jobTypeLabel(i.jobType) : "")}${i.city ? ` · ${i.city}` : ""}`}
                      </p>
                    </div>
                    {/* Resize handle (right edge) */}
                    <div onMouseDown={e => beginDrag(e, i, "resize")}
                      className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize"
                      style={{ borderRight: `2px solid ${typeColor}` }} />
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
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap" style={{ backgroundColor: "var(--bg-surface-2)" }}>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Unscheduled Queue</p>
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
      {/* Collapsible content — grid-rows height transition for a smooth collapse */}
      <div style={{ display: "grid", gridTemplateRows: collapsed ? "0fr" : "1fr", transition: "grid-template-rows 0.32s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div style={{ borderTop: "1px solid var(--border)", opacity: collapsed ? 0 : 1, transition: "opacity 0.22s ease" }}>
          {/* Triage tabs — one per configured queue view */}
          <div className="flex items-center gap-0.5 px-3 py-2 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
            {views.map(v => {
              const active = (activeView?.key ?? tab) === v.key; const c = countForView(items, v);
              // Configured views are curated in Settings (active + "Show as tab"),
              // so always render them — even at 0 — rather than auto-hiding empties.
              return (
                <button key={v.key} onClick={() => setTab(v.key)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{ backgroundColor: active ? "var(--accent-soft-bg)" : "transparent", color: active ? "var(--accent-text)" : "var(--text-muted)", border: `1px solid ${active ? "var(--accent-soft-border)" : "transparent"}` }}>
                  {v.color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: v.color }} />}
                  {v.name}
                  {c > 0 && <span className="text-[11px] font-semibold tabular-nums" style={{ color: active ? "var(--accent-text)" : "var(--text-muted)" }}>{c}</span>}
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
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {filtered.map((u, i) => <QueueRow key={u.id} item={u} onSelect={onSelect} last={i === filtered.length - 1} />)}
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact list row for the queue's List layout — draggable like the card.
// Handle to the queue item currently being dragged, so the board can render a
// live drop preview — native DnD can't read dataTransfer during dragover.
let draggedQueueItem: UnscheduledItem | null = null;
// Set true by a lane while the cursor is over a VALID (droppable) slot. When true,
// the board shows the slot preview and the cursor-follow card is hidden; when
// false (off-board or over a conflicting slot) the cursor card shows instead.
let overValidSlot = false;

// 1×1 transparent image to suppress the browser's default drag ghost so we can
// drive the cursor card ourselves.
const EMPTY_DRAG_IMG = typeof window !== "undefined"
  ? (() => { const img = new Image(); img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; return img; })()
  : null;
function suppressNativeDragImage(e: React.DragEvent) {
  if (EMPTY_DRAG_IMG) { try { e.dataTransfer.setDragImage(EMPTY_DRAG_IMG, 0, 0); } catch { /* ignore */ } }
}

function QueueRow({ item: u, onSelect, last }: { item: UnscheduledItem; onSelect: (u: UnscheduledItem) => void; last: boolean }) {
  const cfg = LAYER_CONFIG[u.type]; const prio = PRIORITY_CONFIG[u.priority];
  return (
    <div draggable onDragStart={e => { e.dataTransfer.setData("text/plain", u.id); draggedQueueItem = u; suppressNativeDragImage(e); }}
      onDragEnd={() => { draggedQueueItem = null; overValidSlot = false; }}
      onClick={() => onSelect(u)}
      className="flex items-center gap-3 px-3 py-2.5 cursor-grab active:cursor-grabbing transition-colors hover:bg-[var(--bg-surface-2)]"
      style={{ borderBottom: last ? "none" : "1px solid var(--border)", borderLeft: `3px solid ${u.color}` }}>
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
    <div draggable onDragStart={e => { e.dataTransfer.setData("text/plain", u.id); draggedQueueItem = u; suppressNativeDragImage(e); }}
      onDragEnd={() => { draggedQueueItem = null; overValidSlot = false; }}
      onClick={() => onSelect(u)}
      className="rounded-lg p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${u.color}` }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 shrink-0" style={{ backgroundColor: cfg.color + "22", color: cfg.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />{cfg.label}
          </span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 shrink-0" style={{ backgroundColor: prio.bg, color: prio.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: prio.color }} />{prio.label}
          </span>
        </div>
        {u.value && <span className="text-xs font-bold shrink-0" style={{ color: "var(--text-primary)" }}>{u.value}</span>}
      </div>
      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{u.title}</p>
      {u.customerName && <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{u.customerName}{u.city ? ` · ${u.city}` : ""}</p>}
      <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
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
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="grid grid-cols-7">
        {days.map((day, di) => {
          const dayItems = items.filter(i => isSameDay(i.start, day)).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
          const isToday = isSameDay(day, today);
          return (
            <div key={di} style={{ borderLeft: di > 0 ? "1px solid var(--border)" : "none", minHeight: "400px" }}>
              <div className="px-2 py-2 text-center" style={{ borderBottom: "1px solid var(--border)", backgroundColor: isToday ? "var(--accent-soft-bg)" : "var(--bg-surface-2)" }}>
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
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      {allDay.length > 0 && <div className="p-2 space-y-1.5" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>{allDay.map(i => <ItemChip key={i.id} item={i} onSelect={onSelect} />)}</div>}
      <div className="relative" style={{ height: `${hours.length * HOUR_PX}px` }}>
        {hours.map((h, i) => <div key={h} className="absolute left-0 right-0 flex" style={{ top: `${i*HOUR_PX}px`, height: `${HOUR_PX}px`, borderTop: "1px solid var(--border)" }}><span className="text-[10px] px-2 pt-1 shrink-0 w-14" style={{ color: "var(--text-muted)" }}>{hourLabel(h)}</span></div>)}
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
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="grid grid-cols-7" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-center" style={{ color: "var(--text-muted)" }}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, di) => {
          const inMonth = day.getMonth() === focus.getMonth(); const isToday = isSameDay(day, today);
          const dayItems = items.filter(i => isSameDay(i.start, day));
          return (
            <div key={di} className="p-1" style={{ minHeight: "92px", borderLeft: di % 7 > 0 ? "1px solid var(--border)" : "none", borderTop: di >= 7 ? "1px solid var(--border)" : "none", opacity: inMonth ? 1 : 0.4 }}>
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
