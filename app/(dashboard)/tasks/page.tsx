"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { CheckSquare, Plus, Search, SlidersHorizontal, Check, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  getAllTasks, toggleTaskComplete, deleteTask,
  type Task, type TaskStatus,
} from "@/lib/tasks/data";
import { taskTypeLabel, taskTypeColor, getTaskSettings } from "@/lib/tasks/settings";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import PageTitle from "@/components/shared/PageTitle";
import StatusTabs from "@/components/shared/StatusTabs";
import NewTaskModal from "@/components/tasks/NewTaskModal";

const STATUS_TABS: { key: "all" | TaskStatus; label: string }[] = [
  { key: "all",       label: "All"       },
  { key: "open",      label: "Open"      },
  { key: "overdue",   label: "Overdue"   },
  { key: "completed", label: "Completed" },
];

const LINKED_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  customer: { bg: "#e0e7ff", color: "#3730a3" },
  lead:     { bg: "#fef3c7", color: "#92400e" },
  job:      { bg: "#dbeafe", color: "#1e40af" },
  project:  { bg: "#ede9fe", color: "#5b21b6" },
};

export default function TasksPage() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();

  const [tab, setTab]       = useState<"all" | TaskStatus>("all");
  const [search, setSearch] = useState("");

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
    toggleTaskComplete(taskId);
    refresh();
  }

  const tabCount = (key: "all" | TaskStatus) =>
    key === "all" ? contextFiltered.length : contextFiltered.filter(t => t.status === key).length;

  const overdueCount = contextFiltered.filter(t => t.status === "overdue").length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <PageTitle title="Tasks"
            count={contextFiltered.filter(t => t.status !== "completed").length}
            extraRows={overdueCount > 0 ? [{ label: "Overdue", node: <span className="text-xs font-semibold" style={{ color: "#dc2626" }}>{overdueCount}</span> }] : undefined}
            description="Follow-ups, calls, and scheduled actions across all records" />
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      <div className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>

        {/* Tabs + search */}
        <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}>
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

        {/* Column headers */}
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "2.5fr 1fr 2fr 1fr 1fr 0.4fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
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
            const isOverdue   = task.status === "overdue" && highlightOverdue;
            const isCompleted = task.status === "completed";
            // Known record types get their color; anchor-pinned links (quote/item/
            // dispatch/…) fall back to a neutral pill but still navigate.
            const lt = (task.linkedType && LINKED_TYPE_STYLE[task.linkedType])
              || (task.linkedHref ? { bg: "var(--bg-input)", color: "var(--text-secondary)" } : null);

            return (
              <div key={task.id}
                className="grid px-4 py-3 items-center transition-opacity"
                style={{
                  gridTemplateColumns: "2.5fr 1fr 2fr 1fr 1fr 0.4fr",
                  borderBottom: i < displayed.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  opacity: isCompleted ? 0.5 : 1,
                }}>

                {/* Task + complete checkbox */}
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => toggleComplete(task.id)}
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all"
                    style={{
                      border: `1.5px solid ${isCompleted ? "#10b981" : isOverdue ? "#ef4444" : "var(--border)"}`,
                      backgroundColor: isCompleted ? "#d1fae5" : "transparent",
                    }}
                    title={isCompleted ? "Mark open" : "Mark complete"}
                  >
                    {isCompleted && <Check className="w-3 h-3 text-emerald-600" />}
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

                {/* Linked to */}
                <div className="min-w-0">
                  {task.linkedLabel && task.linkedHref && lt ? (
                    <Link href={task.linkedHref}
                      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-full"
                      style={{ backgroundColor: lt.bg, color: lt.color, textDecoration: "none" }}>
                      {task.linkedLabel}
                    </Link>
                  ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                </div>

                {/* Assigned */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0">
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
          style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)", backgroundColor: "var(--bg-surface-2)" }}>
          {contextFiltered.filter(t => t.status !== "completed").length} open ·{" "}
          {contextFiltered.filter(t => t.status === "completed").length} completed
        </div>
      </div>

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
