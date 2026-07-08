// ─── Project Map — connected workflow (template-driven, mirrored) ──
// A project's map is instantiated from a per-type template (lib/projects/
// map-templates). Each node is MANUAL (checked off) or MIRRORED (reflects a real
// record — Job, Quote, Material Request, PO, Subcontractor, Work Order, Invoice).
// Mirrored creatable nodes spawn + link their record from the map. Dependencies
// gate the flow (the first incomplete node is the "next step"). Mock/local.
// Ownership: the map LINKS records owned by CRM / Inventory / Accounting.

import { getProject } from "./data";
import { templateForProject, type MapTemplate, type MirrorSource } from "./map-templates";
import { getJobsForProject, getJob, getWorkOrder, getWorkOrderById, createJob } from "@/lib/jobs/data";
import { getAppointmentsForJob, getAppointmentsForWorkOrder } from "@/lib/appointments/data";
import { createTask } from "@/lib/tasks/data";
import {
  materialRequestsForProject, posForProject, assignmentsForProject, getSubcontractor,
  poReceivingState, subCompliance, createMaterialRequest, createPurchaseOrder, createAssignment,
  getVendors, getSubcontractors,
} from "@/lib/inventory/data";
import { getQuotesForProject, getInvoicesForProject, getInvoice, createInvoice, fmt as fmtMoney } from "@/lib/quotes/data";

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
  in_progress: { label: "In Progress", color: "#239c8d" },
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
  expectedDate?: string;    // yyyy-mm-dd — when a waiting/blocked step should resolve
  percent?: number;         // billing nodes: % of contract this stage bills
  deposit?: boolean;
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

// ─── Per-node meta (persisted) ────────────────────────────
// Expected dates on waiting/blocked steps + the follow-up-task guard, keyed by
// node id. Small and additive — the map itself stays derived from live records.
const META_KEY = "crm-map-node-meta";
interface NodeMeta { expectedDate?: string; followUpTaskId?: string; invoiceId?: string; recordId?: string }
function metaStore(): Record<string, NodeMeta> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch { return {}; }
}
function saveMeta(all: Record<string, NodeMeta>): void {
  try { localStorage.setItem(META_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}
// Bind a node to a specific record (job/quote/PO/…) so it drives THAT step
// only. Used by createForNode and by seeds that create records directly.
export function bindMapNodeRecord(nodeId: string, recordId: string): void {
  const all = metaStore();
  all[nodeId] = { ...(all[nodeId] ?? {}), recordId };
  saveMeta(all);
}
export function setMapNodeExpected(nodeId: string, date: string): void {
  const all = metaStore();
  const cur = all[nodeId] ?? {};
  // Changing the date re-arms the follow-up (a new promise deserves a new nudge).
  all[nodeId] = { ...cur, expectedDate: date || undefined, followUpTaskId: date === cur.expectedDate ? cur.followUpTaskId : undefined };
  saveMeta(all);
}

// ─── Manual completion store (per node id, persisted) ─────
const DONE_KEY = "crm-map-manual-done";
let _manualDone: Set<string> | null = null;
function manualDone(): Set<string> {
  if (_manualDone) return _manualDone;
  if (typeof window === "undefined") return new Set();
  try { _manualDone = new Set(JSON.parse(localStorage.getItem(DONE_KEY) || "[]") as string[]); }
  catch { _manualDone = new Set(); }
  return _manualDone;
}
export function setMapNodeStatus(nodeId: string, status: MapNodeStatus): void {
  const set = manualDone();
  if (status === "completed") set.add(nodeId); else set.delete(nodeId);
  try { localStorage.setItem(DONE_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

// ─── Mirror resolution — node status from a real record ───
type BaseStatus = "completed" | "in_progress" | "waiting" | "blocked" | null;
interface MirrorResult { status: BaseStatus; linkedApp?: LinkedApp; linkedLabel?: string; linkedId?: string }

// Resolve a node against the SPECIFIC record bound to it (recordId), not "the
// first record of this type" — so a project's site-visit job and install job
// each drive their own node instead of one job completing every job step.
// equipment_received stays project-wide (any PO fully received is the gate).
function resolveMirror(src: MirrorSource, projectId: string, recordId?: string): MirrorResult {
  switch (src) {
    case "job": {
      const j = recordId ? getJob(recordId) : undefined;
      if (!j) return { status: null };
      const done = ["completed", "closed", "invoiced"].includes(j.status);
      return { status: done ? "completed" : "in_progress", linkedApp: "CRM", linkedLabel: j.title, linkedId: j.id };
    }
    case "work_order": {
      const wo = recordId ? getWorkOrderById(recordId) : undefined;
      if (!wo) return { status: null };
      const open = wo.checklist.some(c => c.required && !c.isComplete);
      return { status: open ? "in_progress" : "completed", linkedApp: "CRM", linkedLabel: wo.title, linkedId: wo.id };
    }
    case "quote": {
      const q = recordId ? getQuotesForProject(projectId).find(x => x.id === recordId) : undefined;
      if (!q) return { status: null };
      const approved = ["approved", "converted"].includes(q.status);
      return { status: approved ? "completed" : "in_progress", linkedApp: "CRM", linkedLabel: q.quoteNumber, linkedId: q.id };
    }
    case "material_request": {
      const m = recordId ? materialRequestsForProject(projectId).find(x => x.id === recordId) : undefined;
      if (!m) return { status: null };
      return { status: m.status === "fulfilled" ? "completed" : "in_progress", linkedApp: "Inventory", linkedLabel: m.number, linkedId: m.id };
    }
    case "purchase_order": {
      const p = recordId ? posForProject(projectId).find(x => x.id === recordId) : undefined;
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
      const a = recordId ? assignmentsForProject(projectId).find(x => x.id === recordId) : undefined;
      if (!a) return { status: null };
      const sub = a.subcontractorId ? getSubcontractor(a.subcontractorId) : undefined;
      const issue = sub ? subCompliance(sub) === "issue" : false;
      const status: BaseStatus = a.status === "completed" ? "completed" : issue ? "blocked" : "in_progress";
      return { status, linkedApp: "Inventory", linkedLabel: sub?.companyName ?? "Subcontractor", linkedId: a.id };
    }
    case "invoice": {
      const inv = recordId ? getInvoicesForProject(projectId).find(x => x.id === recordId) : undefined;
      if (!inv) return { status: null };
      const sent = ["sent", "viewed", "partially_paid", "paid", "past_due"].includes(inv.status);
      return { status: sent ? "completed" : "in_progress", linkedApp: "Accounting", linkedLabel: inv.invoiceNumber, linkedId: inv.id };
    }
  }
}

// ─── Node → record binding ────────────────────────────────
// Each mirror node binds to ONE specific record. Explicit bindings (set by
// createForNode / the seed, stored in meta.recordId) claim first; remaining
// nodes of a kind consume the project's unclaimed records in template order, so
// a record can satisfy at most one node. A work_order node watches the work
// order of the job bound to the nearest preceding job node.
const POOL_TYPES: MirrorSource[] = ["job", "quote", "material_request", "purchase_order", "subcontractor", "invoice"];
function bindMirrorNodes(projectId: string, template: MapTemplate): Map<string, string | undefined> {
  const meta = metaStore();
  const pools: Partial<Record<MirrorSource, { id: string }[]>> = {
    job: getJobsForProject(projectId),
    quote: getQuotesForProject(projectId),
    material_request: materialRequestsForProject(projectId),
    purchase_order: posForProject(projectId),
    subcontractor: assignmentsForProject(projectId),
    invoice: getInvoicesForProject(projectId),
  };
  const claimed: Record<string, Set<string>> = {};
  for (const t of POOL_TYPES) claimed[t] = new Set();
  // Billing nodes already own a specific invoice — reserve it so a plain
  // invoice-mirror node doesn't grab the same one.
  for (const t of template.nodes) {
    if (t.type === "billing" && t.percent != null) {
      const invId = meta[`${projectId}__${t.key}`]?.invoiceId;
      if (invId) claimed.invoice.add(invId);
    }
  }

  const binding = new Map<string, string | undefined>();
  // Phase 1 — explicit bindings claim their record.
  for (const t of template.nodes) {
    const m = t.mirror;
    if (t.manual || !m || !POOL_TYPES.includes(m)) continue;
    const rid = meta[`${projectId}__${t.key}`]?.recordId;
    if (rid && pools[m]?.some(r => r.id === rid) && !claimed[m].has(rid)) {
      binding.set(t.key, rid); claimed[m].add(rid);
    }
  }
  // Phase 2 — positional fallback + work_order follows the last job.
  let lastJobId: string | undefined;
  for (const t of template.nodes) {
    const m = t.mirror;
    if (t.manual || !m) continue;
    if (m === "work_order") { binding.set(t.key, lastJobId ? getWorkOrder(lastJobId)?.id : undefined); continue; }
    if (!POOL_TYPES.includes(m)) continue;   // equipment_received: project-wide
    let id = binding.get(t.key);
    if (!id) {
      const next = pools[m]?.find(r => !claimed[m].has(r.id));
      if (next) { id = next.id; claimed[m].add(id); binding.set(t.key, id); }
    }
    if (m === "job" && id) lastJobId = id;
  }
  return binding;
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
  const template: MapTemplate = templateForProject(project);
  const overdue = !!project?.targetDate && new Date(project.targetDate).getTime() < Date.now();
  const binding = bindMirrorNodes(projectId, template);

  // First pass — base status + links.
  const base = template.nodes.map((t) => {
    const id = `${projectId}__${t.key}`;
    let baseStatus: BaseStatus = null;
    let link: MirrorResult = { status: null };
    if (t.manual) {
      baseStatus = (manualDone().has(id) || t.key === "created") ? "completed" : null;
    } else if (t.type === "billing" && t.percent != null) {
      const invId = metaStore()[id]?.invoiceId;
      const inv = invId ? getInvoice(invId) : undefined;
      if (inv) {
        const sent = ["sent", "viewed", "partially_paid", "paid", "past_due"].includes(inv.status);
        baseStatus = sent ? "completed" : "in_progress";
        link = { status: baseStatus, linkedApp: "Accounting", linkedLabel: inv.invoiceNumber, linkedId: inv.id };
      }
    } else if (t.mirror) {
      link = resolveMirror(t.mirror, projectId, binding.get(t.key));
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
      dependencies: deps, blockedReason, expectedDate: metaStore()[b.id]?.expectedDate,
      percent: b.t.percent, deposit: b.t.deposit, order: i, notes: b.t.notes,
    };
  });
}

export function getProjectMapByGroup(projectId: string): { group: string; nodes: ProjectMapNode[] }[] {
  const template = templateForProject(getProject(projectId));
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

// ─── Create-from-node — quick-create + BIND the real record ──
// The created record is bound to the node (meta.recordId) so it drives THIS
// step and no other — creating a site-visit job never satisfies the install
// job node. `nodeId` is the full node id (`${projectId}__${key}`); `title`
// names the record after the step.
export function createForNode(projectId: string, src: MirrorSource, nodeId?: string, title?: string): boolean {
  const p = getProject(projectId);
  if (!p) return false;
  let createdId: string | undefined;
  switch (src) {
    case "job": {
      const job = createJob({ companyId: p.companyId, locationId: p.locationId, serviceAreaId: p.serviceAreaId, accountId: p.accountId,
        customerName: p.customerName, customerInitials: p.customerInitials, locationName: p.locationName,
        title: title?.trim() || "Install", type: "installation", projectId, propertyAddress: p.propertyAddress,
        assignedTo: p.assignedTo, assignedToInitials: p.assignedToInitials });
      createdId = job.id;
      break;
    }
    case "material_request": {
      const mr = createMaterialRequest({ projectId, projectName: p.name, requestedBy: p.assignedTo || "—", status: "open", source: "warehouse", items: [] });
      createdId = mr.id;
      break;
    }
    case "purchase_order": {
      const v = getVendors().find(x => x.type !== "subcontractor") ?? getVendors()[0];
      if (!v) return false;
      const po = createPurchaseOrder({ vendorId: v.id, vendorName: v.name, status: "draft", projectId, projectName: p.name, createdBy: p.assignedTo || "—", lines: [] });
      createdId = po.id;
      break;
    }
    case "subcontractor": {
      const s = getSubcontractors()[0];
      if (!s) return false;
      const a = createAssignment({ subcontractorId: s.id, projectId, projectName: p.name, scopeOfWork: "—", status: "proposed" });
      createdId = a.id;
      break;
    }
    default:
      return false;
  }
  if (nodeId && createdId) bindMapNodeRecord(nodeId, createdId);
  return true;
}

// ─── Day progress for multi-day steps ─────────────────────
// A job/work-order node whose linked record has 2+ dated visits is a multi-day
// step ("Install — Day 3 of 6"). Day = how far the calendar has advanced
// through the booked days, clamped so a finished visit always counts.
export interface NodeDayProgress {
  day: number;
  total: number;
  visits: { date: string; done: boolean; today: boolean }[];
}
export function nodeDayProgress(node: ProjectMapNode): NodeDayProgress | null {
  if (!node.linkedId || (node.mirror !== "job" && node.mirror !== "work_order")) return null;
  const appts = node.mirror === "work_order"
    ? getAppointmentsForWorkOrder(node.linkedId)
    : getAppointmentsForJob(node.linkedId);
  const dated = appts
    .filter(a => a.scheduledDate && a.status !== "canceled")
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  if (dated.length < 2) return null;
  const today = new Date().toISOString().slice(0, 10);
  const visits = dated.map(a => ({
    date: a.scheduledDate,
    done: a.status === "completed",
    today: a.scheduledDate === today,
  }));
  const reached = visits.filter(v => v.done || v.date <= today).length;
  return { day: Math.min(Math.max(reached, 1), visits.length), total: visits.length, visits };
}

// ─── Dated waits → follow-up tasks ────────────────────────
// Called from the Map UI (client, post-render): any waiting/blocked step whose
// expected date has passed gets ONE follow-up task, assigned to the step's
// owner. Re-armed if the expected date is changed.
export function sweepDatedWaits(projectId: string): void {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  const all = metaStore();
  let dirty = false;
  for (const node of getProjectMap(projectId)) {
    const meta = all[node.id];
    if (!meta?.expectedDate || meta.followUpTaskId) continue;
    if (!(node.status === "waiting" || node.status === "blocked")) continue;
    if (meta.expectedDate >= today) continue;
    const p = getProject(projectId);
    const task = createTask({
      title: `Follow up: ${node.title}`,
      type: "follow_up",
      dueDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      assignedTo: node.assignedTo,
      notes: `Expected by ${meta.expectedDate} and still ${NODE_STATUS_META[node.status].label.toLowerCase()} — give it a push. (Auto-created from the project map.)`,
      companyId: p?.companyId ?? "co_hvac",
      locationId: p?.locationId ?? "loc_augusta",
      projectId,
    });
    all[node.id] = { ...meta, followUpTaskId: task.id };
    dirty = true;
  }
  if (dirty) saveMeta(all);
}

// ─── Staged billing nodes ─────────────────────────────────
// A billing node with `percent` bills that share of the project contract
// (estimatedValue). Creating it raises a real invoice and remembers the link
// in node meta, so THIS stage tracks THIS invoice — three billing nodes,
// three invoices, no crosstalk.
export function billingNodeAmount(node: ProjectMapNode): number | null {
  if (node.percent == null) return null;
  const p = getProject(node.projectId);
  const contract = parseFloat(String(p?.estimatedValue ?? "").replace(/[^0-9.]/g, "")) || 0;
  return contract > 0 ? Math.round(contract * node.percent) / 100 : null;
}
export function billingNodeAmountLabel(node: ProjectMapNode): string {
  const amt = billingNodeAmount(node);
  return amt != null ? fmtMoney(amt) : "set the project value to compute";
}
export function createBillingInvoiceForNode(node: ProjectMapNode): boolean {
  const p = getProject(node.projectId);
  if (!p || node.percent == null) return false;
  const amount = billingNodeAmount(node) ?? 0;
  const due = new Date(); due.setDate(due.getDate() + 14);
  const inv = createInvoice({
    customerId: p.accountId, customerName: p.customerName, customerInitials: p.customerInitials, locationName: p.locationName,
    title: `${p.name} — ${node.title}`,
    dueDate: due.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    lineItems: [{
      id: `li-map-${Date.now()}`, description: `${node.title} — ${node.percent}% of contract`,
      quantity: 1, unitPrice: amount, total: amount,
    }],
    companyId: p.companyId, locationId: p.locationId, projectId: p.id,
    linkedLabel: p.name, linkedType: "project", linkedId: p.id,
    isDeposit: node.deposit,
  });
  const all = metaStore();
  all[node.id] = { ...(all[node.id] ?? {}), invoiceId: inv.id };
  saveMeta(all);
  return true;
}

// ─── Timeline span per node (read-only Gantt lens) ────────
// Where a step sits in calendar time, derived from what already exists:
// visits give job/WO steps real days; a dated wait spans today → expected.
// Steps with no time info return null — the timeline lists them separately
// rather than inventing dates.
export interface NodeSpan { start: string; end: string; kind: "visits" | "wait" }
// Coerce any date string to strict YYYY-MM-DD, or null if unparseable — so the
// timeline never receives a display-format date (which would make `new Date` an
// Invalid Date and crash the whole view on toISOString()).
function toYmd(s?: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
export function nodeDateSpan(node: ProjectMapNode): NodeSpan | null {
  if (node.linkedId && (node.mirror === "job" || node.mirror === "work_order")) {
    const dates = (node.mirror === "work_order"
      ? getAppointmentsForWorkOrder(node.linkedId)
      : getAppointmentsForJob(node.linkedId))
      .filter(a => a.status !== "canceled")
      .map(a => toYmd(a.scheduledDate))
      .filter((d): d is string => !!d)
      .sort((a, b) => a.localeCompare(b));
    if (dates.length > 0) return { start: dates[0], end: dates[dates.length - 1], kind: "visits" };
  }
  const expected = toYmd(node.expectedDate);
  if ((node.status === "waiting" || node.status === "blocked") && expected) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      start: today < expected ? today : expected,
      end: expected < today ? today : expected,
      kind: "wait",
    };
  }
  return null;
}
