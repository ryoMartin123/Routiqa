// ─── Sample data — type registry ─────────────────────────
// Defines the entity types the sample-data loader can generate, their display
// metadata, and the order they must be deleted in (children before parents) so a
// cascade never leaves an impossible state (e.g. a work order without its job).

export type SampleType =
  | "customer" | "lead" | "project" | "job" | "workorder"
  | "quote" | "invoice" | "agreement" | "task";

// One generated record, remembered so we can find + remove it later WITHOUT
// tagging the record itself (the records stay indistinguishable from real ones).
export interface SampleEntry {
  key:       string;        // unique manifest key
  type:      SampleType;
  id:        string;        // the entity's id in its store (cascade + delete target)
  parentIds: string[];      // entity ids this record depends on (for cascade)
  ref?:      string;        // secondary delete key when id isn't the store key (work order → jobId)
}

export interface SampleTypeMeta {
  type:        SampleType;
  label:       string;      // "Customers"
  noun:        string;      // "customer"
  rank:        number;      // delete order — lower is deleted first (more child-like)
  description: string;
  // Types this one needs to exist first (auto-created if missing when generating).
  requires?:   SampleType;
}

// Ordered for display (parents first). `rank` drives deletion order separately.
export const SAMPLE_TYPES: SampleTypeMeta[] = [
  { type: "customer",  label: "Customers",   noun: "customer",   rank: 9, description: "Residential & commercial accounts" },
  { type: "lead",      label: "Leads",       noun: "lead",       rank: 8, description: "Sales-pipeline prospects" },
  { type: "project",   label: "Projects",    noun: "project",    rank: 7, description: "Multi-job projects on a customer", requires: "customer" },
  { type: "job",       label: "Jobs",        noun: "job",        rank: 5, description: "Scheduled & unscheduled jobs",      requires: "customer" },
  { type: "workorder", label: "Work Orders", noun: "work order", rank: 0, description: "Field checklist tied to a job",     requires: "job" },
  { type: "quote",     label: "Quotes",      noun: "quote",      rank: 3, description: "Estimates with line items",         requires: "customer" },
  { type: "invoice",   label: "Invoices",    noun: "invoice",    rank: 0, description: "Bills with line items",             requires: "customer" },
  { type: "agreement", label: "Agreements",  noun: "agreement",  rank: 3, description: "Recurring maintenance plans",       requires: "customer" },
  { type: "task",      label: "Tasks",       noun: "task",       rank: 1, description: "Follow-ups & reminders",            requires: "customer" },
];

export function metaFor(type: SampleType): SampleTypeMeta {
  return SAMPLE_TYPES.find(t => t.type === type)!;
}
