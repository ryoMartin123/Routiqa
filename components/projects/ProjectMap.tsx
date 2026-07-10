"use client";

// ─── CRM Project · Project Map ────────────────────────────
// The connected workflow (template-driven). Nodes are CHECKLISTS (worked
// through on the map), BILLING actions, or MIRRORS (watch a real Job / Quote /
// PO / Material Request / Subcontractor / Work Order / Invoice until a chosen
// milestone). Clicking a node opens a slide-over drawer — the map stays
// visible behind it. Mock/local.

import SegmentedProgress from "@/components/shared/SegmentedProgress";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Layers, Briefcase, CheckSquare, ClipboardList, Package, ShoppingCart, HardHat,
  FileText, Receipt, ChevronRight, Check, CheckCircle2, AlertTriangle, CornerDownRight, Calendar, Link2,
  Plus, ExternalLink, ListChecks, GitBranch, Circle, X, Ban, RotateCcw,
} from "lucide-react";
import ActionsMenu from "@/components/shared/ActionsMenu";
import {
  getProjectMap, getProjectMapByGroup, setMapNodeStatus, createForNode, isQuickCreate, SOURCE_TAB,
  NODE_STATUS_META, nodeDayProgress, setMapNodeExpected, sweepDatedWaits,
  setMapNodeSkipped, clearMapNodeSkipped,
  billingNodeAmount, billingNodeAmountLabel, createBillingInvoiceForNode, nodeDateSpan,
  getItemAnswers, setItemAnswer, toggleChecklistItem, checklistProgress,
  type ProjectMapNode,
} from "@/lib/projects/map";
import { mirrorMilestone, MIRROR_MILESTONES, type NodeChecklistItem, type MirrorSource } from "@/lib/projects/map-templates";
import UiSelect from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import MultiDayBookModal from "@/components/calendar/MultiDayBookModal";
import { getAppointmentsForJob, getAppointmentsForWorkOrder, updateAppointment, createAppointment, deleteAppointment } from "@/lib/appointments/data";
import { pingSaved, pingError } from "@/components/shared/SavedPill";

const ACCENT = "#0f8578"; // CRM indigo
const initials = (n: string) => { const p = n.trim().split(/\s+/); return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : n.slice(0, 2)).toUpperCase(); };

// A step's icon and label follow what it IS — a checklist, a billing action,
// or the record it watches (the stored `type` is legacy authoring data).
const MIRROR_ICON: Record<MirrorSource, typeof Layers> = {
  quote: FileText, job: Briefcase, work_order: ClipboardList, material_request: Package,
  purchase_order: ShoppingCart, equipment_received: Package, subcontractor: HardHat, invoice: Receipt,
};
const MIRROR_LABEL: Record<MirrorSource, string> = {
  quote: "Quote", job: "Job", work_order: "Work Order", material_request: "Material Request",
  purchase_order: "Purchase Order", equipment_received: "Equipment", subcontractor: "Subcontractor", invoice: "Invoice",
};
const isBillingAction = (n: ProjectMapNode) => n.type === "billing" && n.percent != null && !n.mirror;
const nodeIcon = (n: ProjectMapNode) => (n.mirror ? MIRROR_ICON[n.mirror] : n.type === "billing" ? Receipt : CheckSquare);
const kindLabel = (n: ProjectMapNode) =>
  n.mirror ? MIRROR_LABEL[n.mirror] : n.type === "billing" ? "Billing" : "Checklist";

// What completes this step (shown in the drawer so the user knows the goal).
function completionRule(node: ProjectMapNode): string {
  if (node.manual && node.checklist?.length) return "Completes when every required checklist item is checked off.";
  if (node.manual) return "This is a manual step — mark it complete once it's done.";
  if (isBillingAction(node)) return `Bills ${node.percent}% of the contract — completes when the invoice is sent.`;
  if (node.mirror) return `Completes automatically when ${mirrorMilestone(node.mirror, node.milestone).caption}.`;
  return "Mark complete when done.";
}
// One-line "what to do now" based on status.
function whatNow(node: ProjectMapNode): string {
  switch (node.status) {
    case "completed": return "This step is complete. Nothing more to do.";
    case "skipped": return "Skipped — this step doesn't apply to this project. Downstream steps aren't waiting on it.";
    case "blocked": return node.blockedReason ?? "This step is blocked — resolve the issue below.";
    case "waiting": return node.blockedReason ?? "Waiting on materials / an external step.";
    case "in_progress": return node.manual && node.checklist?.length ? "In progress — keep working through the checklist below." : "In progress — open the linked record to keep it moving.";
    case "ready": return node.manual && node.checklist?.length ? "Ready — work through the checklist below." : node.manual ? "Ready — mark it complete when finished." : node.linkedLabel ? "Ready — open the record to continue." : "Ready to start — create the record to begin.";
    default: return "Not started yet — finish the prerequisites below first.";
  }
}

export default function ProjectMap({ projectId, onOpenTab }: { projectId: string; onOpenTab?: (t: string) => void }) {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "timeline">("map");

  // Overdue dated waits spawn their follow-up task once (guarded in the lib).
  useEffect(() => { sweepDatedWaits(projectId); }, [projectId, tick]);

  const groups = useMemo(() => getProjectMapByGroup(projectId), [projectId, tick]);
  const allNodes = useMemo(() => getProjectMap(projectId), [projectId, tick]);
  const byId = useMemo(() => new Map(allNodes.map(n => [n.id, n])), [allNodes]);

  // ── Step drawer — slides over the map, which stays visible behind it ──
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  // ── Map grid ── (skipped steps leave the denominator — they'll never happen)
  const active = allNodes.filter(n => n.status !== "skipped");
  const completed = active.filter(n => n.status === "completed").length;
  const blocked = allNodes.filter(n => n.status === "blocked").length;
  const next = allNodes.find(n => ["in_progress", "ready", "waiting", "blocked"].includes(n.status));
  const pct = active.length ? Math.round((completed / active.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Workflow header — a segmented bar (each step colored by status) + next step. */}
      <div className="rounded-xl px-4 py-3.5 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <SegmentedProgress segments={allNodes.map(n => ({
          filled: n.status !== "not_started",
          color: NODE_STATUS_META[n.status].color,
          current: next?.id === n.id,
          title: `${n.title} · ${NODE_STATUS_META[n.status].label}`,
          onClick: () => setSelectedId(n.id),
        }))} />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{pct}%</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{completed} of {active.length} steps complete{active.length < allNodes.length ? ` · ${allNodes.length - active.length} skipped` : ""}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Map ↔ Timeline lens toggle */}
            <div className="flex items-center rounded-lg p-0.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              {(["map", "timeline"] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-colors"
                  style={{
                    backgroundColor: view === v ? "var(--bg-surface)" : "transparent",
                    color: view === v ? "var(--text-primary)" : "var(--text-muted)",
                    boxShadow: view === v ? "var(--shadow-card)" : "none",
                  }}>{v}</button>
              ))}
            </div>
            {blocked > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>
                <AlertTriangle className="w-3 h-3" /> {blocked} blocked
              </span>
            )}
            {next && (
              <button onClick={() => setSelectedId(next.id)} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all hover:brightness-105" style={{ backgroundColor: ACCENT + "14", color: ACCENT }}>
                <CornerDownRight className="w-3.5 h-3.5 shrink-0" /> <span style={{ color: "var(--text-muted)" }}>Next</span> <span className="font-semibold">{next.title}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {view === "timeline" && <TimelineView nodes={allNodes} onSelect={setSelectedId} onChanged={refresh} />}

      {/* Full-width adaptive columns: grow to fill on wide screens, scroll when cramped. */}
      {view === "map" && (
      <div className="flex gap-1 overflow-x-auto thin-scroll-x pb-2 items-stretch">
        {groups.map((g, gi) => (
          <Fragment key={g.group}>
            <div className="flex-1 min-w-[14rem] flex flex-col">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{g.group}</p>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{g.nodes.filter(n => n.status === "completed").length}/{g.nodes.length}</span>
              </div>
              <div className="space-y-2">
                {g.nodes.map(n => <NodeCard key={n.id} node={n} deps={n.dependencies.map(d => byId.get(d)).filter(Boolean) as ProjectMapNode[]} onClick={() => setSelectedId(n.id)} />)}
              </div>
            </div>
            {gi < groups.length - 1 && <div className="flex items-center shrink-0 px-0.5"><ChevronRight className="w-4 h-4" style={{ color: "var(--border)" }} /></div>}
          </Fragment>
        ))}
      </div>
      )}

      {selected && (
        <NodeDrawer node={selected} byId={byId} onChanged={refresh}
          onClose={() => setSelectedId(null)} onSelectNode={setSelectedId} onOpenTab={onOpenTab}
          onComplete={() => { setMapNodeStatus(selected.id, "completed"); refresh(); }}
          onCreate={() => { if (selected.mirror) { createForNode(projectId, selected.mirror, selected.id, selected.title); refresh(); } }} />
      )}
    </div>
  );
}

// ─── Timeline lens (Gantt) ────────────────────────────────
// Bars are drawn only from REAL time data (visits, dated waits) — undated
// steps are listed below rather than given invented dates. Bars can be
// dragged to replan: moving a visit run reschedules its visits (started work
// stays put, nothing lands in the past), the right edge adds/removes days,
// and dashed wait bars drag their expected date. The dispatch board remains
// the source of truth — this edits the same visits it shows.
const DAY_W = 26;
const dayMs = 86400000;
const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
// Non-throwing: an Invalid Date returns "" rather than crashing toISOString().
const ymd = (d: Date) => (isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10));
const addDays = (base: string, n: number) => { const d = new Date(`${base}T12:00:00`); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / dayMs);
const isWeekend = (d: string) => { const dow = new Date(`${d}T12:00:00`).getDay(); return dow === 0 || dow === 6; };
// Lay out `count` days from `start`, skipping weekends when the crew works weekdays.
const layoutDays = (start: string, count: number, weekdaysOnly: boolean): string[] => {
  const out: string[] = [];
  let d = start;
  while (out.length < count) {
    if (!weekdaysOnly || !isWeekend(d)) out.push(d);
    d = addDays(d, 1);
  }
  return out;
};
const STARTED = new Set(["in_progress", "completed"]);

function TimelineView({ nodes, onSelect, onChanged }: { nodes: ProjectMapNode[]; onSelect: (id: string) => void; onChanged: () => void }) {
  const today = ymd(new Date());
  // Live drag preview: which node, which handle, how many days so far.
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "resize"; delta: number } | null>(null);

  const rows = nodes
    .map(n => ({ node: n, span: nodeDateSpan(n) }))
    // Drop any span that isn't clean YYYY-MM-DD — one bad date must not crash the view.
    .filter((r): r is { node: ProjectMapNode; span: NonNullable<ReturnType<typeof nodeDateSpan>> } =>
      !!r.span && isYmd(r.span.start) && isYmd(r.span.end));
  const undated = nodes.filter(n => !nodeDateSpan(n) && n.status !== "completed" && n.status !== "skipped");

  if (rows.length === 0) {
    return (
      <div className="rounded-xl px-4 py-8 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Nothing on the calendar yet</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Book visits or put expected dates on waiting steps and they'll appear here.</p>
      </div>
    );
  }

  // Axis: a few days of air around everything that has a date (today included).
  const allDates = rows.flatMap(r => [r.span.start, r.span.end]).concat([today]);
  const min = addDays(allDates.reduce((a, b) => (a < b ? a : b)), -2);
  const max = addDays(allDates.reduce((a, b) => (a > b ? a : b)), 5);
  const total = diffDays(min, max) + 1;
  const days = Array.from({ length: total }, (_, i) => addDays(min, i));
  const todayX = diffDays(min, today);

  const visitsFor = (node: ProjectMapNode) =>
    (node.mirror === "work_order" ? getAppointmentsForWorkOrder(node.linkedId!) : getAppointmentsForJob(node.linkedId!))
      .filter(a => a.scheduledDate && a.status !== "canceled")
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  // ── Commit handlers ──
  function commitMove(node: ProjectMapNode, span: NonNullable<ReturnType<typeof nodeDateSpan>>, delta: number) {
    if (delta === 0) return;
    if (span.kind === "wait") {
      const next = addDays(node.expectedDate!, delta);
      setMapNodeExpected(node.id, next);
      pingSaved(`Expected date → ${new Date(`${next}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`);
      onChanged();
      return;
    }
    const visits = visitsFor(node);
    const movable = visits.filter(v => !STARTED.has(v.status));
    if (movable.length === 0) { pingError("Started work stays put — nothing here can move."); return; }
    const weekdaysOnly = visits.every(v => !isWeekend(v.scheduledDate));
    const newStart = addDays(movable[0].scheduledDate, delta);
    if (newStart < today) { pingError("That lands in the past — visits can only move from today forward."); return; }
    const dates = layoutDays(newStart, movable.length, weekdaysOnly);
    movable.forEach((v, i) => updateAppointment(v.id, { scheduledDate: dates[i] }));
    pingSaved(`Rescheduled ${movable.length} visit${movable.length === 1 ? "" : "s"}`);
    onChanged();
  }
  function commitResize(node: ProjectMapNode, span: NonNullable<ReturnType<typeof nodeDateSpan>>, delta: number) {
    if (delta === 0) return;
    if (span.kind === "wait") { commitMove(node, span, delta); return; }
    const visits = visitsFor(node);
    const weekdaysOnly = visits.every(v => !isWeekend(v.scheduledDate));
    if (delta > 0) {
      // Extend: clone the last day's crew/time onto the next working days.
      const last = visits[visits.length - 1];
      let d = last.scheduledDate;
      for (let i = 0; i < delta; i++) {
        d = addDays(d, 1);
        while (weekdaysOnly && isWeekend(d)) d = addDays(d, 1);
        createAppointment({
          jobId: last.jobId, workOrderId: last.workOrderId, techIds: last.techIds,
          scheduledDate: d, scheduledTime: last.scheduledTime, durationMinutes: last.durationMinutes,
        });
      }
      pingSaved(`Added ${delta} day${delta === 1 ? "" : "s"}`);
    } else {
      // Shrink: drop trailing days that haven't started; never below one visit.
      const removable = [...visits].reverse().filter(v => !STARTED.has(v.status));
      const toRemove = removable.slice(0, Math.min(-delta, Math.max(visits.length - 1, 0), removable.length));
      if (toRemove.length === 0) { pingError("Those days have started work — they can't be removed."); return; }
      toRemove.forEach(v => deleteAppointment(v.id));
      pingSaved(`Removed ${toRemove.length} day${toRemove.length === 1 ? "" : "s"}`);
    }
    onChanged();
  }

  // ── Drag physics: snap per day, Escape cancels ──
  function beginDrag(e: React.PointerEvent, node: ProjectMapNode, span: NonNullable<ReturnType<typeof nodeDateSpan>>, mode: "move" | "resize") {
    e.preventDefault(); e.stopPropagation();
    if (mode === "move" && span.kind === "visits") {
      const visits = visitsFor(node);
      if (visits.every(v => STARTED.has(v.status))) { pingError("Started work stays put — extend it from the right edge instead."); return; }
    }
    const startX = e.clientX;
    let delta = 0, canceled = false, moved = false;
    setDrag({ id: node.id, mode, delta: 0 });
    document.body.style.userSelect = "none";
    document.body.style.cursor = mode === "move" ? "grabbing" : "ew-resize";
    const onMove = (ev: PointerEvent) => {
      const d = Math.round((ev.clientX - startX) / DAY_W);
      if (d !== delta) { delta = d; moved = true; setDrag({ id: node.id, mode, delta: d }); }
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") { canceled = true; cleanup(); } };
    const onUp = () => {
      cleanup();
      if (canceled) return;
      if (!moved) { onSelect(node.id); return; }   // a plain click still opens the step
      if (mode === "move") commitMove(node, span, delta);
      else commitResize(node, span, delta);
    };
    const cleanup = () => {
      document.body.style.userSelect = ""; document.body.style.cursor = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="overflow-x-auto thin-scroll-x">
        <div style={{ minWidth: 176 + total * DAY_W }}>
          {/* Date header */}
          <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="w-44 shrink-0 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Step</div>
            <div className="relative flex">
              {days.map(d => {
                const dt = new Date(`${d}T12:00:00`);
                return (
                  <div key={d} className="shrink-0 py-2 text-center text-[9px]"
                    style={{ width: DAY_W, color: d === today ? "var(--accent-text)" : "var(--text-muted)", fontWeight: d === today ? 700 : 400, backgroundColor: isWeekend(d) ? "var(--bg-surface-2)" : "transparent" }}>
                    {dt.getDate() === 1 || d === min ? dt.toLocaleDateString("en-US", { month: "short" }) : dt.getDate()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rows */}
          <div className="relative">
            {/* Today line across all rows */}
            <div className="absolute top-0 bottom-0 w-px z-10 pointer-events-none" style={{ left: 176 + todayX * DAY_W + DAY_W / 2, backgroundColor: "var(--accent-text)" }} />
            {rows.map(({ node, span }, i) => {
              const sm = NODE_STATUS_META[node.status];
              const dragging = drag?.id === node.id ? drag : null;
              const shift = dragging?.mode === "move" ? dragging.delta : 0;
              const grow = dragging?.mode === "resize" ? dragging.delta : 0;
              const x = diffDays(min, span.start) + shift;
              const w = Math.max(diffDays(span.start, span.end) + 1 + grow, 1);
              const overdue = node.status !== "completed" && span.end < today;
              const done = node.status === "completed";
              return (
                <div key={node.id} className="flex items-center" style={{ borderTop: i ? "1px solid var(--border-subtle)" : "none" }}>
                  <button onClick={() => onSelect(node.id)} className="w-44 shrink-0 px-3 py-2.5 flex items-center gap-1.5 text-left hover:underline">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sm.color }} />
                    <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>{node.title}</span>
                  </button>
                  <div className="relative h-9 flex-1">
                    {days.map((d, di) => isWeekend(d) ? <span key={d} className="absolute top-0 bottom-0" style={{ left: di * DAY_W, width: DAY_W, backgroundColor: "var(--bg-surface-2)" }} /> : null)}
                    {/* The bar: drag body = move, drag right edge = resize; click = open */}
                    <div
                      onPointerDown={e => { if (!done) beginDrag(e, node, span, "move"); }}
                      onClick={() => { if (done) onSelect(node.id); }}
                      title={`${node.title} · ${span.start === span.end ? span.start : `${span.start} → ${span.end}`}${done ? "" : " — drag to replan"}`}
                      className="group/bar absolute top-1/2 -translate-y-1/2 h-4 rounded-[3px]"
                      style={{
                        left: x * DAY_W + 2, width: Math.max(w * DAY_W - 4, 10),
                        backgroundColor: overdue ? "#ef4444" : span.kind === "wait" ? "transparent" : sm.color,
                        border: span.kind === "wait" ? `1.5px dashed ${overdue ? "#ef4444" : sm.color}` : "none",
                        opacity: done ? 0.55 : dragging ? 0.85 : 1,
                        cursor: done ? "pointer" : "grab",
                        boxShadow: dragging ? `0 0 0 1.5px var(--bg-surface), 0 0 0 3px ${sm.color}` : "none",
                        transition: dragging ? "none" : "left 120ms ease, width 120ms ease",
                        zIndex: dragging ? 20 : 1,
                      }}>
                      {!done && (
                        <span onPointerDown={e => beginDrag(e, node, span, "resize")}
                          className="absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-5 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 flex items-center justify-center">
                          <span className="w-[3px] h-3.5 rounded-full" style={{ backgroundColor: sm.color, filter: "brightness(0.7)" }} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Steps with no calendar footprint yet */}
      {undated.length > 0 && (
        <div className="px-3 py-2 flex items-center gap-2 flex-wrap" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>No dates yet</span>
          {undated.map(n => (
            <button key={n.id} onClick={() => onSelect(n.id)} className="text-[11px] px-2 py-0.5 rounded hover:underline"
              style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)" }}>{n.title}</button>
          ))}
        </div>
      )}
      <p className="px-3 py-1.5 text-[10px]" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
        Drag a bar to move it · drag the right edge to add or remove days · dashed = waiting, expected date · Esc cancels
      </p>
    </div>
  );
}

// ─── Node card (in the grid) ──────────────────────────────
function NodeCard({ node, deps, onClick }: { node: ProjectMapNode; deps: ProjectMapNode[]; onClick: () => void }) {
  const Icon = nodeIcon(node);
  const sm = NODE_STATUS_META[node.status];
  const done = node.status === "completed";
  const skipped = node.status === "skipped";
  const depBlocked = deps.some(d => d.status !== "completed" && d.status !== "skipped") && !done && !skipped;
  const canCreate = node.createable && !node.linkedLabel && node.status === "ready";
  const milestone = node.mirror && MIRROR_MILESTONES[node.mirror].length > 1 ? mirrorMilestone(node.mirror, node.milestone).label : null;
  return (
    <button onClick={onClick} className="w-full text-left rounded-lg overflow-hidden transition-all hover:-translate-y-0.5"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", opacity: done || skipped ? 0.72 : 1 }}>
      <div style={{ height: 3, backgroundColor: sm.color }} />
      <div className="p-2.5">
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}><Icon className="w-3 h-3" /> {kindLabel(node)}{milestone && <span className="opacity-60">· {milestone.toLowerCase()}</span>}</span>
          {done ? <Check className="w-3.5 h-3.5" style={{ color: "#10b981" }} /> : <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sm.color }} />}
        </div>
        <p className="text-sm font-medium leading-snug" style={{ color: "var(--text-primary)", textDecoration: done ? "line-through" : "none" }}>{node.title}</p>
        {skipped && <p className="text-[10px] mt-1 italic" style={{ color: "var(--text-muted)" }}>Skipped — {node.skipReason || "doesn't apply"}</p>}
        {/* Multi-day steps read as days, not a binary box */}
        {(() => {
          const dp = nodeDayProgress(node);
          if (!dp || done) return null;
          return (
            <div className="mt-1.5">
              <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Day {dp.day} of {dp.total}</p>
              <SegmentedProgress segments={dp.visits.map(v => ({ filled: v.done, color: "#0f8578", current: v.today && !v.done }))} />
            </div>
          );
        })()}
        {/* Checklist-source steps: how many items are done */}
        {(() => {
          const cp = checklistProgress(node);
          if (!cp || done) return null;
          return (
            <div className="mt-1.5">
              <p className="text-[10px] font-semibold mb-1 flex items-center gap-1" style={{ color: "var(--text-secondary)" }}><ListChecks className="w-3 h-3" /> {cp.done} of {cp.total}</p>
              <SegmentedProgress segments={node.checklist!.map(it => ({ filled: cp.doneIds.has(it.id), color: "#0f8578" }))} />
            </div>
          );
        })()}
        {(node.status === "blocked" || node.status === "waiting") && node.blockedReason && (
          <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: node.status === "blocked" ? "#dc2626" : "#b45309" }}><AlertTriangle className="w-3 h-3 shrink-0" /> {node.blockedReason}</p>
        )}
        {(node.status === "blocked" || node.status === "waiting") && node.expectedDate && (() => {
          const overdue = node.expectedDate! < new Date().toISOString().slice(0, 10);
          return (
            <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: overdue ? "#dc2626" : "var(--text-muted)" }}>
              <Calendar className="w-3 h-3 shrink-0" />
              expected {new Date(`${node.expectedDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{overdue ? " — overdue" : ""}
            </p>
          );
        })()}
        <div className="flex items-center justify-between gap-1 mt-2">
          <div className="flex items-center gap-1 min-w-0">
            {node.assignedTo && <span title={node.assignedTo} className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: ACCENT }}>{initials(node.assignedTo)}</span>}
            {node.linkedLabel ? <span className="text-[9px] font-medium px-1.5 py-0.5 rounded truncate" style={{ backgroundColor: ACCENT + "14", color: ACCENT }}>{node.linkedLabel}</span>
              : canCreate ? <span className="text-[9px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-0.5" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}><Plus className="w-2.5 h-2.5" />Create</span> : null}
          </div>
          {depBlocked && <CornerDownRight className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />}
        </div>
      </div>
    </button>
  );
}

// ─── Node drawer (slides over the map) ────────────────────
// The map stays visible behind it — position in the workflow is the map
// itself, so the drawer only carries what the step needs: status, the one
// action, the checklist / days / expected date when relevant, prerequisites.
function NodeDrawer({ node, byId, onClose, onSelectNode, onOpenTab, onComplete, onCreate, onChanged }: {
  node: ProjectMapNode; byId: Map<string, ProjectMapNode>;
  onClose: () => void; onSelectNode: (id: string) => void; onOpenTab?: (t: string) => void;
  onComplete: () => void; onCreate: () => void; onChanged: () => void;
}) {
  const [bookOpen, setBookOpen] = useState(false);
  // Skip flow: the menu opens an inline confirm with an optional reason.
  const [skipConfirm, setSkipConfirm] = useState(false);
  const [skipReason, setSkipReason] = useState("");

  // Enter/exit animation: mount hidden → rAF flips `visible` on (slide in);
  // close slides out first, then unmounts via onClose after the transition.
  const [visible, setVisible] = useState(false);
  const reduce = useRef(false);
  useEffect(() => {
    reduce.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const requestClose = () => {
    if (reduce.current) { onClose(); return; }
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const dayProg = nodeDayProgress(node);
  // The job to book multi-day visits against (job nodes directly).
  const bookJobId = node.mirror === "job" ? node.linkedId : undefined;
  const Icon = nodeIcon(node);
  const sm = NODE_STATUS_META[node.status];
  const done = node.status === "completed";
  const skipped = node.status === "skipped";
  const deps = node.dependencies.map(d => byId.get(d)).filter(Boolean) as ProjectMapNode[];
  // Deps are satisfied by completion OR skip; unmet ones fuel the early-action warning.
  const unmetDeps = deps.filter(d => d.status !== "completed" && d.status !== "skipped");
  const actingEarly = !done && !skipped && unmetDeps.length > 0;
  const tab = node.mirror ? SOURCE_TAB[node.mirror] : node.type === "billing" && node.linkedId ? "Invoices" : undefined;
  const openTab = () => { if (tab && onOpenTab) { onOpenTab(tab); requestClose(); } };
  const restore = () => { clearMapNodeSkipped(node.id); onChanged(); };
  const confirmSkip = () => { setMapNodeSkipped(node.id, skipReason); setSkipConfirm(false); setSkipReason(""); onChanged(); };

  // The primary "do this" action.
  const isChecklist = node.manual && !!node.checklist?.length;
  let primary: React.ReactNode = null;
  if (done) {
    primary = <div className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}><Check className="w-4 h-4" /> This step is complete</div>;
  } else if (skipped) {
    primary = <button onClick={restore} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}><RotateCcw className="w-4 h-4" /> Restore this step</button>;
  } else if (isChecklist) {
    primary = null;   // the checklist drives completion
  } else if (node.manual) {
    primary = <button onClick={onComplete} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:brightness-110" style={{ backgroundColor: ACCENT }}><Check className="w-4 h-4" /> {actingEarly ? "Complete anyway" : "Mark Complete"}</button>;
  } else if (node.linkedLabel) {
    primary = <button onClick={openTab} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:brightness-110" style={{ backgroundColor: ACCENT }}><ExternalLink className="w-4 h-4" /> Open {node.linkedLabel}</button>;
  } else if (node.type === "billing" && node.percent != null) {
    // Staged billing: raise THIS stage's invoice for its share of the contract.
    primary = (
      <button onClick={() => { if (createBillingInvoiceForNode(node)) onChanged(); }}
        disabled={billingNodeAmount(node) == null}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:brightness-110 disabled:opacity-40"
        style={{ backgroundColor: ACCENT }}
        title={billingNodeAmount(node) == null ? "Set the project's estimated value first" : undefined}>
        <Receipt className="w-4 h-4" /> Create invoice — {node.percent}% · {billingNodeAmountLabel(node)}
      </button>
    );
  } else if (node.createable && isQuickCreate(node.mirror)) {
    primary = <button onClick={onCreate} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:brightness-110" style={{ backgroundColor: ACCENT }}><Plus className="w-4 h-4" /> Create {MIRROR_LABEL[node.mirror!]} &amp; link</button>;
  } else {
    primary = <button onClick={openTab} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:brightness-110" style={{ backgroundColor: ACCENT }}><ExternalLink className="w-4 h-4" /> Open {tab ?? "record"}</button>;
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={requestClose}
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s ease" }} />
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-[420px] max-w-full"
        style={{
          backgroundColor: "var(--bg-page)", borderLeft: "1px solid var(--border)", boxShadow: "-4px 0 24px rgba(0,0,0,0.18)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)",
        }}>

        {/* ── Header ── */}
        <div className="shrink-0 px-5 pt-4 pb-4" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Map Step · {node.group}</p>
            <button onClick={requestClose} aria-label="Close" className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: sm.color + "1f" }}><Icon className="w-5 h-5" style={{ color: sm.color }} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>{node.title}</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{completionRule(node)}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: sm.color + "22", color: sm.color }}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: sm.color }} /> {sm.label}</span>
            {node.assignedTo && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{node.assignedTo}</span>}
            {node.linkedLabel && (
              <button onClick={openTab} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded hover:underline" style={{ backgroundColor: ACCENT + "14", color: ACCENT }}>
                <Link2 className="w-3 h-3" /> {node.linkedLabel}
              </button>
            )}
            {!done && (
              <div className="ml-auto">
                <ActionsMenu actions={[
                  skipped
                    ? { label: "Restore step", icon: RotateCcw, onClick: restore }
                    : { label: "Skip step — doesn't apply", icon: Ban, onClick: () => setSkipConfirm(true) },
                ]} />
              </div>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          <p className="text-sm px-0.5" style={{ color: "var(--text-primary)" }}>{whatNow(node)}</p>

          {skipped && node.skipReason && (
            <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              <Ban className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <p className="text-xs italic" style={{ color: "var(--text-secondary)" }}>{node.skipReason}</p>
            </div>
          )}

          {/* Acting ahead of the plan is allowed — but it's a choice, not an accident. */}
          {actingEarly && !skipConfirm && (
            <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
              <p className="text-xs" style={{ color: "#92400e" }}>
                {unmetDeps.length} prerequisite{unmetDeps.length === 1 ? " isn't" : "s aren't"} done yet — you can still work this step if reality got ahead of the plan.
              </p>
            </div>
          )}

          {skipConfirm && (
            <div className="rounded-xl p-3.5 space-y-2" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Skip this step?</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>It leaves the progress count and downstream steps stop waiting on it. You can restore it anytime.</p>
              <input value={skipReason} onChange={e => setSkipReason(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === "Enter") confirmSkip(); if (e.key === "Escape") setSkipConfirm(false); }}
                placeholder="Why doesn't it apply? (optional)"
                className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }} />
              <div className="flex items-center gap-2">
                <button onClick={confirmSkip} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#6b7280" }}><Ban className="w-3.5 h-3.5" /> Skip step</button>
                <button onClick={() => { setSkipConfirm(false); setSkipReason(""); }} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              </div>
            </div>
          )}

          {(node.status === "blocked" || node.status === "waiting") && node.blockedReason && (
            <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ backgroundColor: node.status === "blocked" ? "#fef2f2" : "#fffbeb", border: `1px solid ${node.status === "blocked" ? "#fecaca" : "#fde68a"}` }}>
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: node.status === "blocked" ? "#dc2626" : "#b45309" }} />
              <p className="text-xs" style={{ color: node.status === "blocked" ? "#991b1b" : "#92400e" }}>{node.blockedReason}</p>
            </div>
          )}

          {/* Multi-day steps: the day-by-day picture */}
          {dayProg && !done && !skipped && (
            <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Day {dayProg.day} of {dayProg.total}</p>
              <SegmentedProgress segments={dayProg.visits.map(v => ({ filled: v.done, color: "#0f8578", current: v.today && !v.done }))} />
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {dayProg.visits.map((v, i) => (
                  <span key={v.date} className="text-[11px]" style={{ color: v.done ? "#10b981" : v.today ? "var(--accent-text)" : "var(--text-muted)", fontWeight: v.today ? 600 : 400 }}>
                    Day {i + 1} · {new Date(`${v.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{v.done ? " ✓" : v.today ? " · today" : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dated waits: when should this resolve? Passing the date spawns a follow-up task. */}
          {(node.status === "waiting" || node.status === "blocked") && (
            <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Expected by
                <span className="font-normal" style={{ color: "var(--text-muted)" }}> — a follow-up task is created if this date passes</span>
              </label>
              <DatePicker size="sm" value={node.expectedDate ?? ""} className="w-44"
                onChange={d => { setMapNodeExpected(node.id, d); onChanged(); }} />
            </div>
          )}

          {/* Checklist source: the items ARE the step — work through them here */}
          {isChecklist && !skipped && node.checklist && (
            <div className="rounded-xl p-3.5 space-y-2" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><ListChecks className="w-3.5 h-3.5" /> Checklist</p>
              {node.checklist.map(item => (
                <MapChecklistItem key={item.id} nodeId={node.id} item={item} onChanged={onChanged} />
              ))}
            </div>
          )}

          {/* Prerequisites — click to view, "Go" to where it gets done */}
          {deps.length > 0 && (
            <div className="rounded-xl p-3.5 space-y-2" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><GitBranch className="w-3.5 h-3.5" /> Before this can start</p>
              {deps.map(d => {
                const dm = NODE_STATUS_META[d.status];
                // Completed OR skipped satisfies the dependency (a skipped step never happens).
                const dSat = d.status === "completed" || d.status === "skipped";
                const dTab = d.mirror ? SOURCE_TAB[d.mirror] : undefined;
                return (
                  <div key={d.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg" style={{ border: "1px solid var(--border)", backgroundColor: dSat ? "transparent" : "var(--bg-surface-2)" }}>
                    {dSat ? <Check className="w-4 h-4 shrink-0" style={{ color: d.status === "completed" ? "#10b981" : dm.color }} /> : <Circle className="w-4 h-4 shrink-0" style={{ color: dm.color }} />}
                    <button onClick={() => onSelectNode(d.id)} className="text-sm font-medium text-left hover:underline flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>{d.title}</button>
                    <span className="text-[11px] shrink-0" style={{ color: dm.color }}>{dm.label}</span>
                    {!dSat && dTab && onOpenTab && <button onClick={() => { onOpenTab(dTab); requestClose(); }} className="text-[11px] font-medium flex items-center gap-0.5 shrink-0" style={{ color: ACCENT }}>Go <ExternalLink className="w-3 h-3" /></button>}
                  </div>
                );
              })}
            </div>
          )}

          {node.notes && <p className="text-[11px] px-0.5" style={{ color: "var(--text-muted)" }}>{node.notes}</p>}
        </div>

        {/* ── Footer: the one action ── */}
        {(primary || (bookJobId && !done && !skipped)) && (
          <div className="shrink-0 p-4 space-y-2" style={{ backgroundColor: "var(--bg-surface)", borderTop: "1px solid var(--border)" }}>
            {primary}
            {bookJobId && !done && !skipped && (
              <button onClick={() => setBookOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
                <Calendar className="w-4 h-4" /> Book multi-day visits
              </button>
            )}
          </div>
        )}
      </div>

      {bookOpen && bookJobId && (
        <MultiDayBookModal jobId={bookJobId} onClose={() => setBookOpen(false)} onBooked={onChanged} />
      )}
    </>
  );
}

// ─── Checklist-step item (the typed fill-out on the live step) ──
// Same behavior as the work-order checklist: answering a typed item stores its
// value and marks it done; untyped / photo items are tap-to-check.
function MapChecklistItem({ nodeId, item, onChanged }: { nodeId: string; item: NodeChecklistItem; onChanged: () => void }) {
  const v = getItemAnswers(nodeId)[item.id];
  const t = item.type;
  const strVal = typeof v === "string" ? v : "";
  const arrVal = Array.isArray(v) ? v : [];
  const done = Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim());
  const tappable = !t || t === "photo";
  const setV = (value: string | string[]) => { setItemAnswer(nodeId, item.id, value); onChanged(); };

  const icon = done
    ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#16a34a" }} />
    : <Circle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />;
  const label = (
    <span className="text-sm" style={{ color: done ? "var(--text-muted)" : "var(--text-primary)", textDecoration: tappable && done ? "line-through" : "none" }}>
      {item.label || "Untitled item"}
      {item.required && <span className="ml-1.5 text-[10px] font-semibold" style={{ color: "#dc2626" }}>Required</span>}
      {t === "photo" && <span className="ml-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>attach in Photos &amp; Files</span>}
    </span>
  );

  if (tappable) {
    return (
      <button onClick={() => { toggleChecklistItem(nodeId, item.id); onChanged(); }} className="flex items-start gap-2 w-full text-left">
        {icon}{label}
      </button>
    );
  }

  const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" } as React.CSSProperties;
  return (
    <div className="flex items-start gap-2">
      {icon}
      <div className="flex-1 min-w-0">
        {label}
        <div className="mt-1">
          {t === "short_text" && (
            <input value={strVal} onChange={e => setV(e.target.value)} placeholder="Enter…" className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none" style={inputStyle} />
          )}
          {t === "long_text" && (
            <textarea value={strVal} onChange={e => setV(e.target.value)} placeholder="Enter…" rows={2} className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none resize-none" style={inputStyle} />
          )}
          {t === "number" && (
            <div className="flex items-center gap-1.5">
              <input type="number" value={strVal} onChange={e => setV(e.target.value)} placeholder="0" className="w-28 rounded-lg px-2.5 py-1.5 text-sm outline-none" style={inputStyle} />
              {item.unit && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{item.unit}</span>}
            </div>
          )}
          {t === "dropdown" && (
            <UiSelect size="sm" value={strVal} onChange={v2 => setV(v2)}
              options={[{ value: "", label: "Select…" }, ...(item.options ?? []).filter(o => o.trim()).map(o => ({ value: o, label: o }))]} />
          )}
          {t === "multi_select" && (
            <div className="flex flex-wrap gap-1.5">
              {(item.options ?? []).filter(o => o.trim()).map(o => {
                const on = arrVal.includes(o);
                return (
                  <button key={o} onClick={() => setV(on ? arrVal.filter(x => x !== o) : [...arrVal, o])}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{ border: `1.5px solid ${on ? "var(--copper-soft-border)" : "var(--border)"}`, backgroundColor: on ? "var(--copper-soft-bg)" : "var(--bg-surface-2)", color: on ? "var(--copper-text)" : "var(--text-secondary)" }}>{o}</button>
                );
              })}
            </div>
          )}
          {t === "datetime" && (
            <input type="datetime-local" value={strVal} onChange={e => setV(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-sm outline-none" style={inputStyle} />
          )}
          {t === "signature" && (
            <input value={strVal} onChange={e => setV(e.target.value)} placeholder="Type full name to sign" className="w-full rounded-lg px-2.5 py-1.5 text-sm italic outline-none" style={{ ...inputStyle, fontFamily: "Georgia, serif" }} />
          )}
        </div>
      </div>
    </div>
  );
}

