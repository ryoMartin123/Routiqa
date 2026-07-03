"use client";

// ─── CRM Project · Project Map ────────────────────────────
// The connected workflow (template-driven). Nodes are MANUAL (check off) or
// MIRRORED (reflect a real Job / Quote / PO / Material Request / Subcontractor /
// Work Order / Invoice). Clicking a node opens its OWN full detail section that
// explains what the step needs, what completes it, its dependencies (with links
// to go do them), and the right action. Mock/local.

import { Fragment, useMemo, useState } from "react";
import {
  Layers, Flag, Briefcase, CheckSquare, ClipboardList, Package, ShoppingCart, HardHat,
  FileText, Receipt, ChevronRight, Check, AlertTriangle, CornerDownRight, User, Calendar, Link2,
  Plus, ExternalLink, ArrowLeft, ListChecks, GitBranch, Circle,
} from "lucide-react";
import {
  getProjectMap, getProjectMapByGroup, setMapNodeStatus, createForNode, isQuickCreate, SOURCE_TAB,
  NODE_TYPE_LABEL, NODE_STATUS_META, type ProjectMapNode, type MapNodeType, type MapNodeStatus,
} from "@/lib/projects/map";

const ACCENT = "#4f46e5"; // CRM indigo
const initials = (n: string) => { const p = n.trim().split(/\s+/); return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : n.slice(0, 2)).toUpperCase(); };

const TYPE_ICON: Record<MapNodeType, typeof Layers> = {
  phase: Layers, milestone: Flag, job: Briefcase, task: CheckSquare, work_order: ClipboardList,
  material_request: Package, purchase_order: ShoppingCart, subcontractor: HardHat, document: FileText, billing: Receipt,
};

// What completes this step (shown on the detail page so the user knows the goal).
function completionRule(node: ProjectMapNode): string {
  if (node.manual) return "This is a manual step — mark it complete once it's done.";
  switch (node.mirror) {
    case "quote": return "Completes automatically when an estimate is approved.";
    case "job": return "Completes automatically when the linked job is finished.";
    case "work_order": return "Completes automatically when the required checklist items are done.";
    case "material_request": return "Completes automatically when the material request is fulfilled.";
    case "purchase_order": return "Completes automatically when the purchase order is created/ordered.";
    case "equipment_received": return "Completes automatically when the purchase order is fully received.";
    case "subcontractor": return "Completes when the assignment is finished — and stays blocked until compliance (COI / W-9) is valid.";
    case "invoice": return "Completes automatically when the invoice is sent.";
    default: return "Mark complete when done.";
  }
}
// One-line "what to do now" based on status.
function whatNow(node: ProjectMapNode): string {
  switch (node.status) {
    case "completed": return "This step is complete. Nothing more to do.";
    case "blocked": return node.blockedReason ?? "This step is blocked — resolve the issue below.";
    case "waiting": return node.blockedReason ?? "Waiting on materials / an external step.";
    case "in_progress": return "In progress — open the linked record to keep it moving.";
    case "ready": return node.manual ? "Ready — mark it complete when finished." : node.linkedLabel ? "Ready — open the record to continue." : "Ready to start — create the record to begin.";
    default: return "Not started yet — finish the prerequisites below first.";
  }
}

export default function ProjectMap({ projectId, onOpenTab }: { projectId: string; onOpenTab?: (t: string) => void }) {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const groups = useMemo(() => getProjectMapByGroup(projectId), [projectId, tick]);
  const allNodes = useMemo(() => getProjectMap(projectId), [projectId, tick]);
  const byId = useMemo(() => new Map(allNodes.map(n => [n.id, n])), [allNodes]);

  // ── Node detail section (its own "page") ──
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  if (selected) {
    return (
      <NodeDetail node={selected} allNodes={allNodes} byId={byId}
        onBack={() => setSelectedId(null)} onSelectNode={setSelectedId} onOpenTab={onOpenTab}
        onComplete={() => { setMapNodeStatus(selected.id, "completed"); refresh(); }}
        onCreate={() => { if (selected.mirror) { createForNode(projectId, selected.mirror); refresh(); } }} />
    );
  }

  // ── Map grid ──
  const completed = allNodes.filter(n => n.status === "completed").length;
  const blocked = allNodes.filter(n => n.status === "blocked").length;
  const next = allNodes.find(n => ["in_progress", "ready", "waiting", "blocked"].includes(n.status));
  const pct = allNodes.length ? Math.round((completed / allNodes.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Workflow header — a segmented bar (each step colored by status) + next step. */}
      <div className="rounded-xl px-4 py-3.5 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1">
          {allNodes.map(n => {
            const dim = n.status === "not_started";
            return (
              <button key={n.id} onClick={() => setSelectedId(n.id)} title={`${n.title} · ${NODE_STATUS_META[n.status].label}`}
                className="flex-1 h-1.5 rounded-full transition-all hover:h-2.5"
                style={{ backgroundColor: dim ? "var(--bg-input)" : NODE_STATUS_META[n.status].color }} />
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{pct}%</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{completed} of {allNodes.length} steps complete</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {blocked > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>
                <AlertTriangle className="w-3 h-3" /> {blocked} blocked
              </span>
            )}
            {next && (
              <button onClick={() => setSelectedId(next.id)} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all hover:brightness-105" style={{ backgroundColor: ACCENT + "14", color: ACCENT }}>
                <CornerDownRight className="w-3.5 h-3.5 shrink-0" /> <span style={{ color: "var(--text-muted)" }}>Next</span> <span className="font-semibold">{next.title}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Full-width adaptive columns: grow to fill on wide screens, scroll when cramped. */}
      <div className="flex gap-1 overflow-x-auto thin-scroll-x pb-2 items-stretch">
        {groups.map((g, gi) => (
          <Fragment key={g.group}>
            <div className="flex-1 min-w-[14rem] flex flex-col">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{g.group}</p>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{g.nodes.filter(n => n.status === "completed").length}/{g.nodes.length}</span>
              </div>
              <div className="space-y-2">
                {g.nodes.map(n => <NodeCard key={n.id} node={n} deps={n.dependencies.map(d => byId.get(d)).filter(Boolean) as ProjectMapNode[]} onClick={() => setSelectedId(n.id)} />)}
              </div>
            </div>
            {gi < groups.length - 1 && <div className="flex items-center shrink-0 px-0.5"><ChevronRight className="w-4 h-4" style={{ color: "var(--border)" }} /></div>}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Node card (in the grid) ──────────────────────────────
function NodeCard({ node, deps, onClick }: { node: ProjectMapNode; deps: ProjectMapNode[]; onClick: () => void }) {
  const Icon = TYPE_ICON[node.type];
  const sm = NODE_STATUS_META[node.status];
  const done = node.status === "completed";
  const depBlocked = deps.some(d => d.status !== "completed") && !done;
  const canCreate = node.createable && !node.linkedLabel && node.status === "ready";
  return (
    <button onClick={onClick} className="w-full text-left rounded-lg overflow-hidden transition-all hover:-translate-y-0.5"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", opacity: done ? 0.72 : 1 }}>
      <div style={{ height: 3, backgroundColor: sm.color }} />
      <div className="p-2.5">
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}><Icon className="w-3 h-3" /> {NODE_TYPE_LABEL[node.type]}{node.manual && <span className="opacity-60">· manual</span>}</span>
          {done ? <Check className="w-3.5 h-3.5" style={{ color: "#10b981" }} /> : <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sm.color }} />}
        </div>
        <p className="text-sm font-medium leading-snug" style={{ color: "var(--text-primary)", textDecoration: done ? "line-through" : "none" }}>{node.title}</p>
        {(node.status === "blocked" || node.status === "waiting") && node.blockedReason && (
          <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: node.status === "blocked" ? "#dc2626" : "#b45309" }}><AlertTriangle className="w-3 h-3 shrink-0" /> {node.blockedReason}</p>
        )}
        <div className="flex items-center justify-between gap-1 mt-2">
          <div className="flex items-center gap-1 min-w-0">
            {node.assignedTo && <span title={node.assignedTo} className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: ACCENT }}>{initials(node.assignedTo)}</span>}
            {node.linkedLabel ? <span className="text-[9px] font-medium px-1.5 py-0.5 rounded truncate" style={{ backgroundColor: ACCENT + "14", color: ACCENT }}>{node.linkedLabel}</span>
              : canCreate ? <span className="text-[9px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-0.5" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}><Plus className="w-2.5 h-2.5" />Create</span> : null}
          </div>
          {depBlocked && <CornerDownRight className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />}
        </div>
      </div>
    </button>
  );
}

// ─── Node detail (its own full section) ───────────────────
function NodeDetail({ node, allNodes, byId, onBack, onSelectNode, onOpenTab, onComplete, onCreate }: {
  node: ProjectMapNode; allNodes: ProjectMapNode[]; byId: Map<string, ProjectMapNode>;
  onBack: () => void; onSelectNode: (id: string) => void; onOpenTab?: (t: string) => void;
  onComplete: () => void; onCreate: () => void;
}) {
  const Icon = TYPE_ICON[node.type];
  const sm = NODE_STATUS_META[node.status];
  const done = node.status === "completed";
  const deps = node.dependencies.map(d => byId.get(d)).filter(Boolean) as ProjectMapNode[];
  const tab = node.mirror ? SOURCE_TAB[node.mirror] : undefined;
  const openTab = () => (tab && onOpenTab ? onOpenTab(tab) : undefined);

  // The primary "do this" action.
  let primary: React.ReactNode = null;
  if (done) {
    primary = <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}><Check className="w-4 h-4" /> This step is complete</div>;
  } else if (node.manual) {
    primary = <button onClick={onComplete} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:brightness-110" style={{ backgroundColor: ACCENT }}><Check className="w-4 h-4" /> Mark Complete</button>;
  } else if (node.linkedLabel) {
    primary = <button onClick={openTab} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:brightness-110" style={{ backgroundColor: ACCENT }}><ExternalLink className="w-4 h-4" /> Open {node.linkedLabel}</button>;
  } else if (node.createable && isQuickCreate(node.mirror)) {
    primary = <button onClick={onCreate} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:brightness-110" style={{ backgroundColor: ACCENT }}><Plus className="w-4 h-4" /> Create {NODE_TYPE_LABEL[node.type]} &amp; link</button>;
  } else {
    primary = <button onClick={openTab} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-white hover:brightness-110" style={{ backgroundColor: ACCENT }}><ExternalLink className="w-4 h-4" /> Open {tab ?? "record"}</button>;
  }

  // Workflow neighbors (previous / next in the overall order).
  const idx = allNodes.findIndex(n => n.id === node.id);
  const prev = allNodes[idx - 1];
  const nextN = allNodes[idx + 1];

  return (
    <div className="space-y-4 w-full">
      {/* Back + header */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Project Map</button>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div style={{ height: 4, backgroundColor: sm.color }} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: sm.color + "1f" }}><Icon className="w-5 h-5" style={{ color: sm.color }} /></span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{node.title}</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{node.group} · {NODE_TYPE_LABEL[node.type]} · {node.manual ? "manual step" : `mirrors a ${node.linkedApp ?? "module"} record`}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: sm.color + "22", color: sm.color }}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: sm.color }} /> {sm.label}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <Meta icon={User} label="Assigned to" value={node.assignedTo ?? "—"} />
            <Meta icon={Calendar} label="Due date" value={node.dueDate ?? "—"} />
            <Meta icon={Layers} label="Stage" value={node.group} />
            <Meta icon={Link2} label="Linked record" value={node.linkedLabel ? `${node.linkedApp} · ${node.linkedLabel}` : node.createable ? "Not created" : "—"} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          <Card title="What this step needs" icon={ListChecks}>
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>{whatNow(node)}</p>
            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>{completionRule(node)}</p>
            {(node.status === "blocked" || node.status === "waiting") && node.blockedReason && (
              <div className="mt-3 rounded-lg px-3 py-2 flex items-start gap-2" style={{ backgroundColor: node.status === "blocked" ? "#fef2f2" : "#fffbeb", border: `1px solid ${node.status === "blocked" ? "#fecaca" : "#fde68a"}` }}>
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: node.status === "blocked" ? "#dc2626" : "#b45309" }} />
                <p className="text-xs" style={{ color: node.status === "blocked" ? "#991b1b" : "#92400e" }}>{node.blockedReason}</p>
              </div>
            )}
            <div className="mt-4">{primary}</div>
            {node.notes && <p className="text-[11px] mt-3 pt-3" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>{node.notes}</p>}
          </Card>

          <Card title="Before this can start" icon={GitBranch}>
            {deps.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No prerequisites — this can begin anytime.</p>
            ) : (
              <div className="space-y-2">
                {deps.map(d => {
                  const dm = NODE_STATUS_META[d.status];
                  const dDone = d.status === "completed";
                  const dTab = d.mirror ? SOURCE_TAB[d.mirror] : undefined;
                  return (
                    <div key={d.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg" style={{ border: "1px solid var(--border)", backgroundColor: dDone ? "transparent" : "var(--bg-surface-2)" }}>
                      {dDone ? <Check className="w-4 h-4 shrink-0" style={{ color: "#10b981" }} /> : <Circle className="w-4 h-4 shrink-0" style={{ color: dm.color }} />}
                      <button onClick={() => onSelectNode(d.id)} className="text-sm font-medium text-left hover:underline flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>{d.title}</button>
                      <span className="text-[11px] shrink-0" style={{ color: dm.color }}>{dm.label}</span>
                      {!dDone && dTab && onOpenTab && <button onClick={() => onOpenTab(dTab)} className="text-[11px] font-medium flex items-center gap-0.5 shrink-0" style={{ color: ACCENT }}>Go <ExternalLink className="w-3 h-3" /></button>}
                    </div>
                  );
                })}
                <p className="text-[11px] pt-1" style={{ color: "var(--text-muted)" }}>Click a prerequisite to open it, or “Go” to where it gets done.</p>
              </div>
            )}
          </Card>
        </div>

        {/* Side */}
        <div className="space-y-4">
          <Card title="Workflow position" icon={CornerDownRight}>
            <div className="space-y-1.5">
              {prev && <WfRow node={prev} onClick={() => onSelectNode(prev.id)} />}
              <WfRow node={node} current />
              {nextN && <WfRow node={nextN} onClick={() => onSelectNode(nextN.id)} />}
            </div>
            <button onClick={onBack} className="w-full mt-3 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Layers className="w-3.5 h-3.5" /> View full map</button>
          </Card>

          <Card title="Quick actions" icon={Plus}>
            <div className="space-y-2">
              {tab && onOpenTab && <SideLink icon={ExternalLink} label={`Open ${tab}`} onClick={() => onOpenTab(tab)} />}
              <SideLink icon={Plus} label="Add Task" onClick={() => alert("Add task — coming soon")} />
              <SideLink icon={GitBranch} label="Add Dependency" onClick={() => alert("Add dependency — coming soon")} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function WfRow({ node, current, onClick }: { node: ProjectMapNode; current?: boolean; onClick?: () => void }) {
  const sm = NODE_STATUS_META[node.status];
  const Inner = (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ backgroundColor: current ? ACCENT + "12" : "transparent", border: `1px solid ${current ? ACCENT + "40" : "transparent"}` }}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sm.color }} />
      <span className="text-sm flex-1 min-w-0 truncate" style={{ color: current ? ACCENT : "var(--text-primary)", fontWeight: current ? 600 : 400 }}>{node.title}</span>
      {current && <span className="text-[9px] font-semibold uppercase" style={{ color: ACCENT }}>You are here</span>}
    </div>
  );
  return onClick ? <button onClick={onClick} className="w-full text-left hover:opacity-80">{Inner}</button> : Inner;
}

function Meta({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
      <div className="min-w-0"><p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p><p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{value}</p></div>
    </div>
  );
}
function Card({ title, icon: Icon, children }: { title: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
        <Icon className="w-4 h-4" style={{ color: "var(--text-muted)" }} /><p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function SideLink({ icon: Icon, label, onClick }: { icon: typeof User; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Icon className="w-3.5 h-3.5" style={{ color: ACCENT }} /> {label}</button>;
}
