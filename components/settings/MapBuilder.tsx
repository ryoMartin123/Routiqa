"use client";

// ─── Project Map builder (full-screen, rail + lane canvas) ─
// A modern map composer: a left rail for the map's frame (project types, groups),
// a center lane canvas (groups as columns, nodes as cards, dependencies drawn as
// connectors), and a right inspector for the selected node — including the v2
// capabilities: duration/SLA, in-node checklist, automation hooks, and a
// conditional-appearance rule. Edits a local draft; Save hands it back up.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  X, Plus, Minus, Trash2, ChevronUp, ChevronDown, ArrowLeft, GitBranch, Clock, ListChecks, Split, SlidersHorizontal, Maximize,
  Layers, Flag, Briefcase, CheckSquare, ClipboardList, Package, ShoppingCart, HardHat, FileText, Receipt,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { NODE_TYPE_LABEL, type MapNodeType } from "@/lib/projects/map";
import {
  type MapTemplate, type TemplateNode, type MirrorSource,
  newMapNodeKey, newChecklistItemId,
} from "@/lib/projects/map-templates";
import { CHECKLIST_TYPE_LABELS, type ChecklistItemType } from "@/lib/work-order-templates/data";
import type { ProjectTypeOption } from "@/lib/projects/settings";

const ACCENT = "#0f8578";
const TYPE_ICON: Record<MapNodeType, typeof Layers> = {
  phase: Layers, milestone: Flag, job: Briefcase, task: CheckSquare, work_order: ClipboardList,
  material_request: Package, purchase_order: ShoppingCart, subcontractor: HardHat, document: FileText, billing: Receipt,
};
const NODE_TYPES = Object.keys(NODE_TYPE_LABEL) as MapNodeType[];
const MIRROR_LABEL: Record<MirrorSource, string> = {
  quote: "Quote", job: "Job", work_order: "Work Order", material_request: "Material Request",
  purchase_order: "Purchase Order", equipment_received: "Equipment Received", subcontractor: "Subcontractor", invoice: "Invoice",
};
const MIRROR_SOURCES = Object.keys(MIRROR_LABEL) as MirrorSource[];
const SOURCE_OPTS = [
  { value: "manual", label: "Manual checkbox" },
  { value: "checklist", label: "Checklist" },
  ...MIRROR_SOURCES.map(s => ({ value: s, label: `Mirror → ${MIRROR_LABEL[s]}` })),
];

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } as const;
const clone = (t: MapTemplate): MapTemplate => JSON.parse(JSON.stringify(t));

export default function MapBuilder({
  template, typeOptions, onSave, onCancel, readOnly = false,
}: {
  template: MapTemplate; typeOptions: ProjectTypeOption[];
  onSave: (t: MapTemplate) => void; onCancel: () => void; readOnly?: boolean;
}) {
  const [draft, setDraft] = useState<MapTemplate>(() => clone(template));
  const [selKey, setSelKey] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const sel = draft.nodes.find(n => n.key === selKey) ?? null;

  // Lanes: ordered groups + an "Other" bucket so nothing is hidden.
  const extra = draft.nodes.some(n => !draft.groups.includes(n.group));
  const lanes = [...draft.groups, ...(extra ? ["Other"] : [])];
  const nodesIn = (g: string) => draft.nodes.filter(n => g === "Other" ? !draft.groups.includes(n.group) : n.group === g);

  // ── Mutations ──
  const patch = (p: Partial<MapTemplate>) => setDraft(d => ({ ...d, ...p }));
  const patchNode = (key: string, p: Partial<TemplateNode>) => setDraft(d => ({ ...d, nodes: d.nodes.map(n => n.key === key ? { ...n, ...p } : n) }));
  const addNode = (group: string) => {
    const n: TemplateNode = { key: newMapNodeKey(), title: "New Step", type: "task", group, manual: true, deps: [] };
    setDraft(d => ({ ...d, nodes: [...d.nodes, n] })); setSelKey(n.key);
  };
  const removeNode = (key: string) =>
    setDraft(d => ({ ...d, nodes: d.nodes.filter(n => n.key !== key).map(n => ({ ...n, deps: n.deps.filter(x => x !== key) })) }));
  const moveNode = (key: string, dir: -1 | 1) => setDraft(d => {
    const arr = [...d.nodes]; const i = arr.findIndex(n => n.key === key); const j = i + dir;
    if (j < 0 || j >= arr.length) return d;
    [arr[i], arr[j]] = [arr[j], arr[i]]; return { ...d, nodes: arr };
  });
  const setSource = (key: string, v: string) => {
    if (v === "manual") { patchNode(key, { manual: true, mirror: undefined, createable: false, checklist: undefined }); return; }
    if (v === "checklist") {
      // Checklist source = a manual step worked through item by item. Seed one
      // empty item so the editor is ready; keep existing items if any.
      const node = draft.nodes.find(n => n.key === key);
      patchNode(key, { manual: true, mirror: undefined, createable: false, checklist: node?.checklist?.length ? node.checklist : [{ id: newChecklistItemId(), label: "" }] });
      return;
    }
    patchNode(key, { manual: false, mirror: v as MirrorSource, createable: true, checklist: undefined });
  };
  const toggleDep = (key: string, dep: string) => {
    const n = draft.nodes.find(x => x.key === key); if (!n) return;
    patchNode(key, { deps: n.deps.includes(dep) ? n.deps.filter(d => d !== dep) : [...n.deps, dep] });
  };
  // Groups
  const addGroup = (name: string) => { const g = name.trim(); if (!g || draft.groups.includes(g)) return; patch({ groups: [...draft.groups, g] }); };
  const removeGroup = (g: string) => patch({ groups: draft.groups.filter(x => x !== g) });
  const moveGroup = (g: string, dir: -1 | 1) => setDraft(d => {
    const arr = [...d.groups]; const i = arr.indexOf(g); const j = i + dir;
    if (j < 0 || j >= arr.length) return d;
    [arr[i], arr[j]] = [arr[j], arr[i]]; return { ...d, groups: arr };
  });
  const toggleType = (key: string) => {
    const has = (draft.projectTypes as string[]).includes(key);
    patch({ projectTypes: (has ? draft.projectTypes.filter(k => k !== key) : [...draft.projectTypes, key]) as MapTemplate["projectTypes"] });
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 h-14 shrink-0" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        <button onClick={onCancel} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Maps</button>
        <div className="h-5 w-px" style={{ backgroundColor: "var(--border)" }} />
        <input value={draft.name} readOnly={readOnly} onChange={e => patch({ name: e.target.value })} placeholder="Map name" className="flex-1 max-w-md text-base font-semibold bg-transparent outline-none" style={{ color: "var(--text-primary)" }} />
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setSetupOpen(o => !o)} aria-expanded={setupOpen} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ border: "1px solid var(--border)", color: setupOpen ? "var(--accent-text)" : "var(--text-secondary)", backgroundColor: setupOpen ? "var(--accent-soft-bg)" : "var(--bg-surface)" }}>
            <SlidersHorizontal className="w-3.5 h-3.5" /> Setup
          </button>
          {readOnly ? (
            <span className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>Built-in · read-only</span>
          ) : (
            <button onClick={() => onSave(draft)} disabled={!draft.name.trim()} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: ACCENT }}>Save map</button>
          )}
        </div>
      </header>

      {/* Full-width canvas; rail + inspector float over it as popups so more lanes
          always get the full width. */}
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0">
          <LaneCanvas lanes={lanes} nodesIn={nodesIn} nodes={draft.nodes} selKey={selKey} onSelect={setSelKey} onDeselect={() => setSelKey(null)} onAdd={addNode} onMove={moveNode} readOnly={readOnly} />
        </div>

        <div className="absolute bottom-3 left-3 z-10 pointer-events-none flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 85%, transparent)", border: "1px solid var(--border)", color: "var(--text-muted)", backdropFilter: "blur(8px)" }}>
          Hold <kbd className="px-1.5 py-0.5 rounded font-sans" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>Space</kbd> to pan · <kbd className="px-1.5 py-0.5 rounded font-sans" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>⌘</kbd>-scroll to zoom
        </div>

        {/* Map setup — popover */}
        {setupOpen && (
            <aside className="absolute top-3 left-3 z-30 w-64 max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl p-4 space-y-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)" }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Map setup</p>
                <button onClick={() => setSetupOpen(false)}><X className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></button>
              </div>
              <fieldset disabled={readOnly} className="space-y-5 border-0 p-0 m-0 min-w-0">
              <RailGroup icon={Split} title="Runs for">
                <div className="flex flex-wrap gap-1.5">
                  {typeOptions.map(t => {
                    const on = (draft.projectTypes as string[]).includes(t.key);
                    return (
                      <button key={t.key} onClick={() => toggleType(t.key)} className="text-xs font-medium px-2.5 py-1 rounded-full transition-colors"
                        style={{ backgroundColor: on ? "var(--accent-soft-bg)" : "var(--bg-input)", color: on ? "var(--accent-text)" : "var(--text-muted)", border: `1px solid ${on ? "var(--accent-soft-border)" : "transparent"}` }}>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>A new project picks the first map matching its type.</p>
              </RailGroup>
              <RailGroup icon={Layers} title="Groups (lanes, in order)">
                <div className="space-y-1.5">
                  {draft.groups.map((g, i) => (
                    <div key={g} className="flex items-center gap-1 text-xs font-medium pl-2.5 pr-1 py-1.5 rounded-lg" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                      <span className="flex-1 truncate">{g}</span>
                      <button onClick={() => moveGroup(g, -1)} disabled={i === 0} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => moveGroup(g, 1)} disabled={i === draft.groups.length - 1} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3.5 h-3.5" /></button>
                      <button onClick={() => removeGroup(g)} style={{ color: "var(--text-muted)" }}><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <AddGroupInput onAdd={addGroup} />
                </div>
              </RailGroup>
              </fieldset>
              <div className="rounded-xl p-3 text-[11px] leading-relaxed" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <b style={{ color: "var(--text-secondary)" }}>{draft.nodes.length}</b> steps across <b style={{ color: "var(--text-secondary)" }}>{draft.groups.length}</b> lanes.
              </div>
            </aside>
        )}

        {/* Node inspector — floating popup (doesn't consume canvas width) */}
        {sel && (
          <aside className="absolute top-3 right-3 z-30 w-80 max-h-[calc(100%-1.5rem)] flex flex-col rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)" }}>
            <Inspector key={sel.key} node={sel} draft={draft} onPatch={p => patchNode(sel.key, p)} onSetSource={v => setSource(sel.key, v)} onToggleDep={d => toggleDep(sel.key, d)} onRemove={() => { removeNode(sel.key); setSelKey(null); }} onClose={() => setSelKey(null)} readOnly={readOnly} />
          </aside>
        )}
      </div>
    </div>
  );
}

// ─── Free canvas (translate + scale) with dependency connectors ──
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function LaneCanvas({
  lanes, nodesIn, nodes, selKey, onSelect, onDeselect, onAdd, onMove, readOnly,
}: {
  lanes: string[]; nodesIn: (g: string) => TemplateNode[]; nodes: TemplateNode[];
  selKey: string | null; onSelect: (k: string) => void; onDeselect: () => void; onAdd: (g: string) => void; onMove: (k: string, d: -1 | 1) => void; readOnly?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);   // clips; receives pointer/wheel
  const worldRef = useRef<HTMLDivElement>(null);      // transformed content
  const lanesRef = useRef<HTMLDivElement>(null);      // the lanes box (true content size)
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const didCenter = useRef(false);
  const [edges, setEdges] = useState<{ id: string; d: string }[]>([]);
  const [worldSize, setWorldSize] = useState({ w: 1400, h: 900 });
  const [view, setView] = useState({ x: 32, y: 32, zoom: 1 });
  const viewRef = useRef(view); viewRef.current = view;
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceRef = useRef(false);
  const panning = useRef(false);

  // Connectors are measured in WORLD coordinates (un-scaled) so the SVG can live
  // inside the transformed world and scale with everything.
  const recompute = () => {
    const world = worldRef.current; if (!world) return;
    const wr = world.getBoundingClientRect();
    const z = viewRef.current.zoom;
    const pos = (key: string) => {
      const el = cardRefs.current.get(key); if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: (r.left - wr.left) / z, top: (r.top - wr.top) / z, w: r.width / z, h: r.height / z };
    };
    const out: { id: string; d: string }[] = [];
    for (const n of nodes) for (const dep of n.deps) {
      const a = pos(dep), b = pos(n.key); if (!a || !b) continue;
      let x1, y1, x2, y2, c1x, c2x, c1y, c2y;
      if (b.left > a.left + a.w - 12) {
        x1 = a.left + a.w; y1 = a.top + a.h / 2; x2 = b.left; y2 = b.top + b.h / 2;
        const dx = Math.max(28, (x2 - x1) / 2); c1x = x1 + dx; c2x = x2 - dx; c1y = y1; c2y = y2;
      } else {
        x1 = a.left + a.w / 2; y1 = a.top + a.h; x2 = b.left + b.w / 2; y2 = b.top;
        const dy = Math.max(20, (y2 - y1) / 2); c1x = x1; c2x = x2; c1y = y1 + dy; c2y = y2 - dy;
      }
      out.push({ id: `${dep}->${n.key}`, d: `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}` });
    }
    setEdges(prev => JSON.stringify(prev) === JSON.stringify(out) ? prev : out);
    const lanesEl = lanesRef.current;
    if (lanesEl) {
      const w = lanesEl.offsetWidth, h = lanesEl.offsetHeight;   // true content size (SVG is absolute)
      setWorldSize(prev => prev.w === w && prev.h === h ? prev : { w, h });
    }
  };

  const centerOn = () => {
    const vp = viewportRef.current, lanesEl = lanesRef.current; if (!vp || !lanesEl) return;
    const ww = lanesEl.offsetWidth;
    // Top-centered: centered horizontally, anchored near the top (work flows down).
    setView({ x: Math.max(24, (vp.clientWidth - ww) / 2), y: 28, zoom: 1 });
  };

  useLayoutEffect(() => {
    recompute();
    // Center the map in the viewport once it's measured (on open / first paint).
    if (!didCenter.current && (lanesRef.current?.offsetWidth ?? 0) > 0) { didCenter.current = true; centerOn(); }
  });

  // Space-to-pan toggle (ref so handlers never read stale state).
  useEffect(() => {
    const typing = () => { const el = document.activeElement as HTMLElement | null; return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable); };
    const down = (e: KeyboardEvent) => { if (e.code === "Space" && !typing() && !spaceRef.current) { e.preventDefault(); spaceRef.current = true; setSpaceHeld(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") { spaceRef.current = false; setSpaceHeld(false); } };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Wheel: ⌘/Ctrl-wheel (or pinch) zooms toward the cursor; plain wheel pans.
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

  const zoomAt = (factor: number, cx: number, cy: number) => setView(v => {
    const z = clamp(v.zoom * factor, 0.35, 2);
    const wx = (cx - v.x) / v.zoom, wy = (cy - v.y) / v.zoom;
    return { x: cx - wx * z, y: cy - wy * z, zoom: z };
  });
  const zoomButton = (factor: number) => { const vp = viewportRef.current; if (!vp) return; zoomAt(factor, vp.clientWidth / 2, vp.clientHeight / 2); };
  const centerView = centerOn;

  // Pan ONLY while holding Space (drag). Window listeners so the drag survives
  // past the viewport edge. Without Space, a clean click on empty space deselects.
  const onPointerDown = (e: React.PointerEvent) => {
    if (spaceRef.current) {
      e.preventDefault();
      panning.current = true;
      const sx = e.clientX, sy = e.clientY, ox = viewRef.current.x, oy = viewRef.current.y;
      const move = (ev: PointerEvent) => { if (panning.current) setView(v => ({ ...v, x: ox + (ev.clientX - sx), y: oy + (ev.clientY - sy) })); };
      const up = () => { panning.current = false; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      return;
    }
    const interactive = (e.target as HTMLElement).closest("[data-node], button, input, select, textarea");
    if (interactive) return;
    const sx = e.clientX, sy = e.clientY; let moved = false;
    const move = (ev: PointerEvent) => { if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) moved = true; };
    const up = () => { if (!moved) onDeselect(); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  return (
    <div ref={viewportRef} onPointerDown={onPointerDown}
      className={`w-full h-full overflow-hidden relative ${spaceHeld ? "cursor-grab select-none" : ""}`}
      style={{ backgroundColor: "var(--bg-page)", backgroundImage: "radial-gradient(var(--border-subtle) 1px, transparent 1px)", backgroundSize: `${22 * view.zoom}px ${22 * view.zoom}px`, backgroundPosition: `${view.x}px ${view.y}px` }}>

      {/* World — translated + scaled */}
      <div ref={worldRef} style={{ position: "absolute", top: 0, left: 0, transformOrigin: "0 0", transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, width: "max-content" }}>
        <svg className="absolute top-0 left-0 pointer-events-none overflow-visible" width={worldSize.w} height={worldSize.h} style={{ zIndex: 0 }}>
          <defs>
            <marker id="mapArrow" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={ACCENT} opacity="0.55" />
            </marker>
          </defs>
          {edges.map(e => <path key={e.id} d={e.d} fill="none" stroke={ACCENT} strokeOpacity="0.45" strokeWidth="1.6" markerEnd="url(#mapArrow)" />)}
        </svg>

        <div ref={lanesRef} className="relative flex gap-4 p-5" style={{ zIndex: 1, width: "max-content" }}>
          {lanes.map(g => {
            const items = nodesIn(g);
            return (
              <div key={g} className="w-60 shrink-0 flex flex-col">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{g}</p>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.map((n, i) => (
                    <NodeCard key={n.key} node={n} selected={n.key === selKey} onClick={() => onSelect(n.key)} onDoubleClick={onDeselect}
                      onUp={() => onMove(n.key, -1)} onDown={() => onMove(n.key, 1)} first={i === 0} last={i === items.length - 1} readOnly={readOnly}
                      setRef={el => { if (el) cardRefs.current.set(n.key, el); else cardRefs.current.delete(n.key); }} />
                  ))}
                  {!readOnly && (
                    <button onClick={() => onAdd(g)} data-add className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1.5px dashed var(--border)", color: "var(--text-muted)" }}>
                      <Plus className="w-3.5 h-3.5" /> Add step
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zoom controls — centered at the bottom */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 rounded-xl p-1"
        style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 88%, transparent)", border: "1px solid var(--border)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.35)", backdropFilter: "blur(10px)" }}>
        <CtrlBtn onClick={() => zoomButton(0.83)} title="Zoom out"><Minus className="w-4 h-4" /></CtrlBtn>
        <button onClick={centerView} title="Reset & center" className="px-2 py-1 rounded-lg text-xs font-semibold tabular-nums min-w-[3rem] transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>{Math.round(view.zoom * 100)}%</button>
        <CtrlBtn onClick={() => zoomButton(1.2)} title="Zoom in"><Plus className="w-4 h-4" /></CtrlBtn>
        <div className="w-px h-5 mx-0.5" style={{ backgroundColor: "var(--border)" }} />
        <CtrlBtn onClick={centerView} title="Fit to view"><Maximize className="w-4 h-4" /></CtrlBtn>
      </div>
    </div>
  );
}

function CtrlBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return <button onClick={onClick} title={title} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>{children}</button>;
}

function NodeCard({ node, selected, onClick, onDoubleClick, onUp, onDown, first, last, setRef, readOnly }: {
  node: TemplateNode; selected: boolean; onClick: () => void; onDoubleClick: () => void; onUp: () => void; onDown: () => void; first: boolean; last: boolean; setRef: (el: HTMLElement | null) => void; readOnly?: boolean;
}) {
  const Icon = TYPE_ICON[node.type] ?? CheckSquare;
  const badges = [
    node.type === "billing" && node.percent != null ? { icon: Receipt, label: `${node.percent}%` } : null,
    node.durationDays ? { icon: Clock, label: `${node.durationDays}d` } : null,
    node.checklist?.length ? { icon: ListChecks, label: String(node.checklist.length) } : null,
    node.deps.length ? { icon: GitBranch, label: String(node.deps.length) } : null,
  ].filter(Boolean) as { icon: typeof Clock; label: string }[];
  return (
    <div ref={setRef} data-node onClick={onClick} onDoubleClick={onDoubleClick} className="group rounded-xl p-2.5 cursor-pointer transition-all"
      style={{ backgroundColor: "var(--bg-surface)", border: `1.5px solid ${selected ? ACCENT : "var(--border-subtle)"}`, boxShadow: selected ? `0 0 0 3px ${ACCENT}22` : "var(--shadow-card)" }}>
      <div className="flex items-start gap-2">
        <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)" }}><Icon className="w-3.5 h-3.5" style={{ color: ACCENT }} /></span>
        <p className="text-[13px] font-semibold leading-snug flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>{node.title}</p>
        <div className={`flex flex-col opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${readOnly ? "hidden" : ""}`}>
          <button onClick={e => { e.stopPropagation(); onUp(); }} disabled={first} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3 h-3" /></button>
          <button onClick={e => { e.stopPropagation(); onDown(); }} disabled={last} className="disabled:opacity-20" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3 h-3" /></button>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{node.manual ? "Manual" : `↪ ${MIRROR_LABEL[node.mirror as MirrorSource] ?? "Mirror"}`}</span>
        {node.assignedTo && <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>· {node.assignedTo.split(" ")[0]}</span>}
      </div>
      {badges.length > 0 && (
        <div className="flex items-center gap-2 mt-1.5">
          {badges.map((b, i) => { const B = b.icon; return <span key={i} className="flex items-center gap-0.5 text-[9px]" style={{ color: "var(--text-muted)" }}><B className="w-3 h-3" />{b.label}</span>; })}
        </div>
      )}
    </div>
  );
}

// ─── Inspector ────────────────────────────────────────────
function Inspector({ node, draft, onPatch, onSetSource, onToggleDep, onRemove, onClose, readOnly }: {
  node: TemplateNode; draft: MapTemplate; onPatch: (p: Partial<TemplateNode>) => void; onSetSource: (v: string) => void; onToggleDep: (d: string) => void; onRemove: () => void; onClose: () => void; readOnly?: boolean;
}) {
  const others = draft.nodes.filter(n => n.key !== node.key);
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{readOnly ? "Step" : "Edit step"}</p>
        <div className="flex items-center gap-1">
          {!readOnly && <button onClick={onRemove} title="Delete step" className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}><Trash2 className="w-4 h-4" /></button>}
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
      </div>
      <fieldset disabled={readOnly} className="flex-1 overflow-y-auto p-4 space-y-5 border-0 m-0 min-w-0">
      <Field label="Title"><input value={node.title} onChange={e => onPatch({ title: e.target.value })} className={inputCls} style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Lane"><UiSelect size="sm" value={node.group} onChange={v => onPatch({ group: v })} options={draft.groups.map(g => ({ value: g, label: g }))} /></Field>
        <Field label="Type"><UiSelect size="sm" value={node.type} onChange={v => onPatch({ type: v as MapNodeType })} options={NODE_TYPES.map(t => ({ value: t, label: NODE_TYPE_LABEL[t] }))} /></Field>
      </div>
      <Field label="Source"><UiSelect size="sm" value={node.manual ? (node.checklist?.length ? "checklist" : "manual") : (node.mirror ?? "manual")} onChange={onSetSource} options={SOURCE_OPTS} /></Field>
      {!node.manual && (
        <label className="flex items-center gap-2 cursor-pointer">
          <Toggle on={!!node.createable} onChange={v => onPatch({ createable: v })} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Offer “Create &amp; link” when no record exists</span>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Assignee"><input value={node.assignedTo ?? ""} onChange={e => onPatch({ assignedTo: e.target.value || undefined })} placeholder="Unassigned" className={inputCls} style={inputStyle} /></Field>
        <Field label="Duration / SLA"><div className="flex items-center gap-1.5"><input type="number" min={0} value={node.durationDays ?? ""} onChange={e => onPatch({ durationDays: e.target.value ? Number(e.target.value) : undefined })} placeholder="—" className={inputCls} style={inputStyle} /><span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>days</span></div></Field>
      </div>

      {/* Dependencies */}
      {others.length > 0 && (
        <Field label="Needs first (dependencies)">
          <div className="flex flex-wrap gap-1.5">
            {others.map(o => {
              const on = node.deps.includes(o.key);
              return <button key={o.key} onClick={() => onToggleDep(o.key)} className="text-[11px] px-2 py-0.5 rounded-full transition-colors" style={{ backgroundColor: on ? "var(--accent-soft-bg)" : "var(--bg-input)", color: on ? "var(--accent-text)" : "var(--text-muted)", border: `1px solid ${on ? "var(--accent-soft-border)" : "transparent"}` }}>{o.title}</button>;
            })}
          </div>
        </Field>
      )}
      <Field label="Gate reason (shown when blocked)"><input value={node.gate ?? ""} onChange={e => onPatch({ gate: e.target.value || undefined })} placeholder="e.g. Equipment not received" className={inputCls} style={inputStyle} /></Field>

      {node.type === "billing" && <BillingEditor node={node} onPatch={onPatch} />}
      {/* Checklist items drive completion only for manual steps; a mirror's
          record drives it instead, so only offer the editor when manual. */}
      {node.manual && <ChecklistEditor node={node} onPatch={onPatch} />}

      <Field label="Notes"><textarea value={node.notes ?? ""} onChange={e => onPatch({ notes: e.target.value || undefined })} rows={2} className={inputCls} style={inputStyle} /></Field>
      </fieldset>
    </>
  );
}

// ── Checklist ──
// Each item is a check-off by default, or a typed field (dropdown, multi-select,
// number, text, photo, …) — the same set the work-order checklist offers.
const CHECK_TYPES = Object.keys(CHECKLIST_TYPE_LABELS) as ChecklistItemType[];
function ChecklistEditor({ node, onPatch }: { node: TemplateNode; onPatch: (p: Partial<TemplateNode>) => void }) {
  const items = node.checklist ?? [];
  const set = (n: typeof items) => onPatch({ checklist: n.length ? n : undefined });
  const patchItem = (id: string, p: Partial<(typeof items)[number]>) => set(items.map(x => x.id === id ? { ...x, ...p } : x));
  return (
    <Capability icon={ListChecks} title="Checklist" count={items.length}>
      <div className="space-y-2.5">
        {items.map(it => {
          const needsOptions = it.type === "dropdown" || it.type === "multi_select";
          return (
            <div key={it.id} className="rounded-lg p-2 space-y-1.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
              <div className="flex items-center gap-1.5">
                <input value={it.label} onChange={e => patchItem(it.id, { label: e.target.value })} placeholder="Item label" className={`${inputCls} py-1.5 text-xs`} style={inputStyle} />
                <button onClick={() => patchItem(it.id, { required: !it.required })} title="Required to complete" className="text-[9px] font-bold px-1.5 py-1 rounded shrink-0" style={{ backgroundColor: it.required ? "var(--accent-soft-bg)" : "var(--bg-input)", color: it.required ? "var(--accent-text)" : "var(--text-muted)" }}>REQ</button>
                <button onClick={() => set(items.filter(x => x.id !== it.id))} className="shrink-0" style={{ color: "#9ca3af" }}><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex items-center gap-1.5">
                <UiSelect size="sm" value={it.type ?? ""}
                  onChange={v => {
                    const t = (v || undefined) as ChecklistItemType | undefined;
                    const opts = (t === "dropdown" || t === "multi_select") ? (it.options?.length ? it.options : ["", ""]) : undefined;
                    patchItem(it.id, { type: t, options: opts, unit: t === "number" ? it.unit : undefined });
                  }}
                  options={[{ value: "", label: "Check-off" }, ...CHECK_TYPES.map(t => ({ value: t, label: CHECKLIST_TYPE_LABELS[t] }))]} />
                {it.type === "number" && (
                  <input value={it.unit ?? ""} onChange={e => patchItem(it.id, { unit: e.target.value || undefined })} placeholder="unit" className={`${inputCls} py-1.5 text-xs w-20 shrink-0`} style={inputStyle} />
                )}
              </div>
              {needsOptions && (
                <div className="space-y-1 pl-1">
                  {(it.options ?? []).map((opt, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <input value={opt} placeholder={`Option ${i + 1}`} onChange={e => { const next = [...(it.options ?? [])]; next[i] = e.target.value; patchItem(it.id, { options: next }); }} className={`${inputCls} py-1 text-xs`} style={inputStyle} />
                      <button onClick={() => patchItem(it.id, { options: (it.options ?? []).filter((_, j) => j !== i) })} className="shrink-0" style={{ color: "#9ca3af" }}><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <button onClick={() => patchItem(it.id, { options: [...(it.options ?? []), ""] })} className="flex items-center gap-1 text-[11px] font-medium" style={{ color: ACCENT }}><Plus className="w-3 h-3" /> Add option</button>
                  {(it.options ?? []).filter(o => o.trim()).length === 0 && <p className="text-[10px]" style={{ color: "#b45309" }}>Add at least one option.</p>}
                </div>
              )}
            </div>
          );
        })}
        <button onClick={() => set([...items, { id: newChecklistItemId(), label: "" }])} className="flex items-center gap-1 text-xs font-medium" style={{ color: ACCENT }}><Plus className="w-3.5 h-3.5" /> Add item</button>
      </div>
    </Capability>
  );
}

// ── Billing (staged) ──
// A billing node with a percent raises an invoice for that share of the
// project's estimated value when the step is reached (e.g. 50 / 50, 20 / 40 / 40).
// Leave it blank to instead watch the project's invoice via the Source picker.
function BillingEditor({ node, onPatch }: { node: TemplateNode; onPatch: (p: Partial<TemplateNode>) => void }) {
  return (
    <div className="rounded-lg p-3 space-y-2.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><Receipt className="w-3.5 h-3.5" /> Staged billing</p>
      <Field label="% of contract">
        <div className="flex items-center gap-1.5">
          <input type="number" min={0} max={100} value={node.percent ?? ""} onChange={e => onPatch({ percent: e.target.value ? Number(e.target.value) : undefined })} placeholder="—" className={inputCls} style={inputStyle} />
          <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>%</span>
        </div>
      </Field>
      <label className="flex items-center gap-2 cursor-pointer">
        <Toggle on={!!node.deposit} onChange={v => onPatch({ deposit: v })} />
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Tag the invoice as a deposit</span>
      </label>
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        {node.percent != null
          ? `Raises an invoice for ${node.percent}% of the project's estimated value when this step is reached.`
          : "Blank = watch the project's invoice instead (set the Source above to “Invoice”)."}
      </p>
    </div>
  );
}

// ─── Small UI ─────────────────────────────────────────────
function RailGroup({ icon: Icon, title, children }: { icon: typeof Layers; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2"><Icon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /><p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{title}</p></div>
      {children}
    </div>
  );
}
function Capability({ icon: Icon, title, count, children }: { icon: typeof Layers; title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-1.5 mb-2"><Icon className="w-3.5 h-3.5" style={{ color: ACCENT }} /><p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>{count > 0 && <span className="text-[10px] px-1.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>{count}</span>}</div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>{children}</div>;
}
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} type="button" className="relative w-8 h-4 rounded-full transition-colors shrink-0" style={{ backgroundColor: on ? ACCENT : "var(--bg-input)", border: "1px solid var(--border)" }}>
      <span className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform" style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
    </button>
  );
}
function AddGroupInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [v, setV] = useState("");
  const commit = () => { if (v.trim()) { onAdd(v); setV(""); } };
  return (
    <div className="flex items-center gap-1">
      <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} placeholder="Add lane…" className="flex-1 text-xs rounded-lg px-2 py-1.5 outline-none" style={inputStyle} />
      <button onClick={commit} disabled={!v.trim()} className="p-1.5 rounded-md disabled:opacity-30" style={{ color: ACCENT }}><Plus className="w-3.5 h-3.5" /></button>
    </div>
  );
}
