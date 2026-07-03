"use client";

// ─── Work Order billing ───────────────────────────────────
// Capture the parts, labor, and fees on a work order — the field→billing bridge —
// then turn them into an invoice in one click. This is what makes "find the bad
// capacitor → fix → invoice → done" a real flow.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Receipt, Wrench, Package, BadgeDollarSign, FileText } from "lucide-react";
import { getWorkOrderById, updateWorkOrderById, type WorkOrderLineItem } from "@/lib/jobs/data";
import { createInvoiceFromWorkOrder, createQuoteFromWorkOrder } from "@/lib/quotes/data";
import { useDataVersion } from "@/lib/sync/useDataVersion";
import { usePermissions } from "@/components/providers/PermissionProvider";

type Kind = "part" | "labor" | "fee";
const KIND_META: Record<Kind, { label: string; icon: React.ElementType; color: string }> = {
  part:  { label: "Part",  icon: Package,         color: "#4f46e5" },
  labor: { label: "Labor", icon: Wrench,          color: "#0891b2" },
  fee:   { label: "Fee",   icon: BadgeDollarSign, color: "#f59e0b" },
};
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function WorkOrderBilling({ workOrderId }: { workOrderId: string }) {
  const router = useRouter();
  const rev = useDataVersion();
  const { fieldVisible } = usePermissions();
  // Field-pricing mask: when off, this role captures parts/labor as a USAGE log
  // only (no $, no invoicing) — the office prices it. When on, it's a priced work
  // order the user can invoice from. Toggled per role in Settings → Roles.
  const showPricing = fieldVisible("finance_field_pricing");
  const wo = useMemo(() => getWorkOrderById(workOrderId), [workOrderId, rev]);
  const [kind, setKind] = useState<Kind>("part");
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");

  const items = wo?.lineItems ?? [];
  const subtotal = items.reduce((s, li) => s + li.qty * li.unitPrice, 0);

  const add = () => {
    if (!desc.trim()) return;
    const li: WorkOrderLineItem = { id: `woli-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, kind, description: desc.trim(), qty: Number(qty) || 1, unitPrice: Number(price) || 0 };
    updateWorkOrderById(workOrderId, { lineItems: [...items, li] });
    setDesc(""); setQty("1"); setPrice("");
  };
  const remove = (id: string) => updateWorkOrderById(workOrderId, { lineItems: items.filter(l => l.id !== id) });
  const createInvoice = () => {
    const inv = createInvoiceFromWorkOrder(workOrderId);
    if (inv) router.push(`/invoices/${inv.id}`);
  };
  const createQuote = () => {
    const q = createQuoteFromWorkOrder(workOrderId);
    if (q) router.push(`/quotes/${q.id}`);
  };

  const inputCls = "rounded-lg px-2.5 py-1.5 text-sm outline-none";
  const inputStyle = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" } as React.CSSProperties;

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Parts & Labor</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{showPricing ? "Captured on the work order — the source for the invoice." : "Log parts & labor used — the office adds pricing on the invoice."}</p>
        </div>
        <Receipt className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
      </div>

      {/* Line items */}
      {items.length > 0 && (
        <div className="rounded-lg overflow-hidden mb-3" style={{ border: "1px solid var(--border)" }}>
          {items.map((li, i) => {
            const m = KIND_META[li.kind];
            return (
              <div key={li.id} className={`grid ${showPricing ? "grid-cols-[auto_1fr_auto_auto_auto]" : "grid-cols-[auto_1fr_auto_auto]"} items-center gap-2.5 px-3 py-2`} style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                <m.icon className="w-3.5 h-3.5 shrink-0" style={{ color: m.color }} />
                <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{li.description}</span>
                {showPricing
                  ? <>
                      <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{li.qty} × {money(li.unitPrice)}</span>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{money(li.qty * li.unitPrice)}</span>
                    </>
                  : <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>× {li.qty}</span>}
                <button onClick={() => remove(li.id)} aria-label="Remove" className="p-1 rounded hover:bg-[var(--bg-surface-2)]"><Trash2 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={kind} onChange={e => setKind(e.target.value as Kind)} className={inputCls} style={inputStyle}>
          {(Object.keys(KIND_META) as Kind[]).map(k => <option key={k} value={k}>{KIND_META[k].label}</option>)}
        </select>
        <input value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="Description (e.g. Run capacitor 45/5)" className={`${inputCls} flex-1 min-w-[140px]`} style={inputStyle} />
        <input value={qty} onChange={e => setQty(e.target.value)} type="number" min="1" className={`${inputCls} w-16`} style={inputStyle} />
        {showPricing && <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className={`${inputCls} w-24`} style={inputStyle} />}
        <button onClick={add} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}><Plus className="w-3.5 h-3.5" /> Add</button>
      </div>

      {/* Total + create invoice — only when this role can see field pricing */}
      {showPricing && (
        <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Subtotal</span>
            <span className="text-base font-bold ml-2 tabular-nums" style={{ color: "var(--text-primary)" }}>{money(subtotal)}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Field-upsell path: turn the captured line items into a quote for the customer. */}
            <button onClick={createQuote} disabled={items.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <FileText className="w-4 h-4" /> Create quote
            </button>
            <button onClick={createInvoice} disabled={items.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: "#4f46e5" }}>
              <Receipt className="w-4 h-4" /> Create invoice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
