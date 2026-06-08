"use client";

import { useState, useMemo } from "react";
import { X, Plus, Trash2, Check, ChevronLeft, ChevronRight, FileText, Send, Package, Tag } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import AccountSearchSelect from "@/components/customers/AccountSearchSelect";
import DatePicker from "@/components/ui/DatePicker";
import InvoicePreview, { type InvoicePreviewData } from "@/components/quotes/InvoicePreview";
import CatalogPicker from "@/components/quotes/CatalogPicker";
import { getAllCustomers, getProperties } from "@/lib/customers/data";
import {
  createInvoice, updateInvoice, computeTotals, fmt,
  type LineItem, type InvoiceRecord,
} from "@/lib/quotes/data";
import { getAllItems, itemToQuoteLine, getItemDefaults, createItem, type Item } from "@/lib/items/data";
import { LINE_ITEM_CATEGORIES, type LineItemCategory } from "@/lib/quotes/types";
import { useHierarchy } from "@/components/providers/HierarchyProvider";

export interface InvoiceWizardPreset {
  customerId?: string;
  jobId?: string;
  projectId?: string;
  lockCustomer?: boolean;
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
  itemId?: string;
  unitCost?: number;
}

let _seq = 0;
function blankItem(): DraftItem {
  return { id: `li-${Date.now()}-${_seq++}`, name: "", description: "", quantity: "1", unitPrice: "0", category: "Labor", taxable: true, optional: false };
}

function toInputDate(s?: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function defaultDueDate(): string {
  const d = new Date(); d.setDate(d.getDate() + 30);
  return toInputDate(d.toISOString());
}

const STEPS = ["Details", "Line Items", "Review"];

export default function InvoiceWizard({ preset, editInvoice, onClose, onCreated }: {
  preset?: InvoiceWizardPreset;
  editInvoice?: InvoiceRecord;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();
  const e = editInvoice;

  // Scope the customer picker to the active company/location so a new invoice is
  // created under the context you're viewing. The preset/edited customer is always
  // kept in the list even if it falls outside the current scope.
  const customers = useMemo(() => {
    const all = getAllCustomers();
    const scoped = all.filter(c =>
      (!effectiveCompanyId  || c.companyId  === effectiveCompanyId) &&
      (!effectiveLocationId || c.locationId === effectiveLocationId));
    const forcedId = e?.customerId ?? preset?.customerId;
    if (forcedId && !scoped.some(c => c.id === forcedId)) {
      const forced = all.find(c => c.id === forcedId);
      if (forced) return [forced, ...scoped];
    }
    return scoped;
  }, [effectiveCompanyId, effectiveLocationId, e?.customerId, preset?.customerId]);

  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState(e?.customerId ?? preset?.customerId ?? customers[0]?.id ?? "");
  const [propertyId, setPropertyId] = useState(e?.propertyId ?? "");
  const [title, setTitle] = useState(e?.title ?? "");
  const [dueDate, setDueDate] = useState(e ? toInputDate(e.dueDate) : defaultDueDate());
  const [taxRate, setTaxRate] = useState(e && e.subtotal > 0 ? String(Math.round((e.tax / e.subtotal) * 1000) / 10) : "0");
  const [customerNotes, setCustomerNotes] = useState(e?.customerNotes ?? "");
  const [internalNotes, setInternalNotes] = useState(e?.internalNotes ?? "");
  const [items, setItems] = useState<DraftItem[]>(
    e && e.lineItems.length
      ? e.lineItems.map(li => ({
          id: li.id, itemId: li.itemId, name: li.name ?? "", description: li.description ?? "",
          quantity: String(li.quantity), unitPrice: String(li.unitPrice), unitCost: li.unitCost,
          category: (li.category ?? "Other") as LineItemCategory, taxable: li.taxable ?? true, optional: li.optional ?? false,
        }))
      : [blankItem()],
  );
  const [showCatalog, setShowCatalog] = useState(false);

  const customer = customers.find(c => c.id === customerId);
  const properties = useMemo(() => (customerId ? getProperties(customerId) : []), [customerId]);

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

  const itemDefaults = useMemo(() => getItemDefaults(), []);
  const catalog = useMemo(() => getAllItems().filter(i => i.active && (!customer || i.companyId === customer.companyId)), [customer]);
  const showCost = itemDefaults.showCostField;
  const knownCost = items.reduce((s, it) => s + (it.optional ? 0 : (it.unitCost ?? 0) * (parseFloat(it.quantity) || 0)), 0);
  const margin = totals.subtotal - knownCost;
  const marginPct = totals.subtotal > 0 ? Math.round((margin / totals.subtotal) * 100) : 0;

  const selectedProperty = properties.find(p => p.id === propertyId);
  const propertyLabel = selectedProperty
    ? `${selectedProperty.label ? selectedProperty.label + " — " : ""}${selectedProperty.address}, ${selectedProperty.city}`
    : undefined;

  function setItem(id: string, patch: Partial<DraftItem>) { setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it)); }
  function addItem() { setItems(prev => [...prev, blankItem()]); }
  function removeItem(id: string) { setItems(prev => prev.filter(it => it.id !== id)); }

  function lineToDraft(li: LineItem): DraftItem {
    return {
      id: li.id, itemId: li.itemId, name: li.name ?? "", description: li.description ?? "",
      quantity: String(li.quantity), unitPrice: String(li.unitPrice), unitCost: li.unitCost,
      category: (li.category ?? "Other") as LineItemCategory, taxable: li.taxable ?? true, optional: li.optional ?? false,
    };
  }
  function addCatalogItems(sel: Item[]) {
    setItems(prev => {
      const kept = prev.filter(it => it.name.trim() || it.description.trim() || it.itemId);
      return [...kept, ...sel.map(it => lineToDraft(itemToQuoteLine(it)))];
    });
    setShowCatalog(false);
  }
  function saveLineAsItem(it: DraftItem) {
    const created = createItem({
      name: it.name.trim() || "Untitled item", description: it.description.trim() || undefined,
      type: "service", category: it.category, unitPrice: parseFloat(it.unitPrice) || 0,
      taxable: it.taxable, defaultQuantity: parseFloat(it.quantity) || 1,
    });
    setItem(it.id, { itemId: created.id });
  }

  const previewData: InvoicePreviewData = {
    invoiceNumber: e?.invoiceNumber, title, customerName: customer?.name ?? "—", propertyLabel,
    locationName: customer?.locationName, dueDate: dueDate || undefined, createdAt: e?.createdAt,
    lineItems, subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
    balanceDue: totals.total, customerNotes: customerNotes || undefined,
  };

  function save(markSent: boolean) {
    if (!customer) return;
    if (editInvoice) {
      const paid = Math.max(0, editInvoice.total - editInvoice.balanceDue);
      updateInvoice(editInvoice.id, {
        title: title.trim() || "Invoice",
        lineItems, subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
        balanceDue: Math.max(0, Math.round((totals.total - paid) * 100) / 100),
        dueDate: dueDate || editInvoice.dueDate,
        customerNotes: customerNotes || undefined, internalNotes: internalNotes || undefined,
        propertyId: propertyId || undefined,
      });
      onCreated(editInvoice.id);
      return;
    }
    const inv = createInvoice({
      customerId, customerName: customer.name, customerInitials: customer.initials, locationName: customer.locationName,
      companyId: customer.companyId, locationId: customer.locationId, serviceAreaId: customer.serviceAreaId,
      title: title.trim() || "Invoice", lineItems, taxRate: (parseFloat(taxRate) || 0) / 100,
      dueDate: dueDate || defaultDueDate(),
      propertyId: propertyId || undefined, propertyLabel,
      // Link back to the originating record (e.g. a project) so it appears on that
      // record's Invoices tab and feeds its billing status.
      projectId: preset?.projectId, jobId: preset?.jobId,
      customerNotes: customerNotes || undefined, internalNotes: internalNotes || undefined,
    });
    if (markSent) updateInvoice(inv.id, { status: "sent" });
    onCreated(inv.id);
  }

  const canNext =
    step === 1 ? Boolean(customerId && dueDate)
    : step === 2 ? Boolean(title.trim() && lineItems.length > 0)
    : true;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={ev => ev.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>

        {/* Header + stepper */}
        <div className="px-6 pt-4 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{editInvoice ? "Edit Invoice" : "New Invoice"}</p>
            <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-1">
            {STEPS.map((label, i) => {
              const n = i + 1; const done = n < step, current = n === step;
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
          {/* Step 1: Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Customer / Account *</label>
                  <AccountSearchSelect customers={customers} value={customerId}
                    onChange={v => { setCustomerId(v); setPropertyId(""); }}
                    disabled={Boolean(preset?.lockCustomer) || Boolean(editInvoice)} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Due Date *</label>
                  <DatePicker value={dueDate} onChange={setDueDate} placeholder="Pick a due date" clearable={false} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Property <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
                <UiSelect value={propertyId} onChange={setPropertyId} placeholder="No specific property"
                  options={[{ value: "", label: "No specific property" }, ...properties.map(p => ({ value: p.id, label: `${p.label ? p.label + " — " : ""}${p.address}, ${p.city}` }))]} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Invoice Title *</label>
                <input value={title} onChange={ev => setTitle(ev.target.value)} placeholder="e.g. HVAC System Installation"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
              </div>
            </div>
          )}

          {/* Step 2: Line items */}
          {step === 2 && (
            <div className="space-y-4">
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
                          <input value={it.name} onChange={ev => setItem(it.id, { name: ev.target.value })} placeholder="Item name"
                            className="flex-1 rounded-lg px-2.5 py-1.5 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                          <UiSelect value={it.category} onChange={v => setItem(it.id, { category: v as LineItemCategory })} size="sm" className="w-40"
                            options={LINE_ITEM_CATEGORIES.map(c => ({ value: c, label: c }))} />
                          <button onClick={() => removeItem(it.id)} className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <input value={it.description} onChange={ev => setItem(it.id, { description: ev.target.value })} placeholder="Description (optional)"
                          className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)" }} />
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Qty</span>
                            <input type="number" min={0} value={it.quantity} onChange={ev => setItem(it.id, { quantity: ev.target.value })}
                              className="w-16 rounded-lg px-2 py-1 text-xs outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                          </div>
                          <div className="flex items-center gap-1"><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>$ Unit</span>
                            <input type="number" min={0} step="0.01" value={it.unitPrice} onChange={ev => setItem(it.id, { unitPrice: ev.target.value })}
                              className="w-24 rounded-lg px-2 py-1 text-xs outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                          </div>
                          <label className="flex items-center gap-1 text-[11px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                            <input type="checkbox" checked={it.taxable} onChange={ev => setItem(it.id, { taxable: ev.target.checked })} className="accent-indigo-600" /> Taxable
                          </label>
                          <div className="ml-auto flex items-center gap-3">
                            {showCost && it.unitCost != null && (
                              <span className="text-[10px]" style={{ color: lineMargin >= 0 ? "#059669" : "#dc2626" }}>{fmt(lineMargin)} margin</span>
                            )}
                            {!it.itemId && itemDefaults.allowSavingCustomLineAsItem && it.name.trim() && (
                              <button onClick={() => saveLineAsItem(it)} className="text-[10px] font-medium" style={{ color: "var(--accent-text)" }}>Save to catalog</button>
                            )}
                            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(lineTotal)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Notes <span style={{ color: "var(--text-muted)" }}>(on invoice)</span></label>
                  <textarea value={customerNotes} onChange={ev => setCustomerNotes(ev.target.value)} rows={3}
                    className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none thin-scroll-y" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                </div>
                <div className="rounded-xl p-3 space-y-1.5 self-end" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                  <div className="flex items-center justify-between"><span className="text-xs" style={{ color: "var(--text-muted)" }}>Subtotal</span><span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fmt(totals.subtotal)}</span></div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><span className="text-xs" style={{ color: "var(--text-muted)" }}>Tax</span>
                      <input type="number" min={0} step="0.1" value={taxRate} onChange={ev => setTaxRate(ev.target.value)}
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

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <InvoicePreview data={previewData} />
              {editInvoice ? (
                <button onClick={() => save(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
                  <Check className="w-4 h-4" /> Save Changes
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => save(false)}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
                    <FileText className="w-4 h-4" /> Save as Draft
                  </button>
                  <button onClick={() => save(true)}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
                    <Send className="w-4 h-4" /> Create &amp; Send
                  </button>
                </div>
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
          {step < 3 && (
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
