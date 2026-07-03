"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Square, ListTodo } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Section, Card, EmptyState } from "@/components/mobile/ui";
import { getMyTasks } from "@/lib/mobile/data";
import { updateTask, taskIsOverdue, type Task } from "@/lib/tasks/data";
import { todayYMD } from "@/lib/utils/schedule";

export default function MobileTasksPage() {
  const [tick, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick re-reads after completing a task
  const tasks = useMemo(() => getMyTasks(), [tick]);
  const today = todayYMD();

  const groups: { title: string; items: Task[] }[] = [
    { title: "Overdue", items: tasks.filter(taskIsOverdue) },
    { title: "Today", items: tasks.filter(t => !taskIsOverdue(t) && t.dueDate === today) },
    { title: "Upcoming", items: tasks.filter(t => !taskIsOverdue(t) && t.dueDate > today) },
  ].filter(g => g.items.length);

  const complete = (id: string) => { updateTask(id, { status: "completed", completedAt: new Date().toISOString() }); setTick(t => t + 1); };

  return (
    <div>
      <MobileHeader title="My Tasks" subtitle={`${tasks.length} open`} />
      <div className="px-4 space-y-5">
        {groups.length === 0 ? (
          <Card><EmptyState icon={ListTodo} title="All caught up" hint="No open tasks assigned to you." /></Card>
        ) : groups.map(g => (
          <Section key={g.title} title={`${g.title} · ${g.items.length}`}>
            <Card>
              {g.items.map((t, i) => (
                <div key={t.id} className="flex items-start gap-3 px-4 py-3.5" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <button onClick={() => complete(t.id)} className="mt-0.5 active:scale-90 transition-transform" aria-label="Complete">
                    <Square className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: taskIsOverdue(t) ? "#dc2626" : "var(--text-muted)" }}>
                      {t.customerName ? `${t.customerName} · ` : ""}Due {t.dueDate}
                    </p>
                  </div>
                </div>
              ))}
            </Card>
          </Section>
        ))}
        <p className="flex items-center justify-center gap-1.5 text-xs pt-1" style={{ color: "var(--text-muted)" }}>
          <CheckSquare className="w-3.5 h-3.5" /> Tap the box to mark a task done
        </p>
      </div>
    </div>
  );
}
