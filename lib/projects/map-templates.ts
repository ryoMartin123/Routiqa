// ─── Project Map templates (per project type) ─────────────
// A project's map is instantiated from a template: an ordered set of nodes with
// dependencies. Each node is either MANUAL (checked off on the map) or MIRRORED
// (reflects a real record in another module — Job, PO, Material Request, etc.).
// Mirrored creatable nodes can spawn + link their record from the map.
// Ownership: the map LINKS records owned by CRM / Inventory / Documents /
// Accounting — it never owns them.

import { resolveScoped, writeScoped, clearScoped, type ScopeIds } from "@/lib/settings-scope/store";
import type { MapNodeType } from "./map";
import type { ProjectType } from "./data";
// Reuse the work-order checklist's item types so a map-step checklist is just
// as rich (dropdown, multi-select, number, photo, …). work-order-templates is a
// leaf module — no import cycle.
export type { ChecklistItemType } from "@/lib/work-order-templates/data";
import type { ChecklistItemType } from "@/lib/work-order-templates/data";

// Which real record a mirrored node reflects (and can create).
export type MirrorSource =
  | "quote" | "job" | "work_order" | "material_request"
  | "purchase_order" | "equipment_received" | "subcontractor" | "invoice";

export interface TemplateNode {
  key: string;
  title: string;
  type: MapNodeType;
  group: string;
  assignedTo?: string;
  manual?: boolean;            // true = checkbox; otherwise mirrored
  mirror?: MirrorSource;       // record reflected (and created) by this node
  milestone?: string;          // which record event completes the step (default = the record's "done")
  sameRecordAs?: string;       // node key: watch the SAME record as that (earlier) step
  createable?: boolean;        // show "Create" when no record is linked yet
  deps: string[];             // dependency node keys
  gate?: string;              // reason shown when blocked by an unmet dependency
  notes?: string;
  percent?: number;           // billing nodes: % of the project contract this invoice bills
  deposit?: boolean;          // billing nodes: tag the invoice as a deposit
  // ── Optional node metadata ──
  // Every node does one of three real jobs: WATCH a record (mirror), GATE the
  // steps after it (deps + gate), or ACT when reached (billing percent creates
  // an invoice). durationDays / checklist are honest planning metadata.
  durationDays?: number;            // planning estimate in business days (not enforced)
  checklist?: NodeChecklistItem[];  // sub-items for a manual node
}

// ─── Node capabilities ────────────────────────────────────
// A checklist-step item. `type` undefined = a simple check-off; otherwise it's
// a typed field the user fills in (same set as the work-order checklist).
export interface NodeChecklistItem {
  id: string;
  label: string;
  required?: boolean;
  type?: ChecklistItemType;
  options?: string[];   // dropdown / multi_select choices
  unit?: string;        // number unit, e.g. "PSI"
}

export function newChecklistItemId(): string { return `cl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`; }

// ─── Mirror milestones ────────────────────────────────────
// Which event on the watched record completes the step. Every source exposes
// its meaningful checkpoints; a node picks one (unset = the record's "done",
// which matches the old hardcoded behavior). Two steps can watch the same
// record at different milestones via `sameRecordAs` — that's how "Quote sent"
// and "Quote approved" become two steps on one quote.
export interface MirrorMilestone { value: string; label: string; caption: string }
export const MIRROR_MILESTONES: Record<MirrorSource, MirrorMilestone[]> = {
  quote: [
    { value: "sent",     label: "Sent",     caption: "the quote is sent to the customer" },
    { value: "approved", label: "Approved", caption: "the quote is approved" },
  ],
  job: [
    { value: "scheduled", label: "Scheduled", caption: "the job is on the calendar" },
    { value: "completed", label: "Completed", caption: "the job is finished" },
  ],
  work_order: [
    { value: "completed", label: "Checklist complete", caption: "every required checklist item is done" },
  ],
  material_request: [
    { value: "ordered",   label: "Ordered",   caption: "the requested materials are ordered" },
    { value: "fulfilled", label: "Fulfilled", caption: "the material request is fulfilled" },
  ],
  purchase_order: [
    { value: "ordered",          label: "Ordered",            caption: "the purchase order is placed" },
    { value: "received_partial", label: "Partially received", caption: "at least part of the order has arrived" },
    { value: "received_full",    label: "Fully received",     caption: "every line is received in full" },
  ],
  // Legacy project-wide source — new maps use purchase_order → Fully received.
  equipment_received: [
    { value: "received_full", label: "Fully received", caption: "a purchase order is fully received" },
  ],
  subcontractor: [
    { value: "compliant", label: "Compliant",     caption: "COI / W-9 compliance is valid" },
    { value: "completed", label: "Work complete", caption: "the assignment is finished" },
  ],
  invoice: [
    { value: "created", label: "Created", caption: "the invoice exists" },
    { value: "sent",    label: "Sent",    caption: "the invoice is sent" },
    { value: "paid",    label: "Paid",    caption: "the invoice is paid in full" },
  ],
};
// Behavior-preserving defaults — an unset milestone means what mirrors always meant.
const DEFAULT_MILESTONE: Record<MirrorSource, string> = {
  quote: "approved", job: "completed", work_order: "completed",
  material_request: "fulfilled", purchase_order: "ordered",
  equipment_received: "received_full", subcontractor: "completed", invoice: "sent",
};
export function mirrorMilestone(src: MirrorSource, milestone?: string): MirrorMilestone {
  const list = MIRROR_MILESTONES[src];
  return list.find(m => m.value === milestone)
    ?? list.find(m => m.value === DEFAULT_MILESTONE[src])
    ?? list[list.length - 1];
}

export interface MapTemplate {
  id: string;
  name: string;
  projectTypes: ProjectType[];   // which project types use this template
  groups: string[];
  nodes: TemplateNode[];
}

// ─── HVAC equipment replacement / install (the flagship workflow) ──
const HVAC_REPLACEMENT: MapTemplate = {
  id: "tpl-hvac-replacement",
  name: "HVAC Equipment Replacement",
  projectTypes: ["installation", "replacement"],
  groups: ["Planning", "Materials", "Scheduling", "Install", "Closeout"],
  nodes: [
    { key: "created",  title: "Project Created",         type: "milestone",        group: "Planning",   assignedTo: "Ryo Martin",    manual: true, deps: [] },
    { key: "site",     title: "Site Visit Completed",    type: "job",              group: "Planning",   assignedTo: "Tucker Hayes",  mirror: "job", createable: true, deps: ["created"] },
    { key: "quote",    title: "Quote Approved",          type: "milestone",        group: "Planning",   assignedTo: "Ryo Martin",    mirror: "quote", createable: true, deps: ["site"] },
    { key: "matreq",   title: "Material Request Created", type: "material_request", group: "Materials",  assignedTo: "Kylie Brooks",  mirror: "material_request", createable: true, deps: ["quote"] },
    { key: "po",       title: "Purchase Order Created",  type: "purchase_order",   group: "Materials",  assignedTo: "Kylie Brooks",  mirror: "purchase_order", createable: true, deps: ["matreq"] },
    { key: "received", title: "Equipment Received",      type: "milestone",        group: "Materials",  assignedTo: "Tucker Hayes",  mirror: "purchase_order", milestone: "received_full", sameRecordAs: "po", deps: ["po"], gate: "Equipment not received", notes: "Install can't start until equipment is received." },
    { key: "schedule", title: "Install Job Scheduled",   type: "job",              group: "Scheduling", assignedTo: "Kylie Brooks",  mirror: "job", milestone: "scheduled", createable: true, deps: ["received"], gate: "Equipment not received" },
    { key: "install",  title: "Install Work Order",      type: "work_order",       group: "Install",    assignedTo: "DeAndre Smith", mirror: "work_order", deps: ["schedule"] },
    { key: "startup",  title: "Startup Checklist",       type: "task",             group: "Install",    assignedTo: "DeAndre Smith", manual: true, deps: ["install"], notes: "Inspection can't be scheduled until startup is complete." },
    { key: "photos",   title: "Final Photos Uploaded",   type: "document",         group: "Closeout",   assignedTo: "DeAndre Smith", manual: true, deps: ["install"], gate: "Final photos required", notes: "Closeout needs final photos." },
    // Staged billing: deposit on approval → progress at install → balance at closeout.
    { key: "dep_inv",  title: "Deposit Invoice",         type: "billing",          group: "Materials",  assignedTo: "Nicole Adams",  deps: ["quote"], percent: 20, deposit: true, notes: "Collect before ordering equipment." },
    { key: "prog_inv", title: "Progress Invoice",        type: "billing",          group: "Install",    assignedTo: "Nicole Adams",  deps: ["install"], percent: 40, gate: "Install work order must be complete" },
    { key: "invoice",  title: "Final Invoice",           type: "billing",          group: "Closeout",   assignedTo: "Nicole Adams",  deps: ["startup", "photos"], percent: 40 },
    { key: "closed",   title: "Project Closed",          type: "milestone",        group: "Closeout",   assignedTo: "Ryo Martin",    manual: true, deps: ["invoice", "photos"] },
  ],
};

// ─── Commercial RTU replacement (adds a crane subcontractor step) ──
const COMMERCIAL_RTU: MapTemplate = {
  id: "tpl-commercial-rtu",
  name: "Commercial RTU Replacement",
  projectTypes: ["multi_phase"],
  groups: ["Planning", "Materials", "Subcontractors", "Install", "Closeout"],
  nodes: [
    { key: "created",  title: "Project Created",        type: "milestone",        group: "Planning",       assignedTo: "Ryo Martin",   manual: true, deps: [] },
    { key: "quote",    title: "Quote Approved",         type: "milestone",        group: "Planning",       assignedTo: "Ryo Martin",   mirror: "quote", createable: true, deps: ["created"] },
    { key: "matreq",   title: "Material Request",       type: "material_request", group: "Materials",      assignedTo: "Kylie Brooks", mirror: "material_request", createable: true, deps: ["quote"] },
    { key: "po",       title: "Purchase Order",         type: "purchase_order",   group: "Materials",      assignedTo: "Kylie Brooks", mirror: "purchase_order", createable: true, deps: ["matreq"] },
    { key: "received", title: "Equipment Received",     type: "milestone",        group: "Materials",      assignedTo: "Tucker Hayes", mirror: "purchase_order", milestone: "received_full", sameRecordAs: "po", deps: ["po"], gate: "Equipment not received" },
    { key: "crane",    title: "Crane Subcontractor",    type: "subcontractor",    group: "Subcontractors", assignedTo: "Kylie Brooks", mirror: "subcontractor", createable: true, deps: ["received"], gate: "Subcontractor COI must be valid", notes: "Crane phase can't start until the COI is valid." },
    { key: "install",  title: "Install Work Order",     type: "work_order",       group: "Install",        assignedTo: "DeAndre Smith", mirror: "work_order", deps: ["crane"] },
    { key: "photos",   title: "Final Photos",           type: "document",         group: "Closeout",       assignedTo: "DeAndre Smith", manual: true, deps: ["install"], gate: "Final photos required" },
    { key: "invoice",  title: "Invoice Sent",           type: "billing",          group: "Closeout",       assignedTo: "Nicole Adams",  mirror: "invoice", createable: true, deps: ["install"], gate: "Install work order must be complete" },
    { key: "closed",   title: "Project Closed",         type: "milestone",        group: "Closeout",       assignedTo: "Ryo Martin",    manual: true, deps: ["invoice", "photos"] },
  ],
};

// ─── Generic fallback for any other project type ──────────
const GENERIC: MapTemplate = {
  id: "tpl-generic",
  name: "General Project",
  projectTypes: ["restoration", "renovation", "other"],
  groups: ["Planning", "Work", "Closeout"],
  nodes: [
    { key: "created",  title: "Project Created",   type: "milestone", group: "Planning", assignedTo: "Ryo Martin",   manual: true, deps: [] },
    { key: "quote",    title: "Quote Approved",    type: "milestone", group: "Planning", assignedTo: "Ryo Martin",   mirror: "quote", createable: true, deps: ["created"] },
    { key: "scheduled",title: "Work Scheduled",    type: "job",       group: "Work",     assignedTo: "Kylie Brooks", mirror: "job", milestone: "scheduled", createable: true, deps: ["quote"] },
    { key: "work",     title: "Work Completed",    type: "work_order",group: "Work",     assignedTo: "DeAndre Smith", mirror: "work_order", deps: ["scheduled"] },
    { key: "photos",   title: "Final Photos",      type: "document",  group: "Closeout", assignedTo: "DeAndre Smith", manual: true, deps: ["work"] },
    { key: "invoice",  title: "Invoice Sent",      type: "billing",   group: "Closeout", assignedTo: "Nicole Adams",  mirror: "invoice", createable: true, deps: ["work"], gate: "Work must be complete" },
    { key: "closed",   title: "Project Closed",    type: "milestone", group: "Closeout", assignedTo: "Ryo Martin",    manual: true, deps: ["invoice", "photos"] },
  ],
};

// Built-in templates ship with the CRM; custom ones layer on top via the scoped
// settings store (Org → Company → Branch), edited in Settings → Projects → Maps.
export const DEFAULT_MAP_TEMPLATES: MapTemplate[] = [HVAC_REPLACEMENT, COMMERCIAL_RTU, GENERIC];
export const MAP_TEMPLATES_KEY = "project-map-templates";

export function getMapTemplates(scope: ScopeIds = {}): MapTemplate[] {
  const list = resolveScoped<MapTemplate[]>(MAP_TEMPLATES_KEY, scope, DEFAULT_MAP_TEMPLATES);
  return Array.isArray(list) && list.length > 0 ? list : DEFAULT_MAP_TEMPLATES;
}
export function saveMapTemplates(templates: MapTemplate[], scopeKey = "org"): void {
  writeScoped(MAP_TEMPLATES_KEY, scopeKey, templates);
}
export function resetMapTemplates(scopeKey = "org"): MapTemplate[] {
  clearScoped(MAP_TEMPLATES_KEY, scopeKey);
  return [...DEFAULT_MAP_TEMPLATES];
}

export function templateForType(type: ProjectType): MapTemplate {
  const list = getMapTemplates();
  return list.find(t => t.projectTypes.includes(type))
    ?? list.find(t => t.id === "tpl-generic") ?? list[0] ?? GENERIC;
}
export function templateById(id?: string): MapTemplate | undefined {
  return id ? getMapTemplates().find(t => t.id === id) : undefined;
}

// The map a project actually runs: its explicitly-chosen template if it has one,
// otherwise the default for its project type. This is the ONE resolution both the
// map builder and the group view must use, so a pinned template is honored
// everywhere (fixes the old dead `templateById(undefined)` fall-through).
export function templateForProject(p?: { mapTemplateId?: string; type?: ProjectType }): MapTemplate {
  return (p?.mapTemplateId ? templateById(p.mapTemplateId) : undefined)
    ?? templateForType((p?.type ?? "other") as ProjectType);
}

export function newMapTemplateId(): string { return `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`; }
export function newMapNodeKey(): string { return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`; }
