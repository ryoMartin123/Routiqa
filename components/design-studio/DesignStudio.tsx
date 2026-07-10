"use client";

// ─── Design Studio — full-screen block builder ────────────
// One builder, two skins: marketing EMAILS and gallery DOCUMENTS. Left rail =
// Insert palette + Layers tree; center = the live design (page bg + content
// column); right = inspector for the selected block, or the global design
// panel when nothing is selected. Same full-screen chrome as the Map builder.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  X, ArrowLeft, Plus, ChevronUp, ChevronDown, Copy, Trash2, Maximize, GripVertical,
  Layers, Columns2, Heading1, Text, MousePointerClick, Image as ImageIcon,
  Minus, MoveVertical, List as ListIcon, AlignLeft, AlignCenter, AlignRight, Palette,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import NumberStepper from "@/components/ui/NumberStepper";
import DesignSurface, { type BlockFrame } from "@/components/design-studio/BlockRenderer";
import {
  type DesignDoc, type DesignBlock, type BlockType, type BlockStyles, type StudioMode, type DropPos,
  newBlock, findBlock, patchBlock, patchStyles, removeBlock, moveBlock, duplicateBlock, insertBlock,
  moveBlockTo, moveBlockToEnd, insertBlockAt,
  FONT_STACKS, MERGE_FIELDS,
} from "@/lib/design-studio/model";

const ACCENT = "#0f8578";

const PALETTE: { type: BlockType; label: string; icon: typeof Layers }[] = [
  { type: "section",   label: "Section",   icon: Layers },
  { type: "columns",   label: "Columns",   icon: Columns2 },
  { type: "heading",   label: "Heading",   icon: Heading1 },
  { type: "paragraph", label: "Paragraph", icon: Text },
  { type: "button",    label: "Button",    icon: MousePointerClick },
  { type: "image",     label: "Image",     icon: ImageIcon },
  { type: "list",      label: "List",      icon: ListIcon },
  { type: "divider",   label: "Divider",   icon: Minus },
  { type: "spacer",    label: "Spacer",    icon: MoveVertical },
];
const TYPE_LABEL = Object.fromEntries(PALETTE.map(p => [p.type, p.label])) as Record<BlockType, string>;
const TYPE_ICON = Object.fromEntries(PALETTE.map(p => [p.type, p.icon])) as Record<BlockType, typeof Layers>;
const TEXT_TYPES: BlockType[] = ["heading", "paragraph", "list", "button"];

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } as const;

// Suppress the browser's default drag ghost for layer drags — a floating
// "Heading → into Section" pill narrates the move instead (same pattern as
// the Documents explorer).
const EMPTY_DRAG_IMG = typeof window !== "undefined"
  ? (() => { const img = new Image(); img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; return img; })()
  : null;
function hideNativeDragImage(e: React.DragEvent) {
  if (EMPTY_DRAG_IMG) { try { e.dataTransfer.setDragImage(EMPTY_DRAG_IMG, 0, 0); } catch { /* ignore */ } }
}

export default function DesignStudio({ mode, initialName, initialSubject, initialDesign, backLabel, onSave, onClose }: {
  mode: StudioMode;
  initialName: string;
  initialSubject?: string;
  initialDesign: DesignDoc;
  backLabel: string;
  onSave: (out: { name: string; subject?: string; design: DesignDoc }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [doc, setDoc] = useState<DesignDoc>(initialDesign);
  const [selId, setSelId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Drag & drop: an existing block (by its grip handle) OR a palette type
  // being dragged in, plus where it would land (line above / below a block,
  // dashed "inside" a section / columns).
  const [dragId, setDragId] = useState<string | null>(null);
  const [paletteDrag, setPaletteDrag] = useState<BlockType | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; pos: DropPos } | null>(null);
  const sel = selId ? findBlock(doc.blocks, selId) : null;

  // ── Canvas view — pan / zoom / center (the Map-builder interaction set) ──
  // The design floats on a vast dotted world: plain wheel pans, ⌘-scroll zooms
  // toward the cursor, Space-drag pans, and the toolbar recenters. Both side
  // panels float over the canvas and toggle from the toolbar.
  const clampZ = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  const viewportRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [viewT, setViewT] = useState({ x: 0, y: 0, zoom: 1 });
  const viewTRef = useRef(viewT); viewTRef.current = viewT;
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceRef = useRef(false);
  const panning = useRef(false);
  const didCenter = useRef(false);
  const [railOpen, setRailOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const zoomAt = (factor: number, cx: number, cy: number) => setViewT(v => {
    const z = clampZ(v.zoom * factor, 0.35, 2);
    const wx = (cx - v.x) / v.zoom, wy = (cy - v.y) / v.zoom;
    return { x: cx - wx * z, y: cy - wy * z, zoom: z };
  });
  const zoomButton = (factor: number) => { const vp = viewportRef.current; if (vp) zoomAt(factor, vp.clientWidth / 2, vp.clientHeight / 2); };
  const centerOn = () => {
    const vp = viewportRef.current, card = cardRef.current;
    if (!vp || !card) return;
    setCardPos({ x: 0, y: 0 });
    setViewT({ x: Math.max(24, (vp.clientWidth - card.offsetWidth) / 2), y: 32, zoom: 1 });
  };
  useLayoutEffect(() => {
    if (!didCenter.current && (cardRef.current?.offsetWidth ?? 0) > 0) { didCenter.current = true; centerOn(); }
  });

  // Space-to-pan (ref so handlers never read stale state; ignore while typing).
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

  // Layer drags carry a floating narration pill ("Heading → into Section"),
  // like moving files in the Documents explorer. Position follows the cursor.
  const [layerPill, setLayerPill] = useState<string | null>(null);
  const [pillPos, setPillPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!layerPill) return;
    const onOver = (e: DragEvent) => setPillPos({ x: e.clientX, y: e.clientY });
    const clear = () => { setLayerPill(null); setPillPos(null); };
    document.addEventListener("dragover", onOver);
    document.addEventListener("drop", clear);
    document.addEventListener("dragend", clear);
    return () => {
      document.removeEventListener("dragover", onOver);
      document.removeEventListener("drop", clear);
      document.removeEventListener("dragend", clear);
    };
  }, [layerPill]);
  const hintTarget = dropHint ? findBlock(doc.blocks, dropHint.id) : null;
  const hintText = hintTarget && dropHint
    ? `${dropHint.pos === "inside" ? "into" : dropHint.pos === "before" ? "above" : "below"} ${TYPE_LABEL[hintTarget.type]}`
    : null;

  // Layers-tree drag & drop shares the same drag state as the canvas, so a
  // row drag uses identical drop rules (before/after lines, inside containers)
  // and even accepts palette drags.
  const layerDnd: LayerDnd = {
    dragId, paletteDrag, hint: dropHint,
    start: (id, e) => {
      hideNativeDragImage(e);
      setDragId(id); setSelId(id);
      const b = findBlock(doc.blocks, id);
      setLayerPill(b ? `${TYPE_LABEL[b.type]}${b.text ? ` · ${b.text.slice(0, 14)}${b.text.length > 14 ? "…" : ""}` : ""}` : "Block");
      setPillPos({ x: e.clientX, y: e.clientY });
    },
    end: () => { setDragId(null); setPaletteDrag(null); setDropHint(null); setLayerPill(null); setPillPos(null); },
    over: (id, pos) => setDropHint(h => (h?.id === id && h.pos === pos ? h : { id, pos })),
    drop: id => {
      const pos = dropHint?.id === id ? dropHint.pos : "after";
      if (paletteDrag) {
        const nb = newBlock(paletteDrag);
        setBlocks(b => insertBlockAt(b, nb, id, pos));
        setSelId(nb.id); setInspectorOpen(true);
      } else if (dragId) {
        setBlocks(b => moveBlockTo(b, dragId, id, pos));
      }
      setDragId(null); setPaletteDrag(null); setDropHint(null); setLayerPill(null); setPillPos(null);
    },
  };

  // The design card is repositioned by ITS handle (the chip floating above it) —
  // grab the handle and drag. Center resets the offset.
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const cardPosRef = useRef(cardPos); cardPosRef.current = cardPos;
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

  const setBlocks = (fn: (b: DesignBlock[]) => DesignBlock[]) => setDoc(d => ({ ...d, blocks: fn(d.blocks) }));
  const add = (type: BlockType) => {
    const b = newBlock(type);
    setBlocks(blocks => insertBlock(blocks, b, selId));
    setSelId(b.id);
  };
  const remove = (id: string) => { setBlocks(b => removeBlock(b, id)); if (selId === id) setSelId(null); };
  const duplicate = (id: string) => setDoc(d => {
    const { blocks, newId } = duplicateBlock(d.blocks, id);
    if (newId) setSelId(newId);
    return { ...d, blocks };
  });

  // Selection frame around every rendered block: click selects, hover hints,
  // the selected block grows a floating toolbar and a GRIP handle on its left —
  // dragging happens by the handle (or from the Insert palette), and drops land
  // above/below a block (accent line) or into a section (dashed outline).
  const frame: BlockFrame = (block, el) => {
    const selected = block.id === selId;
    const hovered = block.id === hoverId && !selected && !dragId && !paletteDrag;
    const hint = dropHint?.id === block.id ? dropHint.pos : null;
    const isContainer = block.type === "section" || block.type === "columns";
    return (
      <div className="relative" data-blk
        onDragOver={e => {
          if ((!dragId && !paletteDrag) || dragId === block.id) return;
          e.preventDefault(); e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - r.top;
          // Containers take drops INTO their middle band; edges mean before/after.
          const pos: DropPos = isContainer && y > r.height * 0.3 && y < r.height * 0.7
            ? "inside" : y < r.height / 2 ? "before" : "after";
          setDropHint(h => (h?.id === block.id && h.pos === pos ? h : { id: block.id, pos }));
        }}
        onDrop={e => {
          if (!dragId && !paletteDrag) return;
          e.preventDefault(); e.stopPropagation();
          const pos = dropHint?.id === block.id ? dropHint.pos : "after";
          if (paletteDrag) {
            const nb = newBlock(paletteDrag);
            setBlocks(b => insertBlockAt(b, nb, block.id, pos));
            setSelId(nb.id); setInspectorOpen(true);
          } else if (dragId) {
            setBlocks(b => moveBlockTo(b, dragId, block.id, pos));
          }
          setDragId(null); setPaletteDrag(null); setDropHint(null);
        }}
        onClick={e => { e.stopPropagation(); setSelId(block.id); setInspectorOpen(true); }}
        onMouseOver={e => { e.stopPropagation(); setHoverId(block.id); }}
        onMouseOut={e => { e.stopPropagation(); setHoverId(h => (h === block.id ? null : h)); }}
        style={{
          outline: selected && !hint ? `2px solid ${ACCENT}` : hovered ? `1.5px dashed ${ACCENT}88` : "1.5px dashed transparent",
          outlineOffset: 3, borderRadius: 4,
          boxShadow: hint === "before" ? `0 -3px 0 0 ${ACCENT}` : hint === "after" ? `0 3px 0 0 ${ACCENT}` : undefined,
          opacity: dragId === block.id ? 0.4 : 1,
          // Blocks are click-to-select; only handles show grab cursors.
          cursor: "pointer",
        }}>
        {/* "Into a container" reads as a real landing slot: tint the container,
            draw the insertion bar where the block will actually land (end of
            its children), and say so. */}
        {hint === "inside" && (
          <div className="absolute inset-0 z-10 pointer-events-none rounded-md" style={{ backgroundColor: ACCENT + "0D", border: `1.5px solid ${ACCENT}55` }}>
            <div className="absolute left-4 right-4 bottom-2.5 h-[3px] rounded-full" style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}88` }} />
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ backgroundColor: ACCENT, color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
              Drop into {TYPE_LABEL[block.type]}
            </span>
          </div>
        )}
        {/* Grip handle — bare icon, only on the SELECTED block */}
        {selected && (
          <span draggable
            onClick={e => e.stopPropagation()}
            onDragStart={e => {
              e.stopPropagation();
              setDragId(block.id);
              e.dataTransfer.effectAllowed = "move";
              try { e.dataTransfer.setData("text/plain", block.id); } catch { /* ignore */ }
            }}
            onDragEnd={() => { setDragId(null); setDropHint(null); }}
            title="Drag to move"
            className="absolute -left-5 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-4 h-7 cursor-grab active:cursor-grabbing transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = ACCENT; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}>
            <GripVertical className="w-3.5 h-3.5" />
          </span>
        )}
        {el}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-4 h-14 shrink-0" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium shrink-0" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> {backLabel}</button>
        <div className="h-5 w-px shrink-0" style={{ backgroundColor: "var(--border)" }} />
        <input value={name} onChange={e => setName(e.target.value)} placeholder={mode === "email" ? "Email name" : "Document name"}
          className="w-56 text-base font-semibold bg-transparent outline-none shrink-0" style={{ color: "var(--text-primary)" }} />
        {mode === "email" && (
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line…"
            className="flex-1 min-w-0 text-sm bg-transparent outline-none px-3 py-1.5 rounded-lg"
            style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        )}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button onClick={() => onSave({ name, subject: subject.trim() || undefined, design: doc })} disabled={!name.trim()}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: ACCENT }}>
            {mode === "email" ? "Save template" : "Save as file"}
          </button>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
      </header>

      {/* ── Canvas world — pan / zoom; panels float over it ── */}
      <div className="flex-1 relative min-h-0">
        <div ref={viewportRef} onPointerDown={onCanvasPointerDown} onClick={() => setSelId(null)}
          onDragOver={e => { if (dragId || paletteDrag) { e.preventDefault(); setDropHint(null); } }}
          onDrop={e => {
            if (!dragId && !paletteDrag) return;
            e.preventDefault();
            if (paletteDrag) {
              const nb = newBlock(paletteDrag);
              setBlocks(b => [...b, nb]);
              setSelId(nb.id); setInspectorOpen(true);
            } else if (dragId) {
              setBlocks(b => moveBlockToEnd(b, dragId));
            }
            setDragId(null); setPaletteDrag(null); setDropHint(null);
          }}
          className={`absolute inset-0 overflow-hidden ${spaceHeld ? "cursor-grab select-none" : ""}`}
          style={{
            backgroundColor: "var(--bg-page)",
            backgroundImage: "radial-gradient(var(--border-subtle) 1px, transparent 1px)",
            backgroundSize: `${22 * viewT.zoom}px ${22 * viewT.zoom}px`,
            backgroundPosition: `${viewT.x}px ${viewT.y}px`,
          }}>
          <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "0 0", transform: `translate(${viewT.x}px, ${viewT.y}px) scale(${viewT.zoom})`, width: "max-content" }}>
            <div className="relative" style={{ width: doc.global.contentWidth + 112, transform: `translate(${cardPos.x}px, ${cardPos.y}px)` }}>
              {/* The card's move handle — the one place the whole design drags from */}
              <button onPointerDown={onCardHandleDown} title={`Drag to move the ${mode === "email" ? "email" : "document"}`}
                className="absolute -top-9 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-grab active:cursor-grabbing select-none"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 6px 18px -6px rgba(0,0,0,0.3)", color: "var(--text-secondary)" }}>
                <GripVertical className="w-3.5 h-3.5" /> {mode === "email" ? "Email" : "Document"}
              </button>
              <div ref={cardRef} className="rounded-xl overflow-hidden"
                style={{ border: "1px solid var(--border)", boxShadow: "0 16px 48px -16px rgba(0,0,0,0.35)" }}>
                <DesignSurface blocks={doc.blocks} global={doc.global} frame={frame} />
              </div>
            </div>
          </div>
        </div>

        {/* Floating left panel: Insert + Layers */}
        {railOpen && (
          <aside className="absolute top-3 left-3 z-30 w-80 max-h-[calc(100%-4.5rem)] overflow-y-auto thin-scroll-y rounded-2xl p-4 space-y-5"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)" }}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <RailTitle icon={Plus} title="Insert" />
                <button onClick={() => setRailOpen(false)} aria-label="Close panel"><X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {PALETTE.map(p => (
                  <button key={p.type} onClick={() => add(p.type)}
                    draggable
                    onDragStart={e => {
                      setPaletteDrag(p.type);
                      e.dataTransfer.effectAllowed = "copy";
                      try { e.dataTransfer.setData("text/plain", `new:${p.type}`); } catch { /* ignore */ }
                    }}
                    onDragEnd={() => { setPaletteDrag(null); setDropHint(null); }}
                    className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium text-left transition-colors hover:bg-[var(--bg-surface-2)] cursor-grab active:cursor-grabbing"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    <p.icon className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} /> {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Click to insert — or drag a block straight onto the design. Blocks on the canvas move by their grip handle.
              </p>
            </div>
            <div>
              <RailTitle icon={Layers} title="Layers" />
              {doc.blocks.length === 0
                ? <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nothing yet.</p>
                : <LayerTree blocks={doc.blocks} depth={0} selId={selId} dnd={layerDnd} onSelect={id => { setSelId(id); setInspectorOpen(true); }} />}
            </div>
          </aside>
        )}

        {/* Floating right panel: block inspector / global design */}
        {inspectorOpen && (
          <aside className="absolute top-3 right-3 z-30 w-72 max-h-[calc(100%-4.5rem)] overflow-y-auto thin-scroll-y rounded-2xl"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)" }}>
            {sel ? (
              <BlockInspector key={sel.id} block={sel} mode={mode}
                onPatch={p => setBlocks(b => patchBlock(b, sel.id, p))}
                onStyle={s => setBlocks(b => patchStyles(b, sel.id, s))}
                onMove={d => setBlocks(b => moveBlock(b, sel.id, d))}
                onDuplicate={() => duplicate(sel.id)}
                onRemove={() => remove(sel.id)} />
            ) : (
              <GlobalInspector doc={doc} onChange={g => setDoc(d => ({ ...d, global: { ...d.global, ...g } }))} />
            )}
          </aside>
        )}

        {/* Bottom-center toolbar: zoom · center · panel toggles (WO-templates pattern) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 rounded-xl p-1"
          style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 88%, transparent)", border: "1px solid var(--border)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.35)", backdropFilter: "blur(10px)" }}>
          <CtrlBtn onClick={() => zoomButton(0.83)} title="Zoom out"><Minus className="w-4 h-4" /></CtrlBtn>
          <button onClick={centerOn} title="Reset & center" className="px-2 py-1 rounded-lg text-xs font-semibold tabular-nums min-w-[3rem] transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>{Math.round(viewT.zoom * 100)}%</button>
          <CtrlBtn onClick={() => zoomButton(1.2)} title="Zoom in"><Plus className="w-4 h-4" /></CtrlBtn>
          <div className="w-px h-5 mx-0.5" style={{ backgroundColor: "var(--border)" }} />
          <CtrlBtn onClick={centerOn} title="Center & fit"><Maximize className="w-4 h-4" /></CtrlBtn>
          <div className="w-px h-5 mx-0.5" style={{ backgroundColor: "var(--border)" }} />
          <button onClick={() => setRailOpen(o => !o)} aria-expanded={railOpen} title="Insert & layers"
            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold transition-colors hover:bg-[var(--bg-surface-2)]"
            style={railOpen ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" } : { color: "var(--text-secondary)" }}>
            <Layers className="w-3.5 h-3.5" /> Blocks
          </button>
          <button onClick={() => setInspectorOpen(o => !o)} aria-expanded={inspectorOpen} title="Inspector"
            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold transition-colors hover:bg-[var(--bg-surface-2)]"
            style={inspectorOpen ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" } : { color: "var(--text-secondary)" }}>
            <Palette className="w-3.5 h-3.5" /> Inspector
          </button>
        </div>

        <div className="absolute bottom-3 left-3 z-10 pointer-events-none flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]"
          style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 85%, transparent)", border: "1px solid var(--border)", color: "var(--text-muted)", backdropFilter: "blur(8px)" }}>
          Hold <kbd className="px-1.5 py-0.5 rounded font-sans" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>Space</kbd> to pan · <kbd className="px-1.5 py-0.5 rounded font-sans" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>⌘</kbd>-scroll to zoom
        </div>
      </div>

      {/* Floating layer-drag pill — names the move as you drag ("Heading → into Section") */}
      {layerPill && pillPos && (
        <div className="fixed z-[100] pointer-events-none flex items-center px-2.5 py-1.5 rounded-lg text-xs"
          style={{ left: pillPos.x + 14, top: pillPos.y + 14, maxWidth: 300, backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 6px 20px rgba(0,0,0,0.18)" }}>
          <span className="truncate" style={{ color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{layerPill}</span>
            {hintText
              ? <> → <span style={{ color: ACCENT, fontWeight: 600 }}>{hintText}</span></>
              : <span style={{ color: "var(--text-muted)" }}> — drop on a layer or the design</span>}
          </span>
        </div>
      )}
    </div>
  );
}

function CtrlBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  // no-plus-anim: the zoom "+" is a control, not a create button — opt out of
  // the app-wide plus grow/spin micro-interaction.
  return <button onClick={onClick} title={title} className="no-plus-anim w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>{children}</button>;
}

// ─── Layers tree ──────────────────────────────────────────
// Rows are draggable and drop targets — same rules as the canvas (line above/
// below, dashed "inside" a container), driven by the shared drag state.
export interface LayerDnd {
  dragId: string | null;
  paletteDrag: BlockType | null;
  hint: { id: string; pos: DropPos } | null;
  start: (id: string, e: React.DragEvent) => void;
  end: () => void;
  over: (id: string, pos: DropPos) => void;
  drop: (id: string) => void;
}
function LayerTree({ blocks, depth, selId, dnd, onSelect }: {
  blocks: DesignBlock[]; depth: number; selId: string | null; dnd: LayerDnd; onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      {blocks.map(b => {
        const Icon = TYPE_ICON[b.type];
        const snippet = b.text ? ` · ${b.text.slice(0, 16)}${b.text.length > 16 ? "…" : ""}` : "";
        const on = b.id === selId;
        const hint = dnd.hint?.id === b.id ? dnd.hint.pos : null;
        const isContainer = b.type === "section" || b.type === "columns";
        return (
          <div key={b.id}>
            <button onClick={() => onSelect(b.id)}
              draggable
              onDragStart={e => { e.stopPropagation(); dnd.start(b.id, e); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", b.id); } catch { /* ignore */ } }}
              onDragEnd={dnd.end}
              onDragOver={e => {
                if ((!dnd.dragId && !dnd.paletteDrag) || dnd.dragId === b.id) return;
                e.preventDefault(); e.stopPropagation();
                const r = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - r.top;
                const pos: DropPos = isContainer && y > r.height * 0.3 && y < r.height * 0.7
                  ? "inside" : y < r.height / 2 ? "before" : "after";
                dnd.over(b.id, pos);
              }}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); dnd.drop(b.id); }}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left text-[11px] transition-colors cursor-grab active:cursor-grabbing"
              style={{
                paddingLeft: 8 + depth * 14,
                backgroundColor: on ? "var(--accent-soft-bg)" : "transparent",
                color: on ? "var(--accent-text)" : "var(--text-secondary)",
                boxShadow: hint === "before" ? `0 -2px 0 0 ${ACCENT}` : hint === "after" ? `0 2px 0 0 ${ACCENT}` : undefined,
                outline: hint === "inside" ? `1.5px dashed ${ACCENT}` : "none",
                opacity: dnd.dragId === b.id ? 0.4 : 1,
              }}>
              <Icon className="w-3 h-3 shrink-0" style={{ color: on ? "var(--accent-text)" : "var(--text-muted)" }} />
              <span className="truncate">{TYPE_LABEL[b.type]}{snippet}</span>
            </button>
            {b.children && <LayerTree blocks={b.children} depth={depth + 1} selId={selId} dnd={dnd} onSelect={onSelect} />}
            {b.cols?.map((col, i) => <LayerTree key={i} blocks={col} depth={depth + 1} selId={selId} dnd={dnd} onSelect={onSelect} />)}
          </div>
        );
      })}
    </div>
  );
}

// ─── Block inspector ──────────────────────────────────────
function BlockInspector({ block, mode, onPatch, onStyle, onMove, onDuplicate, onRemove }: {
  block: DesignBlock; mode: StudioMode;
  onPatch: (p: Partial<DesignBlock>) => void;
  onStyle: (s: Partial<BlockStyles>) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const s = block.styles ?? {};
  const isText = TEXT_TYPES.includes(block.type);
  const isBox = block.type === "section" || block.type === "columns";
  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{TYPE_LABEL[block.type]}</p>
        {/* Block actions — reorder, duplicate, delete (moved off the canvas) */}
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <ToolBtn title="Move up" onClick={() => onMove(-1)}><ChevronUp className="w-3.5 h-3.5" /></ToolBtn>
          <ToolBtn title="Move down" onClick={() => onMove(1)}><ChevronDown className="w-3.5 h-3.5" /></ToolBtn>
          <ToolBtn title="Duplicate" onClick={onDuplicate}><Copy className="w-3.5 h-3.5" /></ToolBtn>
          <ToolBtn title="Delete" danger onClick={onRemove}><Trash2 className="w-3.5 h-3.5" /></ToolBtn>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {/* Content */}
        {isText && (
          <Field label={block.type === "list" ? "Items (one per line)" : "Text"}>
            <textarea value={block.text ?? ""} onChange={e => onPatch({ text: e.target.value })}
              rows={block.type === "heading" || block.type === "button" ? 2 : 4} className={inputCls} style={inputStyle} />
          </Field>
        )}
        {block.type === "button" && (
          <Field label="Link (URL)"><input value={block.href ?? ""} onChange={e => onPatch({ href: e.target.value })} placeholder="https://…" className={inputCls} style={inputStyle} /></Field>
        )}
        {block.type === "image" && (
          <>
            <Field label="Image URL"><input value={block.src ?? ""} onChange={e => onPatch({ src: e.target.value })} placeholder="https://…" className={inputCls} style={inputStyle} /></Field>
            <Field label="Alt text"><input value={block.alt ?? ""} onChange={e => onPatch({ alt: e.target.value })} className={inputCls} style={inputStyle} /></Field>
          </>
        )}
        {/* Merge fields — email mode, blocks that carry text */}
        {mode === "email" && isText && (
          <Field label="Merge fields (tap to add)">
            <div className="flex flex-wrap gap-1">
              {MERGE_FIELDS.map(f => (
                <button key={f} onClick={() => onPatch({ text: `${block.text ?? ""}${block.text?.endsWith(" ") || !block.text ? "" : " "}${f}` })}
                  className="text-[10px] px-1.5 py-0.5 rounded font-mono transition-colors hover:bg-[var(--accent-soft-bg)]"
                  style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{f}</button>
              ))}
            </div>
          </Field>
        )}

        {/* Styles */}
        {isText && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <NumberField label="Size" value={s.fontSize} onChange={v => onStyle({ fontSize: v })} />
              <Field label="Weight">
                <UiSelect size="sm" value={String(s.fontWeight ?? (block.type === "heading" ? 700 : block.type === "button" ? 600 : 400))}
                  onChange={v => onStyle({ fontWeight: Number(v) })}
                  options={[{ value: "400", label: "Regular" }, { value: "600", label: "Semi-bold" }, { value: "700", label: "Bold" }]} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <ColorField label="Text color" value={s.color} fallback="#1f2937" onChange={v => onStyle({ color: v })} />
              {block.type !== "button" && <NumberField label="Line height" value={s.lineHeight} step={0.1} onChange={v => onStyle({ lineHeight: v })} />}
              {block.type === "button" && <ColorField label="Background" value={s.bg} fallback={ACCENT} onChange={v => onStyle({ bg: v })} />}
            </div>
            <AlignField value={s.align ?? "left"} onChange={v => onStyle({ align: v })} />
          </>
        )}
        {isBox && (
          <>
            <ColorField label="Background" value={s.bg} fallback="#ffffff" onChange={v => onStyle({ bg: v })} />
            <div className="grid grid-cols-2 gap-2.5">
              <NumberField label="Padding" value={s.padding} onChange={v => onStyle({ padding: v })} />
              <NumberField label="Corner radius" value={s.radius} onChange={v => onStyle({ radius: v })} />
            </div>
          </>
        )}
        {block.type === "button" && (
          <div className="grid grid-cols-2 gap-2.5">
            <NumberField label="Padding" value={s.padding} onChange={v => onStyle({ padding: v })} />
            <NumberField label="Corner radius" value={s.radius} onChange={v => onStyle({ radius: v })} />
          </div>
        )}
        {block.type === "image" && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <NumberField label="Width %" value={s.widthPct ?? 100} onChange={v => onStyle({ widthPct: v })} />
              <NumberField label="Corner radius" value={s.radius} onChange={v => onStyle({ radius: v })} />
            </div>
            <AlignField value={s.align ?? "left"} onChange={v => onStyle({ align: v })} />
          </>
        )}
        {block.type === "divider" && (
          <div className="grid grid-cols-2 gap-2.5">
            <NumberField label="Thickness" value={s.height ?? 1} onChange={v => onStyle({ height: v })} />
            <ColorField label="Color" value={s.color} fallback="#e5e7eb" onChange={v => onStyle({ color: v })} />
          </div>
        )}
        {block.type === "spacer" && (
          <NumberField label="Height" value={s.height ?? 24} onChange={v => onStyle({ height: v })} />
        )}
        {block.type !== "spacer" && (
          <div className="grid grid-cols-2 gap-2.5">
            <NumberField label="Margin top" value={s.marginTop} onChange={v => onStyle({ marginTop: v })} />
            <NumberField label="Margin bottom" value={s.marginBottom} onChange={v => onStyle({ marginBottom: v })} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Global design panel (nothing selected) ───────────────
function GlobalInspector({ doc, onChange }: { doc: DesignDoc; onChange: (g: Partial<DesignDoc["global"]>) => void }) {
  const g = doc.global;
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <Palette className="w-4 h-4" style={{ color: ACCENT }} />
        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Design</p>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Global styles for the whole {doc.mode === "email" ? "email" : "document"}. Select a block to style it individually.
        </p>
        <Field label="Font">
          <UiSelect size="sm" value={g.fontFamily} onChange={v => onChange({ fontFamily: v })}
            options={FONT_STACKS.map(f => ({ value: f.value, label: f.label }))} />
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <ColorField label="Text color" value={g.textColor} fallback="#1f2937" onChange={v => onChange({ textColor: v })} />
          <ColorField label="Accent (buttons)" value={g.accent} fallback={ACCENT} onChange={v => onChange({ accent: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <ColorField label="Content background" value={g.contentBg} fallback="#ffffff" onChange={v => onChange({ contentBg: v })} />
          <ColorField label="Page background" value={g.bg} fallback="#f1f3f4" onChange={v => onChange({ bg: v })} />
        </div>
        <NumberField label="Content width (px)" value={g.contentWidth} onChange={v => onChange({ contentWidth: v ?? 600 })} />
      </div>
    </div>
  );
}

// ─── Small controls ───────────────────────────────────────
function RailTitle({ icon: Icon, title }: { icon: typeof Layers; title: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{title}</p>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>{children}</div>;
}
// Numbers use the app-wide stepper (same +/- arrows as the rest of the CRM).
function NumberField({ label, value, step, onChange }: { label: string; value?: number; step?: number; onChange: (v: number | undefined) => void }) {
  return (
    <Field label={label}>
      <NumberStepper size="sm" step={step} placeholder="—" value={value != null ? String(value) : ""}
        onChange={v => onChange(v === "" ? undefined : Number(v))} />
    </Field>
  );
}
function ColorField({ label, value, fallback, onChange }: { label: string; value?: string; fallback: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-1.5">
        <input type="color" value={value ?? fallback} onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg cursor-pointer shrink-0" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", padding: 2 }} />
        <input value={value ?? ""} placeholder={fallback} onChange={e => onChange(e.target.value)}
          className={`${inputCls} font-mono text-xs`} style={inputStyle} />
      </div>
    </Field>
  );
}
function AlignField({ value, onChange }: { value: "left" | "center" | "right"; onChange: (v: "left" | "center" | "right") => void }) {
  const opts = [{ v: "left" as const, I: AlignLeft }, { v: "center" as const, I: AlignCenter }, { v: "right" as const, I: AlignRight }];
  return (
    <Field label="Align">
      <div className="flex items-center gap-1">
        {opts.map(({ v, I }) => (
          <button key={v} onClick={() => onChange(v)} className="flex-1 flex items-center justify-center py-1.5 rounded-lg transition-colors"
            style={{
              border: `1px solid ${value === v ? "var(--accent-soft-border)" : "var(--border)"}`,
              backgroundColor: value === v ? "var(--accent-soft-bg)" : "var(--bg-surface)",
              color: value === v ? "var(--accent-text)" : "var(--text-muted)",
            }}>
            <I className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
    </Field>
  );
}
function ToolBtn({ title, danger, onClick, children }: { title: string; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} onClick={e => { e.stopPropagation(); onClick(); }}
      className={`w-7 h-7 flex items-center justify-center transition-colors ${danger ? "hover:bg-red-50" : "hover:bg-[var(--bg-surface-2)]"}`}
      style={{ color: danger ? "#dc2626" : "var(--text-secondary)" }}>
      {children}
    </button>
  );
}
