"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckSquare, Plus, Search, SlidersHorizontal, Check } from "lucide-react";
import {
  ALL_TASKS, TASK_TYPE_LABELS,
  type Task, type TaskStatus,
} from "@/lib/tasks/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import StatusTabs from "@/components/shared/StatusTabs";

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
  const [tasks, setTasks]   = useState<Task[]>(ALL_TASKS);

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
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return t.status === "completed"
        ? { ...t, status: "open" as TaskStatus, completedAt: undefined }
        : { ...t, status: "completed" as TaskStatus, completedAt: "Just now" };
    }));
  }

  const tabCount = (key: "all" | TaskStatus) =>
    key === "all" ? contextFiltered.length : contextFiltered.filter(t => t.status === key).length;

  const overdueCount = contextFiltered.filter(t => t.status === "overdue").length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <CheckSquare className="w-5 h-5" style={{ color: "#4f46e5" }} />
            <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Tasks</h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
              {contextFiltered.filter(t => t.status !== "completed").length}
            </span>
            {overdueCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>
                {overdueCount} overdue
              </span>
            )}
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Follow-ups, calls, and scheduled actions across all records
          </p>
        </div>
        <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
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
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No tasks match the current filter.</p>
            </div>
          ) : displayed.map((task, i) => {
            const isOverdue   = task.status === "overdue";
            const isCompleted = task.status === "completed";
            const lt = task.linkedType ? LINKED_TYPE_STYLE[task.linkedType] : null;

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
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {TASK_TYPE_LABELS[task.type]}
                </span>

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

                <div />
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
    </div>
  );
}
