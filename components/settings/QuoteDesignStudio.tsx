"use client";

// ─── Quote Design Studio — build your own quote design ────
// The immersive builder for CUSTOM Quote Designs, using the email Design-Studio
// interaction set: the real proposal document (sample content) floats on a
// pan/zoom canvas; a floating left panel holds the block palette + the design's
// structure; the right inspector holds design-level settings (name, layout,
// visual style). Blocks are TYPED section slots — the same types Content Blocks
// use — so a design built here tells the template studio exactly which content
// slots exist, which options/pricing blocks render, and which modes it supports
// (derived on save in lib/quotes/quoteDesigns).

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft, X, Plus, Minus, Maximize, GripVertical, Trash2, Check,
  ChevronUp, ChevronDown, Layers, Palette, Type, FileText, Package, CreditCard,
  ShieldCheck, PenLine, User, MapPin, Heading1, ListOrdered, Sparkles,
} from "lucide-react";
import ProposalFamilyDocument from "@/components/quotes/family/ProposalFamilyDocument";
import { buildSampleProposalDoc } from "@/lib/proposals/sampleDoc";
import { resolveTemplate, VARIANTS, type FamilyId, type VariantId } from "@/lib/proposals/families";
import type { SectionKey } from "@/lib/proposals/data";
import {
  getQuoteDesign, saveCustomQuoteDesign,
  type QuoteDesign,
} from "@/lib/quotes/quoteDesigns";

const ACCENT = "#0f8578";
const DOC_W = 816;

const inputCls = "w-full rounded-lg px-2.5 py-2 text-sm outline-none";
const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };

// ─── Block palette — typed section slots ──────────────────
// Every block is a proposal SectionKey. "content" blocks sync with Content Block
// types (the template studio offers "Insert saved wording" per slot); "selling"
// blocks render options/pricing; "structural" blocks are the document chrome.
type BlockGroup = "structural" | "content" | "selling";
const PALETTE: { key: SectionKey; label: string; icon: typeof Layers; group: BlockGroup; hint?: string }[] = [
  { key: "cover_header",         label: "Cover Header",       icon: Heading1,    group: "structural" },
  { key: "customer_info",        label: "Customer Info",      icon: User,        group: "structural" },
  { key: "property_info",        label: "Property Info",      icon: MapPin,      group: "structural" },
  { key: "approval",             label: "Signature",          icon: PenLine,     group: "structural" },
  { key: "problem_need",         label: "Problem / Need",     icon: FileText,    group: "content", hint: "Content Block slot" },
  { key: "inspection_findings",  label: "Inspection Findings",icon: FileText,    group: "content", hint: "Content Block slot" },
  { key: "recommended_solution", label: "Recommended Solution", icon: Sparkles,  group: "content", hint: "Content Block slot" },
  { key: "scope_of_work",        label: "Scope of Work",      icon: ListOrdered, group: "content", hint: "Content Block slot" },
  { key: "custom_text",          label: "Custom Text",        icon: Type,        group: "content", hint: "Content Block slot" },
  { key: "optional_addons",      label: "Add-On Explanation", icon: Plus,        group: "content", hint: "Content Block slot" },
  { key: "gbb_options",          label: "Options — Good / Better / Best", icon: Package, group: "selling", hint: "Tiered option cards" },
  { key: "line_items",           label: "Line Items & Totals", icon: ListOrdered, group: "selling" },
  { key: "financing_note",       label: "Financing",          icon: CreditCard,  group: "selling", hint: "Content Block slot" },
  { key: "warranty",             label: "Warranty",           icon: ShieldCheck, group: "content", hint: "Content Block slot" },
  { key: "terms",                label: "Terms & Conditions", icon: FileText,    group: "content", hint: "Content Block slot" },
];
const GROUP_LABELS: Record<BlockGroup, string> = {
  structural: "Structure", content: "Content slots", selling: "Options & pricing",
};
const PALETTE_BY_KEY = new Map(PALETTE.map(p => [p.key, p]));

// Blocks the renderer pins to fixed positions — order applies to everything else.
const PINNED: SectionKey[] = ["cover_header", "customer_info", "property_info", "approval"];

// The two structural layouts the proposal engine renders distinctly.
const LAYOUTS: { id: FamilyId; label: string; sub: string }[] = [
  { id: "classic",    label: "Document",   sub: "One-column letterhead proposal" },
  { id: "comparison", label: "Showcase",   sub: "Hero header, side-by-side option cards" },
];
const VARIANT_IDS: VariantId[] = ["clean", "bold", "warm", "executive"];

const STARTER_SECTIONS: SectionKey[] = [
  "cover_header", "customer_info", "recommended_solution", "line_items", "warranty", "terms", "approval",
];

// ─── Studio ───────────────────────────────────────────────
export default function QuoteDesignStudio({ designId, onClose, onSaved }: {
  designId?: string;             // present = edit an existing CUSTOM design
  onClose: () => void;
  onSaved: (d: QuoteDesign) => void;
}) {
  const editing = designId ? getQuoteDesign(designId) : null;
  const [name, setName] = useState(editing?.custom ? editing.name : "");
  const [description, setDescription] = useState(editing?.custom ? editing.description : "");
  const [family, setFamily] = useState<FamilyId>(editing?.custom ? editing.layoutFamily : "classic");
  const [variant, setVariant] = useState<VariantId>(editing?.custom ? editing.visualVariant : "clean");
  const [sections, setSections] = useState<SectionKey[]>(editing?.custom ? [...editing.defaultSections] : [...STARTER_SECTIONS]);
  const [railOpen, setRailOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  // ── Canvas view — pan / zoom / center (Design-Studio interaction set) ──
  const clampZ = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewT, setViewT] = useState({ x: 0, y: 0, zoom: 0.9 });
  const viewTRef = useRef(viewT); viewTRef.current = viewT;
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceRef = useRef(false);
  const panning = useRef(false);
  const didCenter = useRef(false);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const cardPosRef = useRef(cardPos); cardPosRef.current = cardPos;

  const zoomAt = (factor: number, cx: number, cy: number) => setViewT(v => {
    const z = clampZ(v.zoom * factor, 0.35, 2);
    const wx = (cx - v.x) / v.zoom, wy = (cy - v.y) / v.zoom;
    return { x: cx - wx * z, y: cy - wy * z, zoom: z };
  });
  const zoomButton = (factor: number) => { const vp = viewportRef.current; if (vp) zoomAt(factor, vp.clientWidth / 2, vp.clientHeight / 2); };
  const centerOn = () => {
    const vp = viewportRef.current; if (!vp) return;
    setCardPos({ x: 0, y: 0 });
    setViewT({ x: Math.max(24, (vp.clientWidth - DOC_W * 0.9) / 2), y: 32, zoom: 0.9 });
  };
  useLayoutEffect(() => {
    if (!didCenter.current && viewportRef.current) { didCenter.current = true; centerOn(); }
  });

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
      else setViewT(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (!spaceRef.current) return;
    e.preventDefault();
    panning.current = true;
    document.body.style.cursor = "grabbing";
    const sx = e.clientX, sy = e.clientY, ox = viewTRef.current.x, oy = viewTRef.current.y;
    const move = (ev: PointerEvent) => { if (panning.current) setViewT(v => ({ ...v, x: ox + (ev.clientX - sx), y: oy + (ev.clientY - sy) })); };
    const up = () => {
      panning.current = false;
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  const onCardHandleDown = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, ox = cardPosRef.current.x, oy = cardPosRef.current.y;
    const z = viewTRef.current.zoom;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    const move = (ev: PointerEvent) => setCardPos({ x: ox + (ev.clientX - sx) / z, y: oy + (ev.clientY - sy) / z });
    const up = () => {
      document.body.style.cursor = ""; document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  // ── Structure ops — one instance per block type ──
  const add = (k: SectionKey) => setSections(s => (s.includes(k) ? s : [...s, k]));
  const remove = (k: SectionKey) => setSections(s => s.filter(x => x !== k));
  const move = (i: number, dir: -1 | 1) => setSections(s => {
    const a = [...s]; const j = i + dir;
    if (j < 0 || j >= a.length) return s;
    [a[i], a[j]] = [a[j], a[i]];
    return a;
  });

  // ── Live document ──
  const { family: fam, variant: skin } = resolveTemplate(family, variant);
  const doc = buildSampleProposalDoc(sections, name.trim() || "Custom Proposal");

  function save() {
    const d = saveCustomQuoteDesign({
      id: editing?.custom ? editing.id : undefined,
      name, description, layoutFamily: family, visualVariant: variant, defaultSections: sections,
    });
    onSaved(d);
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-4 h-14 shrink-0" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium shrink-0" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Quote Designs
        </button>
        <div className="h-5 w-px shrink-0" style={{ backgroundColor: "var(--border)" }} />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Design name…"
          className="w-64 text-base font-semibold bg-transparent outline-none shrink-0" style={{ color: "var(--text-primary)" }} />
        <span className="text-[11px] hidden md:inline" style={{ color: "var(--text-muted)" }}>
          {sections.includes("gbb_options") ? "Supports Good / Better / Best" : "Single-offer layout"}
        </span>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button onClick={save} disabled={!name.trim() || sections.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: ACCENT }}>
            <Check className="w-4 h-4" /> Save Design
          </button>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
      </header>

      {/* ── Canvas world ── */}
      <div className="flex-1 relative min-h-0">
        <div ref={viewportRef} onPointerDown={onCanvasPointerDown}
          className={`absolute inset-0 overflow-hidden ${spaceHeld ? "cursor-grab select-none" : ""}`}
          style={{
            backgroundColor: "var(--bg-page)",
            backgroundImage: "radial-gradient(var(--border-subtle) 1px, transparent 1px)",
            backgroundSize: `${22 * viewT.zoom}px ${22 * viewT.zoom}px`,
            backgroundPosition: `${viewT.x}px ${viewT.y}px`,
          }}>
          <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "0 0", transform: `translate(${viewT.x}px, ${viewT.y}px) scale(${viewT.zoom})`, width: "max-content" }}>
            <div className="relative" style={{ width: DOC_W, transform: `translate(${cardPos.x}px, ${cardPos.y}px)` }}>
              <button onPointerDown={onCardHandleDown} title="Drag to move the proposal"
                className="absolute -top-9 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-grab active:cursor-grabbing select-none"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 6px 18px -6px rgba(0,0,0,0.3)", color: "var(--text-secondary)" }}>
                <GripVertical className="w-3.5 h-3.5" /> Proposal
              </button>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", boxShadow: "0 16px 48px -16px rgba(0,0,0,0.35)" }}>
                <ProposalFamilyDocument data={doc} family={fam} variant={skin} shadow={false} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Floating left panel: Blocks palette + Structure ── */}
        {railOpen && (
          <aside className="absolute top-3 left-3 z-30 w-80 max-h-[calc(100%-4.5rem)] overflow-y-auto thin-scroll-y rounded-2xl p-4 space-y-5"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)" }}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <RailTitle icon={Plus} title="Blocks" />
                <button onClick={() => setRailOpen(false)} aria-label="Close panel"><X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></button>
              </div>
              {(Object.keys(GROUP_LABELS) as BlockGroup[]).map(g => (
                <div key={g} className="mb-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{GROUP_LABELS[g]}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PALETTE.filter(p => p.group === g).map(p => {
                      const used = sections.includes(p.key);
                      return (
                        <button key={p.key} onClick={() => add(p.key)} disabled={used}
                          title={used ? "Already on the design" : p.hint}
                          className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium text-left transition-colors hover:bg-[var(--bg-surface-2)] disabled:opacity-35 disabled:cursor-not-allowed"
                          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                          <p.icon className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
                          <span className="truncate">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Content slots sync with your Content Blocks library — templates built on this design can fill each slot with saved wording.
              </p>
            </div>

            <div>
              <RailTitle icon={Layers} title="Structure" />
              <div className="space-y-1 mt-2">
                {sections.map((k, i) => {
                  const p = PALETTE_BY_KEY.get(k);
                  const pinned = PINNED.includes(k);
                  return (
                    <div key={k} className="group flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                      <span className="text-[10px] font-mono w-4 text-center shrink-0" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                      {p && <p.icon className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />}
                      <span className="flex-1 min-w-0 truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>{p?.label ?? k}</span>
                      {pinned && <span className="text-[9px] shrink-0" style={{ color: "var(--text-muted)" }}>pinned</span>}
                      {!pinned && (
                        <span className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                          <button onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-20 p-0.5" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3 h-3" /></button>
                          <button onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="disabled:opacity-20 p-0.5" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3 h-3" /></button>
                        </span>
                      )}
                      <button onClick={() => remove(k)} title="Remove" className="p-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3 h-3" /></button>
                    </div>
                  );
                })}
                {sections.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Empty design — add blocks above.</p>}
              </div>
              <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Header, customer/property info, and the signature are pinned by the layout — everything else follows this order.
              </p>
            </div>
          </aside>
        )}

        {/* ── Floating right inspector: design settings ── */}
        {inspectorOpen && (
          <aside className="absolute top-3 right-3 z-30 w-72 max-h-[calc(100%-4.5rem)] overflow-y-auto thin-scroll-y rounded-2xl p-4 space-y-4"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)" }}>
            <RailTitle icon={Palette} title="Design" />
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                placeholder="Best for…" className={`${inputCls} resize-none`} style={inputStyle} />
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Layout</label>
              <div className="space-y-1.5">
                {LAYOUTS.map(l => (
                  <button key={l.id} onClick={() => setFamily(l.id)}
                    className="w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-colors"
                    style={family === l.id
                      ? { backgroundColor: "var(--accent-soft-bg)", border: "1px solid var(--accent-soft-border)" }
                      : { border: "1px solid var(--border)" }}>
                    <span className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 flex items-center justify-center"
                      style={{ border: `1.5px solid ${family === l.id ? ACCENT : "var(--border)"}` }}>
                      {family === l.id && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold" style={{ color: family === l.id ? "var(--accent-text)" : "var(--text-primary)" }}>{l.label}</span>
                      <span className="block text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{l.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Visual style</label>
              <div className="grid grid-cols-2 gap-1.5">
                {VARIANT_IDS.map(v => (
                  <button key={v} onClick={() => setVariant(v)}
                    className="px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={variant === v
                      ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)", border: "1px solid var(--accent-soft-border)" }
                      : { border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    {VARIANTS[v].name}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* ── Bottom toolbar ── */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 rounded-xl p-1"
          style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 88%, transparent)", border: "1px solid var(--border)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.35)", backdropFilter: "blur(10px)" }}>
          <CtrlBtn onClick={() => zoomButton(0.83)} title="Zoom out"><Minus className="w-4 h-4" /></CtrlBtn>
          <button onClick={centerOn} title="Reset & center" className="px-2 py-1 rounded-lg text-xs font-semibold tabular-nums min-w-[3rem] transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>{Math.round(viewT.zoom * 100)}%</button>
          <CtrlBtn onClick={() => zoomButton(1.2)} title="Zoom in"><Plus className="w-4 h-4" /></CtrlBtn>
          <div className="w-px h-5 mx-0.5" style={{ backgroundColor: "var(--border)" }} />
          <CtrlBtn onClick={centerOn} title="Center & fit"><Maximize className="w-4 h-4" /></CtrlBtn>
          <div className="w-px h-5 mx-0.5" style={{ backgroundColor: "var(--border)" }} />
          <button onClick={() => setRailOpen(o => !o)} aria-expanded={railOpen} title="Blocks & structure"
            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold transition-colors hover:bg-[var(--bg-surface-2)]"
            style={railOpen ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" } : { color: "var(--text-secondary)" }}>
            <Layers className="w-3.5 h-3.5" /> Blocks
          </button>
          <button onClick={() => setInspectorOpen(o => !o)} aria-expanded={inspectorOpen} title="Design settings"
            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold transition-colors hover:bg-[var(--bg-surface-2)]"
            style={inspectorOpen ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" } : { color: "var(--text-secondary)" }}>
            <Palette className="w-3.5 h-3.5" /> Design
          </button>
        </div>

        <div className="absolute bottom-3 left-3 z-10 pointer-events-none flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]"
          style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 85%, transparent)", border: "1px solid var(--border)", color: "var(--text-muted)", backdropFilter: "blur(8px)" }}>
          Hold <kbd className="px-1.5 py-0.5 rounded font-sans" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>Space</kbd> to pan · <kbd className="px-1.5 py-0.5 rounded font-sans" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>⌘</kbd>-scroll to zoom
        </div>
      </div>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────
function RailTitle({ icon: Icon, title }: { icon: typeof Layers; title: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
      <Icon className="w-3.5 h-3.5" style={{ color: ACCENT }} /> {title}
    </p>
  );
}

function CtrlBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  // no-plus-anim: the zoom "+" is a control, not a create button.
  return <button onClick={onClick} title={title} className="no-plus-anim w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>{children}</button>;
}
