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

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Eye, EyeOff, Send, Cloud, CloudOff,
  Plus, Trash2, Copy, Link2, RotateCcw, Archive, GripVertical, Monitor, Pencil,
  Printer, Download, Check, SlidersHorizontal, Lock, MoreVertical,
  Package, Tag, ChevronLeft, ChevronRight, Image as ImageIcon, Search, X, Blocks,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import CatalogPicker from "@/components/quotes/CatalogPicker";
import OptionImageInput from "@/components/quotes/OptionImageInput";
import RichTextEditor from "@/components/quotes/custom/RichTextEditor";
import CustomProposalDocument, { type CustomDocData } from "@/components/quotes/custom/CustomProposalDocument";
import { downloadCustomProposalPdf } from "@/lib/quotes/customProposalPdf";
import {
  getContentBlocks, CONTENT_BLOCK_TYPE_LABELS, CONTENT_BLOCK_TYPES,
  type ContentBlock, type ContentBlockType,
} from "@/lib/content-blocks/data";
import {
  getQuote, autosaveQuote, updateQuoteStatus, computeTotals, fmt,
  duplicateQuote, archiveQuote, deleteQuote,
  type QuoteRecord, type QuoteOption, type LineItem,
} from "@/lib/quotes/data";
import {
  BLOCK_LIBRARY, BLOCK_GROUPS, BLOCK_LABELS, RICH_BLOCK_TYPES, defaultBlock,
  starterBlocks, sectionsToBlocks, blockId, imageId,
  type QuoteBlock, type BlockType, type BlockImage,
} from "@/lib/quotes/blocks";
import { getAllItems, itemToQuoteLine, getItemDefaults, type Item } from "@/lib/items/data";
import { LINE_ITEM_CATEGORIES, QUOTE_STATUS_STYLE, type LineItemCategory, type QuoteStatus } from "@/lib/quotes/types";
import { getProposalBranding, getProposalTerms } from "@/lib/proposals/data";
import { getActiveDesign, type ProposalDesignStyle } from "@/lib/proposals/designs";

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
}
let _seq = 0;
const uid = () => `li-${Date.now()}-${_seq++}`;
function blankItem(): DraftItem { return { id: uid(), name: "", description: "", quantity: "1", unitPrice: "0", category: "Labor", taxable: true, optional: false }; }
function lineToDraft(li: LineItem): DraftItem {
  return { id: li.id, itemId: li.itemId, name: li.name ?? "", description: li.description ?? "", quantity: String(li.quantity), unitPrice: String(li.unitPrice), unitCost: li.unitCost, category: (li.category ?? "Other") as LineItemCategory, taxable: li.taxable ?? true, optional: li.optional ?? false };
}
function draftsToLines(items: DraftItem[]): LineItem[] {
  return items.filter(it => it.name.trim() || it.description.trim()).map(it => {
    const qty = parseFloat(it.quantity) || 0; const price = parseFloat(it.unitPrice) || 0;
    return { id: it.id, name: it.name.trim() || undefined, description: it.description.trim() || it.name.trim(), quantity: qty, unitPrice: price, total: Math.round(qty * price * 100) / 100, category: it.category, taxable: it.taxable, optional: it.optional, itemId: it.itemId, unitCost: it.unitCost };
  });
}

type SaveState = "idle" | "saving" | "saved";

export default function CustomProposalBuilder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const branding = useMemo(() => getProposalBranding(), []);
  const design = useMemo(() => getActiveDesign(), []);
  const ds = design.style;
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
  const [preview, setPreview] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [moreOpen, setMoreOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragId, setDragId] = useState("");
  const [cbDrawerOpen, setCbDrawerOpen] = useState(false);   // Content Block library drawer (right slide-in)
  const [cbDrag, setCbDrag] = useState<ContentBlock | null>(null);   // content block being dragged from the drawer
  const [cbDropIndex, setCbDropIndex] = useState<number | null>(null);   // live-preview insert position while dragging

  const hydratedRef = useRef(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = getQuote(id);
    if (q) {
      const blks = (q.blocks && q.blocks.length) ? q.blocks : sectionsToBlocks(q.sections ?? [], q.title);
      setQuote(q); setTitle(q.title); setBlocks(blks);
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
    setSaveState("saving");
    const t = setTimeout(() => {
      autosaveQuote(id, {
        title: title.trim() || "Untitled Proposal", blocks, lineItems, options,
        subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
        expiresAt: expiresAt || undefined, customerNotes: customerNotes || undefined,
      });
      setSaveState("saved");
    }, 600);
    return () => clearTimeout(t);
  }, [title, blocks, lineItems, options, taxRate, customerNotes, expiresAt, loading, quote, id, totals.subtotal, totals.tax, totals.total]);

  useCloseOnOutside(moreRef, moreOpen, () => setMoreOpen(false));

  // ─── Block ops ──────────────────────────────────────────
  const patchBlock = (bid: string, patch: Partial<QuoteBlock>) => setBlocks(p => p.map(b => b.id === bid ? { ...b, ...patch } : b));
  const setBlockSettings = (bid: string, patch: Record<string, unknown>) => setBlocks(p => p.map(b => b.id === bid ? { ...b, settings: { ...b.settings, ...patch } } : b));
  const toggleVisible = (bid: string) => setBlocks(p => p.map(b => b.id === bid ? { ...b, visible: !b.visible } : b));
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
  // Live-drag preview: the ghost block shown in-flow as the rep drags (same content
  // it'll become). Memoized per drag so the previewed + dropped block are identical.
  const previewBlock = useMemo(() => (cbDrag ? contentBlockToBlock(cbDrag) : null), [cbDrag]);
  function commitCbDrop() {
    if (previewBlock && cbDropIndex !== null) {
      const b = previewBlock; const idx = Math.max(0, Math.min(cbDropIndex, blocks.length));
      setBlocks(prev => { const next = [...prev]; next.splice(idx, 0, b); return next; });
    }
    setCbDrag(null); setCbDropIndex(null);
  }
  function endCbDrag() { setCbDrag(null); setCbDropIndex(null); }
  // Live drag-reorder: as the cursor moves over a block, slot the dragged block
  // before/after it so the whole list reflows in real time (the hovered block
  // moves to take the dragged block's old place).
  function liveMove(targetId: string, bottomHalf: boolean) {
    if (!dragId || dragId === targetId) return;
    setBlocks(prev => {
      const from = prev.findIndex(b => b.id === dragId);
      const tIdx = prev.findIndex(b => b.id === targetId);
      if (from < 0 || tIdx < 0) return prev;
      let dest = bottomHalf ? tIdx + 1 : tIdx;
      const arr = [...prev]; const [m] = arr.splice(from, 1);
      if (from < dest) dest -= 1;
      dest = Math.max(0, Math.min(dest, arr.length));
      arr.splice(dest, 0, m);
      if (arr.every((b, i) => b.id === prev[i].id)) return prev; // no change → skip re-render
      return arr;
    });
  }

  // ─── Line item ops ──────────────────────────────────────
  const setItem = (iid: string, patch: Partial<DraftItem>) => setItems(p => p.map(it => it.id === iid ? { ...it, ...patch } : it));
  const addItem = () => setItems(p => [...p, blankItem()]);
  const removeItem = (iid: string) => setItems(p => p.filter(it => it.id !== iid));
  function addCatalogItems(sel: Item[]) { setItems(prev => { const kept = prev.filter(it => it.name.trim() || it.description.trim() || it.itemId); return [...kept, ...sel.map(it => lineToDraft(itemToQuoteLine(it)))]; }); setShowCatalog(false); }
  // ─── Option ops ─────────────────────────────────────────
  const selectTier = (oid: string) => setOptions(p => p.map(o => ({ ...o, selected: o.id === oid ? !o.selected : o.selected })));
  const setOption = (oid: string, patch: Partial<QuoteOption>) => setOptions(p => p.map(o => o.id === oid ? { ...o, ...patch } : o));
  const removeOption = (oid: string) => setOptions(p => p.filter(o => o.id !== oid));
  const addOption = () => setOptions(p => [...p, { id: `qopt-${Date.now()}-${p.length}`, name: "New option", price: 0 }]);

  // ─── Persist + lifecycle ────────────────────────────────
  function persist() {
    autosaveQuote(id, { title: title.trim() || "Untitled Proposal", blocks, lineItems, options, subtotal: totals.subtotal, tax: totals.tax, total: totals.total, expiresAt: expiresAt || undefined, customerNotes: customerNotes || undefined });
  }
  function sendQuote() { persist(); updateQuoteStatus(id, "sent"); router.push(`/quotes/${id}`); }
  function printProposal() {
    setMoreOpen(false);
    const prev = document.title; document.title = `${quote?.quoteNumber} — ${quote?.customerName}`;
    const restore = () => { document.title = prev; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore); window.print();
  }
  // Real PDF download (no print dialog) — block-aware, matches this builder.
  function downloadPdf() { setMoreOpen(false); if (docData) void downloadCustomProposalPdf(docData, design); }
  function handleDuplicate() { setMoreOpen(false); persist(); const c = duplicateQuote(id); if (c) router.push(`/quotes/${c.id}${c.quoteMode === "quick" ? "/quick" : c.quoteMode === "custom" ? "/custom" : ""}`); }
  function copyLink() { setMoreOpen(false); try { navigator.clipboard?.writeText(`${window.location.origin}/quotes/${id}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }
  function resetLayout() { setMoreOpen(false); if (!window.confirm("Reset to the starter proposal structure? This replaces the current sections (line items, options and pricing are kept).")) return; const b = starterBlocks(); setBlocks(b); setEditingId(""); }
  function handleArchive() { setMoreOpen(false); persist(); archiveQuote(id); router.push(`/quotes/${id}`); }
  function handleDelete() { setMoreOpen(false); if (!window.confirm("Delete this quote?")) return; deleteQuote(id); router.push("/quotes"); }

  if (loading) return <div className="p-10 text-sm" style={{ color: "var(--text-muted)" }}>Loading builder…</div>;
  if (!quote) return (
    <div className="p-10">
      <Link href="/quotes" className="flex items-center gap-1.5 text-sm mb-3" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Back to Quotes</Link>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Quote not found.</p>
    </div>
  );

  const statusStyle = QUOTE_STATUS_STYLE[quote.status as QuoteStatus];
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
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-5 py-2.5 shrink-0" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <Link href={`/quotes/${id}`} className="flex items-center gap-1.5 text-sm shrink-0 transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Quotes</Link>
        <div className="w-px h-5" style={{ backgroundColor: "var(--border)" }} />
        <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: accent + "1a", color: accent }}><SlidersHorizontal className="w-3 h-3" /> Custom Proposal</span>
        <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>{quote.quoteNumber}</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>{statusStyle.label}</span>
        <span className="flex items-center gap-1.5 text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>
          {saveState === "saving" ? <><CloudOff className="w-3.5 h-3.5" /> Saving…</> : saveState === "saved" ? <><Cloud className="w-3.5 h-3.5" style={{ color: "#10b981" }} /> Saved</> : <><Cloud className="w-3.5 h-3.5" /> Autosave on</>}
        </span>
        {preview && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text)" }}>
            <Monitor className="w-3 h-3" /> Preview
          </span>
        )}
        <div className="flex-1" />
        <button onClick={sendQuote} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium text-white transition-transform active:scale-[0.98]" style={{ backgroundColor: accent, boxShadow: "0 2px 8px " + accent + "55" }}><Send className="w-3.5 h-3.5" /> Send Quote</button>
        <div className="relative" ref={moreRef}>
          <button onClick={() => setMoreOpen(o => !o)} className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><MoreVertical className="w-4 h-4" /></button>
          {moreOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl p-1" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.28)" }}>
              <MenuItem icon={preview ? Pencil : Monitor} label={preview ? "Back to editing" : "Preview proposal"} onClick={() => { setMoreOpen(false); setPreview(p => !p); }} />
              <div className="my-1 h-px" style={{ backgroundColor: "var(--border-subtle)" }} />
              <MenuItem icon={Copy} label="Duplicate quote" onClick={handleDuplicate} />
              <MenuItem icon={Download} label="Download PDF" onClick={downloadPdf} />
              <MenuItem icon={Printer} label="Print proposal" onClick={printProposal} />
              <MenuItem icon={copied ? Check : Link2} label={copied ? "Link copied" : "Copy link"} onClick={copyLink} />
              <div className="my-1 h-px" style={{ backgroundColor: "var(--border-subtle)" }} />
              <MenuItem icon={RotateCcw} label="Reset to starter" onClick={resetLayout} />
              <MenuItem icon={Archive} label="Archive quote" onClick={handleArchive} />
              <MenuItem icon={Trash2} label="Delete quote" onClick={handleDelete} danger />
            </div>
          )}
        </div>
      </div>

      {/* ── Canvas ── */}
      <div className="flex-1 overflow-y-auto thin-scroll-y" style={{ backgroundColor: preview ? "#e5e7eb" : "var(--bg-canvas, #eef0f4)" }}>
        {preview && docData ? (
          <div className="p-6"><CustomProposalDocument data={docData} design={design} /></div>
        ) : (
          <div className="mx-auto px-4 py-6 flex gap-5 items-start" style={{ maxWidth: quote.pricing ? "1180px" : "880px" }}>
            {/* Internal pricing — rep-only panel to the left of the sheet (never part of the document). */}
            {quote.pricing && <PricingSidebar pricing={quote.pricing} accent={accent} onEdit={() => router.push(`/quotes/${id}/pricing`)} />}

            <div className="flex-1 min-w-0">
              {/* Toolbar above the sheet — the Content Blocks launcher (horizontal,
                  stays put + shows an active state while the drawer is open). */}
              <div className="mx-auto mb-2.5 flex justify-end" style={{ maxWidth: "816px" }}>
                <button onClick={() => setCbDrawerOpen(o => !o)} title="Content Block library"
                  aria-pressed={cbDrawerOpen}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={cbDrawerOpen
                    ? { backgroundColor: accent, color: "#fff", border: `1px solid ${accent}`, boxShadow: "0 2px 8px " + accent + "55" }
                    : { backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  <Blocks className="w-3.5 h-3.5" /> Content Blocks
                </button>
              </div>

              {/* The proposal sheet — click any section to edit it in the focused editor. */}
              <div className="relative mx-auto" style={{ maxWidth: "816px", backgroundColor: "#fff", borderRadius: "10px", boxShadow: "0 10px 40px rgba(0,0,0,0.14)" }}>
                {ds.header === "band" && <div style={{ height: "6px", backgroundColor: accent, borderTopLeftRadius: "10px", borderTopRightRadius: "10px" }} />}
                <div style={{ padding: "40px 56px 56px", fontFamily: ds.fontFamily }}
                  onDragOver={cbDrag ? (e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }) : undefined}
                  onDrop={cbDrag ? (e => { e.preventDefault(); commitCbDrop(); }) : undefined}>
                  <Letterhead branding={branding} quote={quote} title={title} setTitle={setTitle} expiresAt={expiresAt} setExpiresAt={setExpiresAt} accent={accent} ds={ds} />

                  {!cbDrag && <InsertGap index={0} onInsert={insertBlock} accent={accent} />}

                  {blocks.length === 0 && !cbDrag && (
                    <div className="py-10 text-center">
                      <p className="text-sm" style={{ color: "#9ca3af" }}>Empty proposal — use a <span style={{ color: accent, fontWeight: 600 }}>＋</span> above to add a section, or drag in a <span style={{ color: accent, fontWeight: 600 }}>Content Block</span>.</p>
                    </div>
                  )}

                  {blocks.map((b, i) => (
                    <div key={b.id}>
                      {cbDrag && previewBlock && cbDropIndex === i && (
                        <GhostBlock block={previewBlock} accent={accent} ds={ds} lineItems={lineItems} totals={totals} taxRate={taxRate} options={options} monthly={quote.pricing?.monthly} />
                      )}
                      <BlockRow
                        b={b} accent={accent} ds={ds}
                        lineItems={lineItems} totals={totals} taxRate={taxRate} options={options} monthly={quote.pricing?.monthly}
                        dragging={dragId === b.id} dragActive={!!dragId}
                        cbDragActive={!!cbDrag}
                        onEdit={() => setEditingId(b.id)}
                        onDragStart={() => setDragId(b.id)}
                        onDragEnd={() => setDragId("")}
                        onDragOverBlock={bottom => liveMove(b.id, bottom)}
                        onCbDragOver={bottom => setCbDropIndex(bottom ? i + 1 : i)}
                      />
                      {!cbDrag && <InsertGap index={i + 1} onInsert={insertBlock} accent={accent} />}
                    </div>
                  ))}

                  {cbDrag && previewBlock && cbDropIndex !== null && cbDropIndex >= blocks.length && (
                    <GhostBlock block={previewBlock} accent={accent} ds={ds} lineItems={lineItems} totals={totals} taxRate={taxRate} options={options} monthly={quote.pricing?.monthly} />
                  )}
                </div>
              </div>
              <p className="text-center text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>Click any section to edit it · drag the handle to reorder{cbDrag ? " · release to drop the content block" : ""}.</p>
            </div>
          </div>
        )}

        {/* Content Block library — slide-in drawer (mirrors the dashboard Add-Widgets panel; eases in). */}
        {cbDrawerOpen && !preview && (
          <ContentBlockDrawer accent={accent}
            onClose={() => setCbDrawerOpen(false)}
            onDragStart={cb => { setCbDrag(cb); setCbDropIndex(blocks.length); }} onDragEnd={endCbDrag}
            onAppend={cb => insertContentBlock(cb, blocks.length, true)} />
        )}
      </div>

      {showCatalog && <CatalogPicker items={catalog} showCost={showCost} onAdd={addCatalogItems} onClose={() => setShowCatalog(false)} />}
      {editingBlock && docData && (
        <SectionEditorModal
          block={editingBlock} index={editingIdx} count={blocks.length} accent={accent} ctx={settingsCtx} docData={docData} design={design}
          onClose={() => setEditingId("")}
          onPrev={() => goEdit(-1)} onNext={() => goEdit(1)}
          onToggleVisible={() => toggleVisible(editingBlock.id)}
          onDuplicate={() => { duplicateBlock(editingBlock.id); }}
          onRemove={() => removeBlock(editingBlock.id)}
        />
      )}
      {docData && <div className="print-doc" aria-hidden><CustomProposalDocument data={docData} shadow={false} design={design} /></div>}
    </div>
  );
}

// ─── Internal pricing panel (rep-only, left of the sheet) ──
function PricingSidebar({ pricing, accent, onEdit }: { pricing: NonNullable<QuoteRecord["pricing"]>; accent: string; onEdit: () => void }) {
  return (
    <aside className="shrink-0 sticky self-start" style={{ width: "250px", top: "8px" }}>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-2 px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <Lock className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Internal Pricing</span>
          <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>Rep only</span>
        </div>
        <div className="px-3.5 pt-3.5 pb-3">
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Sell price</p>
          <p className="text-2xl font-bold tabular-nums leading-tight" style={{ color: "var(--text-primary)" }}>{fmt(pricing.sellPrice)}</p>
          <p className="text-[11px] font-medium tabular-nums mt-0.5" style={{ color: accent }}>{(pricing.grossMargin * 100).toFixed(0)}% gross margin</p>
        </div>
        <div className="px-3.5 pb-3.5 space-y-2">
          <MetricRow label="Total cost" value={fmt(pricing.totalCost)} />
          <MetricRow label="Gross profit" value={fmt(pricing.grossProfit)} sub={`${(pricing.grossMargin * 100).toFixed(1)}%`} />
          <MetricRow label="Net profit" value={fmt(pricing.netProfit)} sub={`${(pricing.netMargin * 100).toFixed(1)}%`} />
          <MetricRow label="Financing" value={`${fmt(pricing.monthly)}/mo`} sub={`${pricing.financeMonths} mo`} />
        </div>
        <div className="px-3.5 pb-3.5">
          <button onClick={onEdit} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Pencil className="w-3.5 h-3.5" /> Edit pricing</button>
        </div>
        <div className="px-3.5 py-2.5" style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
          <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>Never shown to the customer. Add a <span style={{ fontWeight: 600 }}>Price Summary</span> or <span style={{ fontWeight: 600 }}>Line Items</span> section to show a number.</p>
        </div>
      </div>
    </aside>
  );
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
function Letterhead({ branding, quote, title, setTitle, expiresAt, setExpiresAt, accent, ds }: {
  branding: ReturnType<typeof getProposalBranding>; quote: QuoteRecord;
  title: string; setTitle: (v: string) => void; expiresAt: string; setExpiresAt: (v: string) => void; accent: string; ds: ProposalDesignStyle;
}) {
  const hf = ds.headingFamily;
  const logo = branding.logoUrl, company = branding.companyName;
  // Editable "valid until" chip, themed light/dark for the header background.
  const validUntil = (dim: string, align: "left" | "right" = "right") => (
    <span className="inline-flex items-center gap-1.5" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
      <span style={{ fontSize: "11px", color: dim }}>Valid until</span>
      <input value={expiresAt} onChange={e => setExpiresAt(e.target.value)} placeholder="e.g. Jul 15, 2026"
        className="bg-transparent outline-none rounded px-1 focus:bg-black/5"
        style={{ fontSize: "11px", color: dim, width: "104px", textAlign: align }} />
    </span>
  );
  const titleInput = (align: "left" | "center" = "left", color = "#111827") => (
    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Untitled Proposal"
      className="w-full bg-transparent outline-none"
      style={{ fontSize: "27px", fontWeight: 800, color, lineHeight: 1.15, fontFamily: hf, textAlign: align, marginTop: "16px" }} />
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
        {titleInput("left")}
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
        {titleInput("center")}
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
        {titleInput("left")}
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
        {titleInput("left")}
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
      {titleInput("left")}
    </div>
  );
}

// ─── Inline insert affordance (between blocks) ──
function InsertGap({ index, onInsert, accent }: {
  index: number; onInsert: (type: BlockType, index: number) => void; accent: string;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useCloseOnOutside(ref, open, () => setOpen(false));
  const lit = open || hover;

  return (
    <div ref={ref} className="relative" style={{ height: "16px" }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button onClick={() => setOpen(o => !o)} title="Add a section here"
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center gap-2 w-full">
        <span className="flex-1 h-px transition-colors" style={{ backgroundColor: lit ? accent : "transparent" }} />
        <span className="flex items-center justify-center rounded-full transition-opacity"
          style={{ width: "20px", height: "20px", backgroundColor: open ? accent : "#fff", color: open ? "#fff" : accent, border: `1px solid ${accent}`, opacity: lit ? 1 : 0 }}>
          <Plus className="w-3 h-3" />
        </span>
        <span className="flex-1 h-px transition-colors" style={{ backgroundColor: lit ? accent : "transparent" }} />
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full z-40 mt-1 rounded-xl p-1.5 w-64 max-h-80 overflow-y-auto thin-scroll-y"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.26)" }}>
          {BLOCK_GROUPS.map(group => (
            <div key={group} className="mb-1">
              <p className="text-[9px] font-semibold uppercase tracking-widest px-2 py-1" style={{ color: "var(--text-muted)" }}>{group}</p>
              {BLOCK_LIBRARY.filter(d => d.group === group).map(d => (
                <button key={d.type} onClick={() => { onInsert(d.type, index); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>
                  <Plus className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} /><span className="truncate">{d.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Content Block library drawer (right slide-in) ──
// Mirrors the dashboard Add-Widgets drawer: fixed panel from the right, no dimming
// backdrop so the rep can drag cards straight onto the sheet (drops land in any
// insert gap) or click to append. The copy is independent — the master is untouched.
function ContentBlockDrawer({ accent, onClose, onDragStart, onDragEnd, onAppend }: {
  accent: string; onClose: () => void;
  onDragStart: (cb: ContentBlock) => void; onDragEnd: () => void; onAppend: (cb: ContentBlock) => void;
}) {
  const all = useMemo(() => getContentBlocks(), []);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("");

  const filtered = all.filter(b => {
    if (type && b.type !== type) return false;
    if (q) { const hay = `${b.name} ${b.text} ${b.tags.join(" ")} ${CONTENT_BLOCK_TYPE_LABELS[b.type]}`.toLowerCase(); if (!hay.includes(q.toLowerCase())) return false; }
    return true;
  });

  return (
    <div className="dashboard-edit-drawer fixed top-0 right-0 bottom-0 z-50 w-full max-w-md flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", borderLeft: "1px solid var(--border)", boxShadow: "-16px 0 48px -12px rgba(0,0,0,0.22)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "1a" }}>
          <Blocks className="w-4 h-4" style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Content Blocks</p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Drag onto the proposal, or click to add</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }} aria-label="Close"><X className="w-4 h-4" /></button>
      </div>

      {/* Search + filter */}
      <div className="px-4 py-3 space-y-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search blocks…"
            className="w-full rounded-lg pl-8 pr-2.5 py-1.5 text-sm outline-none" style={inputStyle} />
        </div>
        <UiSelect size="sm" value={type} onChange={setType} placeholder="All types"
          options={[{ value: "", label: "All types" }, ...CONTENT_BLOCK_TYPES.map(t => ({ value: t, label: CONTENT_BLOCK_TYPE_LABELS[t] }))]} />
      </div>

      {/* Cards */}
      <div className="flex-1 min-h-0 overflow-y-auto thin-scroll-y p-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>No content blocks match.</p>
          ) : filtered.map(b => (
            <div key={b.id}
              draggable
              onDragStart={e => { e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", b.id); onDragStart(b); }}
              onDragEnd={onDragEnd}
              onClick={() => onAppend(b)}
              title="Drag onto the proposal, or click to append"
              className="group rounded-lg p-2.5 cursor-grab active:cursor-grabbing transition-all hover:shadow-md"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-start gap-2">
                <GripVertical className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug truncate" style={{ color: "var(--text-primary)" }}>{b.name}</p>
                  <span className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded mt-1" style={{ backgroundColor: accent + "1a", color: accent }}>{CONTENT_BLOCK_TYPE_LABELS[b.type]}</span>
                  <p className="text-[11px] mt-1 leading-snug" style={{ color: "var(--text-muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{b.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

      {/* Footer hint */}
      <div className="px-4 py-2.5 shrink-0" style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
        <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>Drag a block into any gap on the proposal, or click to append. Edits here never change the master block.</p>
      </div>
    </div>
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
        onDragStart={e => { e.stopPropagation(); props.onDragStart(); e.dataTransfer.effectAllowed = "move"; }}
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

// ─── Live drag preview — the dragged content block shown in-flow before it's
// dropped (reflows the document as the cursor moves, like the dashboard). ──
function GhostBlock({ block, accent, ds, lineItems, totals, taxRate, options, monthly }: {
  block: QuoteBlock; accent: string; ds: ProposalDesignStyle;
  lineItems: LineItem[]; totals: { subtotal: number; tax: number; total: number }; taxRate: string; options: QuoteOption[]; monthly?: number;
}) {
  return (
    <div className="cb-ghost-block" style={{ margin: "6px -12px", padding: "10px 12px", borderRadius: "8px", outline: `2px dashed ${accent}`, outlineOffset: "-2px", backgroundColor: accent + "0d" }}>
      <p className="text-[9px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: accent }}>New block · drop to place</p>
      <CanvasBlock b={block} accent={accent} ds={ds} lineItems={lineItems} totals={totals} taxRate={taxRate} options={options} monthly={monthly} />
    </div>
  );
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
  onToggleVisible: () => void; onDuplicate: () => void; onRemove: () => void;
}) {
  const { block, accent, ctx, docData } = props;
  const previewRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [editorW, setEditorW] = useState(560);   // left editor pane width (px); user-resizable

  // Keep the section being edited scrolled into view in the live preview.
  useEffect(() => {
    const el = previewRef.current?.querySelector(`[data-blk="${block.id}"]`);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [block.id]);

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3" style={{ backgroundColor: "rgba(15,18,25,0.55)" }} onClick={props.onClose}>
      <div className="flex flex-col rounded-2xl overflow-hidden" style={{ width: "min(1560px, 98vw)", height: "94vh", backgroundColor: "var(--bg-surface)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg shrink-0" style={{ backgroundColor: accent + "1a", color: accent }}>{BLOCK_LABELS[block.type]}</span>
          {showLabelField ? (
            <input value={block.title} onChange={e => ctx.patchBlock(block.id, { title: e.target.value })} placeholder="Section label (shown above the section)"
              className="flex-1 min-w-0 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:ring-2" style={inputStyle} />
          ) : <div className="flex-1" />}
          <div className="flex items-center gap-1 shrink-0">
            <ToolBtn title="Previous section" disabled={props.index === 0} onClick={props.onPrev}><ChevronLeft className="w-4 h-4" /></ToolBtn>
            <span className="text-[11px] tabular-nums px-1" style={{ color: "var(--text-muted)" }}>{props.index + 1}/{props.count}</span>
            <ToolBtn title="Next section" disabled={props.index === props.count - 1} onClick={props.onNext}><ChevronRight className="w-4 h-4" /></ToolBtn>
          </div>
          <div className="w-px h-5" style={{ backgroundColor: "var(--border)" }} />
          <ToolBtn title={block.visible ? "Hide from proposal" : "Show on proposal"} active={!block.visible} onClick={props.onToggleVisible}>{block.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</ToolBtn>
          <ToolBtn title="Duplicate" onClick={props.onDuplicate}><Copy className="w-4 h-4" /></ToolBtn>
          <ToolBtn title="Delete section" danger onClick={props.onRemove}><Trash2 className="w-4 h-4" /></ToolBtn>
          <button onClick={props.onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ml-1" style={{ backgroundColor: accent, color: "#fff" }}><Check className="w-3.5 h-3.5" /> Done</button>
        </div>

        {/* Body: editor | resizer | live preview */}
        <div ref={bodyRef} className="flex-1 flex overflow-hidden">
          <div className="overflow-y-auto thin-scroll-y p-5 space-y-5 shrink-0" style={{ width: `${editorW}px`, minWidth: `${EDITOR_MIN}px` }}>
            <SectionContentEditor block={block} ctx={ctx} />
            <BlockSettings sel={block} ctx={ctx} />
          </div>
          {/* Resizer */}
          <div onPointerDown={startResize} title="Drag to resize" className="shrink-0 flex items-center justify-center cursor-col-resize group/resize" style={{ width: "8px", backgroundColor: "var(--bg-surface-2)", borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
            <span className="rounded-full transition-colors group-hover/resize:bg-[var(--accent-text)]" style={{ width: "3px", height: "36px", backgroundColor: "var(--border)" }} />
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
    return (
      <Field label="Content" hint="format, add images, links">
        <RichTextEditor key={block.id} value={block.content} onChange={html => ctx.patchBlock(block.id, { content: html })} minHeight={280} placeholder="Write or paste text here…" />
      </Field>
    );
  }
  return null;
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
    <Field label="Price" hint="customer-facing"><div className="flex items-center gap-1"><span className="text-sm" style={{ color: "var(--text-muted)" }}>$</span><input type="number" min={0} value={s.price ?? ""} onChange={e => ctx.setBlockSettings(sel.id, { price: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0 })} className="w-32 rounded-lg px-2.5 py-1.5 text-sm outline-none tabular-nums focus:ring-2" style={inputStyle} /></div></Field>
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
            <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Qty</span><input type="number" min={0} value={it.quantity} onChange={e => ctx.setItem(it.id, { quantity: e.target.value })} className="w-14 rounded-lg px-2 py-1 text-xs outline-none tabular-nums focus:ring-2" style={inputStyle} /></div>
            <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>$</span><input type="number" min={0} step="0.01" value={it.unitPrice} onChange={e => ctx.setItem(it.id, { unitPrice: e.target.value })} className="w-20 rounded-lg px-2 py-1 text-xs outline-none tabular-nums focus:ring-2" style={inputStyle} /></div>
            <button onClick={() => ctx.removeItem(it.id)} className="ml-auto p-1 rounded-lg" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-[11px] cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={it.taxable} onChange={e => ctx.setItem(it.id, { taxable: e.target.checked })} className="accent-[#0f8578]" /> Taxable</label>
            <label className="flex items-center gap-1 text-[11px] cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={it.optional} onChange={e => ctx.setItem(it.id, { optional: e.target.checked })} className="accent-[#0f8578]" /> Optional</label>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Tax %</span><input type="number" min={0} step="0.1" value={ctx.taxRate} onChange={e => ctx.setTaxRate(e.target.value)} className="w-16 rounded px-1.5 py-0.5 text-xs outline-none tabular-nums focus:ring-2" style={inputStyle} /><span className="ml-auto text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(ctx.totals.total)}</span></div>
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
        <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>$</span><input type="number" min={0} value={o.price} onChange={e => onChange({ price: numOr(e.target.value) })} className="w-24 rounded-lg px-2 py-1 text-xs outline-none tabular-nums focus:ring-2" style={inputStyle} /></div>
        <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>$/mo</span><input type="number" min={0} value={o.monthlyPrice ?? ""} onChange={e => onChange({ monthlyPrice: e.target.value === "" ? undefined : numOr(e.target.value) })} className="w-20 rounded-lg px-2 py-1 text-xs outline-none tabular-nums focus:ring-2" style={inputStyle} /></div>
      </div>
      <textarea value={(o.includes ?? []).join("\n")} onChange={e => onChange({ includes: e.target.value.split("\n").map(str => str.trim()).filter(Boolean) })} rows={2} placeholder="Included items (one per line)" className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none resize-none focus:ring-2" style={inputStyle} />
    </div>
  );
}

// ─── Small UI helpers ─────────────────────────────────────
function useCloseOnOutside(ref: React.RefObject<HTMLDivElement | null>, open: boolean, close: () => void) {
  useEffect(() => { if (!open) return; const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); }; document.addEventListener("mousedown", onDown); return () => document.removeEventListener("mousedown", onDown); }, [open, ref, close]);
}
function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Printer; label: string; onClick: () => void; danger?: boolean }) {
  return (<button onClick={onClick} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[var(--bg-surface-2)] transition-colors" style={{ color: danger ? "#ef4444" : "var(--text-secondary)" }}><Icon className="w-3.5 h-3.5 shrink-0" /> {label}</button>);
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
