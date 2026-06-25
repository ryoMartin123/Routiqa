"use client";

// ─── Tasks panel for a record (customer / lead / job / project) ──
// Shows the central-store tasks linked to a record and lets you create one
// pre-linked (and LOCKED) to it — so it always shows here AND on the global
// Tasks page. Search (left) · status tabs (center) · New Task (right). Uses the
// same in-place "complete" animation as the global Tasks page.

import { useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import {
  getTasksForCustomer, getTasksForLead, getTasksForJob, getTasksForProject,
  toggleTaskComplete, taskIsOverdue, type Task,
} from "@/lib/tasks/data";
import NewTaskModal from "@/components/tasks/NewTaskModal";

type LinkType = "customer" | "lead" | "job" | "project";
const GETTER: Record<LinkType, (id: string) => Task[]> = {
  customer: getTasksForCustomer, lead: getTasksForLead, job: getTasksForJob, project: getTasksForProject,
};
type StatusFilter = "all" | "open" | "overdue" | "completed";
const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" }, { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" }, { key: "completed", label: "Completed" },
];

export default function RecordTasks({ type, id, accent = "#4f46e5" }: { type: LinkType; id: string; accent?: string }) {
  const [tick, setTick] = useState(0);
  const [creating, setCreating] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  void tick;

  const all = GETTER[type](id);
  const counts = {
    all: all.length,
    open: all.filter(t => t.status !== "completed").length,
    overdue: all.filter(t => t.status !== "completed" && taskIsOverdue(t)).length,
    completed: all.filter(t => t.status === "completed").length,
  };
  const matchesFilter = (t: Task) =>
    filter === "all" ? true
      : filter === "completed" ? t.status === "completed"
      : filter === "overdue" ? (t.status !== "completed" && taskIsOverdue(t))
      : /* open */ t.status !== "completed";
  const q = search.trim().toLowerCase();
  const tasks = all.filter(t => matchesFilter(t) && (!q || t.title.toLowerCase().includes(q) || (t.assignedTo ?? "").toLowerCase().includes(q)));

  function toggle(tid: string) {
    const t = all.find(x => x.id === tid);
    if (t && t.status !== "completed") {
      setCompletingId(tid);
      setTimeout(() => { toggleTaskComplete(tid); setCompletingId(null); setTick(n => n + 1); }, 550);
    } else {
      toggleTaskComplete(tid); setTick(n => n + 1);
    }
  }

  return (
    <div className="w-full space-y-3">
      {/* Search (left) · status tabs (center) · New Task (right) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center">
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
              className="bg-transparent text-sm outline-none w-40" style={{ color: "var(--text-primary)" }} />
          </div>
        </div>

        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)" }}>
                {f.label}<span className="ml-1.5 opacity-60">{counts[f.key]}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-w-0 flex items-center justify-end">
          <button onClick={() => setCreating(true)} className="group flex items-center gap-1.5 text-xs font-medium transition-colors shrink-0" style={{ color: accent }}>
            <span className="w-4 h-4 rounded-full flex items-center justify-center transition-all group-hover:brightness-95" style={{ backgroundColor: accent + "1a" }}><Plus className="w-3 h-3" /></span>
            New Task
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{all.length === 0 ? "No tasks yet." : "No tasks match this filter."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => {
            const isCompleted  = task.status === "completed";
            const isCompleting = task.id === completingId;
            const showChecked  = isCompleted || isCompleting;
            const overdue      = taskIsOverdue(task) && !isCompleted;
            return (
              <div key={task.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-opacity ${isCompleting ? "task-completing" : ""}`}
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", opacity: isCompleted ? 0.55 : 1 }}>
                <button onClick={() => toggle(task.id)}
                  className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all"
                  style={{
                    border: `1.5px solid ${showChecked ? "#10b981" : overdue ? "#ef4444" : "var(--border)"}`,
                    backgroundColor: showChecked ? "#d1fae5" : "transparent",
                  }}
                  title={isCompleted ? "Mark open" : "Mark complete"}>
                  {showChecked && <Check className={`w-3 h-3 text-emerald-600 ${isCompleting ? "check-pop" : ""}`} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: isCompleted ? "var(--text-muted)" : "var(--text-primary)", textDecoration: isCompleted ? "line-through" : "none" }}>
                    {task.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: overdue ? "#dc2626" : "var(--text-muted)" }}>
                    {[task.dueDate + (overdue ? " · Overdue" : ""), task.assignedTo].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewTaskModal open={creating} onClose={() => setCreating(false)}
        defaultLink={{ type, id }} lockLink onSaved={() => { setCreating(false); setTick(n => n + 1); }} />
    </div>
  );
}
