// ─── Project Map — connected workflow (template-driven, mirrored) ──
// A project's map is instantiated from a per-type template (lib/projects/
// map-templates). Each node is MANUAL (checked off) or MIRRORED (reflects a real
// record — Job, Quote, Material Request, PO, Subcontractor, Work Order, Invoice).
// Mirrored creatable nodes spawn + link their record from the map. Dependencies
// gate the flow (the first incomplete node is the "next step"). Mock/local.
// Ownership: the map LINKS records owned by CRM / Inventory / Accounting.

import { getProject, type ProjectType } from "./data";
import { templateForType, templateById, type MapTemplate, type MirrorSource } from "./map-templates";
import { getJobsForProject, getWorkOrder, createJob } from "@/lib/jobs/data";
import {
  materialRequestsForProject, posForProject, assignmentsForProject, getSubcontractor,
  poReceivingState, subCompliance, createMaterialRequest, createPurchaseOrder, createAssignment,
  getVendors, getSubcontractors,
} from "@/lib/inventory/data";
import { getQuotesForProject, getInvoicesForProject } from "@/lib/quotes/data";

export type MapNodeType =
  | "phase" | "milestone" | "job" | "task" | "work_order"
  | "material_request" | "purchase_order" | "subcontractor" | "document" | "billing";

export const NODE_TYPE_LABEL: Record<MapNodeType, string> = {
  phase: "Phase", milestone: "Milestone", job: "Job", task: "Task", work_order: "Work Order",
  material_request: "Material Request", purchase_order: "Purchase Order", subcontractor: "Subcontractor",
  document: "Document", billing: "Billing",
};

export type MapNodeStatus = "not_started" | "ready" | "in_progress" | "waiting" | "blocked" | "completed" | "skipped";

export const NODE_STATUS_META: Record<MapNodeStatus, { label: string; color: string }> = {
  not_started: { label: "Not Started", color: "#9ca3af" },
  ready:       { label: "Ready",       color: "#0ea5e9" },
  in_progress: { label: "In Progress", color: "#6366f1" },
  waiting:     { label: "Waiting",     color: "#f59e0b" },
  blocked:     { label: "Blocked",     color: "#ef4444" },
  completed:   { label: "Completed",   color: "#10b981" },
  skipped:     { label: "Skipped",     color: "#6b7280" },
};

export type LinkedApp = "CRM" | "Inventory" | "Documents" | "Accounting";

export interface ProjectMapNode {
  id: string;
  projectId: string;
  key: string;
  title: string;
  type: MapNodeType;
  group: string;
  status: MapNodeStatus;
  assignedTo?: string;
  dueDate?: string;
  manual: boolean;
  mirror?: MirrorSource;
  createable: boolean;
  linkedApp?: LinkedApp;
  linkedLabel?: string;
  linkedId?: string;
  dependencies: string[];   // node ids
  blockedReason?: string;
  order: number;
  notes?: string;
}

// Mirror-source sources that the map can quick-create + link in one click.
const QUICK_CREATE: MirrorSource[] = ["job", "material_request", "purchase_order", "subcontractor"];
export function isQuickCreate(src?: MirrorSource): boolean { return !!src && QUICK_CREATE.includes(src); }

// The CRM-project tab a node's record lives in (for "Open").
export const SOURCE_TAB: Record<MirrorSource, string> = {
  quote: "Estimates", job: "Jobs", work_order: "Jobs", material_request: "Materials & Vendors",
  purchase_order: "Materials & Vendors", equipment_received: "Materials & Vendors", subcontractor: "Materials & Vendors", invoice: "Invoices",
};

// ─── Manual completion store (per node id) ────────────────
const _manualDone = new Set<string>();
export function setMapNodeStatus(nodeId: string, status: MapNodeStatus): void {
  if (status === "completed") _manualDone.add(nodeId); else _manualDone.delete(nodeId);
}

// ─── Mirror resolution — node status from a real record ───
type BaseStatus = "completed" | "in_progress" | "waiting" | "blocked" | null;
interface MirrorResult { status: BaseStatus; linkedApp?: LinkedApp; linkedLabel?: string; linkedId?: string }

function resolveMirror(src: MirrorSource, projectId: string): MirrorResult {
  switch (src) {
    case "job": {
      const j = getJobsForProject(projectId)[0];
      if (!j) return { status: null };
      const done = ["completed", "closed", "invoiced"].includes(j.status);
      return { status: done ? "completed" : "in_progress", linkedApp: "CRM", linkedLabel: j.title, linkedId: j.id };
    }
    case "work_order": {
      const j = getJobsForProject(projectId)[0];
      const wo = j ? getWorkOrder(j.id) : undefined;
      if (!wo) return { status: null };
      const open = wo.checklist.some(c => c.required && !c.isComplete);
      return { status: open ? "in_progress" : "completed", linkedApp: "CRM", linkedLabel: wo.title, linkedId: wo.id };
    }
    case "quote": {
      const qs = getQuotesForProject(projectId);
      if (qs.length === 0) return { status: null };
      const approved = qs.some(q => ["approved", "converted"].includes(q.status));
      return { status: approved ? "completed" : "in_progress", linkedApp: "CRM", linkedLabel: qs[0].quoteNumber, linkedId: qs[0].id };
    }
    case "material_request": {
      const m = materialRequestsForProject(projectId)[0];
      if (!m) return { status: null };
      return { status: m.status === "fulfilled" ? "completed" : "in_progress", linkedApp: "Inventory", linkedLabel: m.number, linkedId: m.id };
    }
    case "purchase_order": {
      const pos = posForProject(projectId);
      const p = pos.find(x => x.status !== "draft") ?? pos[0];
      if (!p) return { status: null };
      return { status: p.status !== "draft" ? "completed" : "in_progress", linkedApp: "Inventory", linkedLabel: p.number, linkedId: p.id };
    }
    case "equipment_received": {
      const pos = posForProject(projectId);
      if (pos.length === 0) return { status: null };
      const full = pos.some(p => poReceivingState(p) === "full");
      return { status: full ? "completed" : "waiting", linkedApp: "Inventory", linkedLabel: full ? "Received" : "Awaiting delivery" };
    }
    case "subcontractor": {
      const a = assignmentsForProject(projectId)[0];
      if (!a) return { status: null };
      const sub = a.subcontractorId ? getSubcontractor(a.subcontractorId) : undefined;
      const issue = sub ? subCompliance(sub) === "issue" : false;
      const status: BaseStatus = a.status === "completed" ? "completed" : issue ? "blocked" : "in_progress";
      return { status, linkedApp: "Inventory", linkedLabel: sub?.companyName ?? "Subcontractor", linkedId: a.id };
    }
    case "invoice": {
      const inv = getInvoicesForProject(projectId)[0];
      if (!inv) return { status: null };
      const sent = ["sent", "viewed", "partially_paid", "paid", "past_due"].includes(inv.status);
      return { status: sent ? "completed" : "in_progress", linkedApp: "Accounting", linkedLabel: inv.invoiceNumber, linkedId: inv.id };
    }
  }
}

// ─── Build the project's map (template → nodes → statuses) ──
// Building a map resolves every node against live Job / Quote / PO / Inventory /
// Invoice data, so it's not free. A single render often asks for the same
// project's map several times (progress + next step + blocker, plus the lens
// counts on the list). A tick-scoped cache collapses those into one build and
// then clears on the next microtask, so it never serves stale data across
// renders / after a mutation.
let _mapCache: Map<string, ProjectMapNode[]> | null = null;
export function getProjectMap(projectId: string): ProjectMapNode[] {
  if (!_mapCache) {
    _mapCache = new Map();
    queueMicrotask(() => { _mapCache = null; });
  }
  let cached = _mapCache.get(projectId);
  if (!cached) { cached = buildProjectMap(projectId); _mapCache.set(projectId, cached); }
  return cached;
}

function buildProjectMap(projectId: string): ProjectMapNode[] {
  const project = getProject(projectId);
  const template: MapTemplate = templateById(undefined) ?? templateForType((project?.type ?? "other") as ProjectType);
  const overdue = !!project?.targetDate && new Date(project.targetDate).getTime() < Date.now();

  // First pass — base status + links.
  const base = template.nodes.map((t) => {
    const id = `${projectId}__${t.key}`;
    let baseStatus: BaseStatus = null;
    let link: MirrorResult = { status: null };
    if (t.manual) {
      baseStatus = (_manualDone.has(id) || t.key === "created") ? "completed" : null;
    } else if (t.mirror) {
      link = resolveMirror(t.mirror, projectId);
      baseStatus = link.status;
    }
    return { t, id, baseStatus, link };
  });

  const keyToId = new Map(template.nodes.map(t => [t.key, `${projectId}__${t.key}`]));
  const completedIds = new Set(base.filter(b => b.baseStatus === "completed").map(b => b.id));
  const firstIncomplete = base.findIndex(b => b.baseStatus !== "completed");

  return base.map((b, i): ProjectMapNode => {
    const deps = b.t.deps.map(k => keyToId.get(k)!).filter(Boolean);
    const depsDone = deps.every(d => completedIds.has(d));
    let status: MapNodeStatus;
    let blockedReason: string | undefined;

    if (b.baseStatus === "completed") {
      status = "completed";
    } else if (!depsDone) {
      status = "not_started";
    } else if (b.baseStatus === "in_progress") {
      status = "in_progress";
    } else if (b.baseStatus === "waiting") {
      status = "waiting"; blockedReason = b.t.gate;
    } else if (b.baseStatus === "blocked") {
      status = "blocked"; blockedReason = b.t.mirror === "subcontractor" ? "Subcontractor compliance is not valid (COI / W-9)" : b.t.gate;
    } else if (i === firstIncomplete) {
      // The frontier: actionable. Overdue projects surface it as blocked.
      status = overdue ? "blocked" : "ready";
      if (overdue) blockedReason = b.t.gate ?? "Past target date — needs attention";
    } else {
      status = "ready";
    }

    return {
      id: b.id, projectId, key: b.t.key, title: b.t.title, type: b.t.type, group: b.t.group,
      status, assignedTo: b.t.assignedTo, manual: !!b.t.manual, mirror: b.t.mirror, createable: !!b.t.createable,
      linkedApp: b.link.linkedApp, linkedLabel: b.link.linkedLabel, linkedId: b.link.linkedId,
      dependencies: deps, blockedReason, order: i, notes: b.t.notes,
    };
  });
}

export function getProjectMapByGroup(projectId: string): { group: string; nodes: ProjectMapNode[] }[] {
  const project = getProject(projectId);
  const template = templateForType((project?.type ?? "other") as ProjectType);
  const nodes = getProjectMap(projectId);
  return template.groups.map(group => ({ group, nodes: nodes.filter(n => n.group === group) }));
}

export function projectNextStep(projectId: string): ProjectMapNode | undefined {
  return getProjectMap(projectId).find(n => ["in_progress", "ready", "waiting", "blocked"].includes(n.status));
}
export function projectBlocker(projectId: string): ProjectMapNode | undefined {
  return getProjectMap(projectId).find(n => n.status === "blocked");
}

// ─── Map-derived progress (the project's headline %) ──────
// The map is the single source of truth for "how far along is this project":
// completed nodes / total (skipped nodes don't count toward the denominator).
export interface ProjectMapSummary {
  total: number; done: number; pct: number;
  nextStep?: ProjectMapNode;
  blocker?: ProjectMapNode;
}
// One pass over the map → progress + next step + blocker. Prefer this when you
// need more than one of those (e.g. the project cards) so the map builds once.
export function projectMapSummary(projectId: string): ProjectMapSummary {
  const nodes = getProjectMap(projectId);
  const active = nodes.filter(n => n.status !== "skipped");
  const done = active.filter(n => n.status === "completed").length;
  const total = active.length;
  return {
    total, done, pct: total ? Math.round((done / total) * 100) : 0,
    nextStep: nodes.find(n => ["in_progress", "ready", "waiting", "blocked"].includes(n.status)),
    blocker: nodes.find(n => n.status === "blocked"),
  };
}
export function mapProgress(projectId: string): { total: number; done: number; pct: number } {
  const { total, done, pct } = projectMapSummary(projectId);
  return { total, done, pct };
}

// ─── Create-from-node — quick-create + link the real record ──
export function createForNode(projectId: string, src: MirrorSource): boolean {
  const p = getProject(projectId);
  if (!p) return false;
  switch (src) {
    case "job":
      createJob({ companyId: p.companyId, locationId: p.locationId, serviceAreaId: p.serviceAreaId, accountId: p.accountId,
        customerName: p.customerName, customerInitials: p.customerInitials, locationName: p.locationName,
        title: "Install", type: "installation", projectId, propertyAddress: p.propertyAddress,
        assignedTo: p.assignedTo, assignedToInitials: p.assignedToInitials });
      return true;
    case "material_request":
      createMaterialRequest({ projectId, projectName: p.name, requestedBy: p.assignedTo || "—", status: "open", source: "warehouse", items: [] });
      return true;
    case "purchase_order": {
      const v = getVendors().find(x => x.type !== "subcontractor") ?? getVendors()[0];
      if (!v) return false;
      createPurchaseOrder({ vendorId: v.id, vendorName: v.name, status: "draft", projectId, projectName: p.name, createdBy: p.assignedTo || "—", lines: [] });
      return true;
    }
    case "subcontractor": {
      const s = getSubcontractors()[0];
      if (!s) return false;
      createAssignment({ subcontractorId: s.id, projectId, projectName: p.name, scopeOfWork: "—", status: "proposed" });
      return true;
    }
    default:
      return false;
  }
}
