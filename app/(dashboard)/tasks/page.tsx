"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { CheckSquare, Plus, Search, SlidersHorizontal, Check, X, MoreHorizontal, Pencil, Trash2, ListChecks, MessageSquare, BarChart2, AlertTriangle, CheckCircle2, ArrowUpRight } from "lucide-react";
import {
  getAllTasks, toggleTaskComplete, deleteTask,
  type Task, type TaskStatus,
} from "@/lib/tasks/data";
import { taskTypeLabel, taskTypeColor, getTaskSettings } from "@/lib/tasks/settings";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import PageTitle from "@/components/shared/PageTitle";
import StatusTabs from "@/components/shared/StatusTabs";
import UiSelect from "@/components/ui/Select";
import NewTaskModal from "@/components/tasks/NewTaskModal";
import { getStaffedUsers } from "@/lib/users/data";
import { getAllThreads, anchorHref, anchorLabel, deleteComment, updateCommentBody, type CommentThread } from "@/lib/comments/data";

const STATUS_TABS: { key: "all" | TaskStatus; label: string }[] = [
  { key: "all",       label: "All"       },
  { key: "open",      label: "Open"      },
  { key: "overdue",   label: "Overdue"   },
  { key: "completed", label: "Completed" },
];

const LINKED_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  customer: { bg: "#d3ebe6", color: "#0a5c53" },
  lead:     { bg: "#fef3c7", color: "#92400e" },
  job:      { bg: "#dbeafe", color: "#1e40af" },
  project:  { bg: "#ede9fe", color: "#5b21b6" },
};

export default function TasksPage() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();

  const [view, setView]     = useState<"overview" | "tasks" | "comments">("tasks");
  const [tab, setTab]       = useState<"all" | TaskStatus>("all");
  const [search, setSearch] = useState("");
  // The task currently playing its completion animation (held in place until it finishes).
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Re-read the store after a create / edit / delete / toggle.
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tasks = useMemo(() => getAllTasks(), [refreshKey]);

  // Display preference from Settings → Tasks.
  const highlightOverdue = getTaskSettings().highlightOverdue;

  // New / edit modal + per-row action menu.
  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<Task | undefined>(undefined);
  const [menuId, setMenuId]         = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuId) return;
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuId]);

  function openNew()  { setEditing(undefined); setModalOpen(true); }
  function openEdit(t: Task) { setEditing(t); setModalOpen(true); setMenuId(null); }
  function removeTask(id: string) { deleteTask(id); setMenuId(null); refresh(); }

  const contextFiltered = tasks
    .filter(t => !effectiveCompanyId  || t.companyId  === effectiveCompanyId)
    .filter(t => !effectiveLocationId || t.locationId === effectiveLocationId);

  const displayed = contextFiltered
    .filter(t => tab === "all" || t.status === tab)
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.customerName ?? "").toLowerCase().includes(q) ||
        t.assignedTo.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (b.status === "completed" && a.status !== "completed") return -1;
      if (a.status === "overdue"   && b.status !== "overdue")   return -1;
      if (b.status === "overdue"   && a.status !== "overdue")   return 1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  function toggleComplete(taskId: string) {
    const t = tasks.find(x => x.id === taskId);
    // Completing: play the animation in place, then commit + re-sort to the bottom.
    if (t && t.status !== "completed") {
      setCompletingId(taskId);
      setTimeout(() => { toggleTaskComplete(taskId); setCompletingId(null); refresh(); }, 550);
    } else {
      toggleTaskComplete(taskId);
      refresh();
    }
  }

  const tabCount = (key: "all" | TaskStatus) =>
    key === "all" ? contextFiltered.length : contextFiltered.filter(t => t.status === key).length;

  const overdueCount = contextFiltered.filter(t => t.status === "overdue").length;

  return (
    <div className="p-6">
      {/* Header — title · centered tabs · action (matches the other modules) */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <PageTitle title="Tasks"
            count={contextFiltered.filter(t => t.status !== "completed").length}
            extraRows={overdueCount > 0 ? [{ label: "Overdue", node: <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{overdueCount}</span> }] : undefined}
            description="Follow-ups, calls, and scheduled actions across all records" />
        </div>

        {/* Overview · Tasks · Comments — same segmented style as the CRM's view toggles */}
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {([
            { key: "overview", label: "Overview", icon: BarChart2 },
            { key: "tasks",    label: "Tasks",    icon: ListChecks },
            { key: "comments", label: "Comments", icon: MessageSquare },
          ] as const).map(t => {
            const active = view === t.key;
            return (
              <button key={t.key} onClick={() => setView(t.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
                style={{ backgroundColor: active ? "#0f8578" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)" }}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 flex justify-end">
          {view === "tasks" && (
            <button onClick={openNew}
              className="flex items-center gap-1.5 bg-[#0f8578] hover:bg-[#0c6b60] text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> New Task
            </button>
          )}
        </div>
      </div>

      {view === "overview" && <TasksOverview tasks={contextFiltered} />}
      {view === "comments" && <CommentsTab />}

      {view === "tasks" && (
      <>
        {/* Toolbar — tabs · search · filter, OUTSIDE the table card (consistent with Customers/Leads) */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <StatusTabs active={tab} onChange={k => setTab(k as typeof tab)}
            tabs={STATUS_TABS.map(t => ({ key: t.key, label: t.label, count: tabCount(t.key) }))} />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5"
              style={{ backgroundColor: "var(--bg-input)" }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input type="text" placeholder="Search tasks..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none w-44"
                style={{ color: "var(--text-primary)" }} />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
            </button>
          </div>
        </div>

        {/* Table card */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        {/* Column headers */}
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "2.5fr 1fr 2fr 1fr 1fr 0.4fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
          <span>Task</span>
          <span>Type</span>
          <span>Linked To</span>
          <span>Assigned</span>
          <span>Due Date</span>
          <span />
        </div>

        {/* Rows */}
        <div>
          {displayed.length === 0 ? (
            <div className="py-16 text-center">
              <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {tasks.length === 0 ? "No tasks yet." : "No tasks match the current filter."}
              </p>
              {tasks.length === 0 && (
                <button onClick={openNew}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <Plus className="w-3.5 h-3.5" /> Create your first task
                </button>
              )}
            </div>
          ) : displayed.map((task, i) => {
            const isOverdue    = task.status === "overdue" && highlightOverdue;
            const isCompleted  = task.status === "completed";
            const isCompleting = task.id === completingId;   // mid-animation
            const showChecked  = isCompleted || isCompleting;
            // Known record types get their color; anchor-pinned links (quote/item/
            // dispatch/…) fall back to a neutral pill but still navigate.
            const lt = (task.linkedType && LINKED_TYPE_STYLE[task.linkedType])
              || (task.linkedHref ? { bg: "var(--bg-input)", color: "var(--text-secondary)" } : null);

            return (
              <div key={task.id}
                className={`grid px-4 py-3 items-center transition-opacity ${isCompleting ? "task-completing" : ""}`}
                style={{
                  gridTemplateColumns: "2.5fr 1fr 2fr 1fr 1fr 0.4fr",
                  borderBottom: i < displayed.length - 1 ? "1px solid var(--border)" : "none",
                  opacity: isCompleted ? 0.5 : 1,
                }}>

                {/* Task + complete checkbox */}
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => toggleComplete(task.id)}
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all"
                    style={{
                      border: `1.5px solid ${showChecked ? "#10b981" : isOverdue ? "#ef4444" : "var(--border)"}`,
                      backgroundColor: showChecked ? "#d1fae5" : "transparent",
                    }}
                    title={isCompleted ? "Mark open" : "Mark complete"}
                  >
                    {showChecked && <Check className={`w-3 h-3 text-emerald-600 ${isCompleting ? "check-pop" : ""}`} />}
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate"
                      style={{
                        color: "var(--text-primary)",
                        textDecoration: isCompleted ? "line-through" : "none",
                      }}>
                      {task.title}
                    </p>
                    {isCompleted && task.completedAt && (
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        Completed {task.completedAt}
                      </p>
                    )}
                  </div>
                </div>

                {/* Type */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: taskTypeColor(task.type) }} />
                  <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                    {taskTypeLabel(task.type)}
                  </span>
                </div>

                {/* Linked to — an arrow link signals it navigates to the record */}
                <div className="min-w-0">
                  {task.linkedLabel && task.linkedHref && lt ? (
                    <Link href={task.linkedHref}
                      className="group inline-flex items-center gap-1 text-[11px] font-medium max-w-full hover:underline"
                      style={{ color: lt.color, textDecoration: "none" }}>
                      <span className="truncate">{task.linkedLabel}</span>
                      <ArrowUpRight className="w-3 h-3 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                  ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                </div>

                {/* Assigned */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-[var(--copper-soft-bg)] flex items-center justify-center text-[8px] font-bold text-[var(--copper-text)] shrink-0">
                    {task.assignedToInitials}
                  </div>
                  <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                    {task.assignedTo}
                  </span>
                </div>

                {/* Due date */}
                <span className="text-sm"
                  style={{
                    color: isOverdue ? "#dc2626" : isCompleted ? "var(--text-muted)" : "var(--text-secondary)",
                    fontWeight: isOverdue ? 600 : 400,
                  }}>
                  {task.dueDate}{isOverdue && " ⚠"}
                </span>

                {/* Row actions */}
                <div className="flex justify-end relative" ref={menuId === task.id ? menuRef : undefined}>
                  <button onClick={() => setMenuId(menuId === task.id ? null : task.id)}
                    className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
                    style={{ color: "var(--text-muted)" }} title="Actions">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {menuId === task.id && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-xl overflow-hidden py-1"
                      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                      <button onClick={() => openEdit(task)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-surface-2)]"
                        style={{ color: "var(--text-primary)" }}>
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => removeTask(task.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-surface-2)]"
                        style={{ color: "#dc2626" }}>
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 text-xs"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)", backgroundColor: "transparent" }}>
          {contextFiltered.filter(t => t.status !== "completed").length} open ·{" "}
          {contextFiltered.filter(t => t.status === "completed").length} completed
        </div>
      </div>
      </>
      )}

      {modalOpen && (
        <NewTaskModal
          open
          task={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────
function Stat({ icon: Icon, label, value, color }: { icon: typeof ListChecks; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + "22" }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-xl font-bold leading-none" style={{ color: "var(--text-primary)" }}>{value}</p>
        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
    </div>
  );
}

// ─── Overview tab — task + comment statistics ─────────────
function TasksOverview({ tasks }: { tasks: Task[] }) {
  const open      = tasks.filter(t => t.status === "open").length;
  const overdue   = tasks.filter(t => t.status === "overdue").length;
  const completed = tasks.filter(t => t.status === "completed").length;

  const threads     = getAllThreads();
  const openThreads = threads.filter(t => !t.root.resolved).length;
  const resolved    = threads.filter(t => t.root.resolved).length;
  const replies     = threads.reduce((n, t) => n + t.replies.length, 0);

  // Tasks by type (active types only).
  const byType = new Map<string, number>();
  tasks.filter(t => t.status !== "completed").forEach(t => byType.set(t.type, (byType.get(t.type) ?? 0) + 1));
  const typeRows = [...byType.entries()].sort((a, b) => b[1] - a[1]);
  const maxType = Math.max(1, ...typeRows.map(([, n]) => n));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Tasks</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={ListChecks}   label="Open"       value={open}      color="#0f8578" />
          <Stat icon={AlertTriangle} label="Overdue"   value={overdue}   color="#dc2626" />
          <Stat icon={CheckCircle2} label="Completed"  value={completed} color="#10b981" />
          <Stat icon={CheckSquare}  label="Total"      value={tasks.length} color="#6b7280" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Comments</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={MessageSquare} label="Open threads" value={openThreads} color="#0f8578" />
          <Stat icon={CheckCircle2}  label="Resolved"     value={resolved}    color="#10b981" />
          <Stat icon={MessageSquare} label="Replies"      value={replies}     color="#0891b2" />
          <Stat icon={MessageSquare} label="Total"        value={threads.length} color="#6b7280" />
        </div>
      </div>

      {typeRows.length > 0 && (
        <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Open tasks by type</p>
          <div className="space-y-2">
            {typeRows.map(([type, n]) => (
              <div key={type} className="flex items-center gap-3">
                <span className="text-xs w-32 shrink-0 truncate" style={{ color: "var(--text-secondary)" }}>{taskTypeLabel(type)}</span>
                <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
                  <div className="h-2 rounded-full" style={{ width: `${(n / maxType) * 100}%`, backgroundColor: taskTypeColor(type) }} />
                </div>
                <span className="text-xs w-6 text-right shrink-0" style={{ color: "var(--text-muted)" }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Comments tab — every comment thread across the CRM ───
function timeAgo(iso: string): string {
  const d = new Date(iso); if (isNaN(d.getTime())) return "";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24); if (dd < 7) return `${dd}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const COMMENT_COLS = "2.4fr 1.6fr 1fr 0.7fr 0.9fr auto";

function CommentsTab() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const threads = useMemo(() => getAllThreads(), [tick]);
  const users = useMemo(() => getStaffedUsers().map(u => ({ id: u.id, name: u.fullName })), []);

  // Status is a tab; the rest live in the Filter popover.
  const [status, setStatus] = useState<"all" | "ongoing" | "resolved">("all");
  const [fAuthor, setAuthor] = useState("all");
  const [fTagged, setTagged] = useState("all");
  const [fTask,   setTask]   = useState<"all" | "with" | "without">("all");
  const [search,  setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFiltersOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filtersOpen]);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Threads that were converted to a task (the task's link carries thread=<id>).
  const threadsWithTask = useMemo(() => {
    const set = new Set<string>();
    getAllTasks().forEach(tk => { const m = tk.linkedHref?.match(/thread=([^&]+)/); if (m) set.add(decodeURIComponent(m[1])); });
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Filter options derived from the actual data.
  const authorOpts = useMemo(() => {
    const m = new Map<string, string>(); threads.forEach(t => m.set(t.root.authorId, t.root.authorName));
    return [...m.entries()].map(([id, name]) => ({ value: id, label: name }));
  }, [threads]);
  const taggedOpts = useMemo(() => {
    const ids = new Set<string>(); threads.forEach(t => [t.root, ...t.replies].forEach(c => c.mentions.forEach(id => ids.add(id))));
    return [...ids].map(id => ({ value: id, label: users.find(u => u.id === id)?.name ?? id }));
  }, [threads, users]);

  // Search + filters (everything except the status tab) drive the tab counts + table.
  const byFilters = threads.filter(t => {
    if (fAuthor !== "all" && t.root.authorId !== fAuthor) return false;
    if (fTagged !== "all" && ![t.root, ...t.replies].some(c => c.mentions.includes(fTagged))) return false;
    if (fTask === "with"    && !threadsWithTask.has(t.root.threadId)) return false;
    if (fTask === "without" &&  threadsWithTask.has(t.root.threadId)) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${t.root.body} ${t.root.authorName} ${anchorLabel(t.root.anchor)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const tabCount = (k: "all" | "ongoing" | "resolved") =>
    k === "all" ? byFilters.length : k === "ongoing" ? byFilters.filter(t => !t.root.resolved).length : byFilters.filter(t => t.root.resolved).length;
  const filtered = byFilters.filter(t => status === "all" || (status === "resolved" ? t.root.resolved : !t.root.resolved));

  const activeFilters = [fAuthor, fTagged].filter(v => v !== "all").length + (fTask !== "all" ? 1 : 0);
  function clearFilters() { setAuthor("all"); setTagged("all"); setTask("all"); }

  function saveEdit(id: string) {
    const body = editValue.trim();
    if (body) updateCommentBody(id, body, users.filter(u => body.includes(`@${u.name}`)).map(u => u.id));
    setEditingId(null); refresh();
  }
  function remove(threadId: string) { deleteComment(threadId); setEditingId(null); refresh(); }

  return (
    <div className="space-y-3">
      {/* Toolbar — kept OUTSIDE the table card so the filter popover / its
          dropdowns aren't clipped by the card's overflow. */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <StatusTabs active={status} onChange={k => setStatus(k as typeof status)}
          tabs={[
            { key: "all", label: "All", count: tabCount("all") },
            { key: "ongoing", label: "Ongoing", count: tabCount("ongoing") },
            { key: "resolved", label: "Resolved", count: tabCount("resolved") },
          ]} />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input type="text" placeholder="Search comments..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none w-44" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="relative" ref={filterRef}>
            <button onClick={() => setFiltersOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
              style={{
                border: `1px solid ${activeFilters > 0 ? "var(--accent-soft-border)" : "var(--border)"}`,
                color: activeFilters > 0 ? "var(--accent-text)" : "var(--text-secondary)",
                backgroundColor: activeFilters > 0 ? "var(--accent-soft-bg)" : "var(--bg-surface)",
              }}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
              {activeFilters > 0 && <span className="ml-0.5 text-[10px] font-bold px-1.5 rounded-full text-white" style={{ backgroundColor: "var(--accent-text)" }}>{activeFilters}</span>}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl z-30 p-3.5 space-y-3"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Filters</span>
                  {activeFilters > 0 && (
                    <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] font-medium hover:underline" style={{ color: "var(--accent-text)" }}>
                      <X className="w-3 h-3" /> Clear all
                    </button>
                  )}
                </div>
                <FilterField label="Author"><UiSelect size="sm" value={fAuthor} onChange={setAuthor} options={[{ value: "all", label: "Anyone" }, ...authorOpts]} /></FilterField>
                <FilterField label="Tagged"><UiSelect size="sm" value={fTagged} onChange={setTagged} options={[{ value: "all", label: "Anyone" }, ...taggedOpts]} /></FilterField>
                <FilterField label="Task"><UiSelect size="sm" value={fTask} onChange={v => setTask(v as typeof fTask)} options={[{ value: "all", label: "Any" }, { value: "with", label: "Has task" }, { value: "without", label: "No task" }]} /></FilterField>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      {/* Column headers */}
      <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ gridTemplateColumns: COMMENT_COLS, gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
        <span>Comment</span><span>Location</span><span>Status</span><span>Replies</span><span>Date</span><span />
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {threads.length === 0 ? "No comments yet." : "No comments match the current view."}
          </p>
          {threads.length === 0 && (
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Turn on comment mode (top bar) and click anywhere to leave one.</p>
          )}
        </div>
      ) : filtered.map((t, i) => {
        const isEditing = editingId === t.root.id;
        const hasTask = threadsWithTask.has(t.root.threadId);
        const last = i === filtered.length - 1;

        if (isEditing) {
          return (
            <div key={t.root.id} className="px-4 py-3" style={{ borderBottom: last ? "none" : "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
              <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={3} autoFocus
                className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none thin-scroll-y"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
              <div className="flex gap-2 mt-2">
                <button onClick={() => saveEdit(t.root.id)} disabled={!editValue.trim()} className="px-2.5 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#0f8578" }}>Save</button>
                <button onClick={() => setEditingId(null)} className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              </div>
            </div>
          );
        }

        return (
          <div key={t.root.id} className="grid px-4 py-3 items-center group/crow hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ gridTemplateColumns: COMMENT_COLS, gap: "0.75rem", borderBottom: last ? "none" : "1px solid var(--border)", opacity: t.root.resolved ? 0.65 : 1 }}>
            {/* Comment */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-6 h-6 rounded-full bg-[var(--copper-soft-bg)] flex items-center justify-center text-[8px] font-bold text-[var(--copper-text)] shrink-0">{t.root.authorInitials}</span>
              <div className="min-w-0">
                <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{t.root.body}</p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{t.root.authorName}</p>
              </div>
            </div>
            {/* Location */}
            <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{anchorLabel(t.root.anchor)}</span>
            {/* Status */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                style={t.root.resolved ? { backgroundColor: "#d1fae5", color: "#065f46" } : { backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
                {t.root.resolved ? "Resolved" : "Ongoing"}
              </span>
              {hasTask && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#d3ebe6", color: "#0a5c53" }}>Task</span>}
            </div>
            {/* Replies */}
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{t.replies.length || "—"}</span>
            {/* Date */}
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{timeAgo(t.root.createdAt)}</span>
            {/* Actions */}
            <div className="flex items-center gap-0.5 justify-end shrink-0 opacity-0 group-hover/crow:opacity-100 transition-opacity">
              <Link href={anchorHref(t.root.anchor, t.root.threadId)} title="Open in context"
                className="p-1.5 rounded-lg hover:bg-[var(--bg-surface)]" style={{ color: "var(--text-muted)" }}>
                <MessageSquare className="w-3.5 h-3.5" />
              </Link>
              <button onClick={() => { setEditingId(t.root.id); setEditValue(t.root.body); }} title="Edit"
                className="p-1.5 rounded-lg hover:bg-[var(--bg-surface)]" style={{ color: "var(--text-muted)" }}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => remove(t.root.id)} title="Delete"
                className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#dc2626" }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

// Stacked labeled field for the Comments filter popover.
function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>{label}</p>
      {children}
    </div>
  );
}
