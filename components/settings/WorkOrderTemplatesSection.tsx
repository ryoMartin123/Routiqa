"use client";

// ─── Work Order Templates — free-form canvas builder ──────
// Like the project Map builder: a template rail on the left, and a pannable /
// zoomable canvas where the template's Scope, Checklist steps, and Photo rules
// are node cards. Click a node to edit it in the floating inspector. One Save
// persists the template meta + its checklist / photos / instructions.

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import {
  Plus, Minus, Maximize, Trash2, X, ChevronUp, ChevronDown, Check, Copy,
  Camera, FileText, ClipboardList, CheckSquare, ArrowLeft, ChevronRight, Pencil,
  GripVertical, LayoutGrid, Search, Loader2,
} from "lucide-react";
import {
  getTemplates, saveTemplates,
  getChecklist, saveChecklist,
  getPhotos, savePhotos,
  getInstructions, saveInstructions,
  getLayout, saveLayout, type TemplateLayout,
  woId, woSlug,
  WO_PRIORITY_LABELS, CHECKLIST_TYPE_LABELS, checklistTypeLabel, PHOTO_CATEGORIES,
  type WorkOrderTemplate, type WOPriority,
  type ChecklistItem, type ChecklistItemType,
  type RequiredPhoto, type WOInstructions,
} from "@/lib/work-order-templates/data";
import {
  getJobTypes, saveJobTypes, WORK_ORDER_POLICY_LABELS,
  type JobTypeDef, type WorkOrderPolicy,
} from "@/lib/job-config/data";
import UiSelect from "@/components/ui/Select";
import NumberStepper from "@/components/ui/NumberStepper";
import ActionsMenu from "@/components/shared/ActionsMenu";
import { pingSaved } from "@/components/shared/SavedPill";

const ACCENT = "#4f46e5";
// Soft "required" accent — Swiss Coffee cream + a muted warm taupe (easier on the
// eyes than bright red).
const REQ_BG = "#E5E0DB";
const REQ_TEXT = "#7a6f5c";
const PRIORITIES = Object.keys(WO_PRIORITY_LABELS) as WOPriority[];
const CHECK_TYPES = Object.keys(CHECKLIST_TYPE_LABELS) as ChecklistItemType[];
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));


const INSTRUCTION_FIELDS: { key: keyof Omit<WOInstructions, "templateId">; label: string; placeholder: string }[] = [
  { key: "internal",       label: "Internal instructions",   placeholder: "Steps & guidance for the field team…" },
  { key: "customerFacing", label: "Customer-facing",         placeholder: "What the customer should know…" },
  { key: "safety",         label: "Safety notes",            placeholder: "Lockout/tagout, PPE, hazards…" },
  { key: "access",         label: "Access notes",            placeholder: "Gate codes, keys, parking…" },
  { key: "materials",      label: "Material notes",          placeholder: "Common parts to bring…" },
  { key: "completion",     label: "Completion requirements", placeholder: "What must be done to close…" },
];

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" } as React.CSSProperties;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>{children}</div>;
}

// A selected node = one of: the scope node, a checklist step, or a photo rule.
type Sel = { kind: "scope" } | { kind: "step"; id: string } | { kind: "photo"; id: string } | null;

const WO_POLICIES = Object.keys(WORK_ORDER_POLICY_LABELS) as WorkOrderPolicy[];

export default function WorkOrderTemplatesSection() {
  const jobTypes = getJobTypes();
  const jobTypeName = (key: string) => jobTypes.find(j => j.key === key)?.name ?? "None";
  // Init synchronously so switching into this section doesn't flash the empty
  // state for a frame before the templates load.
  const [templates, setTemplates] = useState<WorkOrderTemplate[]>(() => getTemplates());
  const [editingId, setEditingId] = useState<string | null>(null);
  const reload = () => setTemplates(getTemplates());

  // New/duplicated/edited templates go to the TOP of the stack: order 0 sorts
  // first, then saveTemplates renumbers 1..n (stable sort keeps the rest put).
  function startNew() {
    const t: WorkOrderTemplate = { id: woId("wt"), name: "New template", key: woSlug(`template_${Date.now()}`), description: "", jobTypeKey: jobTypes[0]?.key ?? "", priority: "normal", duration: 60, active: true, order: 0 };
    saveTemplates([...templates, t]); reload(); setEditingId(t.id);
  }
  function duplicate(t: WorkOrderTemplate) {
    const copy: WorkOrderTemplate = { ...t, id: woId("wt"), name: `${t.name} (Copy)`, key: woSlug(`${t.key}_copy_${Date.now()}`), order: 0 };
    saveChecklist(copy.id, getChecklist(t.id).map(c => ({ ...c, id: woId("ci"), templateId: copy.id })));
    savePhotos(copy.id, getPhotos(t.id).map(p => ({ ...p, id: woId("rp"), templateId: copy.id })));
    saveInstructions({ ...getInstructions(t.id), templateId: copy.id });
    saveTemplates([...templates, copy]); reload();
  }
  function remove(id: string) { saveTemplates(templates.filter(t => t.id !== id)); reload(); }

  // Editing → the full-screen canvas builder.
  if (editingId) {
    const tpl = templates.find(t => t.id === editingId);
    if (!tpl) { setEditingId(null); return null; }
    return <TemplateBuilder templateId={editingId} jobTypes={jobTypes} onBack={() => { reload(); setEditingId(null); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Work Order Templates</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{templates.length} template{templates.length === 1 ? "" : "s"} · a job type suggests its template. Open one to build the field workflow on a canvas.</p>
        </div>
        <button onClick={startNew} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white shrink-0" style={{ backgroundColor: ACCENT }}><Plus className="w-3.5 h-3.5" /> New template</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map(t => {
          const steps = getChecklist(t.id);
          const req = steps.filter(s => s.required).length;
          const pics = getPhotos(t.id).length;
          return (
            <div key={t.id} onClick={() => setEditingId(t.id)}
              className="group rounded-2xl flex flex-col cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", opacity: t.active ? 1 : 0.65 }}>
              <div className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                    {/* Linked job type — the chip makes the type→template wiring visible at a glance. */}
                    {(() => {
                      const jt = jobTypes.find(j => j.key === t.jobTypeKey);
                      return jt ? (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 shrink-0" style={{ backgroundColor: jt.color + "22", color: jt.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: jt.color }} />{jt.name}
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>No job type</span>
                      );
                    })()}
                  </div>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{t.description || `For ${jobTypeName(t.jobTypeKey)} jobs`}</p>
                </div>
                <div onClick={e => e.stopPropagation()} className="shrink-0 -mt-1 -mr-1">
                  <ActionsMenu size="sm" label="Template actions" actions={[
                    { label: "Open builder", icon: Pencil, onClick: () => setEditingId(t.id) },
                    { label: "Duplicate", icon: Copy, onClick: () => duplicate(t) },
                    { label: "Delete", icon: Trash2, onClick: () => remove(t.id), danger: true, separated: true },
                  ]} />
                </div>
              </div>
              {/* Step-flow preview — hover the strip to see every step when there are more than 4 */}
              <div className="px-4 pb-3 flex items-center gap-1.5 overflow-hidden" title={steps.length > 4 ? steps.map((s, i) => `${i + 1}. ${s.label}`).join("\n") : undefined}>
                {steps.length === 0 ? <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>No steps yet</span>
                  : steps.slice(0, 4).map((s, i) => (
                    <span key={s.id} className="flex items-center gap-1.5 shrink-0 min-w-0">
                      <span className="text-[11px] px-2 py-1 rounded-lg truncate max-w-[110px]" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{s.label}</span>
                      {i < Math.min(steps.length, 4) - 1 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />}
                    </span>
                  ))}
                {steps.length > 4 && <span className="text-[11px] font-semibold shrink-0 px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>+{steps.length - 4}</span>}
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-medium mt-auto rounded-b-2xl" style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}><CheckSquare className="w-3.5 h-3.5" />{steps.length} step{steps.length === 1 ? "" : "s"}</span>
                <span style={{ color: "var(--border)" }}>·</span>
                <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>{req} required</span>
                <span style={{ color: "var(--border)" }}>·</span>
                <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}><Camera className="w-3.5 h-3.5" />{pics}</span>
              </div>
            </div>
          );
        })}
        {templates.length === 0 && (
          <div className="sm:col-span-2 rounded-2xl p-10 text-center" style={{ border: "1.5px dashed var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
            <ClipboardList className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No templates yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Create your first work order template to define the field workflow.</p>
            <button onClick={startNew} className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: ACCENT }}><Plus className="w-3.5 h-3.5" /> New template</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Full-screen builder for one template ─────────────────
function TemplateBuilder({ templateId, jobTypes, onBack }: {
  templateId: string; jobTypes: { key: string; name: string }[]; onBack: () => void;
}) {
  const [tpl, setTpl] = useState<WorkOrderTemplate>(() => getTemplates().find(t => t.id === templateId)!);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => getChecklist(templateId));
  const [photos, setPhotos] = useState<RequiredPhoto[]>(() => getPhotos(templateId));
  const [instructions, setInstructions] = useState<WOInstructions>(() => getInstructions(templateId));
  const [sel, setSel] = useState<Sel>(null);
  const lastSnap = useRef<string | null>(null);

  const patchTpl = (p: Partial<WorkOrderTemplate>) => setTpl(t => ({ ...t, ...p }));

  const sortedSteps = [...checklist].sort((a, b) => a.order - b.order);
  function addStep() {
    const max = checklist.length ? Math.max(...checklist.map(i => i.order)) : 0;
    const n: ChecklistItem = { id: woId("ci"), templateId, label: "New step", required: false, order: max + 1, active: true };
    setChecklist(prev => [...prev, n]); setSel({ kind: "step", id: n.id });
  }
  function moveStep(id: string, dir: -1 | 1) {
    const s = [...checklist].sort((a, b) => a.order - b.order);
    const i = s.findIndex(x => x.id === id), j = i + dir; if (j < 0 || j >= s.length) return;
    [s[i].order, s[j].order] = [s[j].order, s[i].order]; setChecklist([...s]);
  }
  const patchStep = (id: string, p: Partial<ChecklistItem>) => setChecklist(prev => prev.map(i => i.id === id ? { ...i, ...p } : i));
  const removeStep = (id: string) => { setChecklist(prev => prev.filter(i => i.id !== id)); setSel(null); };
  function addPhoto() {
    const n: RequiredPhoto = { id: woId("rp"), templateId, category: PHOTO_CATEGORIES[0], required: true, minCount: 1, notes: "" };
    setPhotos(prev => [...prev, n]); setSel({ kind: "photo", id: n.id });
  }
  const patchPhoto = (id: string, p: Partial<RequiredPhoto>) => setPhotos(prev => prev.map(x => x.id === id ? { ...x, ...p } : x));
  const removePhoto = (id: string) => { setPhotos(prev => prev.filter(x => x.id !== id)); setSel(null); };
  const patchInstr = (k: keyof Omit<WOInstructions, "templateId">, v: string) => setInstructions(r => ({ ...r, [k]: v }));

  // Auto-save: persist on any real change and flash "saved". We snapshot the
  // editable state and skip when it's unchanged — so the initial mount (and
  // StrictMode's double-invoke in dev) never fires a spurious "Saved".
  useEffect(() => {
    const snap = JSON.stringify({ tpl, checklist, photos, instructions });
    if (lastSnap.current === null) { lastSnap.current = snap; return; }
    if (lastSnap.current === snap) return;
    lastSnap.current = snap;
    // Editing bubbles the template to the top of the stack (order 0 → renumbered first).
    saveTemplates(getTemplates().map(t => t.id === tpl.id ? { ...tpl, order: 0 } : t));
    saveChecklist(templateId, checklist); savePhotos(templateId, photos); saveInstructions({ ...instructions, templateId });
    pingSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpl, checklist, photos, instructions]);

  const onLayoutChange = (layout: TemplateLayout) => { saveLayout(templateId, layout); pingSaved(); };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* Immersive header */}
      <header className="flex items-center gap-3 px-4 h-14 shrink-0" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Templates</button>
        <div className="h-5 w-px" style={{ backgroundColor: "var(--border)" }} />
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tpl.active ? "#16a34a" : "#9ca3af" }} />
        <input value={tpl.name} onChange={e => patchTpl({ name: e.target.value })} placeholder="Template name" className="flex-1 max-w-md text-base font-semibold bg-transparent outline-none" style={{ color: "var(--text-primary)" }} />
      </header>

      {/* Full-width canvas; inspector floats over it */}
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0">
          <Canvas tpl={tpl} steps={sortedSteps} photos={photos} sel={sel} onSelect={setSel} onAddStep={addStep} onAddPhoto={addPhoto} onMoveStep={moveStep}
            initialLayout={getLayout(templateId)} onLayoutChange={onLayoutChange} />
        </div>
        <CanvasBoot />
        {sel && (
          <aside className="absolute top-3 right-3 z-30 w-80 max-h-[calc(100%-1.5rem)] flex flex-col rounded-2xl overflow-hidden"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)" }}>
            <Inspector sel={sel} tpl={tpl} jobTypes={jobTypes} steps={checklist} photos={photos} instructions={instructions}
              onClose={() => setSel(null)} patchTpl={patchTpl} patchStep={patchStep} removeStep={removeStep} patchPhoto={patchPhoto} removePhoto={removePhoto} patchInstr={patchInstr} />
          </aside>
        )}
      </div>

    </div>
  );
}

// ─── Boot curtain ─────────────────────────────────────────
// Minimal "loading canvas" splash. Self-controlled: holds for a guaranteed
// on-screen time, then fades out and unmounts — same timing/feel as switching
// apps (see AppLoadingOverlay). Just a small spinner over the dot-grid, no icon.
function CanvasBoot() {
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t1 = window.setTimeout(() => setFading(true), 900);   // MIN_VISIBLE_MS
    const t2 = window.setTimeout(() => setDone(true), 900 + 500); // + FADE_MS
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, []);
  if (done) return null;
  return (
    <div aria-hidden className="absolute inset-0 z-40 flex items-center justify-center"
      style={{ opacity: fading ? 0 : 1, transition: "opacity 500ms ease", pointerEvents: fading ? "none" : "auto" }}>
      <div className="absolute inset-0" style={{ backgroundColor: "var(--bg-page)", backgroundImage: "radial-gradient(var(--border-subtle) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
      <div className="relative flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--text-muted)" }} />
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading canvas…</span>
      </div>
    </div>
  );
}

// ─── The pannable / zoomable canvas ───────────────────────
function Canvas({ tpl, steps, photos, sel, onSelect, onAddStep, onAddPhoto, onMoveStep, initialLayout, onLayoutChange }: {
  tpl: WorkOrderTemplate; steps: ChecklistItem[]; photos: RequiredPhoto[]; sel: Sel;
  onSelect: (s: Sel) => void; onAddStep: () => void; onAddPhoto: () => void; onMoveStep: (id: string, d: -1 | 1) => void;
  initialLayout?: TemplateLayout; onLayoutChange: (l: TemplateLayout) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 40, y: 64, zoom: 1 });
  const viewRef = useRef(view); viewRef.current = view;
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceRef = useRef(false);
  const panning = useRef(false);
  const didCenter = useRef(false);
  const wfRef = useRef<HTMLDivElement>(null);
  const phRef = useRef<HTMLDivElement>(null);
  // Lanes are free-positioned on the canvas (drag by their header). Nodes are
  // children, so a lane drags its steps with it.
  const LANE_W = { workflow: 256, photos: 240 } as const;
  const GAP = 56;
  const [lanePos, setLanePos] = useState<TemplateLayout>(() => initialLayout ?? { workflow: { x: 0, y: 0 }, photos: { x: LANE_W.workflow + GAP, y: 0 } });
  const lanePosRef = useRef(lanePos); lanePosRef.current = lanePos;
  // Step ↔ photo links, drawn as connectors. Nodes register their element so we
  // can measure world-coord positions (like the project Map builder).
  const worldRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());
  const registerNode = (id: string, el: HTMLElement | null) => { if (el) nodeRefs.current.set(id, el); else nodeRefs.current.delete(id); };
  const [edges, setEdges] = useState<{ id: string; d: string }[]>([]);
  const recompute = () => {
    const world = worldRef.current; if (!world) return;
    const wr = world.getBoundingClientRect(); const z = viewRef.current.zoom || 1;
    const pos = (id: string) => { const el = nodeRefs.current.get(id); if (!el) return null; const r = el.getBoundingClientRect(); return { l: (r.left - wr.left) / z, t: (r.top - wr.top) / z, w: r.width / z, h: r.height / z }; };
    const out: { id: string; d: string }[] = [];
    for (const s of steps) for (const pid of s.photoIds ?? []) {
      const a = pos(s.id), b = pos(pid); if (!a || !b) continue;
      // Adaptive: exit/enter on whichever edges face each other, so the link reads
      // right whether the photo is to the right, left, above, or below the step.
      const acx = a.l + a.w / 2, acy = a.t + a.h / 2, bcx = b.l + b.w / 2, bcy = b.t + b.h / 2;
      const dx = bcx - acx, dy = bcy - acy;
      let x1: number, y1: number, x2: number, y2: number, c1x: number, c1y: number, c2x: number, c2y: number;
      if (Math.abs(dx) >= Math.abs(dy)) {
        x1 = dx >= 0 ? a.l + a.w : a.l; x2 = dx >= 0 ? b.l : b.l + b.w; y1 = acy; y2 = bcy;
        const k = Math.max(30, Math.abs(x2 - x1) / 2) * (dx >= 0 ? 1 : -1);
        c1x = x1 + k; c1y = y1; c2x = x2 - k; c2y = y2;
      } else {
        y1 = dy >= 0 ? a.t + a.h : a.t; y2 = dy >= 0 ? b.t : b.t + b.h; x1 = acx; x2 = bcx;
        const k = Math.max(24, Math.abs(y2 - y1) / 2) * (dy >= 0 ? 1 : -1);
        c1x = x1; c1y = y1 + k; c2x = x2; c2y = y2 - k;
      }
      out.push({ id: `${s.id}->${pid}`, d: `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}` });
    }
    setEdges(prev => JSON.stringify(prev) === JSON.stringify(out) ? prev : out);
  };

  const zoomAt = (factor: number, cx: number, cy: number) => setView(v => {
    const z = clamp(v.zoom * factor, 0.4, 1.8);
    const wx = (cx - v.x) / v.zoom, wy = (cy - v.y) / v.zoom;
    return { x: cx - wx * z, y: cy - wy * z, zoom: z };
  });
  const zoomButton = (f: number) => { const vp = viewportRef.current; if (!vp) return; zoomAt(f, vp.clientWidth / 2, vp.clientHeight / 2); };

  // Fit the lanes' bounding box to the viewport (centered). `pos` lets align()
  // center the NEW layout without waiting for a state round-trip.
  const fit = (pos = lanePos) => {
    const vp = viewportRef.current; if (!vp) return;
    const boxes = [
      { x: pos.workflow.x, y: pos.workflow.y, w: LANE_W.workflow, h: wfRef.current?.offsetHeight ?? 240 },
      { x: pos.photos.x, y: pos.photos.y, w: LANE_W.photos, h: phRef.current?.offsetHeight ?? 240 },
    ];
    const minX = Math.min(...boxes.map(b => b.x)), minY = Math.min(...boxes.map(b => b.y));
    const maxX = Math.max(...boxes.map(b => b.x + b.w)), maxY = Math.max(...boxes.map(b => b.y + b.h));
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    const z = clamp(Math.min((vp.clientWidth - 96) / bw, (vp.clientHeight - 96) / bh, 1), 0.4, 1);
    setView({ x: (vp.clientWidth - bw * z) / 2 - minX * z, y: (vp.clientHeight - bh * z) / 2 - minY * z, zoom: z });
  };
  const center = () => fit();
  // Tidy the lanes back into a neat side-by-side row, then fit.
  const align = () => { const pos = { workflow: { x: 0, y: 0 }, photos: { x: LANE_W.workflow + GAP, y: 0 } }; setLanePos(pos); fit(pos); onLayoutChange(pos); };

  const startLaneDrag = (lane: "workflow" | "photos", e: React.PointerEvent) => {
    if (spaceRef.current) return;
    e.stopPropagation();
    const other = lane === "workflow" ? "photos" : "workflow";
    const movingRef = lane === "workflow" ? wfRef : phRef;
    const otherRef = other === "workflow" ? wfRef : phRef;
    const sx = e.clientX, sy = e.clientY, start = lanePos[lane], z = viewRef.current.zoom;
    const GAP2 = 16;   // minimum breathing room between lanes
    const move = (ev: PointerEvent) => setLanePos(p => {
      let x = start.x + (ev.clientX - sx) / z;
      let y = start.y + (ev.clientY - sy) / z;
      const mW = LANE_W[lane], mH = movingRef.current?.offsetHeight ?? 240;
      const o = p[other], oW = LANE_W[other], oH = otherRef.current?.offsetHeight ?? 240;
      // Resolve any AABB overlap by pushing out along the axis of least penetration.
      const ox = Math.min(x + mW, o.x + oW + GAP2) - Math.max(x, o.x - GAP2);
      const oy = Math.min(y + mH, o.y + oH + GAP2) - Math.max(y, o.y - GAP2);
      if (ox > 0 && oy > 0) {
        if (ox < oy) x += (x + mW / 2 < o.x + oW / 2) ? -ox : ox;
        else y += (y + mH / 2 < o.y + oH / 2) ? -oy : oy;
      }
      return { ...p, [lane]: { x, y } };
    });
    const up = () => { onLayoutChange(lanePosRef.current); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  useLayoutEffect(() => { recompute(); if (!didCenter.current && viewportRef.current) { didCenter.current = true; fit(); } });

  useEffect(() => {
    const typing = () => { const el = document.activeElement as HTMLElement | null; return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable); };
    const down = (e: KeyboardEvent) => { if (e.code === "Space" && !typing() && !spaceRef.current) { e.preventDefault(); spaceRef.current = true; setSpaceHeld(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") { spaceRef.current = false; setSpaceHeld(false); } };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    const vp = viewportRef.current; if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - rect.left, e.clientY - rect.top);
      else setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (spaceRef.current) {
      e.preventDefault(); panning.current = true;
      const sx = e.clientX, sy = e.clientY, ox = viewRef.current.x, oy = viewRef.current.y;
      const move = (ev: PointerEvent) => { if (panning.current) setView(v => ({ ...v, x: ox + (ev.clientX - sx), y: oy + (ev.clientY - sy) })); };
      const up = () => { panning.current = false; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); return;
    }
    if ((e.target as HTMLElement).closest("[data-node], button, input, select, textarea")) return;
    const sx = e.clientX, sy = e.clientY; let moved = false;
    const move = (ev: PointerEvent) => { if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) moved = true; };
    const up = () => { if (!moved) onSelect(null); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  const stepConnector = <div className="flex justify-center"><div className="w-px h-4" style={{ backgroundColor: "var(--border)" }} /></div>;

  return (
    <div ref={viewportRef} onPointerDown={onPointerDown}
      className={`w-full h-full overflow-hidden relative ${spaceHeld ? "cursor-grab select-none" : ""}`}
      style={{ backgroundColor: "var(--bg-page)", backgroundImage: "radial-gradient(var(--border-subtle) 1px, transparent 1px)", backgroundSize: `${22 * view.zoom}px ${22 * view.zoom}px`, backgroundPosition: `${view.x}px ${view.y}px` }}>
      <div ref={worldRef} style={{ position: "absolute", top: 0, left: 0, transformOrigin: "0 0", transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, pointerEvents: spaceHeld ? "none" : undefined }}>
        {/* Step → photo links */}
        <svg className="absolute top-0 left-0 pointer-events-none overflow-visible" width="10" height="10" style={{ zIndex: 0 }}>
          <defs>
            <marker id="woLink" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#2563eb" opacity="0.75" /></marker>
          </defs>
          {edges.map(e => <path key={e.id} d={e.d} fill="none" stroke="#2563eb" strokeOpacity="0.5" strokeWidth="1.6" markerEnd="url(#woLink)" />)}
        </svg>

        {/* Checklist lane — drag the header grip to move the whole flow */}
        <div ref={wfRef} style={{ position: "absolute", left: lanePos.workflow.x, top: lanePos.workflow.y, width: LANE_W.workflow, zIndex: 1 }}>
          <LaneScopeCard label="Checklist" icon={FileText} onClick={() => onSelect({ kind: "scope" })} onDrag={e => startLaneDrag("workflow", e)} />
          {steps.map((s, i) => (
            <div key={s.id}>
              {stepConnector}
              <StepNode step={s} idx={i} total={steps.length} selected={sel?.kind === "step" && sel.id === s.id} linkCount={s.photoIds?.length ?? 0}
                setRef={el => registerNode(s.id, el)}
                onClick={() => onSelect({ kind: "step", id: s.id })} onUp={() => onMoveStep(s.id, -1)} onDown={() => onMoveStep(s.id, 1)} />
            </div>
          ))}
          {stepConnector}
          <button onClick={onAddStep} data-node className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1.5px dashed var(--border)", color: "var(--text-muted)", backgroundColor: "var(--bg-surface)" }}>
            <Plus className="w-3.5 h-3.5" /> Add step
          </button>
        </div>

        {/* Photos lane */}
        <div ref={phRef} style={{ position: "absolute", left: lanePos.photos.x, top: lanePos.photos.y, width: LANE_W.photos, zIndex: 1 }}>
          <LaneScopeCard label="Photos" icon={Camera} onClick={() => onSelect({ kind: "scope" })} onDrag={e => startLaneDrag("photos", e)} />
          <div className="space-y-2.5">
            {photos.map(p => (
              <PhotoNode key={p.id} photo={p} selected={sel?.kind === "photo" && sel.id === p.id} setRef={el => registerNode(p.id, el)} onClick={() => onSelect({ kind: "photo", id: p.id })} />
            ))}
            <button onClick={onAddPhoto} data-node className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1.5px dashed var(--border)", color: "var(--text-muted)", backgroundColor: "var(--bg-surface)" }}>
              <Plus className="w-3.5 h-3.5" /> Add photo rule
            </button>
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 rounded-xl p-1"
        style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 88%, transparent)", border: "1px solid var(--border)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.35)", backdropFilter: "blur(10px)" }}>
        <CtrlBtn onClick={() => zoomButton(0.83)} title="Zoom out"><Minus className="w-4 h-4" /></CtrlBtn>
        <button onClick={center} className="px-2 py-1 rounded-lg text-xs font-semibold tabular-nums min-w-[3rem] transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>{Math.round(view.zoom * 100)}%</button>
        <CtrlBtn onClick={() => zoomButton(1.2)} title="Zoom in"><Plus className="w-4 h-4" /></CtrlBtn>
        <div className="w-px h-5 mx-0.5" style={{ backgroundColor: "var(--border)" }} />
        <CtrlBtn onClick={align} title="Align & tidy"><LayoutGrid className="w-4 h-4" /></CtrlBtn>
        <CtrlBtn onClick={center} title="Fit to view"><Maximize className="w-4 h-4" /></CtrlBtn>
        <div className="w-px h-5 mx-0.5" style={{ backgroundColor: "var(--border)" }} />
        <button onClick={() => onSelect(sel?.kind === "scope" ? null : { kind: "scope" })} aria-expanded={sel?.kind === "scope"} title="Scope & defaults"
          className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold transition-colors hover:bg-[var(--bg-surface-2)]"
          style={sel?.kind === "scope" ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" } : { color: "var(--text-secondary)" }}>
          <FileText className="w-3.5 h-3.5" /> Scope & defaults
        </button>
      </div>
      <p className="absolute bottom-3 right-3 z-10 text-[10px] pointer-events-none" style={{ color: "var(--text-muted)" }}>Hold Space to pan · ⌘-scroll to zoom</p>
    </div>
  );
}

function CtrlBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return <button onClick={onClick} title={title} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>{children}</button>;
}

// A lane's header card: a drag grip (moves the lane + its nodes) and a label that
// opens the Scope inspector. One per lane — "Checklist" and "Photos". No active
// state (scope isn't a "selectable" node).
function LaneScopeCard({ label, icon: Icon, onClick, onDrag }: {
  label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; onClick: () => void; onDrag: (e: React.PointerEvent) => void;
}) {
  return (
    <div data-node className="group/lane rounded-xl p-2.5 mb-2 flex items-center gap-2 transition-all"
      style={{ backgroundColor: "var(--bg-surface)", border: "1.5px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <button onPointerDown={onDrag} title="Drag to move" className="cursor-grab active:cursor-grabbing shrink-0" style={{ color: "var(--text-muted)" }}>
        <GripVertical className="w-3.5 h-3.5 opacity-40 group-hover/lane:opacity-100 transition-opacity" />
      </button>
      <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)" }}><Icon className="w-3.5 h-3.5" style={{ color: ACCENT }} /></span>
      <button onClick={onClick} className="text-[13px] font-semibold flex-1 min-w-0 truncate text-left" style={{ color: "var(--text-primary)" }}>{label}</button>
    </div>
  );
}

function StepNode({ step, idx, total, selected, linkCount, onClick, onUp, onDown, setRef }: {
  step: ChecklistItem; idx: number; total: number; selected: boolean; linkCount: number; onClick: () => void; onUp: () => void; onDown: () => void; setRef: (el: HTMLElement | null) => void;
}) {
  return (
    <div ref={setRef} data-node onClick={onClick} title={`${checklistTypeLabel(step.type)}${step.required ? " · Required" : ""}`}
      className="group rounded-xl p-2.5 cursor-pointer transition-all" style={{ backgroundColor: "var(--bg-surface)", border: `1.5px solid ${selected ? ACCENT : "var(--border-subtle)"}`, boxShadow: selected ? `0 0 0 3px ${ACCENT}22` : "var(--shadow-card)", opacity: step.active ? 1 : 0.55 }}>
      <div className="flex items-center gap-2">
        {/* Number badge — soft cream when the step is required. */}
        <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold"
          style={step.required ? { backgroundColor: REQ_BG, color: REQ_TEXT } : { backgroundColor: "var(--accent-soft-bg)", color: ACCENT }}>{idx + 1}</span>
        <p className="text-[13px] font-semibold leading-snug flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>{step.label}</p>
        {linkCount > 0 && <span className="inline-flex items-center shrink-0" title={`Requires ${linkCount} photo${linkCount === 1 ? "" : "s"}`} style={{ color: "#2563eb" }}><Camera className="w-2.5 h-2.5" /></span>}
        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: "var(--text-muted)" }}>
          <button onClick={e => { e.stopPropagation(); onUp(); }} disabled={idx === 0} className="disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
          <button onClick={e => { e.stopPropagation(); onDown(); }} disabled={idx === total - 1} className="disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
        </div>
      </div>
    </div>
  );
}

function PhotoNode({ photo, selected, onClick, setRef }: { photo: RequiredPhoto; selected: boolean; onClick: () => void; setRef: (el: HTMLElement | null) => void }) {
  return (
    <div ref={setRef} data-node onClick={onClick} title={`Min ${photo.minCount}${photo.required ? " · Required" : ""}`}
      className="rounded-xl p-2.5 cursor-pointer transition-all flex items-center gap-2" style={{ backgroundColor: "var(--bg-surface)", border: `1.5px solid ${selected ? ACCENT : "var(--border-subtle)"}`, boxShadow: selected ? `0 0 0 3px ${ACCENT}22` : "var(--shadow-card)" }}>
      <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={photo.required ? { backgroundColor: REQ_BG } : { backgroundColor: "#dbeafe" }}><Camera className="w-3.5 h-3.5" style={{ color: photo.required ? REQ_TEXT : "#2563eb" }} /></span>
      <p className="text-[13px] font-semibold flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>{photo.category}</p>
      {photo.minCount > 1 && <span className="text-[10px] tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>×{photo.minCount}</span>}
    </div>
  );
}

// Segmented two-state control — a minimal CRM-styled replacement for a toggle.
// Transparent track (just a hairline), the active option gets a soft accent fill.
function Seg({ value, on, off, onChange }: { value: boolean; on: string; off: string; onChange: (v: boolean) => void }) {
  return (
    <div className="flex w-fit items-center rounded-lg p-0.5" style={{ border: "1px solid var(--border)", backgroundColor: "transparent" }}>
      {[{ v: true, label: on }, { v: false, label: off }].map(o => (
        <button key={o.label} onClick={() => onChange(o.v)} className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
          style={value === o.v ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" } : { color: "var(--text-muted)" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Photo linking — removable chips + an "Add" button that opens a searchable,
// checkable modal (the same pattern as adding people to a dispatch board).
function PhotoLinkPicker({ photos, selectedIds, onToggle }: { photos: RequiredPhoto[]; selectedIds: string[]; onToggle: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const list = photos.filter(p => !ql || p.category.toLowerCase().includes(ql));
  const selected = photos.filter(p => selectedIds.includes(p.id));
  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>Requires photos</label>
        <button type="button" onClick={() => { setQ(""); setOpen(true); }} className="flex items-center gap-1 text-[11px] font-medium hover:opacity-70 transition-opacity" style={{ color: "var(--accent-text)" }}>
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      <div className="w-full min-h-[34px] rounded-lg px-2 py-1.5 flex flex-wrap items-center gap-1" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        {selected.length === 0 && <span className="text-sm" style={{ color: "var(--text-muted)" }}>No photos linked</span>}
        {selected.map(p => (
          <span key={p.id} className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)" }}>
            {p.category}
            <span role="button" onClick={() => onToggle(p.id)} className="cursor-pointer hover:opacity-70"><X className="w-2.5 h-2.5" /></span>
          </span>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
            <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Link photos to this step</p>
              <button onClick={() => setOpen(false)} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search photo rules…" className="w-full text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto thin-scroll-y px-2 py-2">
              {list.length === 0 ? <p className="px-3 py-3 text-xs" style={{ color: "var(--text-muted)" }}>No photo rules match.</p>
                : list.map(p => {
                  const on = selectedIds.includes(p.id);
                  return (
                    <button key={p.id} onClick={() => onToggle(p.id)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                      <span className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ border: `1.5px solid ${on ? "#c9c0b2" : "var(--border)"}`, backgroundColor: on ? "#E5E0DB" : "transparent" }}>{on && <Check className="w-3 h-3" style={{ color: "#5c5545" }} />}</span>
                      <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>{p.category}</span>
                      {p.notes && <span className="text-[11px] truncate max-w-[40%]" style={{ color: "var(--text-muted)" }}>{p.notes}</span>}
                    </button>
                  );
                })}
            </div>
            <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{selectedIds.length} linked</span>
              <button onClick={() => setOpen(false)} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: ACCENT }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Inspector (floating, right) ──────────────────────────
function Inspector({ sel, tpl, jobTypes, steps, photos, instructions, onClose, patchTpl, patchStep, removeStep, patchPhoto, removePhoto, patchInstr }: {
  sel: Exclude<Sel, null>; tpl: WorkOrderTemplate; jobTypes: { key: string; name: string }[];
  steps: ChecklistItem[]; photos: RequiredPhoto[]; instructions: WOInstructions; onClose: () => void;
  patchTpl: (p: Partial<WorkOrderTemplate>) => void;
  patchStep: (id: string, p: Partial<ChecklistItem>) => void; removeStep: (id: string) => void;
  patchPhoto: (id: string, p: Partial<RequiredPhoto>) => void; removePhoto: (id: string) => void;
  patchInstr: (k: keyof Omit<WOInstructions, "templateId">, v: string) => void;
}) {
  const step = sel.kind === "step" ? steps.find(s => s.id === sel.id) : undefined;
  const photo = sel.kind === "photo" ? photos.find(p => p.id === sel.id) : undefined;
  const title = sel.kind === "scope" ? "Scope & defaults" : sel.kind === "step" ? "Edit step" : "Photo rule";

  // Auto-create policy lives on the JOB TYPE (same field the Job Types settings
  // used to edit) — shown here for the type this template is linked to.
  const [, forcePolicy] = useState(0);
  const linkedPolicy = getJobTypes().find(j => j.key === tpl.jobTypeKey)?.workOrderPolicy ?? "optional";
  function setLinkedPolicy(v: WorkOrderPolicy) {
    saveJobTypes(getJobTypes().map(t => t.key === tpl.jobTypeKey ? { ...t, workOrderPolicy: v } : t));
    forcePolicy(x => x + 1); pingSaved();
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{title}</p>
        <div className="flex items-center gap-1">
          {sel.kind === "step" && step && <button onClick={() => removeStep(step.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}><Trash2 className="w-4 h-4" /></button>}
          {sel.kind === "photo" && photo && <button onClick={() => removePhoto(photo.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}><Trash2 className="w-4 h-4" /></button>}
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sel.kind === "scope" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority"><UiSelect size="sm" value={tpl.priority} onChange={v => patchTpl({ priority: v as WOPriority })} options={PRIORITIES.map(p => ({ value: p, label: WO_PRIORITY_LABELS[p] }))} /></Field>
              <Field label="Duration (min)"><NumberStepper size="sm" min={0} step={15} value={String(tpl.duration)} onChange={v => patchTpl({ duration: parseInt(v, 10) || 0 })} /></Field>
            </div>
            <Field label="Linked job type"><UiSelect size="sm" value={tpl.jobTypeKey} onChange={v => patchTpl({ jobTypeKey: v })} options={[{ value: "", label: "None" }, ...jobTypes.map(j => ({ value: j.key, label: j.name }))]} /></Field>
            <Field label="Auto-create">
              {tpl.jobTypeKey ? (
                <>
                  <UiSelect size="sm" value={linkedPolicy} onChange={v => setLinkedPolicy(v as WorkOrderPolicy)}
                    options={WO_POLICIES.map(pk => ({ value: pk, label: WORK_ORDER_POLICY_LABELS[pk] }))} />
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                    What happens when a {jobTypes.find(j => j.key === tpl.jobTypeKey)?.name ?? "linked-type"} job is booked. Applies to the job type, not just this template.
                  </p>
                </>
              ) : (
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Link a job type to control whether its work order auto-creates.</p>
              )}
            </Field>
            <Seg value={tpl.active} on="Active" off="Inactive" onChange={v => patchTpl({ active: v })} />
            <div className="pt-1" style={{ borderTop: "1px solid var(--border)" }} />
            {INSTRUCTION_FIELDS.map(f => (
              <Field key={f.key} label={f.label}>
                <textarea value={instructions[f.key]} onChange={e => patchInstr(f.key, e.target.value)} placeholder={f.placeholder} rows={2} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={inputStyle} />
              </Field>
            ))}
          </>
        )}
        {sel.kind === "step" && step && (
          <>
            <Field label="Step label"><input value={step.label} onChange={e => patchStep(step.id, { label: e.target.value })} className={inputCls} style={inputStyle} autoFocus /></Field>
            <Field label="Type"><UiSelect size="sm" value={step.type ?? ""}
              onChange={v => {
                const t = (v || undefined) as ChecklistItemType | undefined;
                const needsOptions = t === "dropdown" || t === "multi_select";
                patchStep(step.id, { type: t, ...(needsOptions && !(step.options?.length) ? { options: ["", ""] } : {}) });
              }}
              options={[{ value: "", label: "Check-off" }, ...CHECK_TYPES.map(t => ({ value: t, label: CHECKLIST_TYPE_LABELS[t] }))]} /></Field>
            {/* Creator-entered config per type: choice steps need their options,
                number steps can carry a unit. */}
            {(step.type === "dropdown" || step.type === "multi_select") && (
              <Field label={step.type === "dropdown" ? "Options — tech picks one" : "Options — tech can pick several"}>
                <div className="space-y-1.5">
                  {(step.options ?? []).map((opt, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input value={opt} placeholder={`Option ${i + 1}`}
                        onChange={e => { const next = [...(step.options ?? [])]; next[i] = e.target.value; patchStep(step.id, { options: next }); }}
                        className={inputCls} style={inputStyle} />
                      <button onClick={() => patchStep(step.id, { options: (step.options ?? []).filter((_, j) => j !== i) })}
                        title="Remove option" className="p-1.5 rounded-lg shrink-0 hover:bg-[var(--bg-surface-2)]" style={{ color: "#9ca3af" }}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => patchStep(step.id, { options: [...(step.options ?? []), ""] })}
                    className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-[var(--bg-surface-2)]"
                    style={{ border: "1.5px dashed var(--border)", color: "var(--text-muted)" }}>
                    <Plus className="w-3 h-3" /> Add option
                  </button>
                  {(step.options ?? []).filter(o => o.trim()).length === 0 && (
                    <p className="text-[11px]" style={{ color: "#b45309" }}>This step needs at least one option for the tech to choose from.</p>
                  )}
                </div>
              </Field>
            )}
            {step.type === "number" && (
              <Field label="Unit (optional)">
                <input value={step.unit ?? ""} onChange={e => patchStep(step.id, { unit: e.target.value })}
                  placeholder="e.g. PSI, °F, V" className={inputCls} style={inputStyle} />
              </Field>
            )}
            <Seg value={step.required} on="Required" off="Optional" onChange={v => patchStep(step.id, { required: v })} />
            <Seg value={step.active} on="Active" off="Inactive" onChange={v => patchStep(step.id, { active: v })} />
            <div className="pt-1" style={{ borderTop: "1px solid var(--border)" }} />
            {photos.length === 0 ? (
              <Field label="Requires photos">
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Add photo rules in the Photos lane first, then link them here.</p>
              </Field>
            ) : (
              <PhotoLinkPicker photos={photos} selectedIds={step.photoIds ?? []}
                onToggle={pid => { const cur = step.photoIds ?? []; patchStep(step.id, { photoIds: cur.includes(pid) ? cur.filter(x => x !== pid) : [...cur, pid] }); }} />
            )}
          </>
        )}
        {sel.kind === "photo" && photo && (
          <>
            <Field label="Photo category"><UiSelect size="sm" value={photo.category} onChange={v => patchPhoto(photo.id, { category: v })} options={PHOTO_CATEGORIES.map(c => ({ value: c, label: c }))} /></Field>
            <Field label="Minimum photos"><NumberStepper size="sm" min={0} value={String(photo.minCount)} onChange={v => patchPhoto(photo.id, { minCount: Math.max(0, parseInt(v, 10) || 0) })} /></Field>
            <Field label="Notes"><input value={photo.notes} onChange={e => patchPhoto(photo.id, { notes: e.target.value })} placeholder="e.g. capture the nameplate clearly" className={inputCls} style={inputStyle} /></Field>
            <Seg value={photo.required} on="Required" off="Optional" onChange={v => patchPhoto(photo.id, { required: v })} />
          </>
        )}
      </div>
    </>
  );
}
