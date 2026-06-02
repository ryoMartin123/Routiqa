"use client";

import { useState, useMemo } from "react";
import { X, Plus, Trash2, Check, ChevronLeft, ChevronRight, FileText, Send, Package, Tag } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import QuotePreview, { type QuotePreviewData } from "@/components/quotes/QuotePreview";
import CatalogPicker from "@/components/quotes/CatalogPicker";
import { getAllCustomers, getProperties, getLeads, getJobs } from "@/lib/customers/data";
import { ALL_PROJECTS } from "@/lib/projects/data";
import {
  createQuote, updateQuote, computeTotals, fmt,
  QUOTE_TEMPLATES, getQuoteTemplate,
  type LineItem, type QuoteRecord,
} from "@/lib/quotes/data";
import { getAllItems, itemToQuoteLine, getItemDefaults, createItem, type Item } from "@/lib/items/data";
import { LINE_ITEM_CATEGORIES, type LineItemCategory } from "@/lib/quotes/types";

type RelatedKind = "none" | "lead" | "job" | "project";

export interface QuoteWizardPreset {
  customerId?: string;
  propertyId?: string;
  leadId?: string;
  jobId?: string;
  projectId?: string;
  lockCustomer?: boolean;   // launched from a customer/lead/job/project page
}

interface DraftItem {
  id: string;
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  category: LineItemCategory;
  taxable: boolean;
  optional: boolean;
  itemId?: string;       // set when added from the catalog (snapshot + back-ref)
  unitCost?: number;     // snapshotted cost for margin display
}

let _seq = 0;
function blankItem(): DraftItem {
  return { id: `li-${Date.now()}-${_seq++}`, name: "", description: "", quantity: "1", unitPrice: "0", category: "Labor", taxable: true, optional: false };
}

const STEPS = ["Context", "Template", "Line Items", "Preview", "Save"];

// "Jun 20, 2026" / "2026-06-20" → "2026-06-20" for a date input.
function toInputDate(s?: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function QuoteWizard({ preset, editQuote, onClose, onCreated }: {
  preset?: QuoteWizardPreset;
  editQuote?: QuoteRecord;   // when set, the wizard edits this quote instead of creating
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const customers = getAllCustomers();
  const e = editQuote;

  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState(e?.customerId ?? preset?.customerId ?? customers[0]?.id ?? "");
  const [propertyId, setPropertyId] = useState(e?.propertyId ?? preset?.propertyId ?? "");
  const [relatedKind, setRelatedKind] = useState<RelatedKind>(
    e ? (e.linkedType === "lead" || e.linkedType === "job" || e.linkedType === "project" ? e.linkedType : "none")
      : preset?.leadId ? "lead" : preset?.jobId ? "job" : preset?.projectId ? "project" : "none",
  );
  const [relatedId, setRelatedId] = useState(e?.linkedId ?? preset?.leadId ?? preset?.jobId ?? preset?.projectId ?? "");
  const [templateKey, setTemplateKey] = useState(e ? (e.templateKey ?? "blank") : "");
  const [title, setTitle] = useState(e?.title ?? "");
  const [taxRate, setTaxRate] = useState(e && e.subtotal > 0 ? String(Math.round((e.tax / e.subtotal) * 1000) / 10) : "0");
  const [expiresAt, setExpiresAt] = useState(toInputDate(e?.expiresAt));
  const [customerNotes, setCustomerNotes] = useState(e?.customerNotes ?? "");
  const [internalNotes, setInternalNotes] = useState(e?.internalNotes ?? "");
  const [items, setItems] = useState<DraftItem[]>(
    e && e.lineItems.length
      ? e.lineItems.map(li => ({
          id: li.id, name: li.name ?? "", description: li.description ?? "",
          quantity: String(li.quantity), unitPrice: String(li.unitPrice),
          category: li.category ?? "Labor", taxable: li.taxable ?? false, optional: li.optional ?? false,
        }))
      : [blankItem()],
  );

  const customer = customers.find(c => c.id === customerId);
  const properties = useMemo(() => (customerId ? getProperties(customerId) : []), [customerId]);
  const leads      = useMemo(() => (customerId ? getLeads(customerId) : []), [customerId]);
  const jobs       = useMemo(() => (customerId ? getJobs(customerId) : []), [customerId]);
  const projects   = useMemo(() => ALL_PROJECTS.filter(p => p.accountId === customerId), [customerId]);

  // Drafts → LineItems for totals + create
  const lineItems: LineItem[] = items
    .filter(it => it.name.trim() || it.description.trim())
    .map(it => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.unitPrice) || 0;
      return {
        id: it.id, name: it.name.trim() || undefined, description: it.description.trim() || it.name.trim(),
        quantity: qty, unitPrice: price, total: Math.round(qty * price * 100) / 100,
        category: it.category, taxable: it.taxable, optional: it.optional,
        itemId: it.itemId, unitCost: it.unitCost,
      };
    });
  const totals = computeTotals(lineItems, (parseFloat(taxRate) || 0) / 100);

  // Catalog linking + rep-only margin
  const itemDefaults = useMemo(() => getItemDefaults(), []);
  const catalog = useMemo(
    () => getAllItems().filter(i => i.active && (!customer || i.companyId === customer.companyId)),
    [customer],
  );
  const showCost = itemDefaults.showCostField;
  const knownCost = items.reduce((s, it) => s + (it.optional ? 0 : (it.unitCost ?? 0) * (parseFloat(it.quantity) || 0)), 0);
  const margin = totals.subtotal - knownCost;
  const marginPct = totals.subtotal > 0 ? Math.round((margin / totals.subtotal) * 100) : 0;
  const [showCatalog, setShowCatalog] = useState(false);

  // Catalog item → editable draft line (snapshot of current item fields).
  function lineToDraft(li: LineItem): DraftItem {
    return {
      id: li.id, itemId: li.itemId, name: li.name ?? "", description: li.description ?? "",
      quantity: String(li.quantity), unitPrice: String(li.unitPrice), unitCost: li.unitCost,
      category: (li.category ?? "Other") as LineItemCategory, taxable: li.taxable ?? true, optional: li.optional ?? false,
    };
  }
  function addCatalogItems(sel: Item[]) {
    setItems(prev => {
      // Drop a lone untouched blank line so the catalog items aren't trailed by it.
      const kept = prev.filter(it => it.name.trim() || it.description.trim() || it.itemId);
      return [...kept, ...sel.map(it => lineToDraft(itemToQuoteLine(it)))];
    });
    setShowCatalog(false);
  }
  // Save a custom (unlinked) line back to the catalog, then link it.
  function saveLineAsItem(it: DraftItem) {
    const created = createItem({
      name: it.name.trim() || "Untitled item", description: it.description.trim() || undefined,
      type: "service", category: it.category,
      unitPrice: parseFloat(it.unitPrice) || 0, taxable: it.taxable,
      defaultQuantity: parseFloat(it.quantity) || 1,
    });
    setItem(it.id, { itemId: created.id });
  }

  const selectedProperty = properties.find(p => p.id === propertyId);
  const propertyLabel = selectedProperty
    ? `${selectedProperty.label ? selectedProperty.label + " — " : ""}${selectedProperty.address}, ${selectedProperty.city}`
    : undefined;

  // ── Item ops ──
  function setItem(id: string, patch: Partial<DraftItem>) { setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it)); }
  function addItem() { setItems(prev => [...prev, blankItem()]); }
  function removeItem(id: string) { setItems(prev => prev.filter(it => it.id !== id)); }

  // ── Template selection seeds items + title ──
  function chooseTemplate(key: string) {
    setTemplateKey(key);
    const tpl = getQuoteTemplate(key);
    if (!tpl) { setItems([blankItem()]); return; }
    setItems(tpl.items.map(s => ({
      id: `li-${Date.now()}-${_seq++}`, name: s.name, description: s.description ?? "",
      quantity: String(s.quantity), unitPrice: String(s.unitPrice), category: s.category,
      taxable: s.taxable ?? false, optional: s.optional ?? false,
    })));
    if (tpl.defaultTaxRate != null) setTaxRate(String(tpl.defaultTaxRate));
    if (!title.trim()) setTitle(tpl.titlePlaceholder);
  }
  function startBlank() {
    setTemplateKey("blank");
    setItems([blankItem()]);
  }

  // ── Related record resolution ──
  function relatedOptions(): { value: string; label: string }[] {
    if (relatedKind === "lead")    return leads.map(l => ({ value: l.id, label: l.title }));
    if (relatedKind === "job")     return jobs.map(j => ({ value: j.id, label: j.title }));
    if (relatedKind === "project") return projects.map(p => ({ value: p.id, label: p.name }));
    return [];
  }
  function linkFields() {
    if (relatedKind === "none" || !relatedId) return {};
    if (relatedKind === "lead") {
      const l = leads.find(x => x.id === relatedId);
      return { leadId: relatedId, linkedType: "lead" as const, linkedId: relatedId, linkedLabel: l ? `Lead: ${l.title}` : "Lead" };
    }
    if (relatedKind === "job") {
      const j = jobs.find(x => x.id === relatedId);
      return { jobId: relatedId, linkedType: "job" as const, linkedId: relatedId, linkedLabel: j ? `Job: ${j.title}` : "Job" };
    }
    const p = projects.find(x => x.id === relatedId);
    return { projectId: relatedId, linkedType: "project" as const, linkedId: relatedId, linkedLabel: p ? `Project: ${p.name}` : "Project" };
  }

  const previewData: QuotePreviewData = {
    title, customerName: customer?.name ?? "—", propertyLabel, locationName: customer?.locationName,
    expiresAt: expiresAt || undefined, assignedTo: "Marcus Reyes", createdAt: undefined,
    lineItems, subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
    customerNotes: customerNotes || undefined,
  };

  // ── Create / Update ──
  function save(markSent: boolean) {
    if (!customer) return;
    const link = linkFields();
    if (editQuote) {
      updateQuote(editQuote.id, {
        title: title.trim() || "Untitled Quote",
        lineItems, subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
        expiresAt: expiresAt || undefined,
        propertyId: propertyId || undefined, propertyLabel,
        customerNotes: customerNotes || undefined, internalNotes: internalNotes || undefined,
        templateKey: templateKey || undefined,
        ...link,
      });
      onCreated(editQuote.id);
      return;
    }
    const q: QuoteRecord = createQuote({
      customerId, customerName: customer.name, customerInitials: customer.initials, locationName: customer.locationName,
      companyId: customer.companyId, locationId: customer.locationId, serviceAreaId: customer.serviceAreaId,
      title: title.trim() || "Untitled Quote",
      lineItems, taxRate: (parseFloat(taxRate) || 0) / 100, expiresAt: expiresAt || undefined,
      propertyId: propertyId || undefined, propertyLabel,
      templateKey: templateKey || undefined, customerNotes: customerNotes || undefined, internalNotes: internalNotes || undefined,
      markSent,
      ...link,
    });
    onCreated(q.id);
  }

  // ── Step gating ──
  const canNext =
    step === 1 ? Boolean(customerId)
    : step === 2 ? Boolean(templateKey)
    : step === 3 ? Boolean(title.trim() && lineItems.length > 0)
    : true;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>

        {/* Header + stepper */}
        <div className="px-6 pt-4 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{editQuote ? "Edit Quote" : "New Quote"}</p>
            <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-1">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < step, current = n === step;
              return (
                <div key={label} className="flex items-center gap-1 flex-1 last:flex-none">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: done || current ? "#4f46e5" : "var(--bg-input)", color: done || current ? "#fff" : "var(--text-muted)" }}>
                      {done ? <Check className="w-3 h-3" /> : n}
                    </span>
                    <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: current ? "var(--text-primary)" : "var(--text-muted)" }}>{label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className="flex-1 h-px mx-1" style={{ backgroundColor: "var(--border-subtle)" }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto thin-scroll-y px-6 py-5">
          {/* ── Step 1: Context ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Customer / Account *</label>
                <UiSelect value={customerId} onChange={v => { setCustomerId(v); setPropertyId(""); setRelatedId(""); }}
                  disabled={Boolean(preset?.lockCustomer) || Boolean(editQuote)} options={customers.map(c => ({ value: c.id, label: c.name }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Property <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
                <UiSelect value={propertyId} onChange={setPropertyId} placeholder="No specific property"
                  options={[{ value: "", label: "No specific property" }, ...properties.map(p => ({ value: p.id, label: `${p.label ? p.label + " — " : ""}${p.address}, ${p.city}` }))]} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Related to <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
                <div className="flex items-center rounded-lg overflow-hidden w-fit mb-2" style={{ border: "1px solid var(--border)" }}>
                  {(["none", "lead", "job", "project"] as RelatedKind[]).map(k => {
                    const active = relatedKind === k;
                    return (
                      <button key={k} onClick={() => { setRelatedKind(k); setRelatedId(""); }}
                        className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
                        style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)" }}>
                        {k === "none" ? "None" : k}
                      </button>
                    );
                  })}
                </div>
                {relatedKind !== "none" && (
                  relatedOptions().length > 0 ? (
                    <UiSelect value={relatedId} onChange={setRelatedId} placeholder={`Select a ${relatedKind}…`}
                      options={relatedOptions()} />
                  ) : (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>No {relatedKind}s for this customer.</p>
                  )
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Template ── */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Pick a starting structure. You can edit everything in the next step.</p>
              <div className="grid grid-cols-2 gap-3">
                {QUOTE_TEMPLATES.map(t => {
                  const active = templateKey === t.key;
                  return (
                    <button key={t.key} onClick={() => chooseTemplate(t.key)}
                      className="text-left rounded-xl p-4 transition-all"
                      style={{ border: `2px solid ${active ? "#4f46e5" : "var(--border)"}`, backgroundColor: active ? "var(--accent-soft-bg)" : "var(--bg-surface-2)" }}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold" style={{ color: active ? "var(--accent-text-strong)" : "var(--text-primary)" }}>{t.name}</p>
                        {t.badge && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{t.badge}</span>}
                      </div>
                      <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{t.description}</p>
                      <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>{t.items.length} starter line items</p>
                    </button>
                  );
                })}
              </div>
              <button onClick={startBlank}
                className="text-xs font-medium" style={{ color: templateKey === "blank" ? "#4f46e5" : "var(--text-muted)" }}>
                or start from a blank quote →
              </button>
            </div>
          )}

          {/* ── Step 3: Line items ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Quote Title *</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. HVAC System Replacement"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Expires</label>
                  <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Line Items</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setShowCatalog(true)} className="flex items-center gap-1 text-xs font-medium" style={{ color: "#4f46e5" }}><Package className="w-3 h-3" /> Add from Catalog</button>
                    {itemDefaults.allowCustomQuoteLines && (
                      <button onClick={addItem} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--text-secondary)" }}><Plus className="w-3 h-3" /> Add custom line</button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {items.map(it => {
                    const lineTotal = (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0);
                    const lineMargin = (((parseFloat(it.unitPrice) || 0) - (it.unitCost ?? 0)) * (parseFloat(it.quantity) || 0));
                    return (
                      <div key={it.id} className="rounded-xl p-3 space-y-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                        {it.itemId && (
                          <div className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: "var(--accent-text)" }}>
                            <Tag className="w-2.5 h-2.5" /> From catalog
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input value={it.name} onChange={e => setItem(it.id, { name: e.target.value })} placeholder="Item name"
                            className="flex-1 rounded-lg px-2.5 py-1.5 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                          <UiSelect value={it.category} onChange={v => setItem(it.id, { category: v as LineItemCategory })} size="sm" className="w-40"
                            options={LINE_ITEM_CATEGORIES.map(c => ({ value: c, label: c }))} />
                          <button onClick={() => removeItem(it.id)} className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <input value={it.description} onChange={e => setItem(it.id, { description: e.target.value })} placeholder="Description (optional)"
                          className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)" }} />
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Qty</span>
                            <input type="number" min={0} value={it.quantity} onChange={e => setItem(it.id, { quantity: e.target.value })}
                              className="w-16 rounded-lg px-2 py-1 text-xs outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                          </div>
                          <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>$ Unit</span>
                            <input type="number" min={0} step="0.01" value={it.unitPrice} onChange={e => setItem(it.id, { unitPrice: e.target.value })}
                              className="w-24 rounded-lg px-2 py-1 text-xs outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                          </div>
                          <label className="flex items-center gap-1 text-[11px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                            <input type="checkbox" checked={it.taxable} onChange={e => setItem(it.id, { taxable: e.target.checked })} className="accent-indigo-600" /> Taxable
                          </label>
                          <label className="flex items-center gap-1 text-[11px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                            <input type="checkbox" checked={it.optional} onChange={e => setItem(it.id, { optional: e.target.checked })} className="accent-indigo-600" /> Optional
                          </label>
                          <div className="ml-auto flex items-center gap-3">
                            {showCost && it.unitCost != null && (
                              <span className="text-[10px]" style={{ color: lineMargin >= 0 ? "#059669" : "#dc2626" }}>{fmt(lineMargin)} margin</span>
                            )}
                            {!it.itemId && itemDefaults.allowSavingCustomLineAsItem && it.name.trim() && (
                              <button onClick={() => saveLineAsItem(it)} className="text-[10px] font-medium" style={{ color: "var(--accent-text)" }}>Save to catalog</button>
                            )}
                            <span className="text-sm font-semibold" style={{ color: it.optional ? "var(--text-muted)" : "var(--text-primary)" }}>{fmt(lineTotal)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes + totals */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Customer notes <span style={{ color: "var(--text-muted)" }}>(on quote)</span></label>
                  <textarea value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} rows={3}
                    className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none thin-scroll-y" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                </div>
                <div className="rounded-xl p-3 space-y-1.5 self-end" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-center justify-between"><span className="text-xs" style={{ color: "var(--text-muted)" }}>Subtotal</span><span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fmt(totals.subtotal)}</span></div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="text-xs" style={{ color: "var(--text-muted)" }}>Tax</span>
                      <input type="number" min={0} step="0.1" value={taxRate} onChange={e => setTaxRate(e.target.value)}
                        className="w-14 rounded px-1.5 py-0.5 text-xs outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>%</span>
                    </div>
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{fmt(totals.tax)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Total</span>
                    <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{fmt(totals.total)}</span>
                  </div>
                  {showCost && (
                    <div className="flex items-center justify-between pt-1.5" style={{ borderTop: "1px dashed var(--border)" }}>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Est. margin · internal</span>
                      <span className="text-xs font-semibold" style={{ color: margin >= 0 ? "#059669" : "#dc2626" }}>{fmt(margin)} · {marginPct}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Preview ── */}
          {step === 4 && <QuotePreview data={previewData} />}

          {/* ── Step 5: Save ── */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Review</p>
                {[
                  ["Customer", customer?.name ?? "—"],
                  ["Property", propertyLabel ?? "—"],
                  ["Related to", linkFields().linkedLabel ?? "—"],
                  ["Template", getQuoteTemplate(templateKey)?.name ?? (templateKey === "blank" ? "Blank" : "—")],
                  ["Title", title || "Untitled Quote"],
                  ["Total", fmt(totals.total)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm"><span style={{ color: "var(--text-muted)" }}>{k}</span><span className="font-medium text-right" style={{ color: "var(--text-primary)" }}>{v}</span></div>
                ))}
              </div>
              {editQuote ? (
                <button onClick={() => save(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white transition-colors"
                  style={{ backgroundColor: "#4f46e5" }}>
                  <Check className="w-4 h-4" /> Save Changes
                </button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => save(false)}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors"
                      style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
                      <FileText className="w-4 h-4" /> Save as Draft
                    </button>
                    <button onClick={() => save(true)}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white transition-colors"
                      style={{ backgroundColor: "#4f46e5" }}>
                      <Send className="w-4 h-4" /> Mark as Sent
                    </button>
                  </div>
                  <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>No emails or texts are sent yet — “Mark as Sent” only sets the status and logs activity.</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={() => (step === 1 ? onClose() : setStep(s => s - 1))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <ChevronLeft className="w-4 h-4" /> {step === 1 ? "Cancel" : "Back"}
          </button>
          {step < 5 && (
            <button onClick={() => canNext && setStep(s => s + 1)} disabled={!canNext}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {showCatalog && (
          <CatalogPicker items={catalog} showCost={showCost} onAdd={addCatalogItems} onClose={() => setShowCatalog(false)} />
        )}
      </div>
    </div>
  );
}
