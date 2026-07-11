"use client";

// Custom Proposal Builder — a flowing, document-first editor.
//
// The rep builds the proposal as ONE continuous sheet that looks like the thing
// the customer will receive: an editable letterhead, then content that flows
// top-to-bottom with no card chrome. Modules ("blocks") still exist — line items,
// price summary, options, images, rich text — but they live in the document.
//
// EDITING a section (or adding one) opens a large, resizable editor modal: the
// left pane holds that section's full editor (formatting, add image, fields, plus
// visibility / duplicate / delete in the header), and the right pane shows the
// live proposal document updating in real time.
//
// Internal pricing math from the /pricing wizard lives in a rep-only panel to the
// LEFT of the sheet. It is never shown to the customer — a number only reaches the
// proposal if the rep adds a Price Summary or Line Items section.
//
// Reached via: chooser → /pricing (wizard) → /custom.

import { use, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Eye, EyeOff, Plus, Trash2, Copy, GripVertical, Pencil,
  Check, Lock, Package, Tag, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Image as ImageIcon, X, Blocks, Minus, Maximize, Layers, Sparkles,
} from "lucide-react";
import { recordUsage } from "@/lib/usage/data";
import UiSelect from "@/components/ui/Select";
import NumberStepper from "@/components/ui/NumberStepper";
import CatalogPicker from "@/components/quotes/CatalogPicker";
import OptionImageInput from "@/components/quotes/OptionImageInput";
import RichTextEditor from "@/components/quotes/custom/RichTextEditor";
import CustomProposalDocument, { type CustomDocData } from "@/components/quotes/custom/CustomProposalDocument";
import PricingCalculatorModal from "@/components/quotes/custom/PricingCalculatorModal";
import { ContentBlockPicker } from "@/components/settings/ContentBlocksSection";
import { QuoteDesignThumbnail } from "@/components/settings/QuoteDesignsManager";
import { getQuoteDesigns, type QuoteDesign } from "@/lib/quotes/quoteDesigns";
import { type ContentBlock, type ContentBlockType } from "@/lib/content-blocks/data";
import {
  getQuote, autosaveQuote, computeTotals, fmt,
  type QuoteRecord, type QuoteOption, type LineItem,
} from "@/lib/quotes/data";
import {
  BLOCK_LIBRARY, BLOCK_GROUPS, BLOCK_LABELS, RICH_BLOCK_TYPES, defaultBlock,
  starterBlocks, sectionsToBlocks, blockId, imageId,
  type QuoteBlock, type BlockType, type BlockImage,
} from "@/lib/quotes/blocks";
import { getAllItems, itemToQuoteLines, getItemDefaults, type Item } from "@/lib/items/data";
import { LINE_ITEM_CATEGORIES, type LineItemCategory, type QuotePricing } from "@/lib/quotes/types";
import { getProposalBranding, getProposalTerms, buildSectionsFromKeys } from "@/lib/proposals/data";
import { getActiveDesign, type DesignHeader, type ProposalDesignStyle } from "@/lib/proposals/designs";

// Suppress the browser's native drag ghost for block reorders — the live reflow
// narrates the move; the ghost only adds a weird snap-back animation on drop.
const EMPTY_DRAG_IMG = typeof window !== "undefined"
  ? (() => { const img = new Image(); img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; return img; })()
  : null;

// Structural blocks have no free-form body — auto-opening the editor on insert is
// skipped for them (they can still be opened by click for delete/move).
const isEditable = (t: BlockType) => t !== "divider" && t !== "page_break";

// Content Block type → the document BlockType it becomes when inserted.
const CB_TO_BLOCK: Record<ContentBlockType, BlockType> = {
  recommended_solution: "recommended_solution", scope_of_work: "scope_of_work", problem_need: "problem_need",
  warranty: "warranty", financing: "financing_note", terms: "terms", exclusions: "terms",
  approval: "approval_signature", company_value: "rich_text", addon_explanation: "custom_section", custom: "rich_text",
};

// Convert a Content Block's plain text (•/- bullets, "## " headings) to the simple
// HTML the rich-text blocks store.
function plainTextToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = ""; let inList = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("• ") || line.startsWith("- ")) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${esc(line.slice(2))}</li>`; continue; }
    if (inList) { html += "</ul>"; inList = false; }
    if (!line) continue;
    if (line.startsWith("## ")) { html += `<h3>${esc(line.slice(3))}</h3>`; continue; }
    html += `<p>${esc(line)}</p>`;
  }
  if (inList) html += "</ul>";
  return html || "<p></p>";
}

// A Content Block → a fresh document block (independent copy). Used by both the
// click-to-append path and the live drag preview/drop.
function contentBlockToBlock(cb: ContentBlock): QuoteBlock {
  const type = CB_TO_BLOCK[cb.type] ?? "rich_text";
  const b = defaultBlock(type);
  b.title = cb.name || b.title;
  b.content = RICH_BLOCK_TYPES.includes(type) ? plainTextToHtml(cb.text) : cb.text;
  return b;
}

// ─── Draft line item (string-backed) ──────────────────────
interface DraftItem {
  id: string; name: string; description: string; quantity: string; unitPrice: string;
  category: LineItemCategory; taxable: boolean; optional: boolean; itemId?: string; unitCost?: number;
  optionId?: string;   // materialized from the selected option card
}
let _seq = 0;
const uid = () => `li-${Date.now()}-${_seq++}`;
function blankItem(): DraftItem { return { id: uid(), name: "", description: "", quantity: "1", unitPrice: "0", category: "Labor", taxable: true, optional: false }; }
function lineToDraft(li: LineItem): DraftItem {
  return { id: li.id, itemId: li.itemId, name: li.name ?? "", description: li.description ?? "", quantity: String(li.quantity), unitPrice: String(li.unitPrice), unitCost: li.unitCost, category: (li.category ?? "Other") as LineItemCategory, taxable: li.taxable ?? true, optional: li.optional ?? false, optionId: li.optionId };
}
function draftsToLines(items: DraftItem[]): LineItem[] {
  return items.filter(it => it.name.trim() || it.description.trim()).map(it => {
    const qty = parseFloat(it.quantity) || 0; const price = parseFloat(it.unitPrice) || 0;
    return { id: it.id, name: it.name.trim() || undefined, description: it.description.trim() || it.name.trim(), quantity: qty, unitPrice: price, total: Math.round(qty * price * 100) / 100, category: it.category, taxable: it.taxable, optional: it.optional, itemId: it.itemId, unitCost: it.unitCost, optionId: it.optionId };
  });
}

export default function CustomProposalBuilder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const branding = useMemo(() => getProposalBranding(), []);
  const design = useMemo(() => getActiveDesign(), []);
  // Per-quote letterhead override ("none" hides it) — chosen from the chip above
  // the sheet, persisted on the quote, and carried into the rendered document.
  const [headerStyle, setHeaderStyle] = useState<DesignHeader>(design.style.header);
  const ds = useMemo(() => ({ ...design.style, header: headerStyle }), [design, headerStyle]);
  const docDesign = useMemo(() => ({ ...design, style: ds }), [design, ds]);
  const itemDefaults = useMemo(() => getItemDefaults(), []);
  const accent = branding.accentColor || "#7c3aed";

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<QuoteBlock[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [options, setOptions] = useState<QuoteOption[]>([]);
  const [taxRate, setTaxRate] = useState("0");
  const [customerNotes, setCustomerNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [editingId, setEditingId] = useState<string>("");   // block open in the section editor modal
  const [showCatalog, setShowCatalog] = useState(false);
  const [dragId, setDragId] = useState("");
  const [typeDrag, setTypeDrag] = useState<BlockType | null>(null);      // palette block being dragged from the rail
  const [cbDropIndex, setCbDropIndex] = useState<number | null>(null);   // live-preview insert position while dragging
  const [cbPickerOpen, setCbPickerOpen] = useState(false);               // Content Block picker (search + add)
  const [calcOpen, setCalcOpen] = useState(false);                       // in-builder pricing calculator
  const [showStart, setShowStart] = useState(false);                     // fresh proposal → blank / design chooser

  const hydratedRef = useRef(false);

  useEffect(() => {
    const q = getQuote(id);
    if (q) {
      // A brand-new custom quote has no structure yet — open the start chooser
      // (blank / starter / from a Quote Design) instead of silently seeding.
      const hasContent = !!(q.blocks && q.blocks.length) || !!(q.sections && q.sections.length);
      const blks = (q.blocks && q.blocks.length) ? q.blocks : sectionsToBlocks(q.sections ?? [], q.title);
      if (!hasContent) setShowStart(true);
      setQuote(q); setTitle(q.title); setBlocks(hasContent ? blks : []);
      if (q.proposalHeader) setHeaderStyle(q.proposalHeader as DesignHeader);
      setItems(q.lineItems.length ? q.lineItems.map(lineToDraft) : [blankItem()]);
      setOptions(q.options ?? []);
      setTaxRate(q.subtotal > 0 ? String(Math.round((q.tax / q.subtotal) * 1000) / 10) : "0");
      setCustomerNotes(q.customerNotes ?? ""); setExpiresAt(q.expiresAt ?? "");
    }
    setLoading(false);
  }, [id]);

  const lineItems = useMemo(() => draftsToLines(items), [items]);
  const totals = useMemo(() => computeTotals(lineItems, (parseFloat(taxRate) || 0) / 100), [lineItems, taxRate]);
  const catalog = useMemo(() => getAllItems().filter(i => i.active && (!quote || i.companyId === quote.companyId)), [quote]);
  const savedTerms = useMemo(() => getProposalTerms().filter(t => t.active), []);

  const docData: CustomDocData | null = useMemo(() => {
    if (!quote) return null;
    return {
      branding, quoteNumber: quote.quoteNumber, customerName: quote.customerName,
      locationName: quote.locationName, propertyLabel: quote.propertyLabel,
      createdAt: quote.createdAt, expiresAt: expiresAt || undefined,
      blocks, lineItems, options, subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
      taxRatePct: parseFloat(taxRate) || 0, monthly: quote.pricing?.monthly,
      customerNotes: customerNotes || undefined,
    };
  }, [quote, branding, blocks, lineItems, options, totals, taxRate, customerNotes, expiresAt]);

  // Autosave
  useEffect(() => {
    if (loading || !quote) return;
    if (!hydratedRef.current) { hydratedRef.current = true; return; }
    const t = setTimeout(() => {
      autosaveQuote(id, {
        title: title.trim() || "Untitled Proposal", blocks, lineItems, options,
        subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
        expiresAt: expiresAt || undefined, customerNotes: customerNotes || undefined,
        proposalHeader: headerStyle,
      });
    }, 600);
    return () => clearTimeout(t);
  }, [title, blocks, lineItems, options, taxRate, customerNotes, expiresAt, headerStyle, loading, quote, id, totals.subtotal, totals.tax, totals.total]);

  // ── Canvas view — pan / zoom (the Design-Studio interaction set) ──
  // The sheet floats on a dotted world: plain wheel pans, ⌘-scroll zooms toward
  // the cursor, Space-drag pans, the toolbar recenters. All block interactions
  // (insert gaps, drag-reorder, content-block drops) live INSIDE the sheet and
  // are untouched by the canvas.
  const DOC_W = 816;
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

  // The canvas isn't infinite: pans and zooms are clamped so the sheet can never
  // be stranded — at least MARGIN px of it always stays inside the viewport.
  const VIEW_MARGIN = 140;
  const clampView = (v: { x: number; y: number; zoom: number }) => {
    const vp = viewportRef.current; if (!vp) return v;
    const h = (sheetRef.current?.offsetHeight ?? 1000) * v.zoom;
    const w = DOC_W * v.zoom;
    const cx = cardPosRef.current.x * v.zoom, cy = cardPosRef.current.y * v.zoom;
    const x = Math.min(Math.max(v.x, VIEW_MARGIN - w - cx), vp.clientWidth - VIEW_MARGIN - cx);
    const y = Math.min(Math.max(v.y, VIEW_MARGIN - h - cy), vp.clientHeight - VIEW_MARGIN - cy);
    return x === v.x && y === v.y ? v : { ...v, x, y };
  };
  const sheetRef = useRef<HTMLDivElement>(null);
  const [railOpen, setRailOpen] = useState(true);        // floating studio rail (Insert · Layers)
  const [pricingOpen, setPricingOpen] = useState(true);  // floating Internal Pricing panel (right side)

  const zoomAt = (factor: number, cx: number, cy: number) => setViewT(v => {
    const z = clampZ(v.zoom * factor, 0.35, 2);
    const wx = (cx - v.x) / v.zoom, wy = (cy - v.y) / v.zoom;
    return clampView({ x: cx - wx * z, y: cy - wy * z, zoom: z });
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

  // Re-attach when the viewport remounts (preview toggles it out of the tree).
  useEffect(() => {
    const vp = viewportRef.current; if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - rect.left, e.clientY - rect.top);
      else setViewT(v => clampView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (!spaceRef.current) return;
    e.preventDefault();
    panning.current = true;
    document.body.style.cursor = "grabbing";
    const sx = e.clientX, sy = e.clientY, ox = viewTRef.current.x, oy = viewTRef.current.y;
    const move = (ev: PointerEvent) => { if (panning.current) setViewT(v => clampView({ ...v, x: ox + (ev.clientX - sx), y: oy + (ev.clientY - sy) })); };
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
    const move = (ev: PointerEvent) => {
      const vp = viewportRef.current;
      let nx = ox + (ev.clientX - sx) / z, ny = oy + (ev.clientY - sy) / z;
      if (vp) {
        const vt = viewTRef.current;
        const h = (sheetRef.current?.offsetHeight ?? 1000);
        nx = Math.min(Math.max(nx, (VIEW_MARGIN - vt.x) / z - DOC_W), (vp.clientWidth - VIEW_MARGIN - vt.x) / z);
        ny = Math.min(Math.max(ny, (VIEW_MARGIN - vt.y) / z - h), (vp.clientHeight - VIEW_MARGIN - vt.y) / z);
      }
      setCardPos({ x: nx, y: ny });
    };
    const up = () => {
      document.body.style.cursor = ""; document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  // ─── Block ops ──────────────────────────────────────────
  const patchBlock = (bid: string, patch: Partial<QuoteBlock>) => setBlocks(p => p.map(b => b.id === bid ? { ...b, ...patch } : b));
  const setBlockSettings = (bid: string, patch: Record<string, unknown>) => setBlocks(p => p.map(b => b.id === bid ? { ...b, settings: { ...b.settings, ...patch } } : b));
  const toggleVisible = (bid: string) => setBlocks(p => p.map(b => b.id === bid ? { ...b, visible: !b.visible } : b));
  const moveBlockIdx = (i: number, dir: -1 | 1) => setBlocks(prev => {
    const j = i + dir;
    if (j < 0 || j >= prev.length) return prev;
    const a = [...prev]; [a[i], a[j]] = [a[j], a[i]]; return a;
  });
  function removeBlock(bid: string) {
    setBlocks(prev => prev.filter(b => b.id !== bid));
    if (editingId === bid) setEditingId("");
  }
  function duplicateBlock(bid: string) {
    setBlocks(prev => { const i = prev.findIndex(b => b.id === bid); if (i < 0) return prev;
      const copy: QuoteBlock = { ...prev[i], id: blockId(), title: `${prev[i].title} (Copy)`, locked: false, images: prev[i].images?.map(im => ({ ...im, id: imageId() })) };
      const next = [...prev]; next.splice(i + 1, 0, copy); return next; });
  }
  // Insert a fresh block at a given index in the flow, then open its editor.
  function insertBlock(type: BlockType, index: number) {
    const b = defaultBlock(type);
    setBlocks(prev => { const next = [...prev]; next.splice(index, 0, b); return next; });
    if (isEditable(type)) setEditingId(b.id);
  }
  // Insert wording from a Content Block: copy its text into a new block at `index`.
  // The copy is independent — editing here never changes the master Content Block.
  // `openEditor` opens the focused editor afterward (used by click-to-append).
  function insertContentBlock(cb: ContentBlock, index: number, openEditor = true) {
    const b = contentBlockToBlock(cb);
    setBlocks(prev => { const next = [...prev]; next.splice(Math.max(0, Math.min(index, prev.length)), 0, b); return next; });
    if (openEditor && isEditable(b.type)) setEditingId(b.id);
  }
  // Live-drag preview: the ghost block shown in-flow as the rep drags a palette
  // block in. Memoized per drag so the previewed + dropped block are identical.
  const previewBlock = useMemo(() => (typeDrag ? defaultBlock(typeDrag) : null), [typeDrag]);
  function commitCbDrop() {
    if (previewBlock && cbDropIndex !== null) {
      const b = previewBlock; const idx = Math.max(0, Math.min(cbDropIndex, blocks.length));
      setBlocks(prev => { const next = [...prev]; next.splice(idx, 0, b); return next; });
      if (isEditable(b.type)) setEditingId(b.id);
    }
    setTypeDrag(null); setCbDropIndex(null);
  }
  function endCbDrag() { setTypeDrag(null); setCbDropIndex(null); }
  // Live drag-reorder with direction-aware hysteresis (the classic sortable rule):
  // dragging DOWN only moves once the cursor passes the target's midpoint, dragging
  // UP only before it. Without this, a swap puts the cursor on the swapped block's
  // other half and instantly swaps back — the jitter/oscillation bug.
  function liveMove(targetId: string, bottomHalf: boolean) {
    if (!dragId || dragId === targetId) return;
    setBlocks(prev => {
      const from = prev.findIndex(b => b.id === dragId);
      const tIdx = prev.findIndex(b => b.id === targetId);
      if (from < 0 || tIdx < 0 || from === tIdx) return prev;
      if (from < tIdx && !bottomHalf) return prev;   // moving down: wait for the lower half
      if (from > tIdx && bottomHalf) return prev;    // moving up: wait for the upper half
      const arr = [...prev]; const [m] = arr.splice(from, 1);
      arr.splice(tIdx, 0, m);
      return arr;
    });
  }

  // ─── Line item ops ──────────────────────────────────────
  const setItem = (iid: string, patch: Partial<DraftItem>) => setItems(p => p.map(it => it.id === iid ? { ...it, ...patch } : it));
  const addItem = () => setItems(p => [...p, blankItem()]);
  const removeItem = (iid: string) => setItems(p => p.filter(it => it.id !== iid));
  function addCatalogItems(sel: Item[]) { setItems(prev => { const kept = prev.filter(it => it.name.trim() || it.description.trim() || it.itemId); return [...kept, ...sel.flatMap(it => itemToQuoteLines(it).map(lineToDraft))]; }); setShowCatalog(false); }
  // ─── Option ops ─────────────────────────────────────────
  // ── Selection drives the total ──
  // Options are OFFERS; the chosen one materializes into ONE designated line item
  // (optionId back-ref) so quote.total — and everything downstream (list, detail,
  // billing) — always reflects the selection. Add-on lines coexist beside it.
  function syncOptionLine(sel: QuoteOption | null | undefined) {
    setItems(prev => {
      const rest = prev.filter(it => !it.optionId && (it.name.trim() || it.description.trim() || it.itemId));
      if (!sel) return rest.length ? rest : [blankItem()];
      const line: DraftItem = {
        id: `li-opt-${sel.id}`, optionId: sel.id,
        name: `Selected option — ${sel.name}`, description: sel.description ?? "",
        quantity: "1", unitPrice: String(sel.price), category: "Equipment", taxable: true, optional: false,
      };
      return [line, ...rest];
    });
  }
  // Selecting a tier is exclusive (it's a Good/Better/Best choice) and syncs the line.
  const selectTier = (oid: string) => {
    const next = options.map(o => ({ ...o, selected: o.id === oid ? !o.selected : false }));
    setOptions(next);
    syncOptionLine(next.find(o => o.selected));
  };
  const setOption = (oid: string, patch: Partial<QuoteOption>) => {
    const next = options.map(o => o.id === oid ? { ...o, ...patch } : o);
    setOptions(next);
    const sel = next.find(o => o.selected);
    if (sel?.id === oid) syncOptionLine(sel);   // price/name edits follow the selection
  };
  const removeOption = (oid: string) => {
    const removed = options.find(o => o.id === oid);
    setOptions(p => p.filter(o => o.id !== oid));
    if (removed?.selected) syncOptionLine(null);
  };
  const addOption = () => setOptions(p => [...p, { id: `qopt-${Date.now()}-${p.length}`, name: "New option", price: 0 }]);

  // ── Calculator → line items ──
  // One deterministic "Pricing adjustment" line lands the pre-tax subtotal exactly
  // on the calculator's sell price without touching the rep's other lines.
  const ADJ_ID = "li-adj-sellprice";
  function applySellPrice() {
    const target = quote?.pricing?.sellPrice;
    if (target == null) return;
    setItems(prev => {
      const rest = prev.filter(it => it.id !== ADJ_ID && (it.name.trim() || it.description.trim() || it.itemId));
      const current = rest.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);
      const diff = Math.round((target - current) * 100) / 100;
      if (Math.abs(diff) < 0.5) return rest.length ? rest : [blankItem()];
      return [...rest, {
        id: ADJ_ID, name: "Pricing adjustment", description: "Aligns the proposal to the calculated sell price",
        quantity: "1", unitPrice: String(diff), category: "Other" as LineItemCategory, taxable: true, optional: false,
      }];
    });
  }

  // ─── Persist + lifecycle ────────────────────────────────
  // Pricing calculator lives IN the builder now: save the worksheet onto the
  // quote; the reconciliation panel surfaces sell-price drift from there.
  function savePricing(pricing: QuotePricing) {
    autosaveQuote(id, { pricing });
    setQuote(q => (q ? { ...q, pricing } : q));
    setCalcOpen(false);
  }

  function persist() {
    autosaveQuote(id, { title: title.trim() || "Untitled Proposal", blocks, lineItems, options, subtotal: totals.subtotal, tax: totals.tax, total: totals.total, expiresAt: expiresAt || undefined, customerNotes: customerNotes || undefined });
  }

  if (loading) return <div className="p-10 text-sm" style={{ color: "var(--text-muted)" }}>Loading builder…</div>;
  if (!quote) return (
    <div className="p-10">
      <Link href="/quotes" className="flex items-center gap-1.5 text-sm mb-3" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Back to Quotes</Link>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Quote not found.</p>
    </div>
  );

  const showCost = itemDefaults.showCostField;
  const settingsCtx: SettingsCtx = {
    accent, setBlockSettings, patchBlock, savedTerms,
    items, setItem, addItem, removeItem, taxRate, setTaxRate, totals,
    customerNotes, setCustomerNotes, showCatalog: () => setShowCatalog(true), showCost,
    options, setOption, removeOption, addOption, selectTier,
  };
  const editingBlock = blocks.find(b => b.id === editingId) ?? null;
  const editingIdx = editingBlock ? blocks.findIndex(b => b.id === editingId) : -1;
  const goEdit = (dir: -1 | 1) => { if (editingIdx < 0) return; const j = editingIdx + dir; if (j >= 0 && j < blocks.length) setEditingId(blocks[j].id); };

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* ── Top bar: back · quote # · centered proposal name · Create Quote ── */}
      <div className="flex items-center gap-3 px-5 py-2.5 shrink-0" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <Link href={`/quotes/${id}`} className="flex items-center gap-1.5 text-sm shrink-0 transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Quotes</Link>
        <div className="w-px h-5" style={{ backgroundColor: "var(--border)" }} />
        <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>{quote.quoteNumber}</span>
        {/* The proposal's name lives HERE (not on the sheet) — centered, like a doc title */}
        <div className="flex-1 min-w-0 flex justify-center px-4">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Name this proposal…"
            className="w-full max-w-md bg-transparent outline-none text-center text-base font-semibold rounded-lg px-3 py-1 transition-colors focus:bg-[var(--bg-surface-2)]"
            style={{ color: "var(--text-primary)" }} />
        </div>
        <button onClick={() => { persist(); router.push(`/quotes/${id}`); }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium text-white transition-transform active:scale-[0.98] shrink-0"
          style={{ backgroundColor: accent, boxShadow: "0 2px 8px " + accent + "55" }}>
          <Check className="w-3.5 h-3.5" /> Create Quote
        </button>
      </div>

      {/* ── Stage: pan/zoom canvas (edit) or scrolling document (preview) ── */}
      <div className="flex-1 relative min-h-0">
        {(
          <>
            <div ref={viewportRef} onPointerDown={onCanvasPointerDown}
              className={`absolute inset-0 overflow-hidden ${spaceHeld ? "cursor-grab select-none" : ""}`}
              style={{
                backgroundColor: "var(--bg-page)",
                backgroundImage: "radial-gradient(var(--border-subtle) 1px, transparent 1px)",
                backgroundSize: `${22 * viewT.zoom}px ${22 * viewT.zoom}px`,
                backgroundPosition: `${viewT.x}px ${viewT.y}px`,
              }}>
              <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "0 0", transform: `translate(${viewT.x}px, ${viewT.y}px) scale(${viewT.zoom})`, width: "max-content" }}>
                <div ref={sheetRef} className="relative" style={{ width: DOC_W, transform: `translate(${cardPos.x}px, ${cardPos.y}px)` }}>
                  {/* The sheet's move handle — the one place the document drags from */}
                  <button onPointerDown={onCardHandleDown} title="Drag to move the proposal"
                    className="absolute -top-9 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-grab active:cursor-grabbing select-none"
                    style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 6px 18px -6px rgba(0,0,0,0.3)", color: "var(--text-secondary)" }}>
                    <GripVertical className="w-3.5 h-3.5" /> Proposal
                  </button>

                  {/* The proposal sheet — every block interaction (insert gaps, drag-reorder,
                      content-block ghost drops) lives inside and is untouched by the canvas. */}
                  <div className="relative" style={{ backgroundColor: "#fff", borderRadius: "10px", boxShadow: "0 16px 48px -16px rgba(0,0,0,0.35)" }}>
                    {ds.header === "band" && <div style={{ height: "6px", backgroundColor: accent, borderTopLeftRadius: "10px", borderTopRightRadius: "10px" }} />}
                    <div style={{ padding: "40px 56px 56px", fontFamily: ds.fontFamily }}
                      onDragOver={e => { if (typeDrag || dragId) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
                      onDrop={e => { if (typeDrag) { e.preventDefault(); commitCbDrop(); } else if (dragId) { e.preventDefault(); setDragId(""); } }}>
                      <HeaderBlock headerStyle={headerStyle} onChange={setHeaderStyle} accent={accent}>
                        {ds.header !== "none" && <Letterhead branding={branding} quote={quote} expiresAt={expiresAt} setExpiresAt={setExpiresAt} accent={accent} ds={ds} />}
                      </HeaderBlock>


                      {blocks.length === 0 && !typeDrag && !showStart && (
                        <div className="py-10 text-center">
                          <p className="text-sm" style={{ color: "#9ca3af" }}>Empty proposal — add sections from the <span style={{ color: accent, fontWeight: 600 }}>Blocks</span> panel, or drag one straight onto the sheet.</p>
                        </div>
                      )}

                      {blocks.map((b, i) => (
                        <div key={b.id}>
                          {typeDrag && cbDropIndex === i && <DropLine accent={accent} />}
                          <BlockRow
                            b={b} accent={accent} ds={ds}
                            lineItems={lineItems} totals={totals} taxRate={taxRate} options={options} monthly={quote.pricing?.monthly}
                            dragging={dragId === b.id} dragActive={!!dragId}
                            cbDragActive={!!typeDrag}
                            onEdit={() => setEditingId(b.id)}
                            onDragStart={() => setDragId(b.id)}
                            onDragEnd={() => setDragId("")}
                            onDragOverBlock={bottom => liveMove(b.id, bottom)}
                            onCbDragOver={bottom => setCbDropIndex(bottom ? i + 1 : i)}
                          />
                        </div>
                      ))}

                      {typeDrag && cbDropIndex !== null && cbDropIndex >= blocks.length && <DropLine accent={accent} />}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating studio rail — Insert palette · Content Blocks · Layers · Pricing */}
            {railOpen && (
              <StudioRail accent={accent} blocks={blocks}
                onClose={() => setRailOpen(false)}
                onInsertType={t => insertBlock(t, blocks.length)}
                onTypeDragStart={t => { setTypeDrag(t); setCbDropIndex(blocks.length); }}
                onTypeDragEnd={endCbDrag}
                onOpenCbPicker={() => setCbPickerOpen(true)}
                onSelect={bid => setEditingId(bid)}
                onToggleVisible={toggleVisible}
                onMove={moveBlockIdx}
                onRemove={removeBlock} />
            )}

            {/* Internal pricing — floating on the RIGHT, opposite the blocks rail */}
            {pricingOpen && (
              <PricingPanel accent={accent} pricing={quote.pricing}
                totals={totals} options={options} items={items}
                onApplySellPrice={applySellPrice}
                onReapplyOption={() => syncOptionLine(options.find(o => o.selected))}
                onEditPricing={() => setCalcOpen(true)}
                onClose={() => setPricingOpen(false)} />
            )}

            {/* Fresh proposal → choose a starting point (blank / starter / a Quote Design) */}
            {showStart && (
              <StartChooser accent={accent}
                onBlank={() => { setBlocks([]); setShowStart(false); }}
                onStarter={() => { setBlocks(starterBlocks()); setShowStart(false); }}
                onDesign={d => {
                  const sections = buildSectionsFromKeys(d.defaultSections).map(s => ({ key: s.key, label: s.label, body: s.body, visible: s.visible }));
                  setBlocks(sectionsToBlocks(sections, title.trim() || quote.title));
                  setShowStart(false);
                }} />
            )}

            {/* Bottom-center toolbar: zoom · center · rail toggle */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 rounded-xl p-1"
              style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 88%, transparent)", border: "1px solid var(--border)", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.35)", backdropFilter: "blur(10px)" }}>
              <CanvasBtn onClick={() => zoomButton(0.83)} title="Zoom out"><Minus className="w-4 h-4" /></CanvasBtn>
              <button onClick={centerOn} title="Reset & center" className="px-2 py-1 rounded-lg text-xs font-semibold tabular-nums min-w-[3rem] transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>{Math.round(viewT.zoom * 100)}%</button>
              <CanvasBtn onClick={() => zoomButton(1.2)} title="Zoom in"><Plus className="w-4 h-4" /></CanvasBtn>
              <div className="w-px h-5 mx-0.5" style={{ backgroundColor: "var(--border)" }} />
              <CanvasBtn onClick={centerOn} title="Center & fit"><Maximize className="w-4 h-4" /></CanvasBtn>
              <div className="w-px h-5 mx-0.5" style={{ backgroundColor: "var(--border)" }} />
              <button onClick={() => setRailOpen(o => !o)} aria-expanded={railOpen} title="Insert, content blocks, layers & pricing"
                className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold transition-colors hover:bg-[var(--bg-surface-2)]"
                style={railOpen ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" } : { color: "var(--text-secondary)" }}>
                <Blocks className="w-3.5 h-3.5" /> Blocks
              </button>
              <button onClick={() => setPricingOpen(o => !o)} aria-expanded={pricingOpen} title="Internal pricing (rep only)"
                className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold transition-colors hover:bg-[var(--bg-surface-2)]"
                style={pricingOpen ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" } : { color: "var(--text-secondary)" }}>
                <Lock className="w-3.5 h-3.5" /> Pricing
              </button>
            </div>

          </>
        )}

      </div>

      {showCatalog && <CatalogPicker items={catalog} showCost={showCost} onAdd={addCatalogItems} onClose={() => setShowCatalog(false)} />}
      {calcOpen && quote && (
        <PricingCalculatorModal initial={quote.pricing} accent={accent}
          onSave={savePricing} onClose={() => setCalcOpen(false)} />
      )}
      {cbPickerOpen && (
        <ContentBlockPicker
          onPick={cb => { insertContentBlock(cb, blocks.length, true); setCbPickerOpen(false); }}
          onClose={() => setCbPickerOpen(false)} />
      )}
      {editingBlock && docData && (
        <SectionEditorModal
          block={editingBlock} index={editingIdx} count={blocks.length} accent={accent} ctx={settingsCtx} docData={docData} design={docDesign}
          onClose={() => setEditingId("")}
          onPrev={() => goEdit(-1)} onNext={() => goEdit(1)}
          onDuplicate={() => { duplicateBlock(editingBlock.id); }}
          onRemove={() => removeBlock(editingBlock.id)}
        />
      )}
    </div>
  );
}


// ─── Header block — the letterhead is a block, not a dropdown ──
// Click the header on the sheet to restyle it from VISUAL tiles (mini previews
// of each letterhead), including "No header". When removed, a slim hover strip
// at the top of the sheet adds it back — same language as the insert gaps.
const HEADER_LABELS: Record<DesignHeader, string> = {
  band: "Accent Band", centered: "Centered", bold: "Bold", serif: "Serif", minimal: "Minimal", none: "No header",
};
const HEADER_STYLES: DesignHeader[] = ["band", "centered", "bold", "serif", "minimal", "none"];

function HeaderBlock({ headerStyle, onChange, accent, children }: {
  headerStyle: DesignHeader; onChange: (h: DesignHeader) => void; accent: string; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useCloseOnOutside(ref, open, () => setOpen(false));

  if (headerStyle === "none") {
    return (
      <div ref={ref} className="relative" style={{ height: "18px" }}>
        <button onClick={() => setOpen(o => !o)} title="Add a header" className="group/hdr absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center gap-2 w-full">
          <span className="flex-1 h-px transition-opacity" style={{ backgroundColor: accent, opacity: open ? 1 : 0 }} />
          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity opacity-0 group-hover/hdr:opacity-100"
            style={{ backgroundColor: open ? accent : "#fff", color: open ? "#fff" : accent, border: `1px solid ${accent}`, opacity: open ? 1 : undefined }}>
            <Plus className="w-3 h-3" /> Header
          </span>
          <span className="flex-1 h-px transition-opacity" style={{ backgroundColor: accent, opacity: open ? 1 : 0 }} />
        </button>
        {open && <HeaderStyleMenu value={headerStyle} accent={accent} onPick={h => { onChange(h); setOpen(false); }} />}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(o => !o)} className="group relative cursor-pointer rounded-lg" style={{ padding: "10px 12px", margin: "-10px -12px 0" }}>
        {/* Same hover language as the section blocks */}
        <div className={`absolute inset-0 rounded-lg pointer-events-none transition-opacity ${open ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          style={open ? { boxShadow: `inset 0 0 0 2px ${accent}` } : { backgroundColor: accent + "0a", boxShadow: `inset 0 0 0 1px ${accent}33` }} />
        {children}
      </div>
      {open && <HeaderStyleMenu value={headerStyle} accent={accent} onPick={h => { onChange(h); setOpen(false); }} />}
    </div>
  );
}

function HeaderStyleMenu({ value, accent, onPick }: { value: DesignHeader; accent: string; onPick: (h: DesignHeader) => void }) {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-full z-40 mt-1.5 w-[360px] rounded-xl p-2.5"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.26)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest px-0.5 mb-1.5" style={{ color: "var(--text-muted)" }}>Header style</p>
      <div className="grid grid-cols-3 gap-1.5">
        {HEADER_STYLES.map(h => <HeaderStyleTile key={h} h={h} accent={accent} active={value === h} onPick={() => onPick(h)} />)}
      </div>
    </div>
  );
}

// Mini abstract previews — each tile sketches what that letterhead looks like.
function HeaderStyleTile({ h, accent, active, onPick }: { h: DesignHeader; accent: string; active: boolean; onPick: () => void }) {
  return (
    <button onClick={onPick} className="rounded-lg p-1.5 text-left transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{ border: active ? `2px solid ${accent}` : "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
      <div className="rounded h-12 overflow-hidden" style={{ backgroundColor: "#fff", border: h === "none" ? "1.5px dashed #d1d5db" : "1px solid #eceef1" }}>
        {h === "band" && <><div style={{ height: "3px", backgroundColor: accent }} /><TileLines /></>}
        {h === "bold" && <><div style={{ height: "18px", backgroundColor: accent }} /><TileLines short /></>}
        {h === "centered" && (
          <div className="flex flex-col items-center pt-2 gap-1">
            <div style={{ width: "18px", height: "3px", backgroundColor: accent, borderRadius: "2px" }} />
            <div style={{ width: "34px", height: "2.5px", backgroundColor: "#d1d5db", borderRadius: "2px" }} />
            <div style={{ width: "24px", height: "2.5px", backgroundColor: "#e5e7eb", borderRadius: "2px" }} />
          </div>
        )}
        {h === "serif" && (
          <div className="px-2 pt-2.5">
            <div style={{ height: "2.5px", width: "55%", backgroundColor: "#d1d5db", borderRadius: "2px" }} />
            <div style={{ height: "1.5px", backgroundColor: accent, marginTop: "8px" }} />
            <div style={{ height: "1.5px", backgroundColor: accent, marginTop: "2px", opacity: 0.5 }} />
          </div>
        )}
        {h === "minimal" && (
          <div className="px-2 pt-3">
            <div className="flex items-center justify-between">
              <div style={{ height: "2.5px", width: "35%", backgroundColor: "#d1d5db", borderRadius: "2px" }} />
              <div style={{ height: "2px", width: "20%", backgroundColor: "#e5e7eb", borderRadius: "2px" }} />
            </div>
            <div style={{ height: "1px", backgroundColor: "#e5e7eb", marginTop: "9px" }} />
          </div>
        )}
        {h === "none" && <div className="h-full flex items-center justify-center"><span className="text-[9px]" style={{ color: "#9ca3af" }}>No header</span></div>}
      </div>
      <p className="text-[10px] font-medium mt-1 text-center" style={{ color: active ? accent : "var(--text-secondary)" }}>{HEADER_LABELS[h]}</p>
    </button>
  );
}

function TileLines({ short }: { short?: boolean }) {
  return (
    <div className="px-2 pt-1.5">
      <div className="flex items-start justify-between">
        <div style={{ height: "2.5px", width: short ? "30%" : "35%", backgroundColor: "#d1d5db", borderRadius: "2px" }} />
        <div style={{ height: "2.5px", width: "20%", backgroundColor: "#e5e7eb", borderRadius: "2px" }} />
      </div>
      <div style={{ height: "2px", width: "45%", backgroundColor: "#eceef1", borderRadius: "2px", marginTop: "3px" }} />
    </div>
  );
}

// ─── Canvas toolbar button ────────────────────────────────
function CanvasBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  // no-plus-anim: the zoom "+" is a control, not a create button.
  return <button onClick={onClick} title={title} className="no-plus-anim w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>{children}</button>;
}

function MetricRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{value}{sub && <span className="font-normal ml-1" style={{ color: "var(--text-muted)" }}>{sub}</span>}</span>
    </div>
  );
}

// ─── Editable letterhead — mirrors the active design's header ─────
function Letterhead({ branding, quote, expiresAt, setExpiresAt, accent, ds }: {
  branding: ReturnType<typeof getProposalBranding>; quote: QuoteRecord;
  expiresAt: string; setExpiresAt: (v: string) => void; accent: string; ds: ProposalDesignStyle;
}) {
  const hf = ds.headingFamily;
  const logo = branding.logoUrl, company = branding.companyName;
  // Editable "valid until" chip, themed light/dark for the header background.
  const validUntil = (dim: string, align: "left" | "right" = "right") => (
    <span className="inline-flex items-center gap-1.5" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
      <span style={{ fontSize: "11px", color: dim }}>Valid until</span>
      <input value={expiresAt} onChange={e => setExpiresAt(e.target.value)} placeholder="e.g. Jul 15, 2026"
        onClick={e => e.stopPropagation()}
        className="bg-transparent outline-none rounded px-1 focus:bg-black/5"
        style={{ fontSize: "11px", color: dim, width: "104px", textAlign: align }} />
    </span>
  );
  const Logo = ({ white }: { white?: boolean }) => logo
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={logo} alt={company} style={{ maxHeight: "44px", marginBottom: "6px", filter: white ? "brightness(0) invert(1)" : undefined }} />
    : <p style={{ fontSize: "20px", fontWeight: 800, color: white ? "#fff" : accent, lineHeight: 1.1, fontFamily: hf }}>{company}</p>;
  const metaBlock = (color: string, dim: string) => (
    <div style={{ textAlign: "right" }}>
      <p style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em", color }}>PROPOSAL</p>
      <p style={{ fontSize: "11px", color: dim, marginTop: "2px" }}>{quote.quoteNumber}</p>
      <p style={{ fontSize: "11px", color: dim }}>Prepared for {quote.customerName}</p>
      <div className="mt-1">{validUntil(dim)}</div>
    </div>
  );

  if (ds.header === "bold") {
    return (
      <div>
        <div style={{ background: accent, margin: "-40px -56px 0", padding: "30px 56px 26px", borderTopLeftRadius: "10px", borderTopRightRadius: "10px" }}>
          <div className="flex items-start justify-between" style={{ gap: "16px" }}>
            <div><Logo white /><p style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)", marginTop: "6px" }}>{branding.companyInfo}</p><p style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)" }}>{branding.contactInfo}</p></div>
            {metaBlock("#fff", "rgba(255,255,255,0.85)")}
          </div>
        </div>
      </div>
    );
  }

  if (ds.header === "centered") {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "inline-block" }}><Logo /></div>
        <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>{branding.companyInfo} · {branding.contactInfo}</p>
        <div style={{ width: "56px", height: "3px", backgroundColor: accent, borderRadius: "2px", margin: "16px auto" }} />
        <p style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.18em", color: "#111827" }}>PROPOSAL</p>
        <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>{quote.quoteNumber} · Prepared for {quote.customerName}</p>
        <div className="flex justify-center mt-1">{validUntil("#374151", "left")}</div>
      </div>
    );
  }

  if (ds.header === "serif") {
    return (
      <div>
        <div className="flex items-start justify-between" style={{ gap: "16px" }}>
          <div><Logo /><p style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px", fontFamily: hf }}>{branding.companyInfo}</p><p style={{ fontSize: "11px", color: "#6b7280", fontFamily: hf }}>{branding.contactInfo}</p></div>
          <div style={{ fontFamily: hf }}>{metaBlock("#111827", "#6b7280")}</div>
        </div>
        <div style={{ borderTop: `1px solid ${accent}`, marginTop: "18px" }} />
        <div style={{ borderTop: `1px solid ${accent}`, marginTop: "3px", opacity: 0.5 }} />
      </div>
    );
  }

  if (ds.header === "minimal") {
    return (
      <div>
        <div className="flex items-baseline justify-between" style={{ gap: "16px" }}>
          {logo ? <Logo /> : <p style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#111827", fontFamily: hf }}>{company}</p>}
          <p style={{ fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#9ca3af" }}>Proposal · {quote.quoteNumber}</p>
        </div>
        <div style={{ borderTop: "1px solid #e5e7eb", marginTop: "12px" }} />
        <div className="flex items-center justify-between mt-2.5">
          <p style={{ fontSize: "11px", color: "#6b7280" }}>Prepared for {quote.customerName}</p>
          {validUntil("#374151", "right")}
        </div>
      </div>
    );
  }

  // band (default)
  return (
    <div>
      <div className="flex items-start justify-between" style={{ marginBottom: "18px" }}>
        <div><Logo /><p style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>{branding.companyInfo}</p><p style={{ fontSize: "11px", color: "#6b7280" }}>{branding.contactInfo}</p></div>
        {metaBlock("#111827", "#6b7280")}
      </div>
      <div style={{ height: "2px", backgroundColor: accent, opacity: 0.85 }} />
    </div>
  );
}

// ─── Studio rail — Insert · Content Blocks · Layers · Pricing ──
// The floating left panel (Design-Studio pattern). Insert mirrors every option
// the "+" gaps offer; Content Blocks are searchable and drag straight onto the
// sheet (drops still land in any gap, with the same ghost preview); Layers lists
// the document's sections for select / hide / reorder / delete; the rep-only
// internal pricing folds in at the bottom.
function StudioRail({ accent, blocks, onClose, onInsertType, onTypeDragStart, onTypeDragEnd, onOpenCbPicker, onSelect, onToggleVisible, onMove, onRemove }: {
  accent: string; blocks: QuoteBlock[];
  onClose: () => void;
  onInsertType: (t: BlockType) => void;
  onTypeDragStart: (t: BlockType) => void; onTypeDragEnd: () => void;
  onOpenCbPicker: () => void;
  onSelect: (bid: string) => void;
  onToggleVisible: (bid: string) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  onRemove: (bid: string) => void;
}) {
  return (
    <aside className="absolute top-3 left-3 z-30 w-80 max-h-[calc(100%-4.5rem)] overflow-y-auto thin-scroll-y rounded-2xl p-4 space-y-5"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)" }}>
      {/* Insert — the same options as the "+" gaps between sections */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <RailTitle icon={Plus} title="Insert" accent={accent} />
          <button onClick={onClose} aria-label="Close panel"><X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></button>
        </div>
        {BLOCK_GROUPS.map(group => (
          <div key={group} className="mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{group}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {BLOCK_LIBRARY.filter(d => d.group === group).map(d => (
                <button key={d.type} onClick={() => onInsertType(d.type)} title={d.hint}
                  draggable
                  onDragStart={e => { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", d.type); } catch { /* ignore */ } onTypeDragStart(d.type); }}
                  onDragEnd={onTypeDragEnd}
                  className="flex items-center px-2 py-2 rounded-lg text-xs font-medium text-left transition-colors hover:bg-[var(--bg-surface-2)] cursor-grab active:cursor-grabbing"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <span className="truncate">{d.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {/* Saved wording lives behind ONE button — the picker handles search/filter/create */}
        <button onClick={onOpenCbPicker}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors hover:brightness-95"
          style={{ backgroundColor: accent + "14", border: `1px solid ${accent}44`, color: accent }}>
          <Blocks className="w-3.5 h-3.5" /> Insert Content Block…
        </button>
        <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Click to add at the end — or drag a block straight onto the sheet where you want it.
        </p>
      </div>

      {/* Layers — the document's sections, top to bottom */}
      <div>
        <RailTitle icon={Layers} title="Layers" accent={accent} />
        <div className="space-y-1 mt-2">
          {blocks.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nothing yet — insert a section above.</p>}
          {blocks.map((b, i) => (
            <div key={b.id} onClick={() => onSelect(b.id)}
              className="group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]"
              style={{ border: "1px solid transparent", opacity: b.visible === false ? 0.55 : 1 }}>
              <span className="text-[10px] font-mono w-4 text-center shrink-0" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
              <span className="flex-1 min-w-0 truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>{BLOCK_LABELS[b.type] ?? b.type}</span>
              <span className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                <button onClick={e => { e.stopPropagation(); onMove(i, -1); }} disabled={i === 0} className="disabled:opacity-20 p-0.5" style={{ color: "var(--text-muted)" }}><ChevronUp className="w-3 h-3" /></button>
                <button onClick={e => { e.stopPropagation(); onMove(i, 1); }} disabled={i === blocks.length - 1} className="disabled:opacity-20 p-0.5" style={{ color: "var(--text-muted)" }}><ChevronDown className="w-3 h-3" /></button>
                <button onClick={e => { e.stopPropagation(); onRemove(b.id); }} title="Delete" className="p-0.5" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3 h-3" /></button>
              </span>
              <button onClick={e => { e.stopPropagation(); onToggleVisible(b.id); }} title={b.visible === false ? "Show" : "Hide"} className="p-0.5 shrink-0" style={{ color: "var(--text-muted)" }}>
                {b.visible === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
        <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>Click a layer to open its editor.</p>
      </div>

    </aside>
  );
}

// ─── Internal pricing — floating panel on the RIGHT ───────
// Rep-only; reconciles the three prices into ONE truth (line items). Never part
// of the document.
function PricingPanel({ accent, pricing, totals, options, items, onApplySellPrice, onReapplyOption, onEditPricing, onClose }: {
  accent: string; pricing?: QuoteRecord["pricing"];
  totals: { subtotal: number; tax: number; total: number };
  options: QuoteOption[]; items: DraftItem[];
  onApplySellPrice: () => void; onReapplyOption: () => void; onEditPricing: () => void; onClose: () => void;
}) {
  // Reconciliation: the three prices that must agree — calculator sell price,
  // line-item subtotal (THE total), and the selected option.
  const selOption = options.find(o => o.selected);
  const sellDrift = pricing ? Math.round(pricing.sellPrice - totals.subtotal) : 0;
  const optionLine = selOption ? items.find(it => it.optionId === selOption.id) : undefined;
  const optionDrift = !!selOption && (!optionLine || Math.abs((parseFloat(optionLine.unitPrice) || 0) - selOption.price) >= 0.5);
  return (
    <aside className="absolute top-3 right-3 z-30 w-72 max-h-[calc(100%-4.5rem)] overflow-y-auto thin-scroll-y rounded-2xl p-4"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45)" }}>
      <div className="flex items-center justify-between mb-2">
        <RailTitle icon={Lock} title="Internal Pricing" accent={accent} />
        <button onClick={onClose} aria-label="Close panel"><X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></button>
      </div>
      <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Line items · the quote total</span>
            <span className="text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(totals.subtotal)}</span>
          </div>
          {selOption && <MetricRow label="Selected option" value={fmt(selOption.price)} sub={selOption.tier ? selOption.tier : undefined} />}
          {pricing && <MetricRow label="Calculator sell price" value={fmt(pricing.sellPrice)} />}

          {/* Drift warnings + one-click fixes — nothing applies silently */}
          {pricing && Math.abs(sellDrift) >= 1 && (
            <div className="rounded-lg p-2" style={{ backgroundColor: "var(--warning-soft-bg)", border: "1px solid var(--warning-soft-border)" }}>
              <p className="text-[11px] leading-snug" style={{ color: "var(--warning-text)" }}>
                Line items are {fmt(Math.abs(sellDrift))} {sellDrift > 0 ? "below" : "above"} the calculator sell price.
              </p>
              <button onClick={onApplySellPrice} className="mt-1 text-[11px] font-semibold underline underline-offset-2" style={{ color: "var(--warning-text)" }}>
                Apply sell price to line items
              </button>
            </div>
          )}
          {optionDrift && selOption && (
            <div className="rounded-lg p-2" style={{ backgroundColor: "var(--warning-soft-bg)", border: "1px solid var(--warning-soft-border)" }}>
              <p className="text-[11px] leading-snug" style={{ color: "var(--warning-text)" }}>
                “{selOption.name}” is selected but its line item is missing or out of date.
              </p>
              <button onClick={onReapplyOption} className="mt-1 text-[11px] font-semibold underline underline-offset-2" style={{ color: "var(--warning-text)" }}>
                Re-apply option to line items
              </button>
            </div>
          )}
          {!selOption && options.length > 0 && (
            <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              No option selected yet — selecting one adds it to the line items automatically.
            </p>
          )}

          {!pricing && (
            <button onClick={onEditPricing} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-surface)]" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <Pencil className="w-3 h-3" /> Open pricing calculator
            </button>
          )}
          {pricing && (
            <>
              <MetricRow label="Gross profit" value={fmt(pricing.grossProfit)} sub={`${(pricing.grossMargin * 100).toFixed(0)}%`} />
              <MetricRow label="Net profit" value={fmt(pricing.netProfit)} sub={`${(pricing.netMargin * 100).toFixed(0)}%`} />
              <MetricRow label="Financing" value={`${fmt(pricing.monthly)}/mo`} sub={`${pricing.financeMonths} mo`} />
              <button onClick={onEditPricing} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-surface)]" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                <Pencil className="w-3 h-3" /> Edit pricing (calculator)
              </button>
            </>
          )}
          <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>Rep only — never shown to the customer. Line items are what the customer pays.</p>
        </div>
    </aside>
  );
}

// ─── Start chooser — blank / starter / from a Quote Design ──
// Shown once when a custom quote has no structure yet (like the email builder's
// blank-vs-branded start): begin empty and add blocks one by one, use the
// standard starter skeleton, or seed from any Quote Design's section layout.
function StartChooser({ accent, onBlank, onStarter, onDesign }: {
  accent: string; onBlank: () => void; onStarter: () => void; onDesign: (d: QuoteDesign) => void;
}) {
  const designs = getQuoteDesigns();
  return (
    <div className="start-overlay absolute inset-0 z-40 flex items-center justify-center p-6" style={{ backgroundColor: "color-mix(in srgb, var(--bg-page) 72%, transparent)", backdropFilter: "blur(6px)" }}>
      <div className="start-panel w-full max-w-2xl max-h-full overflow-y-auto thin-scroll-y rounded-2xl p-6"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
        <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>How do you want to start?</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Start empty and add blocks one by one, or begin from a structure and tune it.</p>

        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <button onClick={onBlank}
            className="start-card group rounded-xl p-4 text-left hover:shadow-md flex flex-col items-start gap-2"
            style={{ border: "1.5px dashed var(--border)", backgroundColor: "var(--bg-surface-2)", animationDelay: "60ms" }}>
            <span className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: accent + "1a" }}><Plus className="w-4 h-4" style={{ color: accent }} /></span>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Blank proposal</span>
            <span className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>An empty sheet — build it block by block.</span>
          </button>
          <button onClick={onStarter}
            className="start-card group rounded-xl p-4 text-left hover:shadow-md flex flex-col items-start gap-2"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", animationDelay: "120ms" }}>
            <span className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: accent + "1a" }}><Blocks className="w-4 h-4" style={{ color: accent }} /></span>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Standard starter</span>
            <span className="text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>The classic proposal skeleton — intro, scope, pricing, terms.</span>
          </button>
        </div>

        <p className="text-[10px] font-semibold uppercase tracking-widest mt-5 mb-2" style={{ color: "var(--text-muted)" }}>Or start from a Quote Design</p>
        <div className="grid grid-cols-3 gap-2">
          {designs.map((d, i) => (
            <button key={d.id} onClick={() => onDesign(d)}
              className="start-card rounded-xl p-1.5 text-left hover:shadow-md"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)", animationDelay: `${180 + i * 45}ms` }}>
              <QuoteDesignThumbnail design={d} height={88} />
              <p className="text-[11px] font-semibold truncate mt-1.5 px-0.5" style={{ color: "var(--text-primary)" }}>{d.name}</p>
              <p className="text-[10px] truncate px-0.5" style={{ color: "var(--text-muted)" }}>{d.defaultSections.length} sections</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function RailTitle({ icon: Icon, title, accent }: { icon: typeof Plus; title: string; accent: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
      <Icon className="w-3.5 h-3.5" style={{ color: accent }} /> {title}
    </p>
  );
}

// ─── A single block in the flowing sheet (display + click-to-edit + drag) ──
function BlockRow(props: {
  b: QuoteBlock; accent: string; ds: ProposalDesignStyle;
  lineItems: LineItem[]; totals: { subtotal: number; tax: number; total: number }; taxRate: string; options: QuoteOption[]; monthly?: number;
  dragging: boolean; dragActive: boolean; cbDragActive?: boolean;
  onEdit: () => void; onDragStart: () => void; onDragEnd: () => void; onDragOverBlock: (bottomHalf: boolean) => void;
  onCbDragOver?: (bottomHalf: boolean) => void;
}) {
  const { b, accent, dragging, dragActive, cbDragActive } = props;

  return (
    <div
      onClick={() => props.onEdit()}
      onDragOver={
        dragActive ? (e => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); props.onDragOverBlock(e.clientY > r.top + r.height / 2); })
        : cbDragActive ? (e => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); props.onCbDragOver?.(e.clientY > r.top + r.height / 2); })
        : undefined
      }
      onDrop={dragActive ? (e => { e.preventDefault(); props.onDragEnd(); }) : undefined}
      className="group relative transition-all cursor-pointer"
      style={{
        padding: "10px 12px",
        marginLeft: "-12px", marginRight: "-12px",
        borderRadius: "8px",
        opacity: dragging ? 0.5 : b.visible ? 1 : 0.5,
        outline: dragging ? `2px dashed ${accent}` : undefined,
        outlineOffset: dragging ? "-2px" : undefined,
        backgroundColor: dragging ? accent + "0d" : undefined,
      }}
    >
      {/* Hover tint to signal the whole section is clickable (suppressed while dragging) */}
      {!dragActive && <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ backgroundColor: accent + "0a", boxShadow: `inset 0 0 0 1px ${accent}33` }} />}

      {/* Hidden tag */}
      {!b.visible && (
        <span className="absolute left-1/2 -translate-x-1/2 -top-2 z-10 text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: "#6b7280", color: "#fff" }}>Hidden</span>
      )}

      {/* Drag handle (left gutter, on hover) — the only inline control; drags the section to reorder. */}
      <span
        draggable
        onDragStart={e => {
          e.stopPropagation();
          if (EMPTY_DRAG_IMG) { try { e.dataTransfer.setDragImage(EMPTY_DRAG_IMG, 0, 0); } catch { /* ignore */ } }
          props.onDragStart(); e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => props.onDragEnd()}
        onClick={e => e.stopPropagation()}
        title="Drag to reorder"
        className="absolute -left-7 top-3 flex items-center justify-center rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-surface-2)]"
        style={{ width: "20px", height: "24px", color: "#9ca3af" }}
      ><GripVertical className="w-4 h-4" /></span>

      {/* The block content, rendered as it appears in the document (borderless, display-only) */}
      <CanvasBlock b={b} accent={accent} ds={props.ds}
        lineItems={props.lineItems} totals={props.totals} taxRate={props.taxRate} options={props.options} monthly={props.monthly} />
    </div>
  );
}

// ─── Drop indicator — a slim line where the dragged block will land ──
// Fixed tiny height so the flow barely shifts under the cursor (a full rendered
// ghost pushed the layout around and made the drop index flicker near the bottom).
function DropLine({ accent }: { accent: string }) {
  return <div className="rounded-full" style={{ height: "3px", margin: "6px 0", backgroundColor: accent, boxShadow: `0 0 8px ${accent}88` }} />;
}

function ToolBtn({ children, title, onClick, active, accent, danger, disabled }: { children: React.ReactNode; title: string; onClick: () => void; active?: boolean; accent?: string; danger?: boolean; disabled?: boolean }) {
  return (
    <button title={title} disabled={disabled} onClick={onClick}
      className="p-1.5 rounded-md transition-colors hover:bg-[var(--bg-surface-2)] disabled:opacity-30 disabled:cursor-default"
      style={{ color: danger ? "#ef4444" : active ? (accent ?? "var(--accent-text)") : "var(--text-secondary)", backgroundColor: active ? "var(--accent-soft-bg)" : undefined }}>
      {children}
    </button>
  );
}

// ─── Section editor modal (resizable: focused editor + live document preview) ──
interface SettingsCtx {
  accent: string;
  setBlockSettings: (id: string, patch: Record<string, unknown>) => void; patchBlock: (id: string, patch: Partial<QuoteBlock>) => void;
  savedTerms: { id: string; title: string; body: string }[];
  items: DraftItem[]; setItem: (id: string, patch: Partial<DraftItem>) => void; addItem: () => void; removeItem: (id: string) => void;
  taxRate: string; setTaxRate: (v: string) => void; totals: { subtotal: number; tax: number; total: number };
  customerNotes: string; setCustomerNotes: (v: string) => void; showCatalog: () => void; showCost: boolean;
  options: QuoteOption[]; setOption: (id: string, patch: Partial<QuoteOption>) => void; removeOption: (id: string) => void; addOption: () => void; selectTier: (id: string) => void;
}

const PREVIEW_MIN = 460;   // px — the live preview never shrinks past this
const EDITOR_MIN = 380;    // px — the editor pane minimum

function SectionEditorModal(props: {
  block: QuoteBlock; index: number; count: number; accent: string; ctx: SettingsCtx; docData: CustomDocData;
  design: ReturnType<typeof getActiveDesign>;
  onClose: () => void; onPrev: () => void; onNext: () => void;
  onDuplicate: () => void; onRemove: () => void;
}) {
  const { block, accent, ctx, docData } = props;
  const previewRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [editorW, setEditorW] = useState(560);   // left editor pane width (px); user-resizable

  // Scroll the edited section into view ONCE when the editor opens — prev/next
  // navigation must NOT move the preview (the highlight outline is enough).
  useEffect(() => {
    const el = previewRef.current?.querySelector(`[data-blk="${block.id}"]`);
    if (el) el.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only by design
  }, []);

  // Esc closes the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    const onMove = (me: PointerEvent) => {
      const r = bodyRef.current?.getBoundingClientRect(); if (!r) return;
      const w = Math.max(EDITOR_MIN, Math.min(me.clientX - r.left, r.width - PREVIEW_MIN));
      setEditorW(w);
    };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  }

  const showLabelField = block.type !== "heading" && isEditable(block.type);

  return (
    <div className="glass-overlay fixed inset-0 z-[60] flex items-center justify-center p-3" onClick={props.onClose}>
      <div className="glass-panel flex flex-col rounded-3xl overflow-hidden" style={{ width: "min(1560px, 98vw)", height: "94vh" }} onClick={e => e.stopPropagation()}>
        {/* Header — floating glass toolbar */}
        <div className="glass-hairline flex items-center gap-3 px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: accent + "16", color: accent, border: `1px solid ${accent}2e` }}>{BLOCK_LABELS[block.type]}</span>
          {showLabelField ? (
            <input value={block.title} onChange={e => ctx.patchBlock(block.id, { title: e.target.value })} placeholder="Section label…"
              className="flex-1 min-w-0 bg-transparent outline-none px-2.5 py-1.5 text-sm font-medium rounded-lg transition-colors focus:bg-[var(--bg-surface-2)]"
              style={{ color: "var(--text-primary)" }} />
          ) : <div className="flex-1" />}
          <div className="flex items-center gap-1 shrink-0">
            <ToolBtn title="Previous section" disabled={props.index === 0} onClick={props.onPrev}><ChevronLeft className="w-4 h-4" /></ToolBtn>
            <span className="text-[11px] tabular-nums px-1" style={{ color: "var(--text-muted)" }}>{props.index + 1}/{props.count}</span>
            <ToolBtn title="Next section" disabled={props.index === props.count - 1} onClick={props.onNext}><ChevronRight className="w-4 h-4" /></ToolBtn>
          </div>
          <div className="w-px h-5" style={{ backgroundColor: "color-mix(in srgb, var(--border) 55%, transparent)" }} />
          <ToolBtn title="Duplicate" onClick={props.onDuplicate}><Copy className="w-4 h-4" /></ToolBtn>
          <ToolBtn title="Delete section" danger onClick={props.onRemove}><Trash2 className="w-4 h-4" /></ToolBtn>
          <button onClick={props.onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ml-1" style={{ backgroundColor: accent, color: "#fff" }}><Check className="w-3.5 h-3.5" /> Saved</button>
        </div>

        {/* Body: editor | resizer | live preview */}
        <div ref={bodyRef} className="flex-1 flex overflow-hidden">
          <div className="overflow-y-auto thin-scroll-y p-5 space-y-5 shrink-0" style={{ width: `${editorW}px`, minWidth: `${EDITOR_MIN}px` }}>
            <SectionContentEditor block={block} ctx={ctx} />
            <BlockSettings sel={block} ctx={ctx} />
          </div>
          {/* Resizer */}
          <div onPointerDown={startResize} title="Drag to resize" className="shrink-0 flex items-center justify-center cursor-col-resize group/resize"
            style={{ width: "10px", borderLeft: "1px solid color-mix(in srgb, var(--border) 45%, transparent)" }}>
            <span className="rounded-full transition-all opacity-40 group-hover/resize:opacity-100 group-hover/resize:bg-[var(--accent-text)]" style={{ width: "3px", height: "40px", backgroundColor: "var(--border)" }} />
          </div>
          <div ref={previewRef} className="flex-1 overflow-y-auto thin-scroll-y" style={{ backgroundColor: "#e5e7eb", minWidth: 0 }}>
            <div className="px-6 py-6">
              <p className="text-center text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#6b7280" }}>Live preview — what your customer sees</p>
              <CustomProposalDocument data={docData} highlightId={block.id} design={props.design} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Content surface for a section (the editable body). Structured blocks have no
// free-form body — they're configured entirely through BlockSettings below.
function SectionContentEditor({ block, ctx }: { block: QuoteBlock; ctx: SettingsCtx }) {
  if (block.type === "heading") {
    return <Field label="Heading text"><input value={block.content} onChange={e => ctx.patchBlock(block.id, { content: e.target.value })} placeholder="Heading text" className="w-full rounded-lg px-3 py-2 text-base font-semibold outline-none focus:ring-2" style={inputStyle} /></Field>;
  }
  if (RICH_BLOCK_TYPES.includes(block.type)) {
    // Riq only assists CUSTOM text — typed sections (scope, warranty, terms, …)
    // pull saved wording from Content Blocks instead.
    const riq = block.type === "rich_text" || block.type === "custom_section";
    return (
      <Field label="Content" hint="format, add images, links">
        <RichTextEditor key={block.id} value={block.content} onChange={html => ctx.patchBlock(block.id, { content: html })} minHeight={280} placeholder="Write or paste text here…"
          toolbarExtra={riq ? <RiqAssist block={block} ctx={ctx} /> : undefined} />
      </Field>
    );
  }
  return null;
}

// ─── Ask Riq — AI drafting for any text section ───────────
// Same brain as the document editor's ask-to-write (/api/ai/write, markdown-lite
// → the block's simple HTML). Empty section = Riq's draft replaces it; otherwise
// the draft appends below what's already written. Honest local fallback offline.
function RiqAssist({ block, ctx }: { block: QuoteBlock; ctx: SettingsCtx }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const accent = ctx.accent;

  async function run() {
    const ask = prompt.trim();
    if (!ask || busy) return;
    setBusy(true);
    recordUsage("ai");
    let text = "";
    try {
      const r = await fetch("/api/ai/write", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: `Write the "${block.title || BLOCK_LABELS[block.type]}" section of a professional service proposal. Keep it customer-facing, confident, and concise. ${ask}`,
        }),
      });
      const data = await r.json();
      if (data?.text) text = data.text;
    } catch { /* fall through to the local fallback */ }
    if (!text) text = `- ${ask}\n- (Riq is offline — set ANTHROPIC_API_KEY to enable drafting)`;
    const html = plainTextToHtml(text.replace(/\*\*/g, ""));
    const existing = (block.content ?? "").replace(/<p>\s*<\/p>/g, "").trim();
    ctx.patchBlock(block.id, { content: existing ? existing + html : html });
    setBusy(false); setPrompt(""); setOpen(false);
  }

  return (
    <span className="relative inline-flex">
      <button onClick={() => setOpen(o => !o)} title="Ask Riq to write this"
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors hover:brightness-95"
        style={{ backgroundColor: open ? accent : accent + "14", border: `1px solid ${accent}44`, color: open ? "#fff" : accent }}>
        <Sparkles className="w-3.5 h-3.5" /> Riq
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-40 w-80 rounded-xl p-2 flex items-center gap-2"
          style={{ backgroundColor: "var(--bg-surface)", border: `1px solid ${accent}44`, boxShadow: "0 12px 32px rgba(0,0,0,0.22)" }}>
          <input autoFocus value={prompt} onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") run(); if (e.key === "Escape") setOpen(false); }}
            placeholder="Tell Riq what to write…"
            disabled={busy}
            className="flex-1 min-w-0 bg-transparent outline-none text-sm" style={{ color: "var(--text-primary)" }} />
          <button onClick={run} disabled={busy || !prompt.trim()}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40 shrink-0" style={{ backgroundColor: accent }}>
            {busy ? "Drafting…" : "Write"}
          </button>
        </div>
      )}
    </span>
  );
}

// ─── Canvas block (document representation — display-only on the sheet) ──
function CanvasBlock({ b, accent, ds, lineItems, totals, taxRate, options, monthly }: {
  b: QuoteBlock; accent: string; ds: ProposalDesignStyle;
  lineItems: LineItem[]; totals: { subtotal: number; tax: number; total: number }; taxRate: string;
  options: QuoteOption[]; monthly?: number;
}) {
  if (b.type === "divider") return <div className="h-px" style={{ backgroundColor: "#e5e7eb" }} />;
  if (b.type === "page_break") return <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest" style={{ color: "#9ca3af" }}><div className="flex-1 h-px" style={{ backgroundColor: "#e5e7eb" }} /> Page break <div className="flex-1 h-px" style={{ backgroundColor: "#e5e7eb" }} /></div>;

  if (b.type === "heading") {
    const lvl = b.settings?.level ?? 2;
    const cls = lvl === 1 ? "text-2xl" : lvl === 2 ? "text-xl" : "text-base";
    return <p className={`${cls} font-bold`} style={{ color: "#111827", textAlign: b.settings?.align ?? "left", fontFamily: ds.headingFamily }}>{b.content || <span style={{ color: "#9ca3af" }}>Heading</span>}</p>;
  }

  if (RICH_BLOCK_TYPES.includes(b.type)) {
    return (
      <>
        {b.title && <SecLabel accent={accent} ds={ds}>{b.title}</SecLabel>}
        {hasHtml(b.content)
          ? <div className="rte-doc text-sm" style={{ color: "#374151" }} dangerouslySetInnerHTML={{ __html: b.content }} />
          : <p className="text-sm italic" style={{ color: "#9ca3af" }}>Click to write or paste text…</p>}
      </>
    );
  }

  if (b.type === "image") {
    const img = b.images?.[0];
    return (<>{b.title && <SecLabel accent={accent} ds={ds}>{b.title}</SecLabel>}
      {img?.src ? (<figure className="m-0" style={{ textAlign: b.settings?.align ?? "center" }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={img.src} alt={img.alt ?? b.title} className="inline-block rounded-lg" style={{ width: `${b.settings?.width ?? 100}%` }} />{img.caption && <figcaption className="text-[11px] mt-1.5" style={{ color: "#6b7280" }}>{img.caption}</figcaption>}</figure>)
        : <Placeholder icon={ImageIcon} text="Click to add an image" />}</>);
  }

  if (b.type === "image_gallery") {
    const imgs = (b.images ?? []).filter(i => i.src);
    return (<>{b.title && <SecLabel accent={accent} ds={ds}>{b.title}</SecLabel>}
      {imgs.length ? (<div className="grid grid-cols-2 gap-2.5">{imgs.map(im => (<figure key={im.id} className="m-0">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={im.src} alt={im.alt ?? ""} className="w-full rounded-lg" style={{ height: "130px", objectFit: "cover" }} />{im.caption && <figcaption className="text-[10px] mt-1" style={{ color: "#6b7280" }}>{im.caption}</figcaption>}</figure>))}</div>)
        : <Placeholder icon={ImageIcon} text="Click to add photos" />}</>);
  }

  if (b.type === "equipment_card") {
    const s = b.settings ?? {}; const img = b.images?.[0];
    return (<><SecLabel accent={accent} ds={ds}>{b.title}</SecLabel>
      <div className="flex gap-3 rounded-xl p-3" style={{ border: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
        {img?.src && (/* eslint-disable-next-line @next/next/no-img-element */<img src={img.src} alt={b.title} className="rounded-lg" style={{ width: "96px", height: "96px", objectFit: "cover" }} />)}
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#111827" }}>{b.title}</p>
          {(s.brand || s.model) && <p className="text-[11px]" style={{ color: "#6b7280" }}>{[s.brand, s.model].filter(Boolean).join(" · ")}</p>}
          {s.specs && <p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: "#374151" }}>{s.specs}</p>}
          {typeof s.price === "number" && s.price > 0 && <p className="text-base font-bold mt-1 tabular-nums" style={{ color: "#111827" }}>{fmt(s.price)}</p>}
        </div>
      </div></>);
  }

  if (b.type === "option_cards") {
    return (<><SecLabel accent={accent} ds={ds}>{b.title}</SecLabel>
      {options.length === 0 ? <Placeholder icon={Package} text="Click to add option cards" /> : (
        <div className="grid sm:grid-cols-3 gap-2.5">{options.map(o => (
          <div key={o.id} className="text-left rounded-xl p-3 overflow-hidden" style={{ border: `1.5px solid ${o.selected ? accent : "#e5e7eb"}`, backgroundColor: o.selected ? accent + "0f" : "#fff" }}>
            {o.image && (/* eslint-disable-next-line @next/next/no-img-element */<img src={o.image} alt={o.name} className="w-full rounded-lg mb-2" style={{ height: "92px", objectFit: "cover" }} />)}
            <div className="flex items-center justify-between">{o.tier && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase" style={{ backgroundColor: accent + "1a", color: accent }}>{o.tier}</span>}{o.selected && <Check className="w-3.5 h-3.5" style={{ color: accent }} />}</div>
            <p className="text-sm font-semibold mt-1.5 leading-snug" style={{ color: "#111827" }}>{o.name}</p>
            <p className="text-lg font-bold mt-1 tabular-nums" style={{ color: "#111827" }}>${o.price.toLocaleString()}</p>
            {o.monthlyPrice ? <p className="text-[11px] tabular-nums" style={{ color: accent }}>${o.monthlyPrice}/mo</p> : null}
          </div>))}</div>)}</>);
  }

  if (b.type === "line_items" || b.type === "price_summary") {
    const base = lineItems.filter(li => !li.optional);
    const itemized = b.type === "line_items" || (b.settings?.itemized ?? true);
    return (<><SecLabel accent={accent} ds={ds}>{b.title}</SecLabel>
      {base.length === 0 ? <Placeholder icon={Tag} text="Click to add line items" /> : (
        <div className="space-y-1.5">
          {itemized && base.map(li => (<div key={li.id} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate" style={{ color: "#111827" }}>{li.name ?? li.description} <span style={{ color: "#9ca3af" }}>×{li.quantity}</span></span><span className="shrink-0 font-medium tabular-nums" style={{ color: "#111827" }}>{fmt(li.total)}</span></div>))}
          <div className="pt-2 mt-1"><CanvasTotals totals={totals} taxRate={taxRate} accent={accent} ds={ds} /></div>
          {b.type === "price_summary" && b.settings?.showMonthly && monthly ? <p className="text-[11px] text-right tabular-nums mt-1" style={{ color: accent }}>≈ {fmt(monthly)}/mo financed</p> : null}
        </div>)}</>);
  }

  if (b.type === "approval_signature") {
    return (<><SecLabel accent={accent} ds={ds}>{b.title}</SecLabel>{b.content && <p className="text-sm mb-3" style={{ color: "#374151" }}>{b.content}</p>}
      <div className="grid grid-cols-2 gap-6">{["Customer Signature", "Date"].map(l => (<div key={l}><div className="h-9 rounded-lg" style={{ border: "1px dashed #d1d5db", backgroundColor: "#f9fafb" }} /><p className="text-[10px] mt-1" style={{ color: "#6b7280" }}>{l}</p></div>))}</div></>);
  }
  return null;
}

// ─── Block settings (type-specific fields, in the editor's left pane) ──
function BlockSettings({ sel, ctx }: { sel: QuoteBlock; ctx: SettingsCtx }) {
  const { accent } = ctx; const s = sel.settings ?? {};
  const setImages = (imgs: BlockImage[]) => ctx.patchBlock(sel.id, { images: imgs });

  if (sel.type === "divider") return <ReadOnlyNote>A thin horizontal line that separates sections. No settings — drag it to reposition, or delete it from the header above.</ReadOnlyNote>;
  if (sel.type === "page_break") return <ReadOnlyNote>Forces a new page when the proposal is printed or exported to PDF. No settings.</ReadOnlyNote>;

  if (sel.type === "heading") return (<>
    <Field label="Size"><UiSelect value={String(s.level ?? 2)} onChange={v => ctx.setBlockSettings(sel.id, { level: Number(v) })} options={[{ value: "1", label: "Large (H1)" }, { value: "2", label: "Medium (H2)" }, { value: "3", label: "Small (H3)" }]} /></Field>
    <Field label="Alignment"><AlignPicker value={s.align ?? "left"} onChange={a => ctx.setBlockSettings(sel.id, { align: a })} accent={accent} /></Field>
  </>);

  if (RICH_BLOCK_TYPES.includes(sel.type) && sel.type !== "terms") return null;

  if (sel.type === "terms") return (<>
    {ctx.savedTerms.length > 0 && (
      <Field label="Insert a saved terms block"><UiSelect value="" placeholder="Choose saved terms…" onChange={v => { const t = ctx.savedTerms.find(x => x.id === v); if (t) ctx.patchBlock(sel.id, { content: `<p>${t.body.replace(/\n/g, "</p><p>")}</p>` }); }} options={ctx.savedTerms.map(t => ({ value: t.id, label: t.title }))} /></Field>
    )}
    <ReadOnlyNote>Pick a saved terms block to drop it in, then fine-tune the wording in the content editor above.</ReadOnlyNote>
  </>);

  if (sel.type === "image") return (<>
    <Field label="Image"><OptionImageInput value={sel.images?.[0]?.src} onChange={src => setImages(src ? [{ id: sel.images?.[0]?.id ?? imageId(), src, caption: sel.images?.[0]?.caption, alt: sel.images?.[0]?.alt }] : [])} accent={accent} /></Field>
    <Field label="Caption"><input value={sel.images?.[0]?.caption ?? ""} onChange={e => setImages([{ id: sel.images?.[0]?.id ?? imageId(), src: sel.images?.[0]?.src ?? "", caption: e.target.value, alt: sel.images?.[0]?.alt }])} placeholder="Optional caption" className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2" style={inputStyle} /></Field>
    <Field label="Alt text" hint="accessibility"><input value={sel.images?.[0]?.alt ?? ""} onChange={e => setImages([{ id: sel.images?.[0]?.id ?? imageId(), src: sel.images?.[0]?.src ?? "", caption: sel.images?.[0]?.caption, alt: e.target.value }])} className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2" style={inputStyle} /></Field>
    <Field label={`Width (${s.width ?? 100}%)`}><input type="range" min={25} max={100} step={5} value={s.width ?? 100} onChange={e => ctx.setBlockSettings(sel.id, { width: Number(e.target.value) })} className="w-full accent-[#0f8578]" /></Field>
    <Field label="Alignment"><AlignPicker value={s.align ?? "center"} onChange={a => ctx.setBlockSettings(sel.id, { align: a })} accent={accent} /></Field>
  </>);

  if (sel.type === "image_gallery") {
    const imgs = sel.images ?? [];
    return (<div className="space-y-3">
      <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Photos</p>
      {imgs.map((im, i) => (
        <div key={im.id} className="rounded-lg p-2.5 space-y-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between"><span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Photo {i + 1}</span><button onClick={() => setImages(imgs.filter(x => x.id !== im.id))} className="p-1 rounded" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button></div>
          <OptionImageInput value={im.src} onChange={src => setImages(imgs.map(x => x.id === im.id ? { ...x, src: src ?? "" } : x))} accent={accent} />
          <input value={im.caption ?? ""} onChange={e => setImages(imgs.map(x => x.id === im.id ? { ...x, caption: e.target.value } : x))} placeholder="Caption" className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2" style={inputStyle} />
        </div>
      ))}
      <button onClick={() => setImages([...imgs, { id: imageId(), src: "" }])} className="w-full flex items-center justify-center gap-1 text-xs font-medium py-2 rounded-lg" style={{ border: "1px dashed var(--border)", color: accent }}><Plus className="w-3.5 h-3.5" /> Add photo</button>
    </div>);
  }

  if (sel.type === "equipment_card") return (<>
    <Field label="Image"><OptionImageInput value={sel.images?.[0]?.src} onChange={src => setImages(src ? [{ id: imageId(), src }] : [])} accent={accent} /></Field>
    <div className="flex gap-2"><Field label="Brand"><input value={s.brand ?? ""} onChange={e => ctx.setBlockSettings(sel.id, { brand: e.target.value })} className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2" style={inputStyle} /></Field>
      <Field label="Model"><input value={s.model ?? ""} onChange={e => ctx.setBlockSettings(sel.id, { model: e.target.value })} className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2" style={inputStyle} /></Field></div>
    <Field label="Specs"><textarea value={s.specs ?? ""} onChange={e => ctx.setBlockSettings(sel.id, { specs: e.target.value })} rows={3} placeholder="Key specs / features" className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-2" style={inputStyle} /></Field>
    <Field label="Price" hint="customer-facing"><NumberStepper min={0} prefix="$" className="w-36" value={s.price != null ? String(s.price) : ""} onChange={v => ctx.setBlockSettings(sel.id, { price: v === "" ? undefined : parseFloat(v) || 0 })} /></Field>
  </>);

  if (sel.type === "line_items") return <LineItemsEditor ctx={ctx} />;

  if (sel.type === "price_summary") return (<>
    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={s.itemized ?? true} onChange={e => ctx.setBlockSettings(sel.id, { itemized: e.target.checked })} className="accent-[#0f8578]" /> Itemized (list each line)</label>
    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={s.showMonthly ?? false} onChange={e => ctx.setBlockSettings(sel.id, { showMonthly: e.target.checked })} className="accent-[#0f8578]" /> Show monthly financing estimate</label>
    <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}><div className="flex items-center justify-between"><span className="text-xs" style={{ color: "var(--text-muted)" }}>Customer total</span><span className="text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(ctx.totals.total)}</span></div></div>
    <ReadOnlyNote>The total comes from the Line Items section. Edit a Line Items section to change it.</ReadOnlyNote>
  </>);

  if (sel.type === "option_cards") return (<div className="space-y-3">
    <div className="flex items-center justify-between"><p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{ctx.options.length} option{ctx.options.length === 1 ? "" : "s"}</p><button onClick={ctx.addOption} className="flex items-center gap-1 text-xs font-medium" style={{ color: accent }}><Plus className="w-3.5 h-3.5" /> Add option</button></div>
    {ctx.options.length === 0 && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No option cards yet. Add Good / Better / Best tiers.</p>}
    {ctx.options.map(o => <OptionEditor key={o.id} o={o} accent={accent} onChange={p => ctx.setOption(o.id, p)} onRemove={() => ctx.removeOption(o.id)} onToggleSelected={() => ctx.selectTier(o.id)} />)}
  </div>);

  if (sel.type === "approval_signature") return (<><Field label="Approval wording"><textarea value={sel.content} onChange={e => ctx.patchBlock(sel.id, { content: e.target.value })} rows={3} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-2" style={inputStyle} /></Field><ReadOnlyNote>E-signature isn&apos;t enabled yet — the proposal shows a signature line placeholder.</ReadOnlyNote></>);

  return <ReadOnlyNote>No extra settings for this section.</ReadOnlyNote>;
}

function LineItemsEditor({ ctx }: { ctx: SettingsCtx }) {
  const { accent } = ctx;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3"><button onClick={ctx.showCatalog} className="flex items-center gap-1 text-xs font-medium" style={{ color: accent }}><Package className="w-3.5 h-3.5" /> Catalog</button><button onClick={ctx.addItem} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--text-secondary)" }}><Plus className="w-3.5 h-3.5" /> Custom line</button></div>
      {ctx.items.map(it => (
        <div key={it.id} className="rounded-lg p-2.5 space-y-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
          {it.itemId && <div className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: "var(--accent-text)" }}><Tag className="w-2.5 h-2.5" /> From catalog</div>}
          <input value={it.name} onChange={e => ctx.setItem(it.id, { name: e.target.value })} placeholder="Item name" className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2" style={inputStyle} />
          <input value={it.description} onChange={e => ctx.setItem(it.id, { description: e.target.value })} placeholder="Description" className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2" style={inputStyle} />
          <UiSelect size="sm" value={it.category} onChange={v => ctx.setItem(it.id, { category: v as LineItemCategory })} options={LINE_ITEM_CATEGORIES.map(c => ({ value: c, label: c }))} />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Qty</span><NumberStepper size="sm" min={0} className="w-20" value={it.quantity} onChange={v => ctx.setItem(it.id, { quantity: v })} /></div>
            <NumberStepper size="sm" min={0} step={0.01} prefix="$" className="w-28" value={it.unitPrice} onChange={v => ctx.setItem(it.id, { unitPrice: v })} />
            <button onClick={() => ctx.removeItem(it.id)} className="ml-auto p-1 rounded-lg" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-[11px] cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={it.taxable} onChange={e => ctx.setItem(it.id, { taxable: e.target.checked })} className="accent-[#0f8578]" /> Taxable</label>
            <label className="flex items-center gap-1 text-[11px] cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={it.optional} onChange={e => ctx.setItem(it.id, { optional: e.target.checked })} className="accent-[#0f8578]" /> Optional</label>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Tax %</span><NumberStepper size="sm" min={0} step={0.1} suffix="%" className="w-24" value={ctx.taxRate} onChange={ctx.setTaxRate} /><span className="ml-auto text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(ctx.totals.total)}</span></div>
      <Field label="Customer notes" hint="on the quote"><textarea value={ctx.customerNotes} onChange={e => ctx.setCustomerNotes(e.target.value)} rows={3} className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none focus:ring-2" style={inputStyle} /></Field>
    </div>
  );
}

function OptionEditor({ o, accent, onChange, onRemove, onToggleSelected }: { o: QuoteOption; accent: string; onChange: (patch: Partial<QuoteOption>) => void; onRemove: () => void; onToggleSelected: () => void }) {
  const numOr = (str: string) => (str === "" ? 0 : parseFloat(str) || 0);
  return (
    <div className="rounded-lg p-2.5 space-y-2" style={{ backgroundColor: "var(--bg-surface-2)", border: `1px solid ${o.selected ? accent : "var(--border-subtle)"}` }}>
      <div className="flex items-center gap-2">
        <UiSelect size="sm" value={o.tier ?? ""} onChange={v => onChange({ tier: (v || undefined) as QuoteOption["tier"] })} className="w-28" options={[{ value: "", label: "No tier" }, { value: "good", label: "Good" }, { value: "better", label: "Better" }, { value: "best", label: "Best" }]} />
        <button onClick={onToggleSelected} className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-1 rounded" style={{ backgroundColor: o.selected ? accent + "1a" : "var(--bg-input)", color: o.selected ? accent : "var(--text-muted)" }}><Check className="w-3 h-3" /> {o.selected ? "Selected" : "Select"}</button>
        <button onClick={onRemove} className="ml-auto p-1 rounded" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      <OptionImageInput value={o.image} onChange={v => onChange({ image: v })} accent={accent} />
      <input value={o.name} onChange={e => onChange({ name: e.target.value })} placeholder="Option name" className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2" style={inputStyle} />
      <div className="flex gap-2"><input value={o.brand ?? ""} onChange={e => onChange({ brand: e.target.value || undefined })} placeholder="Brand" className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2" style={inputStyle} /><input value={o.model ?? ""} onChange={e => onChange({ model: e.target.value || undefined })} placeholder="Model" className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2" style={inputStyle} /></div>
      <div className="flex items-center gap-3 flex-wrap">
        <NumberStepper size="sm" min={0} prefix="$" className="w-28" value={String(o.price)} onChange={v => onChange({ price: numOr(v) })} />
        <NumberStepper size="sm" min={0} prefix="$" suffix="/mo" className="w-32" value={o.monthlyPrice != null ? String(o.monthlyPrice) : ""} onChange={v => onChange({ monthlyPrice: v === "" ? undefined : numOr(v) })} />
      </div>
      <textarea value={(o.includes ?? []).join("\n")} onChange={e => onChange({ includes: e.target.value.split("\n").map(str => str.trim()).filter(Boolean) })} rows={2} placeholder="Included items (one per line)" className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none resize-none focus:ring-2" style={inputStyle} />
    </div>
  );
}

// ─── Small UI helpers ─────────────────────────────────────
function useCloseOnOutside(ref: React.RefObject<HTMLDivElement | null>, open: boolean, close: () => void) {
  useEffect(() => { if (!open) return; const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); }; document.addEventListener("mousedown", onDown); return () => document.removeEventListener("mousedown", onDown); }, [open, ref, close]);
}
function AlignPicker({ value, onChange, accent }: { value: "left" | "center" | "right"; onChange: (a: "left" | "center" | "right") => void; accent: string }) {
  return (
    <div className="flex items-center rounded-lg overflow-hidden w-fit" style={{ border: "1px solid var(--border)" }}>
      {(["left", "center", "right"] as const).map(a => (
        <button key={a} onClick={() => onChange(a)} className="px-3 py-1.5 text-xs font-medium capitalize transition-colors" style={{ backgroundColor: value === a ? accent : "var(--bg-surface)", color: value === a ? "#fff" : "var(--text-secondary)" }}>{a}</button>
      ))}
    </div>
  );
}
function Placeholder({ icon: Icon, text }: { icon: typeof Package; text: string }) {
  return (<div className="rounded-lg px-3 py-5 text-center" style={{ border: "1px dashed #d1d5db" }}><Icon className="w-4 h-4 mx-auto mb-1" style={{ color: "#9ca3af" }} /><p className="text-[11px]" style={{ color: "#9ca3af" }}>{text}</p></div>);
}
function hasHtml(html: string): boolean { return !!html && html.replace(/<[^>]*>/g, "").trim().length > 0; }
const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };
function SecLabel({ children, accent, ds }: { children: React.ReactNode; accent: string; ds: ProposalDesignStyle }) {
  if (ds.label === "bar") return <div className="flex items-center gap-2 mb-2"><span style={{ width: "3px", height: "15px", backgroundColor: accent, borderRadius: "2px" }} /><span className="text-[12.5px] font-bold" style={{ color: "#111827", fontFamily: ds.headingFamily }}>{children}</span></div>;
  if (ds.label === "rule") return <p className="inline-block text-[12.5px] font-bold mb-2" style={{ color: "#111827", borderBottom: `2px solid ${accent}`, paddingBottom: "2px", fontFamily: ds.headingFamily }}>{children}</p>;
  return <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: accent }}>{children}</p>;
}
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between"><span className="text-xs" style={{ color: "#6b7280" }}>{label}</span><span className="text-sm tabular-nums" style={{ color: "#374151" }}>{value}</span></div>; }

// Totals on the canvas sheet — mirrors the active design's totals treatment.
function CanvasTotals({ totals, taxRate, accent, ds }: { totals: { subtotal: number; tax: number; total: number }; taxRate: string; accent: string; ds: ProposalDesignStyle }) {
  const rows = <><Row label="Subtotal" value={fmt(totals.subtotal)} /><Row label={`Tax (${taxRate}%)`} value={fmt(totals.tax)} /></>;
  if (ds.totals === "accentbar") return (
    <div className="space-y-1">{rows}
      <div className="flex items-center justify-between mt-1.5 px-3 py-2 rounded-lg" style={{ backgroundColor: accent }}>
        <span className="text-sm font-semibold text-white">Total</span><span className="text-lg font-bold tabular-nums text-white">{fmt(totals.total)}</span>
      </div>
    </div>
  );
  if (ds.totals === "box") return (
    <div className="rounded-lg px-3 py-2.5 space-y-1" style={{ border: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }}>{rows}
      <div className="flex items-center justify-between pt-1.5 mt-0.5" style={{ borderTop: `2px solid ${accent}` }}><span className="text-sm font-semibold" style={{ color: "#111827" }}>Total</span><span className="text-lg font-bold tabular-nums" style={{ color: accent }}>{fmt(totals.total)}</span></div>
    </div>
  );
  return (
    <div className="space-y-1">{rows}
      <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid #e5e7eb" }}><span className="text-sm font-semibold" style={{ color: "#111827" }}>Total</span><span className="text-lg font-bold tabular-nums" style={{ color: accent }}>{fmt(totals.total)}</span></div>
    </div>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}{hint && <span style={{ color: "var(--text-muted)" }}> ({hint})</span>}</label>{children}</div>; }
function ReadOnlyNote({ children }: { children: React.ReactNode }) { return <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{children}</p>; }
