"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { getAllCustomers } from "@/lib/customers/data";
import {
  createQuote, createInvoice, computeTotals, fmt,
  type LineItem, type QuoteRecord, type InvoiceRecord,
} from "@/lib/quotes/data";
import { LINE_ITEM_CATEGORIES, type LineItemCategory } from "@/lib/quotes/types";

type Kind = "quote" | "invoice";

interface Preset {
  customerId?: string;
  jobId?: string;
  projectId?: string;
  leadId?: string;
  agreementId?: string;
  propertyId?: string;
  linkedLabel?: string;
  linkedType?: QuoteRecord["linkedType"] & InvoiceRecord["linkedType"];
  linkedId?: string;
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
}

function blankItem(): DraftItem {
  return { id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, name: "", description: "", quantity: "1", unitPrice: "0", category: "Labor", taxable: true, optional: false };
}

export default function CreateDocumentModal({
  kind, preset, onClose, onCreated,
}: {
  kind: Kind;
  preset?: Preset;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const customers = getAllCustomers();
  const [customerId, setCustomerId] = useState(preset?.customerId ?? customers[0]?.id ?? "");
  const [title, setTitle]   = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [dateField, setDateField] = useState(""); // expires_at (quote) or due_date (invoice)
  const [items, setItems] = useState<DraftItem[]>([blankItem()]);

  const isQuote = kind === "quote";

  // Convert drafts to LineItems for totals + create
  const lineItems: LineItem[] = items
    .filter(it => it.name.trim() || it.description.trim())
    .map(it => {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.unitPrice) || 0;
      return {
        id: it.id, name: it.name.trim() || undefined, description: it.description.trim() || it.name.trim(),
        quantity: qty, unitPrice: price, total: Math.round(qty * price * 100) / 100,
        category: it.category, taxable: it.taxable, optional: it.optional,
      };
    });

  const totals = computeTotals(lineItems, (parseFloat(taxRate) || 0) / 100);
  const customer = customers.find(c => c.id === customerId);
  const canCreate = Boolean(customerId && title.trim() && lineItems.length > 0);

  function setItem(id: string, patch: Partial<DraftItem>) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }
  function addItem() { setItems(prev => [...prev, blankItem()]); }
  function removeItem(id: string) { setItems(prev => prev.filter(it => it.id !== id)); }

  function handleCreate() {
    if (!customer) return;
    const initials = customer.initials;
    const common = {
      customerId, customerName: customer.name, customerInitials: initials, locationName: customer.locationName,
      title: title.trim(), lineItems, taxRate: (parseFloat(taxRate) || 0) / 100,
      jobId: preset?.jobId, projectId: preset?.projectId, agreementId: preset?.agreementId, propertyId: preset?.propertyId,
      linkedLabel: preset?.linkedLabel, linkedType: preset?.linkedType, linkedId: preset?.linkedId,
    };
    if (isQuote) {
      const q = createQuote({ ...common, leadId: preset?.leadId, expiresAt: dateField || undefined });
      onCreated(q.id);
    } else {
      const inv = createInvoice({ ...common, dueDate: dateField || "On receipt" });
      onCreated(inv.id);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            New {isQuote ? "Quote" : "Invoice"}
          </p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Customer *</label>
              <UiSelect value={customerId} onChange={setCustomerId} disabled={Boolean(preset?.customerId)}
                options={customers.map(c => ({ value: c.id, label: c.name }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                {isQuote ? "Expires" : "Due Date"}
              </label>
              <input type="date" value={dateField} onChange={e => setDateField(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder={isQuote ? "e.g. HVAC System Replacement" : "e.g. Service Call — Invoice"}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
          {preset?.linkedLabel && (
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Linked to: {preset.linkedLabel}</p>
          )}

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Line Items</label>
              <button onClick={addItem} className="flex items-center gap-1 text-xs font-medium" style={{ color: "#4f46e5" }}>
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map(it => {
                const lineTotal = (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0);
                return (
                  <div key={it.id} className="rounded-xl p-3 space-y-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
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
                      <div className="flex items-center gap-1">
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Qty</span>
                        <input type="number" min={0} value={it.quantity} onChange={e => setItem(it.id, { quantity: e.target.value })}
                          className="w-16 rounded-lg px-2 py-1 text-xs outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>$ Unit</span>
                        <input type="number" min={0} step="0.01" value={it.unitPrice} onChange={e => setItem(it.id, { unitPrice: e.target.value })}
                          className="w-24 rounded-lg px-2 py-1 text-xs outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                      </div>
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                        <input type="checkbox" checked={it.taxable} onChange={e => setItem(it.id, { taxable: e.target.checked })} className="accent-indigo-600" /> Taxable
                      </label>
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                        <input type="checkbox" checked={it.optional} onChange={e => setItem(it.id, { optional: e.target.checked })} className="accent-indigo-600" /> Optional
                      </label>
                      <span className="ml-auto text-sm font-semibold" style={{ color: it.optional ? "var(--text-muted)" : "var(--text-primary)" }}>{fmt(lineTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-xl p-3 space-y-1.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Subtotal</span>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fmt(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Tax</span>
                <input type="number" min={0} step="0.1" value={taxRate} onChange={e => setTaxRate(e.target.value)}
                  className="w-14 rounded px-1.5 py-0.5 text-xs outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>%</span>
              </div>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{fmt(totals.tax)}</span>
            </div>
            <div className="flex items-center justify-between pt-1.5" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Total</span>
              <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{fmt(totals.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={handleCreate} disabled={!canCreate}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
            Create {isQuote ? "Quote" : "Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
