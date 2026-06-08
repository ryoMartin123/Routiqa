"use client";

// ─── Notifications bell ───────────────────────────────────
// Two streams in one panel:
//  • Stored events addressed to the current user — @mentions and task
//    assignments (durable, with read state) from lib/notifications.
//  • Derived urgent items computed live and scoped to the active company/
//    location — overdue/due-today tasks, past-due invoices, emergency jobs.
// Opening the panel marks both streams read; each row deep-links to its spot.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckSquare, FileText, Flame, Clock, Check, AtSign, ListChecks, X } from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { usePermissionContext } from "@/components/providers/PermissionProvider";
import { getAllTasks } from "@/lib/tasks/data";
import { ALL_INVOICES, fmt } from "@/lib/quotes/data";
import { ALL_JOBS } from "@/lib/jobs/data";
import { getNotificationsForUser, markAllReadForUser, clearNotification, clearAllNotificationsForUser } from "@/lib/notifications/data";

type NotifKind = "mention" | "assigned" | "overdue_task" | "due_task" | "invoice" | "emergency";

interface Notif {
  id: string;
  kind: NotifKind;
  title: string;
  detail: string;
  href: string;
  read?: boolean;     // present on stored events
  stored?: boolean;
}

const KIND_META: Record<NotifKind, { icon: typeof Bell; color: string; bg: string }> = {
  mention:      { icon: AtSign,      color: "#4f46e5", bg: "#e0e7ff" },
  assigned:     { icon: ListChecks,  color: "#4f46e5", bg: "#e0e7ff" },
  overdue_task: { icon: CheckSquare, color: "#dc2626", bg: "#fee2e2" },
  due_task:     { icon: Clock,       color: "#92400e", bg: "#fef3c7" },
  invoice:      { icon: FileText,    color: "#b45309", bg: "#fef3c7" },
  emergency:    { icon: Flame,       color: "#dc2626", bg: "#fee2e2" },
};

const SEEN_KEY = "crm-notifications-seen";

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

export default function NotificationBell() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();
  const { actingUser } = usePermissionContext();
  const userId = actingUser?.id ?? "";
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);   // re-read stored events after marking read
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(SEEN_KEY); if (raw) setSeen(new Set(JSON.parse(raw))); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const inScope = (x: { companyId: string; locationId: string }) =>
    (!effectiveCompanyId  || x.companyId  === effectiveCompanyId) &&
    (!effectiveLocationId || x.locationId === effectiveLocationId);

  // Stored events addressed to the acting user (mentions, assignments).
  const stored = useMemo<Notif[]>(() =>
    getNotificationsForUser(userId).map(n => ({
      id: n.id, kind: n.kind === "task_assigned" ? "assigned" : "mention",
      title: n.title, detail: n.detail, href: n.href, read: n.read, stored: true,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, open, tick],
  );

  // Derived urgent items (scoped, computed live).
  const derived = useMemo<Notif[]>(() => {
    const tasks = getAllTasks().filter(inScope);
    const items: Notif[] = [];
    for (const t of tasks.filter(t => t.status === "overdue")) {
      items.push({ id: `task-${t.id}`, kind: "overdue_task", title: t.title, detail: `Overdue · due ${t.dueDate} · ${t.assignedTo}`, href: t.linkedHref ?? "/tasks" });
    }
    for (const t of tasks.filter(t => t.status === "open" && isToday(t.dueDate))) {
      items.push({ id: `task-${t.id}`, kind: "due_task", title: t.title, detail: `Due today · ${t.assignedTo}`, href: t.linkedHref ?? "/tasks" });
    }
    for (const j of ALL_JOBS.filter(j => j.type === "emergency" && (j.status === "in_progress" || j.status === "en_route")).filter(inScope)) {
      items.push({ id: `job-${j.id}`, kind: "emergency", title: `Emergency: ${j.title}`, detail: `${j.customerName} · ${j.assignedTo}`, href: `/jobs/${j.id}` });
    }
    for (const i of ALL_INVOICES.filter(i => i.status === "past_due").filter(inScope)) {
      items.push({ id: `inv-${i.id}`, kind: "invoice", title: `${i.invoiceNumber} past due`, detail: `${i.customerName} · ${fmt(i.balanceDue)} outstanding`, href: `/invoices/${i.id}` });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCompanyId, effectiveLocationId, open]);

  const items = [...stored, ...derived];
  const unread = stored.filter(n => !n.read).length + derived.filter(n => !seen.has(n.id)).length;

  function markAllSeen() {
    setSeen(prev => {
      const next = new Set(prev);
      derived.forEach(n => next.add(n.id));
      try { localStorage.setItem(SEEN_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function handleToggle() {
    const opening = !open;
    setOpen(opening);
    if (opening && unread > 0) {
      markAllReadForUser(userId);
      markAllSeen();
      setTick(t => t + 1);
    }
  }

  // Dismiss a single stored event (mentions/assignments). Derived urgent items
  // can't be cleared — they regenerate from live data — so only stored rows get a ✕.
  function dismissOne(id: string) {
    clearNotification(id);
    setTick(t => t + 1);
  }

  function clearAll() {
    clearAllNotificationsForUser(userId);
    markAllSeen();
    setTick(t => t + 1);
  }

  const hasStored = stored.length > 0;

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleToggle}
        className="relative p-2 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
        style={{ color: "var(--text-secondary)" }}
        title="Notifications">
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl overflow-hidden z-50"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Notifications</p>
            <div className="flex items-center gap-2">
              {hasStored && (
                <button onClick={clearAll}
                  className="text-[11px] font-medium transition-colors hover:underline"
                  style={{ color: "var(--text-muted)" }}>
                  Clear all
                </button>
              )}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
                {items.length}
              </span>
            </div>
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-10 text-center">
                <Check className="w-7 h-7 mx-auto mb-2 opacity-20" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>You&apos;re all caught up.</p>
              </div>
            ) : items.map((n, i) => {
              const meta = KIND_META[n.kind];
              const isUnread = n.stored ? !n.read : !seen.has(n.id);
              return (
                <Link key={`${n.id}-${n.kind}`} href={n.href} onClick={() => setOpen(false)}
                  className="group/notif flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none", backgroundColor: isUnread ? "var(--accent-soft-bg)" : undefined }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: meta.bg }}>
                    <meta.icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{n.title}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{n.detail}</p>
                  </div>
                  {n.stored ? (
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); dismissOne(n.id); }}
                      title="Dismiss"
                      className="shrink-0 mt-0.5 p-1 rounded-md opacity-0 group-hover/notif:opacity-100 transition-opacity hover:bg-[var(--bg-surface)]"
                      style={{ color: "var(--text-muted)" }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    isUnread && <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: "var(--accent-text)" }} />
                  )}
                </Link>
              );
            })}
          </div>

          <Link href="/tasks" onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-center text-xs font-medium transition-colors hover:bg-[var(--bg-surface-2)]"
            style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--accent-text)", textDecoration: "none" }}>
            View all tasks
          </Link>
        </div>
      )}
    </div>
  );
}
