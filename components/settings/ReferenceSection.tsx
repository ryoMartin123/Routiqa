"use client";

// ─── Reference / help gallery ─────────────────────────────
// Read-only reference material — nothing here is configurable. First entry:
// the job status lifecycle (the fixed set the engine, dispatch lanes, mobile
// flow, and billing key off). Reads as a flow, not a settings table.

import { useEffect, useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import {
  getJobStatuses, JOB_STATUS_CATEGORY_LABELS,
  type JobStatusDef, type JobStatusCategory,
} from "@/lib/job-config/data";

// The main path a job travels; Waiting and Canceled branch off it.
const MAIN_PATH: JobStatusCategory[] = ["open", "scheduled", "active", "completed"];

function StatusPill({ s }: { s: JobStatusDef }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md whitespace-nowrap"
      style={{ backgroundColor: s.color + "22", color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />{s.name}
    </span>
  );
}

function GalleryLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{children}</p>;
}

export default function ReferenceSection() {
  const [statuses, setStatuses] = useState<JobStatusDef[]>([]);
  useEffect(() => { setStatuses(getJobStatuses()); }, []);
  const active = [...statuses].filter(s => s.active).sort((a, b) => a.order - b.order);
  const inCat = (cat: JobStatusCategory) => active.filter(s => s.category === cat);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Reference</h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          How the system works under the hood — for reading, not configuring.
        </p>
      </div>

      {/* ── Job status lifecycle ── */}
      <div className="rounded-xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap px-5 pt-4">
          <GalleryLabel>Job Status Lifecycle</GalleryLabel>
          <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
            <Lock className="w-3 h-3" /> Fixed set
          </span>
        </div>

        {/* Main path: Open → Scheduled → Active → Completed */}
        <div className="px-5 pt-4 pb-2 flex items-start gap-2 flex-wrap">
          {MAIN_PATH.map((cat, i) => (
            <div key={cat} className="flex items-start gap-2">
              <div className="rounded-lg px-3 py-2.5 space-y-1.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{JOB_STATUS_CATEGORY_LABELS[cat]}</p>
                <div className="flex flex-col items-start gap-1.5">
                  {inCat(cat).map(s => <StatusPill key={s.id} s={s} />)}
                </div>
              </div>
              {i < MAIN_PATH.length - 1 && <ChevronRight className="w-4 h-4 mt-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
            </div>
          ))}
        </div>

        {/* Branches: Waiting (pause) + Canceled (exit) */}
        <div className="px-5 pb-4 pt-1 space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-16 shrink-0 text-[9px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Paused</span>
            {inCat("waiting").map(s => <StatusPill key={s.id} s={s} />)}
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>— a job can pause here from any active stage, then resume.</span>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-16 shrink-0 text-[9px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Exit</span>
            {inCat("canceled").map(s => <StatusPill key={s.id} s={s} />)}
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>— possible at any point before completion.</span>
          </div>
        </div>

        <div className="px-5 py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Statuses drive the job lifecycle, dispatch board lanes, the technician mobile flow, and billing triggers —
            which is why the set is fixed. Job <span className="font-medium">types</span> stay customizable in Settings → Job Types.
          </p>
        </div>
      </div>

      {/* ── How a job is structured ── */}
      <div className="rounded-xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="px-5 pt-4"><GalleryLabel>How a Job Is Structured</GalleryLabel></div>
        <div className="px-5 py-4 flex items-center gap-2 flex-wrap">
          {[
            { name: "Job", desc: "the container — customer, money, status" },
            { name: "Work Order", desc: "a scope of field work — checklist, parts & labor, signature" },
            { name: "Visit", desc: "a window of time on the board when a tech executes it" },
          ].map((n, i) => (
            <div key={n.name} className="flex items-center gap-2">
              <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{n.name}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{n.desc}</p>
              </div>
              {i < 2 && <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
            </div>
          ))}
        </div>
        <div className="px-5 py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            A job can hold several work orders (return visits, multi-scope installs), and a work order can take several
            visits. Rule of thumb: separately quoted or billed work is a new work order; more time on the same scope is another visit.
          </p>
        </div>
      </div>
    </div>
  );
}
