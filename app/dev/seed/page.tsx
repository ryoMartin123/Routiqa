"use client";

// ─── Dev seed page ────────────────────────────────────────
// Drives the same sample-data generator as the top-bar Sample Data panel, but
// from a URL — so automation (the product-screenshot capture script) can fill a
// fresh browser profile with realistic demo records before taking screenshots.
//
// Usage: /dev/seed?auto=1        → seed localStorage-backed types and report
//        /dev/seed?auto=1&jobs=1 → also seed jobs + work orders. ONLY for
//                                  automation that blocks *.supabase.co (the
//                                  capture script does): the jobs store writes
//                                  through to Supabase, and this page must never
//                                  mutate the shared dev database. With Supabase
//                                  blocked, jobs stay in the local cache only.
//        /dev/seed               → manual button (no jobs)
// Dev-only: renders nothing in production builds.

import { useEffect, useState } from "react";
import { resolveCtx, loadSamples, sampleSummary } from "@/lib/sample-data/manager";
import { getManifest } from "@/lib/sample-data/manifest";
import { getInvoice, updateInvoice } from "@/lib/quotes/data";
import { getJob, updateJob } from "@/lib/jobs/data";
import { getUsers, upsertUser } from "@/lib/users/data";
import type { SampleType } from "@/lib/sample-data/types";

const PLAN: Array<[SampleType, number]> = [
  ["customer", 12],
  ["lead", 9],
  ["project", 4],
  ["quote", 8],
  ["invoice", 8],
  ["agreement", 6],
  ["task", 10],
];

// Extra types when ?jobs=1 (see header comment). Jobs come before work orders
// so the work orders attach to fresh sample jobs instead of creating more.
const JOBS_PLAN: Array<[SampleType, number]> = [
  ["job", 16],
  ["workorder", 6],
  ["invoice", 4],
];

// ─── History enrichment ───────────────────────────────────
// The raw generator dates everything within ±3 weeks, which leaves 12-month
// dashboard charts flat. Backdate a share of the sample records (via the normal
// store update APIs) so revenue/jobs trends show a realistic year of activity.
function stamp(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
// The mobile job buckets match scheduledDate against todayYMD() with a plain
// string compare, so live-day jobs must use the yyyy-mm-dd form.
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// A date `monthsBack` months ago, on a random day of that month.
function backdate(monthsBack: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack, 1 + Math.floor(Math.random() * 26));
  return d;
}
// Month offsets 0..9 weighted toward recent months → a gentle growth curve.
function weightedMonth(): number {
  return Math.floor(10 * Math.pow(Math.random(), 1.7));
}

function enrichHistory(withJobs: boolean): void {
  const manifest = getManifest();

  // ~65% of sample invoices become paid, settled across the past 10 months.
  for (const e of manifest.filter(m => m.type === "invoice")) {
    const inv = getInvoice(e.id);
    if (!inv || Math.random() > 0.65) continue;
    updateInvoice(e.id, { status: "paid", balanceDue: 0, paidAt: stamp(backdate(weightedMonth())) });
  }

  if (!withJobs) return;

  // The dispatch board draws one lane per field technician — make sure a few
  // exist (names match the sample generator's TECHS so historic jobs line up).
  const existing = new Set(getUsers().map(u => u.fullName));
  for (const name of ["Luis Romero", "Priya Shah", "Owen Bauer"]) {
    if (existing.has(name)) continue;
    upsertUser({
      fullName: name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@northstar.example`,
      status: "active",
      assignments: [{ role: "field_technician", level: "location", companyId: "co_hvac", locationId: "loc_augusta" }],
    });
  }

  // Pin 6 jobs to TODAY with spread times — two on the current user (fills the
  // mobile today/jobs views), the rest across the technician lanes.
  const jobIds = manifest.filter(m => m.type === "job").map(m => m.id);
  const times = ["8:00 AM", "9:30 AM", "11:00 AM", "1:00 PM", "2:30 PM", "4:00 PM"];
  const lanes = ["Tucker Hayes", "Luis Romero", "Priya Shah", "Owen Bauer"];
  jobIds.slice(0, 6).forEach((id, i) => {
    const job = getJob(id);
    if (!job) return;
    const tech = i < 2 ? "Ryo Martin" : lanes[(i - 2) % lanes.length];
    updateJob(id, {
      scheduledDate: ymd(new Date()),
      scheduledTime: times[i],
      status: i === 0 ? "completed" : i === 1 ? "in_progress" : "scheduled",
      completedDate: i === 0 ? ymd(new Date()) : job.completedDate,
      assignedTo: tech,
      assignedToInitials: tech.split(" ").map(w => w[0]).join(""),
    });
  });

  // Spread the rest over the past 9 months as completed work with a real ticket.
  const historic = jobIds.slice(6);
  for (const id of historic) {
    const job = getJob(id);
    if (!job) continue;
    const when = backdate(weightedMonth());
    const amount = Number(String(job.estimatedAmount ?? "0").replace(/[^0-9.]/g, "")) || 400;
    updateJob(id, {
      status: "completed",
      scheduledDate: stamp(when),
      completedDate: stamp(when),
      actualAmount: `$${(Math.round(amount * (0.9 + Math.random() * 0.3))).toLocaleString("en-US")}.00`,
    });
  }
}

export default function DevSeedPage() {
  const [status, setStatus] = useState<"idle" | "seeding" | "done" | "skipped">("idle");
  const [total, setTotal] = useState(0);

  function seed(withJobs: boolean) {
    setStatus("seeding");
    const existing = sampleSummary().total;
    if (existing >= 20) {
      // Already populated (idempotence guard for repeated capture runs).
      setTotal(existing);
      setStatus("skipped");
      return;
    }
    const ctx = resolveCtx();
    const plan = withJobs ? [...PLAN, ...JOBS_PLAN] : PLAN;
    let made = 0;
    for (const [type, count] of plan) made += loadSamples(type, count, ctx);
    enrichHistory(withJobs);
    setTotal(made);
    setStatus("done");
  }

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") === "1") seed(params.get("jobs") === "1");
  }, []);

  if (process.env.NODE_ENV !== "development") return null;

  const finished = status === "done" || status === "skipped";
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div
        className="bg-white rounded-xl border border-gray-200 p-8 text-center"
        data-seed-status={status}
        {...(finished ? { "data-seed-complete": "true" } : {})}
      >
        <h1 className="text-lg font-bold text-gray-900">Dev sample-data seeder</h1>
        <p className="text-sm text-gray-500 mt-1">
          {status === "idle" && "Seeds demo customers, leads, quotes, invoices, agreements & tasks into localStorage."}
          {status === "seeding" && "Seeding…"}
          {status === "done" && `Seeded ${total} sample records.`}
          {status === "skipped" && `Already seeded (${total} sample records present).`}
        </p>
        {status === "idle" && (
          <button onClick={() => seed(false)} className="mt-4 px-4 py-2 rounded-lg bg-[#0f8578] text-white text-sm font-medium">
            Seed sample data
          </button>
        )}
      </div>
    </div>
  );
}
