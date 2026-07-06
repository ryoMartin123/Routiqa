// ─── Plan usage metering ──────────────────────────────────
// The variable costs the platform passes through to the account — storage,
// SMS, voice minutes, email sends, AI actions — tracked against the plan's
// included quotas so the office can see what's left BEFORE running out.
//
// Counters live per billing cycle (calendar month) in localStorage; storage is
// derived live from the Photos & Files store on top of a seeded baseline.
// `recordUsage` is the single write path — wire it wherever a metered action
// happens (SMS send, AI reply, call ends) as those modules go live.

import { notifyDataChanged, invalidateOnStorage } from "@/lib/sync/liveData";
import { getFiles } from "@/lib/files/data";

export type UsageMetricKey = "storage" | "sms" | "voice" | "email" | "ai";

export interface UsageMetricDef {
  key: UsageMetricKey;
  label: string;
  description: string;      // what counts toward it
  unit: "gb" | "count" | "minutes";
  unitLabel: string;        // "GB" / "messages" / "minutes" / "emails" / "AI actions"
  overageRate: number;      // $ per unit past the quota
  overageUnit: string;      // "per GB" / "per message" / …
}

export const USAGE_METRICS: UsageMetricDef[] = [
  { key: "storage", label: "File Storage",  description: "Photos, documents, and signatures across all jobs", unit: "gb",      unitLabel: "GB",         overageRate: 0.02,   overageUnit: "per GB" },
  { key: "sms",     label: "Text Messages", description: "Campaigns, review requests, and dispatch notifications", unit: "count",   unitLabel: "messages",   overageRate: 0.015,  overageUnit: "per message" },
  { key: "voice",   label: "Voice Minutes", description: "Inbound and outbound calls through the CRM line",   unit: "minutes", unitLabel: "minutes",    overageRate: 0.018,  overageUnit: "per minute" },
  { key: "email",   label: "Email Sends",   description: "Marketing campaigns and automated sequences",       unit: "count",   unitLabel: "emails",     overageRate: 0.0008, overageUnit: "per email" },
  { key: "ai",      label: "AI Actions",    description: "Inbox reply drafts, auto-pilot, and AI reports",    unit: "count",   unitLabel: "AI actions", overageRate: 0.04,   overageUnit: "per action" },
];

// ─── Plans ────────────────────────────────────────────────
export interface UsagePlan {
  key: string;
  name: string;
  priceMonthly: number;
  quotas: Record<UsageMetricKey, number>;
}

export const PLANS: UsagePlan[] = [
  { key: "starter", name: "Starter", priceMonthly: 89,  quotas: { storage: 25,  sms: 500,   voice: 300,  email: 2500,  ai: 100 } },
  { key: "pro",     name: "Pro",     priceMonthly: 189, quotas: { storage: 100, sms: 2500,  voice: 1000, email: 10000, ai: 500 } },
  { key: "scale",   name: "Scale",   priceMonthly: 389, quotas: { storage: 500, sms: 10000, voice: 4000, email: 50000, ai: 2000 } },
];

const PLAN_KEY = "crm-usage-plan";
export function getCurrentPlan(): UsagePlan {
  let key = "pro";
  try { key = localStorage.getItem(PLAN_KEY) || "pro"; } catch { /* ignore */ }
  return PLANS.find(p => p.key === key) ?? PLANS[1];
}

// ─── Billing cycle (calendar month) ───────────────────────
export interface UsageCycle {
  key: string;          // "2026-07"
  startLabel: string;   // "Jul 1"
  endLabel: string;     // "Jul 31"
  resetLabel: string;   // "Aug 1"
  daysLeft: number;
}

export function currentCycle(now = new Date()): UsageCycle {
  const y = now.getFullYear(), m = now.getMonth();
  const end = new Date(y, m + 1, 0);
  const reset = new Date(y, m + 1, 1);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return {
    key: `${y}-${String(m + 1).padStart(2, "0")}`,
    startLabel: fmt(new Date(y, m, 1)),
    endLabel: fmt(end),
    resetLabel: fmt(reset),
    daysLeft: Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000)),
  };
}

// ─── Counters ─────────────────────────────────────────────
// { [cycleKey]: { sms: 2286, voice: 412, … } } — storage isn't counted here
// (derived from the files store); everything else increments via recordUsage.
type CycleCounters = Partial<Record<UsageMetricKey, number>>;
const STORE_KEY = "crm-usage-cycles";
let _cycles: Record<string, CycleCounters> | null = null;

function store(): Record<string, CycleCounters> {
  if (_cycles) return _cycles;
  if (typeof window === "undefined") return {};
  try { _cycles = JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch { _cycles = {}; }
  return _cycles!;
}
function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(_cycles ?? {})); } catch { /* ignore */ } }
invalidateOnStorage([STORE_KEY], () => { _cycles = null; });

// Demo seed for a cycle that has no counters yet — mid-cycle numbers so the
// section reads real. SMS is intentionally near its quota to exercise the
// warning treatment.
function seedFor(plan: UsagePlan): CycleCounters {
  return {
    sms:   Math.round(plan.quotas.sms   * 0.91),
    voice: Math.round(plan.quotas.voice * 0.41),
    email: Math.round(plan.quotas.email * 0.61),
    ai:    Math.round(plan.quotas.ai    * 0.68),
  };
}

function countersFor(cycleKey: string): CycleCounters {
  const s = store();
  if (!s[cycleKey]) {
    s[cycleKey] = seedFor(getCurrentPlan());
    persist();
  }
  return s[cycleKey];
}

// The single write path for metered actions — call it where the action happens
// (an SMS goes out, an AI draft is generated, a call completes).
export function recordUsage(metric: Exclude<UsageMetricKey, "storage">, amount = 1): void {
  const key = currentCycle().key;
  const c = countersFor(key);
  _cycles = { ...store(), [key]: { ...c, [metric]: (c[metric] ?? 0) + amount } };
  persist();
  notifyDataChanged();
}

// Storage: seeded baseline + a per-file estimate from the real files store, so
// uploading photos in the app visibly moves the meter.
const STORAGE_BASE_GB = 54.6;
const AVG_FILE_MB = 4.2;
function storageUsedGb(): number {
  const files = typeof window === "undefined" ? [] : getFiles({});
  return Math.round((STORAGE_BASE_GB + (files.length * AVG_FILE_MB) / 1024) * 10) / 10;
}

// ─── Summary (what the UI renders) ────────────────────────
export interface MetricUsage {
  def: UsageMetricDef;
  used: number;
  quota: number;
  pct: number;            // 0–100+, uncapped
  over: number;           // units past quota (0 when within)
  overageCost: number;    // $ this cycle for this metric
}

export interface UsageSummary {
  plan: UsagePlan;
  cycle: UsageCycle;
  metrics: MetricUsage[];
  totalOverage: number;
}

export function getUsageSummary(): UsageSummary {
  const plan = getCurrentPlan();
  const cycle = currentCycle();
  const counters = countersFor(cycle.key);
  const metrics = USAGE_METRICS.map(def => {
    const used = def.key === "storage" ? storageUsedGb() : (counters[def.key] ?? 0);
    const quota = plan.quotas[def.key];
    const over = Math.max(0, used - quota);
    return {
      def, used, quota,
      pct: quota > 0 ? Math.round((used / quota) * 1000) / 10 : 0,
      over,
      overageCost: Math.round(over * def.overageRate * 100) / 100,
    };
  });
  return { plan, cycle, metrics, totalOverage: Math.round(metrics.reduce((s, m) => s + m.overageCost, 0) * 100) / 100 };
}

// Display formatting per unit — "62.4 GB", "2,286", "412 min".
export function fmtUsage(value: number, unit: UsageMetricDef["unit"]): string {
  if (unit === "gb") return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} GB`;
  if (unit === "minutes") return `${Math.round(value).toLocaleString("en-US")} min`;
  return Math.round(value).toLocaleString("en-US");
}
