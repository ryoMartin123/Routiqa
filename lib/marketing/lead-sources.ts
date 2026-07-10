// ─── Lead sources ─────────────────────────────────────────
// Where leads come from and what each source actually produces. The SOURCE
// LIST is managed (name, category, spend, which lead-source key it counts);
// the METRICS are never stored — leads, booked (won) and revenue are computed
// live from real Lead records on every read, so the table can't drift from
// the truth. Spend is entered manually until ad integrations pull it.

import { getAllLeads, LEAD_SOURCE_LABELS, type LeadSource as LeadKey } from "@/lib/leads/data";

export type SourceCategory = "digital" | "referral" | "offline" | "repeat";

// Stored shape — configuration only, no metrics.
interface StoredSource {
  id: string;
  name: string;
  category: SourceCategory;
  active: boolean;
  cost: number;          // monthly marketing spend, user-entered (0 = organic)
  leadKey?: LeadKey;     // which lead-record `source` this attributes
}

// Read shape — configuration + LIVE metrics.
export interface LeadSource extends StoredSource {
  leads: number;         // real leads with this source key
  bookedJobs: number;    // of those, stage === "won"
  revenue: number;       // sum of won leads' estimated value
}

export const CATEGORY_META: Record<SourceCategory, { label: string; color: string }> = {
  digital:  { label: "Digital",  color: "#2563eb" },
  referral: { label: "Referral", color: "#16a34a" },
  offline:  { label: "Offline",  color: "#f59e0b" },
  repeat:   { label: "Repeat",   color: "#a855f7" },
};

// Options for "counts leads from" in the editor.
export const LEAD_KEY_OPTIONS: { value: LeadKey; label: string }[] =
  (Object.keys(LEAD_SOURCE_LABELS) as LeadKey[]).map(k => ({ value: k, label: LEAD_SOURCE_LABELS[k] }));

const KEY = "routiqa-marketing-lead-sources";

function seed(): StoredSource[] {
  return [
    { id: "ls-gads", name: "Google Ads",              category: "digital",  active: true, cost: 9200, leadKey: "google_ads" },
    { id: "ls-lsa",  name: "Google LSA",              category: "digital",  active: true, cost: 6100, leadKey: "google_lsa" },
    { id: "ls-gbp",  name: "Google Business Profile", category: "digital",  active: true, cost: 0 },
    { id: "ls-web",  name: "Website",                 category: "digital",  active: true, cost: 0,    leadKey: "website" },
    { id: "ls-ref",  name: "Customer referral",       category: "referral", active: true, cost: 0,    leadKey: "referral" },
    { id: "ls-soc",  name: "Social Media",            category: "digital",  active: true, cost: 3400, leadKey: "social" },
    { id: "ls-ph",   name: "Phone",                   category: "offline",  active: true, cost: 0,    leadKey: "phone" },
    { id: "ls-dk",   name: "Door Knock",              category: "offline",  active: true, cost: 0,    leadKey: "door_knock" },
    { id: "ls-rep",  name: "Repeat customer",         category: "repeat",   active: true, cost: 0,    leadKey: "repeat" },
  ];
}

// Legacy stored rows (pre-rework) carried fake metric numbers — strip them and
// recover a leadKey by name where possible.
const NAME_TO_KEY: Record<string, LeadKey> = {
  "google ads": "google_ads", "google lsa": "google_lsa", "website": "website", "website form": "website",
  "customer referral": "referral", "referral": "referral", "facebook": "social", "social media": "social",
  "phone": "phone", "door knock": "door_knock", "repeat customer": "repeat",
};
let cache: StoredSource[] | null = null;
function load(): StoredSource[] {
  if (cache) return cache;
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { cache = seed(); return cache; }
    const parsed = JSON.parse(raw) as (StoredSource & { leads?: number })[];
    cache = parsed.map(s => ({
      id: s.id, name: s.name, category: s.category, active: s.active, cost: s.cost ?? 0,
      leadKey: s.leadKey ?? NAME_TO_KEY[s.name.trim().toLowerCase()],
    }));
  } catch { cache = seed(); }
  return cache!;
}
function persist() { if (typeof window !== "undefined") try { localStorage.setItem(KEY, JSON.stringify(cache ?? [])); } catch { /* quota */ } }

// ── Live attribution from real leads ──
const parseMoney = (v?: string): number => { const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, "")); return isNaN(n) ? 0 : n; };
// A lead filed under a managed source (sourceId) belongs to that source only;
// leads without one (legacy / imported) fall back to the lead-source key.
function belongsTo(l: { source: LeadKey; sourceId?: string }, s: StoredSource): boolean {
  return l.sourceId ? l.sourceId === s.id : Boolean(s.leadKey && l.source === s.leadKey);
}
function metricsFor(s: StoredSource): { leads: number; bookedJobs: number; revenue: number } {
  const mine = getAllLeads().filter(l => belongsTo(l, s));
  const won = mine.filter(l => l.stage === "won");
  return { leads: mine.length, bookedJobs: won.length, revenue: won.reduce((sum, l) => sum + parseMoney(l.estimatedValue), 0) };
}

export function getLeadSources(): LeadSource[] {
  return load().map(s => ({ ...s, ...metricsFor(s) }));
}

// ── Lead-form bridge ──
// The new/edit lead forms pick from the managed source list (plus a bare
// "Other"), so custom sources like "Trade show" are selectable and attribute.

// Options for the lead forms' Source dropdown: active managed sources by id.
export function leadSourceOptions(): { value: string; label: string }[] {
  return [...load().filter(s => s.active).map(s => ({ value: s.id, label: s.name })), { value: "other", label: "Other" }];
}
// What to stamp on the lead for a dropdown selection.
export function leadFieldsFor(selection: string): { source: LeadKey; sourceId?: string } {
  const s = load().find(x => x.id === selection);
  return s ? { source: s.leadKey ?? "other", sourceId: s.id } : { source: "other" };
}
// Reverse mapping for pre-selecting the dropdown from an existing lead.
export function sourceSelectionFor(lead: { source: LeadKey; sourceId?: string }): string {
  const list = load();
  if (lead.sourceId && list.some(s => s.id === lead.sourceId)) return lead.sourceId;
  return list.find(s => s.leadKey === lead.source)?.id ?? "other";
}
// Display name for a lead's source — managed name when filed under one.
export function leadSourceLabel(lead: { source: LeadKey; sourceId?: string }): string {
  if (lead.sourceId) { const s = load().find(x => x.id === lead.sourceId); if (s) return s.name; }
  return LEAD_SOURCE_LABELS[lead.source];
}

export function addLeadSource(name: string, category: SourceCategory, opts?: { cost?: number; leadKey?: LeadKey }): void {
  cache = [{ id: `ls-${Date.now().toString(36)}`, name: name.trim(), category, active: true, cost: opts?.cost ?? 0, leadKey: opts?.leadKey }, ...load()];
  persist();
}
export function updateLeadSource(id: string, patch: Partial<Omit<StoredSource, "id">>): void {
  cache = load().map(s => (s.id === id ? { ...s, ...patch, id: s.id } : s));
  persist();
}
export function toggleLeadSource(id: string) { cache = load().map(s => s.id === id ? { ...s, active: !s.active } : s); persist(); }
export function deleteLeadSource(id: string) { cache = load().filter(s => s.id !== id); persist(); }

// ── Derived metrics ──
export const conversion = (s: LeadSource) => (s.leads ? s.bookedJobs / s.leads : 0);
export const cpl = (s: LeadSource) => (s.leads && s.cost ? s.cost / s.leads : 0);
export const roi = (s: LeadSource) => (s.cost ? (s.revenue - s.cost) / s.cost : null); // null = organic (no spend)
export const revenuePerLead = (s: LeadSource) => (s.leads ? s.revenue / s.leads : 0);

export interface SourceTotals { leads: number; bookedJobs: number; revenue: number; cost: number; conversion: number; cpl: number; roi: number }
export function totals(list: LeadSource[]): SourceTotals {
  const leads = list.reduce((a, s) => a + s.leads, 0);
  const bookedJobs = list.reduce((a, s) => a + s.bookedJobs, 0);
  const revenue = list.reduce((a, s) => a + s.revenue, 0);
  const cost = list.reduce((a, s) => a + s.cost, 0);
  return {
    leads, bookedJobs, revenue, cost,
    conversion: leads ? bookedJobs / leads : 0,
    cpl: leads && cost ? cost / leads : 0,
    roi: cost ? (revenue - cost) / cost : 0,
  };
}
