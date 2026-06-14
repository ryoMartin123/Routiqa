// Structured config for "Custom" visit schedules and billing rules in the
// Agreement Builder. When a visit's frequency (or a billing rule's frequency)
// is set to "custom", the builder shows a guided rule builder that writes one
// of these configs. Rules are stored as structured JSON on the draft / snapshot
// — never free text — and the UI/preview derive plain-English summaries from them.
//
// Mock/local only: no auto-invoicing, payment collection, or Supabase here.

// ─── Custom Visit Schedule ────────────────────────────────
export type CustomVisitRuleType =
  | "fixed_per_year"       // N visits/year, optional named seasonal windows
  | "every_x"              // repeat every X days / weeks / months
  | "specific_months"      // visits in specific months
  | "specific_dates"       // visits on fixed calendar dates each term
  | "on_demand_allowance"; // up to N on-demand visits/year (booked on request)

export type IntervalUnit = "days" | "weeks" | "months";

// A named seasonal window, e.g. "Spring Cooling Tune-Up" spanning Mar–May.
export interface CustomVisitWindow {
  id: string;
  label: string;
  startMonth: number;   // 1–12
  endMonth: number;     // 1–12
}

export interface CustomVisitConfig {
  ruleType: CustomVisitRuleType;
  visitsPerYear?: number;          // fixed_per_year, on_demand_allowance
  windows?: CustomVisitWindow[];   // fixed_per_year (optional seasonal windows)
  intervalCount?: number;          // every_x
  intervalUnit?: IntervalUnit;     // every_x
  months?: number[];               // specific_months (1–12)
  dates?: string[];                // specific_dates (yyyy-mm-dd)
}

// ─── Custom Billing ───────────────────────────────────────
export type CustomBillingRuleType =
  | "fixed_recurring"   // fixed recurring amount (e.g. $99/month)
  | "payment_schedule"  // custom payment schedule (amounts + due dates)
  | "deposit_recurring" // deposit + recurring payments
  | "per_visit"         // amount after each completed visit
  | "milestone";        // amounts tied to named milestones

// One line of a payment schedule or milestone plan. `dueDate` for scheduled
// payments; `label` carries the milestone/occasion name (e.g. "At signing").
export interface CustomBillingItem {
  id: string;
  label: string;
  amount: number;
  dueDate?: string;     // yyyy-mm-dd (payment_schedule)
}

export interface CustomBillingConfig {
  ruleType: CustomBillingRuleType;
  amount?: number;                 // fixed_recurring / deposit_recurring (recurring) / per_visit
  recurringFrequencyKey?: string;  // "monthly" | "quarterly" | "semi_annual" | "annual"
  startDate?: string;              // billing start (fixed_recurring, deposit_recurring)
  deposit?: number;                // deposit_recurring
  items?: CustomBillingItem[];     // payment_schedule, milestone
}

// ─── Rule-type metadata (the radio cards) ─────────────────
export const CUSTOM_VISIT_RULE_TYPES: { type: CustomVisitRuleType; title: string; desc: string }[] = [
  { type: "fixed_per_year",      title: "Fixed visits per year",  desc: "e.g. 3 visits/year with seasonal windows" },
  { type: "every_x",             title: "Repeat every…",          desc: "e.g. every 6 weeks" },
  { type: "specific_months",     title: "Specific months",        desc: "e.g. March, June, September" },
  { type: "specific_dates",      title: "Specific dates",         desc: "Fixed calendar dates each term" },
  { type: "on_demand_allowance", title: "On-demand allowance",    desc: "e.g. up to 8 visits/year on request" },
];

export const CUSTOM_BILLING_RULE_TYPES: { type: CustomBillingRuleType; title: string; desc: string }[] = [
  { type: "fixed_recurring",   title: "Fixed recurring amount", desc: "e.g. $99/month" },
  { type: "payment_schedule",  title: "Custom payment schedule", desc: "Set amounts + due dates" },
  { type: "deposit_recurring", title: "Deposit + recurring",    desc: "e.g. $250 deposit + $99/month" },
  { type: "per_visit",         title: "Per completed visit",    desc: "e.g. $150 after each visit" },
  { type: "milestone",         title: "Milestone billing",      desc: "Amounts tied to milestones" },
];

export const RECURRING_FREQ_OPTIONS = [
  { value: "monthly",     label: "Monthly" },
  { value: "quarterly",   label: "Quarterly" },
  { value: "semi_annual", label: "Semi-annual" },
  { value: "annual",      label: "Annual" },
];

export const INTERVAL_UNIT_OPTIONS: { value: IntervalUnit; label: string }[] = [
  { value: "days",   label: "Days" },
  { value: "weeks",  label: "Weeks" },
  { value: "months", label: "Months" },
];

export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── Factories ────────────────────────────────────────────
let _seq = 0;
const cid = (p: string) => `${p}-${Date.now()}-${_seq++}`;
export const newVisitWindow = (label = "", startMonth = 1, endMonth = 3): CustomVisitWindow => ({ id: cid("vw"), label, startMonth, endMonth });
export const newBillingItem = (label = "", amount = 0, dueDate?: string): CustomBillingItem => ({ id: cid("bi"), label, amount, dueDate });

export function defaultCustomVisit(ruleType: CustomVisitRuleType): CustomVisitConfig {
  switch (ruleType) {
    case "fixed_per_year":      return { ruleType, visitsPerYear: 3, windows: [] };
    case "every_x":             return { ruleType, intervalCount: 6, intervalUnit: "weeks" };
    case "specific_months":     return { ruleType, months: [] };
    case "specific_dates":      return { ruleType, dates: [] };
    case "on_demand_allowance": return { ruleType, visitsPerYear: 8 };
  }
}

export function defaultCustomBilling(ruleType: CustomBillingRuleType): CustomBillingConfig {
  switch (ruleType) {
    case "fixed_recurring":   return { ruleType, amount: 99, recurringFrequencyKey: "monthly" };
    case "payment_schedule":  return { ruleType, items: [newBillingItem("At signing", 0)] };
    case "deposit_recurring": return { ruleType, deposit: 250, amount: 99, recurringFrequencyKey: "monthly" };
    case "per_visit":         return { ruleType, amount: 150 };
    case "milestone":         return { ruleType, items: [newBillingItem("Milestone 1", 0)] };
  }
}

// ─── Derived values ───────────────────────────────────────
const PERIODS_BY_FREQ: Record<string, number> = { monthly: 12, quarterly: 4, semi_annual: 2, annual: 1 };

// Effective visits/year a custom schedule produces (drives the generated plan).
export function customVisitsPerYear(c?: CustomVisitConfig): number {
  if (!c) return 0;
  switch (c.ruleType) {
    case "fixed_per_year":      return c.visitsPerYear ?? c.windows?.length ?? 0;
    case "every_x": {
      const n = c.intervalCount || 1;
      const days = c.intervalUnit === "days" ? n : c.intervalUnit === "months" ? n * 30 : n * 7;
      return Math.max(1, Math.round(365 / days));
    }
    case "specific_months":     return c.months?.length ?? 0;
    case "specific_dates":      return c.dates?.length ?? 0;
    case "on_demand_allowance": return 0; // booked on request, not pre-generated
  }
}

// Estimated first-year value of a custom billing rule.
export function customBillingAnnualValue(c?: CustomBillingConfig, visitsPerYear = 0): number {
  if (!c) return 0;
  switch (c.ruleType) {
    case "fixed_recurring":
    case "deposit_recurring": return Math.round((c.amount || 0) * (PERIODS_BY_FREQ[c.recurringFrequencyKey || "monthly"] ?? 1));
    case "per_visit":         return Math.round((c.amount || 0) * (visitsPerYear || 1));
    case "payment_schedule":
    case "milestone":         return Math.round((c.items || []).reduce((s, i) => s + (i.amount || 0), 0));
  }
}

// A single representative amount for list/preview rows.
export function representativeBillingAmount(c?: CustomBillingConfig): number {
  if (!c) return 0;
  switch (c.ruleType) {
    case "fixed_recurring":
    case "deposit_recurring":
    case "per_visit":         return c.amount || 0;
    case "payment_schedule":
    case "milestone":         return (c.items || []).reduce((s, i) => s + (i.amount || 0), 0);
  }
}

// ─── Plain-English summaries ──────────────────────────────
const money = (n: number) => `$${(n || 0).toLocaleString()}`;
const fmtDate = (s?: string): string => {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const unitLabel = (n: number, u?: IntervalUnit): string => {
  const base = u === "days" ? "day" : u === "months" ? "month" : "week";
  return `${n} ${base}${n === 1 ? "" : "s"}`;
};
const freqWord = (k?: string): string => k === "quarterly" ? "quarter" : k === "semi_annual" ? "6 months" : k === "annual" ? "year" : "month";

export function summarizeCustomVisit(c?: CustomVisitConfig): string {
  if (!c) return "Choose a rule type to get started.";
  switch (c.ruleType) {
    case "fixed_per_year": {
      const n = c.visitsPerYear ?? c.windows?.length ?? 0;
      if (c.windows?.length) {
        const w = c.windows.map(x => `${x.label || "Visit"} (${MONTH_LABELS[(x.startMonth || 1) - 1]}–${MONTH_LABELS[(x.endMonth || 1) - 1]})`).join(", ");
        return `${n} visits/year: ${w}.`;
      }
      return `${n} visit${n === 1 ? "" : "s"}/year.`;
    }
    case "every_x":         return `Every ${unitLabel(c.intervalCount || 1, c.intervalUnit)}.`;
    case "specific_months": return c.months?.length ? `Visits in ${c.months.slice().sort((a, b) => a - b).map(m => MONTH_LABELS[m - 1]).join(", ")}.` : "No months selected yet.";
    case "specific_dates":  return c.dates?.length ? `Visits on ${c.dates.filter(Boolean).map(fmtDate).join(", ")}.` : "No dates added yet.";
    case "on_demand_allowance": { const n = c.visitsPerYear ?? 0; return `Up to ${n} on-demand visit${n === 1 ? "" : "s"}/year, booked on request.`; }
  }
}

export function summarizeCustomBilling(c?: CustomBillingConfig): string {
  if (!c) return "Choose a rule type to get started.";
  switch (c.ruleType) {
    case "fixed_recurring":   return `${money(c.amount || 0)}/${freqWord(c.recurringFrequencyKey)}${c.startDate ? ` starting ${fmtDate(c.startDate)}` : ""}.`;
    case "deposit_recurring": return `${money(c.deposit || 0)} deposit + ${money(c.amount || 0)}/${freqWord(c.recurringFrequencyKey)}.`;
    case "per_visit":         return `${money(c.amount || 0)} after each completed visit.`;
    case "payment_schedule":
    case "milestone": {
      const items = c.items || [];
      if (!items.length) return "No payments added yet.";
      return items.map(i => i.dueDate ? `${money(i.amount)} due ${fmtDate(i.dueDate)}` : `${money(i.amount)}${i.label ? ` ${i.label}` : ""}`).join(", ") + ".";
    }
  }
}
