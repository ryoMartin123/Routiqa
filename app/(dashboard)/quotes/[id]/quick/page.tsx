"use client";

// Quick Quote editor — the simplest of the three quote paths. A focused,
// single-column workspace: pick catalog items (or add custom lines), set notes,
// preview the branded quote, and save/send. No section nav, no proposal layout
// editing — that's what the Custom/Template paths and the full builder are for.

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Send, FileText, Cloud, CloudOff, Plus, Trash2, Package, Tag,
  Monitor, Pencil, Download, Printer, MoreHorizontal, MapPin, User, Zap, Palette,
} from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import UiSelect from "@/components/ui/Select";
import CatalogPicker from "@/components/quotes/CatalogPicker";
import ProposalFamilyDocument from "@/components/quotes/family/ProposalFamilyDocument";
import { QuoteDesignPicker } from "@/components/settings/QuoteDesignsManager";
import { buildProposalDoc } from "@/lib/quotes/proposalDoc";
import { downloadProposalPdf } from "@/lib/quotes/proposalPdf";
import { resolveQuoteDesign, getQuoteDesign, legacyDesignForQuoteDesign } from "@/lib/quotes/quoteDesigns";
import {
  getQuote, autosaveQuote, updateQuote, updateQuoteStatus, computeTotals, fmt,
  type QuoteRecord, type QuoteSection, type LineItem,
} from "@/lib/quotes/data";
import { getAllItems, itemToQuoteLine, getItemDefaults, type Item } from "@/lib/items/data";
import { LINE_ITEM_CATEGORIES, QUOTE_STATUS_STYLE, type LineItemCategory, type QuoteStatus } from "@/lib/quotes/types";
import { getProposalBranding, buildSectionsFromKeys } from "@/lib/proposals/data";

// Quick quotes always carry this section set for the branded preview.
const QUICK_SECTIONS = ["cover_header", "customer_info", "property_info", "line_items", "approval"] as const;

interface DraftItem {
  id: string; name: string; description: string; quantity: string; unitPrice: string;
  category: LineItemCategory; taxable: boolean; optional: boolean; itemId?: string; unitCost?: number;
}
let _seq = 0;
const uid = () => `li-${Date.now()}-${_seq++}`;
function blankItem(): DraftItem {
  return { id: uid(), name: "", description: "", quantity: "1", unitPrice: "0", category: "Other", taxable: true, optional: false };
}
function lineToDraft(li: LineItem): DraftItem {
  return {
    id: li.id, itemId: li.itemId, name: li.name ?? "", description: li.description ?? "",
    quantity: String(li.quantity), unitPrice: String(li.unitPrice), unitCost: li.unitCost,
    category: (li.category ?? "Other") as LineItemCategory, taxable: li.taxable ?? true, optional: li.optional ?? false,
  };
}
function draftsToLines(items: DraftItem[]): LineItem[] {
  return items.filter(it => it.name.trim() || it.description.trim()).map(it => {
    const qty = parseFloat(it.quantity) || 0; const price = parseFloat(it.unitPrice) || 0;
    return {
      id: it.id, name: it.name.trim() || undefined, description: it.description.trim() || it.name.trim(),
      quantity: qty, unitPrice: price, total: Math.round(qty * price * 100) / 100,
      category: it.category, taxable: it.taxable, optional: it.optional, itemId: it.itemId, unitCost: it.unitCost,
    };
  });
}

type SaveState = "idle" | "saving" | "saved";

export default function QuickQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const branding = useMemo(() => getProposalBranding(), []);
  const itemDefaults = useMemo(() => getItemDefaults(), []);

  // Customer-facing Quote Design — resolved from the quote (set on creation from the
  // default Quick Quote design; the rep can change it here).
  const [designId, setDesignId] = useState<string | undefined>(undefined);
  const [designPickerOpen, setDesignPickerOpen] = useState(false);
  const resolvedDesign = useMemo(() => resolveQuoteDesign(designId), [designId]);

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<QuoteRecord | null>(null);

  const [title, setTitle] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [taxRate, setTaxRate] = useState("0");
  const [customerNotes, setCustomerNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [sections, setSections] = useState<QuoteSection[]>([]);
  const [preview, setPreview] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [moreOpen, setMoreOpen] = useState(false);

  const hydratedRef = useRef(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = getQuote(id);
    if (q) {
      setQuote(q);
      setDesignId(getQuoteDesign(q.quoteDesignId).id);
      setTitle(q.title);
      setItems(q.lineItems.length ? q.lineItems.map(lineToDraft) : [blankItem()]);
      setTaxRate(q.subtotal > 0 ? String(Math.round((q.tax / q.subtotal) * 1000) / 10) : "0");
      setCustomerNotes(q.customerNotes ?? "");
      setExpiresAt(q.expiresAt ?? "");
      const secs = (q.sections && q.sections.length)
        ? q.sections
        : buildSectionsFromKeys([...QUICK_SECTIONS]).map(s => ({ key: s.key, label: s.label, body: s.body, visible: s.visible }));
      setSections(secs);
    }
    setLoading(false);
  }, [id]);

  const lineItems = useMemo(() => draftsToLines(items), [items]);
  const totals = useMemo(() => computeTotals(lineItems, (parseFloat(taxRate) || 0) / 100), [lineItems, taxRate]);
  const catalog = useMemo(() => getAllItems().filter(i => i.active && (!quote || i.companyId === quote.companyId)), [quote]);

  const docData = useMemo(() => {
    if (!quote) return null;
    return buildProposalDoc({
      quoteNumber: quote.quoteNumber, title: title || "Quote",
      customerName: quote.customerName, locationName: quote.locationName, propertyLabel: quote.propertyLabel,
      assignedTo: quote.assignedTo ?? quote.createdBy, createdAt: quote.createdAt,
      expiresAt: expiresAt || undefined,
      sections, lineItems, subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
      taxRatePct: parseFloat(taxRate) || 0, customerNotes: customerNotes || undefined,
    });
  }, [quote, title, sections, lineItems, totals.subtotal, totals.tax, totals.total, taxRate, customerNotes, expiresAt]);

  // Autosave (debounced) — skips the first run after hydration.
  useEffect(() => {
    if (loading || !quote) return;
    if (!hydratedRef.current) { hydratedRef.current = true; return; }
    setSaveState("saving");
    const t = setTimeout(() => {
      autosaveQuote(id, {
        title: title.trim() || "Quick Quote", lineItems,
        subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
        expiresAt: expiresAt || undefined, customerNotes: customerNotes || undefined,
      });
      setSaveState("saved");
    }, 600);
    return () => clearTimeout(t);
  }, [title, lineItems, taxRate, customerNotes, expiresAt, loading, quote, id, totals.subtotal, totals.tax, totals.total]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => { if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  const setItem = (iid: string, patch: Partial<DraftItem>) => setItems(p => p.map(it => it.id === iid ? { ...it, ...patch } : it));
  const addItem = () => setItems(p => [...p, blankItem()]);
  const removeItem = (iid: string) => setItems(p => p.filter(it => it.id !== iid));
  function addCatalogItems(sel: Item[]) {
    setItems(prev => {
      const kept = prev.filter(it => it.name.trim() || it.description.trim() || it.itemId);
      return [...kept, ...sel.map(it => lineToDraft(itemToQuoteLine(it)))];
    });
    setShowCatalog(false);
  }

  function persist() {
    autosaveQuote(id, {
      title: title.trim() || "Quick Quote", lineItems,
      subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
      expiresAt: expiresAt || undefined, customerNotes: customerNotes || undefined,
    });
  }
  function saveDraftAndExit() { persist(); router.push(`/quotes/${id}`); }
  function sendQuote() { persist(); updateQuoteStatus(id, "sent"); router.push(`/quotes/${id}`); }
  function printQuote() {
    setMoreOpen(false);
    const prev = document.title;
    document.title = `${quote?.quoteNumber} — ${quote?.customerName}`;
    const restore = () => { document.title = prev; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
  }
  function downloadPdf() { setMoreOpen(false); if (docData) downloadProposalPdf(docData, legacyDesignForQuoteDesign(designId)); }
  function chooseDesign(nextId: string) { setDesignId(nextId); setDesignPickerOpen(false); updateQuote(id, { quoteDesignId: nextId }); }

  if (loading) return <div className="p-10 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>;
  if (!quote) return (
    <div className="p-10">
      <Link href="/quotes" className="flex items-center gap-1.5 text-sm mb-3" style={{ color: "var(--text-secondary)" }}><ArrowLeft className="w-4 h-4" /> Back to Quotes</Link>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Quote not found.</p>
    </div>
  );

  const statusStyle = QUOTE_STATUS_STYLE[quote.status as QuoteStatus];
  const accent = branding.accentColor || "#0f8578";
  const showCost = itemDefaults.showCostField;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 shrink-0" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <Link href={`/quotes/${id}`} className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Quote
        </Link>
        <div className="w-px h-5" style={{ backgroundColor: "var(--border)" }} />
        <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: accent + "1a", color: accent }}>
          <Zap className="w-3 h-3" /> Quick Quote
        </span>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{quote.quoteNumber}</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>{statusStyle.label}</span>
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
          {saveState === "saving" ? <><CloudOff className="w-3.5 h-3.5" /> Saving…</> : saveState === "saved" ? <><Cloud className="w-3.5 h-3.5" style={{ color: "#10b981" }} /> All changes saved</> : <><Cloud className="w-3.5 h-3.5" /> Autosave on</>}
        </span>

        <div className="flex-1" />

        <button onClick={() => setDesignPickerOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)" }}
          title="Change the customer-facing quote design">
          <Palette className="w-3.5 h-3.5" /> {resolvedDesign.design.name}
        </button>
        <button onClick={() => setPreview(p => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
          style={{ border: "1px solid var(--border)", backgroundColor: preview ? "var(--accent-soft-bg)" : "var(--bg-surface)", color: preview ? "var(--accent-text)" : "var(--text-secondary)" }}>
          {preview ? <Pencil className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />} {preview ? "Edit" : "Preview"}
        </button>
        <button onClick={saveDraftAndExit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          <FileText className="w-3.5 h-3.5" /> Save Draft
        </button>
        <button onClick={sendQuote} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: accent }}>
          <Send className="w-3.5 h-3.5" /> Send Quote
        </button>
        <div className="relative" ref={moreRef}>
          <button onClick={() => setMoreOpen(o => !o)} className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><MoreHorizontal className="w-4 h-4" /></button>
          {moreOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-xl p-1" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)" }}>
              <MenuItem icon={Printer} label="Print quote" onClick={printQuote} />
              <MenuItem icon={Download} label="Download PDF" onClick={downloadPdf} />
              <div className="my-1 h-px" style={{ backgroundColor: "var(--border-subtle)" }} />
              <MenuItem icon={FileText} label="Open quote detail" onClick={() => { setMoreOpen(false); router.push(`/quotes/${id}`); }} />
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto thin-scroll-y p-6" style={{ backgroundColor: preview ? "#e5e7eb" : undefined }}>
        {preview && docData ? (
          <ProposalFamilyDocument data={docData} family={resolvedDesign.family} variant={resolvedDesign.variant} />
        ) : (
          <div className="mx-auto space-y-4" style={{ maxWidth: "760px" }}>
            {/* Customer / property summary */}
            <div className="rounded-xl p-4 flex flex-wrap items-center gap-x-6 gap-y-2" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                <div>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Customer</p>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{quote.customerName}</p>
                </div>
              </div>
              {quote.propertyLabel && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  <div>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Property</p>
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>{quote.propertyLabel}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Title + expiry */}
            <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Quote Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Capacitor Replacement"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Expires</label>
                  <DatePicker value={expiresAt} onChange={setExpiresAt} placeholder="No expiry" />
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Line Items</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowCatalog(true)} className="flex items-center gap-1 text-xs font-medium" style={{ color: accent }}><Package className="w-3.5 h-3.5" /> Add from Catalog</button>
                  <button onClick={addItem} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--text-secondary)" }}><Plus className="w-3.5 h-3.5" /> Custom line</button>
                </div>
              </div>

              <div className="p-3 space-y-2">
                {items.length === 0 && (
                  <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>No items yet — add from the catalog or a custom line.</p>
                )}
                {items.map(it => (
                  <div key={it.id} className="rounded-lg p-2.5 space-y-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2">
                      {it.itemId && <span className="flex items-center gap-1 text-[10px] font-semibold shrink-0" style={{ color: "var(--accent-text)" }}><Tag className="w-2.5 h-2.5" /> Catalog</span>}
                      <input value={it.name} onChange={e => setItem(it.id, { name: e.target.value })} placeholder="Item name" className="flex-1 rounded-lg px-2.5 py-1.5 text-sm outline-none" style={inputStyle} />
                      <UiSelect size="sm" value={it.category} onChange={v => setItem(it.id, { category: v as LineItemCategory })} className="w-36" options={LINE_ITEM_CATEGORIES.map(c => ({ value: c, label: c }))} />
                      <button onClick={() => removeItem(it.id)} className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    <input value={it.description} onChange={e => setItem(it.id, { description: e.target.value })} placeholder="Description (optional)" className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={inputStyle} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Qty</span>
                        <input type="number" min={0} value={it.quantity} onChange={e => setItem(it.id, { quantity: e.target.value })} className="w-16 rounded-lg px-2 py-1 text-xs outline-none" style={inputStyle} /></div>
                      <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>$ Unit</span>
                        <input type="number" min={0} step="0.01" value={it.unitPrice} onChange={e => setItem(it.id, { unitPrice: e.target.value })} className="w-24 rounded-lg px-2 py-1 text-xs outline-none" style={inputStyle} /></div>
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={it.taxable} onChange={e => setItem(it.id, { taxable: e.target.checked })} className="accent-[#0f8578]" /> Taxable</label>
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={it.optional} onChange={e => setItem(it.id, { optional: e.target.checked })} className="accent-[#0f8578]" /> Optional</label>
                      <span className="ml-auto text-sm font-semibold" style={{ color: it.optional ? "var(--text-muted)" : "var(--text-primary)" }}>{fmt((parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0))}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="px-4 py-3 space-y-1.5" style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Subtotal</span>
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fmt(totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Tax</span>
                    <input type="number" min={0} step="0.1" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="w-14 rounded px-1.5 py-0.5 text-xs outline-none" style={inputStyle} />
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>%</span>
                  </div>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{fmt(totals.tax)}</span>
                </div>
                <div className="flex items-center justify-between pt-1.5" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Total</span>
                  <span className="text-lg font-bold" style={{ color: accent }}>{fmt(totals.total)}</span>
                </div>
              </div>
            </div>

            {/* Customer notes / terms */}
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Notes / Terms <span style={{ color: "var(--text-muted)" }}>(shown on the quote)</span></label>
              <textarea value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} rows={3} placeholder="Scheduling, terms, scope notes…"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={inputStyle} />
            </div>
          </div>
        )}
      </div>

      {showCatalog && <CatalogPicker items={catalog} showCost={showCost} onAdd={addCatalogItems} onClose={() => setShowCatalog(false)} />}

      {designPickerOpen && (
        <QuoteDesignPicker activeId={designId} mode="quick_quote"
          onPick={chooseDesign} onClose={() => setDesignPickerOpen(false)} />
      )}

      {/* Hidden printable document */}
      {docData && <div className="print-doc" aria-hidden><ProposalFamilyDocument data={docData} shadow={false} family={resolvedDesign.family} variant={resolvedDesign.variant} /></div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" };

function MenuItem({ icon: Icon, label, onClick }: { icon: typeof Printer; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>
      <Icon className="w-3.5 h-3.5 shrink-0" /> {label}
    </button>
  );
}
