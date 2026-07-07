"use client";

// ─── Work Order billing ───────────────────────────────────
// Capture the parts, labor, and fees on a work order — the field→billing bridge.
// Captured lines post to the JOB's billable-items ledger; each line is either
// unbilled (selectable to invoice now) or already billed (locked, links to its
// invoice). So a job can span visits and bill in pieces — deposit / progress /
// final — without ever double-billing. "Bill selected" powers "just the service
// call now, the rest later."

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, PlusCircle, Trash2, Receipt, Wrench, Package, BadgeDollarSign, FileText, Check } from "lucide-react";
import { getWorkOrderById, updateWorkOrderById, getJob, type WorkOrderLineItem } from "@/lib/jobs/data";
import { createInvoiceFromWorkOrder, createQuoteFromWorkOrder } from "@/lib/quotes/data";
import { getWorkOrderLedger, sumUnbilled } from "@/lib/billing/ledger";
import { getAllItems, type Item } from "@/lib/items/data";
import CatalogPicker from "@/components/quotes/CatalogPicker";
import { useDataVersion } from "@/lib/sync/useDataVersion";
import { usePermissions } from "@/components/providers/PermissionProvider";

type Kind = "part" | "labor" | "fee";
const KIND_META: Record<Kind, { label: string; icon: React.ElementType; color: string }> = {
  part:  { label: "Part",  icon: Package,         color: "#0f8578" },
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
  const canBill = fieldVisible("finance_field_billing");  // may capture + see prices but not invoice
  const showCost = fieldVisible("finance_cost_margin");   // margin visible in the catalog picker
  const wo = useMemo(() => getWorkOrderById(workOrderId), [workOrderId, rev]);
  const job = useMemo(() => (wo?.jobId ? getJob(wo.jobId) : undefined), [wo?.jobId]);
  // The catalog (Items & Services / price book) scoped to this WO's company —
  // the fast path for services + common parts. Custom lines cover the rest.
  const catalog = useMemo(() => getAllItems().filter(i => i.active && (!job || i.companyId === job.companyId)), [job]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("part");
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  // Lines the user has explicitly EXCLUDED from the next invoice. Anything else
  // that's unbilled is billed by default (so newly-added lines auto-include).
  const [deselected, setDeselected] = useState<Set<string>>(new Set());

  const items = wo?.lineItems ?? [];
  const ledger = useMemo(() => getWorkOrderLedger(workOrderId), [workOrderId, rev]);
  const unbilled = ledger.filter(l => !l.billed);
  const billed = ledger.filter(l => l.billed);

  const isSelected = (id: string) => !deselected.has(id);
  const selectedLines = unbilled.filter(l => isSelected(l.id));
  const selectedIds = selectedLines.map(l => l.id);
  const selectedTotal = selectedLines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const unbilledTotal = sumUnbilled(ledger);
  const billedTotal = billed.reduce((s, l) => s + l.qty * l.unitPrice, 0);

  const toggleSelect = (id: string) => setDeselected(d => {
    const n = new Set(d); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  // Item type → work-order line kind (part / labor / fee).
  const kindForItem = (t: Item["type"]): Kind =>
    t === "labor" || t === "service" ? "labor"
    : t === "fee" || t === "discount" || t === "membership" ? "fee"
    : "part";

  // Pull selected catalog items in as priced work-order lines (snapshot + itemId ref).
  const addCatalogItems = (sel: Item[]) => {
    const added: WorkOrderLineItem[] = sel.map((it, i) => ({
      id: `woli-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
      kind: kindForItem(it.type), description: it.name, qty: it.defaultQuantity || 1,
      unitPrice: it.unitPrice, itemId: it.id, taxable: it.taxable, unitCost: it.unitCost,
    }));
    if (added.length) updateWorkOrderById(workOrderId, { lineItems: [...items, ...added] });
    setCatalogOpen(false);
  };

  const add = () => {
    if (!desc.trim()) return;
    const li: WorkOrderLineItem = { id: `woli-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, kind, description: desc.trim(), qty: Number(qty) || 1, unitPrice: Number(price) || 0 };
    updateWorkOrderById(workOrderId, { lineItems: [...items, li] });
    setDesc(""); setQty("1"); setPrice("");
  };
  // Only unbilled lines can be removed — billed ones are locked to their invoice.
  const remove = (id: string) => updateWorkOrderById(workOrderId, { lineItems: items.filter(l => l.id !== id) });
  const createInvoice = () => {
    const inv = createInvoiceFromWorkOrder(workOrderId, selectedIds);
    if (inv) router.push(`/invoices/${inv.id}`);
  };
  const createQuote = () => {
    const q = createQuoteFromWorkOrder(workOrderId, selectedIds);
    if (q) router.push(`/quotes/${q.id}`);
  };

  const inputCls = "rounded-lg px-2.5 py-1.5 text-sm outline-none";
  const inputStyle = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" } as React.CSSProperties;

  // A single captured line. Unbilled → selectable + removable; billed → locked,
  // muted, links to the invoice it landed on.
  const LineRow = (l: typeof ledger[number], i: number) => {
    const m = KIND_META[l.kind];
    const sel = isSelected(l.id);
    return (
      <div key={l.id} className="flex items-center gap-2.5 px-3 py-2" style={{ borderTop: i ? "1px solid var(--border)" : "none", opacity: l.billed ? 0.6 : 1 }}>
        {showPricing && (l.billed
          ? <span className="w-5 h-5 shrink-0" />
          : <button onClick={() => toggleSelect(l.id)} aria-label={sel ? "Exclude from invoice" : "Include in invoice"} title={sel ? "Included — click to exclude" : "Excluded — click to include"}
              className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors"
              style={{ border: `1.5px solid ${sel ? "var(--copper-soft-border)" : "var(--border)"}`, backgroundColor: sel ? "var(--copper-soft-bg)" : "transparent" }}>
              {sel && <Check className="w-3 h-3" style={{ color: "var(--copper-text)" }} />}
            </button>)}
        <m.icon className="w-3.5 h-3.5 shrink-0" style={{ color: m.color }} />
        <span className="text-sm truncate flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>{l.description}</span>
        {showPricing && l.billed && l.invoiceId && (
          <Link href={`/invoices/${l.invoiceId}`} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 hover:brightness-95"
            style={l.paid
              ? { backgroundColor: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" }
              : { backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{l.paid ? "Paid" : "Billed"}</Link>
        )}
        {showPricing
          ? <>
              <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>{l.qty} × {money(l.unitPrice)}</span>
              <span className="text-sm font-semibold tabular-nums shrink-0 w-20 text-right" style={{ color: "var(--text-primary)" }}>{money(l.qty * l.unitPrice)}</span>
            </>
          : <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>× {l.qty}</span>}
        {l.billed
          ? <span className="w-6 shrink-0" />
          : <button onClick={() => remove(l.id)} aria-label="Remove" className="p-1 rounded hover:bg-[var(--bg-surface-2)] shrink-0"><Trash2 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /></button>}
      </div>
    );
  };

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Parts & Labor</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{showPricing ? "Captured on the work order — select lines to bill. Billed lines are locked to their invoice." : "Log parts & labor used — the office adds pricing on the invoice."}</p>
        </div>
        <Receipt className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
      </div>

      {/* Line items — unbilled first, then already-billed. */}
      {ledger.length > 0 && (
        <div className="rounded-lg overflow-hidden mb-3" style={{ border: "1px solid var(--border)" }}>
          {[...unbilled, ...billed].map((l, i) => LineRow(l, i))}
        </div>
      )}

      {/* Add from catalog — the fast path: services + common parts pull in priced. */}
      {showPricing && (
        <button onClick={() => setCatalogOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold mb-2 transition hover:brightness-95"
          style={{ border: "1px solid var(--accent-soft-border)", color: "var(--accent-text)", backgroundColor: "var(--accent-soft-bg)" }}>
          <PlusCircle className="w-4 h-4" /> Add from catalog
        </button>
      )}

      {/* Custom line — for a one-off part or charge that isn't in the catalog. */}
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <select value={kind} onChange={e => setKind(e.target.value as Kind)} className={inputCls} style={inputStyle}>
          {(Object.keys(KIND_META) as Kind[]).map(k => <option key={k} value={k}>{KIND_META[k].label}</option>)}
        </select>
        <input value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="Custom line (e.g. Run capacitor 45/5)" className={`${inputCls} flex-1 min-w-[140px]`} style={inputStyle} />
        <input value={qty} onChange={e => setQty(e.target.value)} type="number" min="1" className={`${inputCls} w-16`} style={inputStyle} />
        {showPricing && <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className={`${inputCls} w-24`} style={inputStyle} />}
        <button onClick={add} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}><Plus className="w-3.5 h-3.5" /> Add</button>
      </div>

      {/* Totals + bill actions — only when this role can see field pricing */}
      {showPricing && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex flex-col">
            <span className="text-base font-bold tabular-nums cursor-default" title="Selected to bill" style={{ color: "var(--text-primary)" }}>{money(selectedTotal)}</span>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {selectedIds.length} of {unbilled.length} unbilled selected
              {billed.length > 0 && ` · ${money(billedTotal)} already billed`}
            </span>
          </div>
          {canBill ? (
            <div className="flex items-center gap-2">
              {/* Field-upsell path: turn the selected lines into a quote (a proposal — nothing is billed). */}
              <button onClick={createQuote} disabled={selectedIds.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <FileText className="w-4 h-4" /> Create quote
              </button>
              <button onClick={createInvoice} disabled={selectedIds.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <Receipt className="w-4 h-4" /> {unbilled.length && selectedIds.length < unbilled.length ? "Bill selected" : "Create invoice"}
              </button>
            </div>
          ) : (
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Billing handled by the office</span>
          )}
        </div>
      )}

      {catalogOpen && <CatalogPicker items={catalog} showCost={showCost} onAdd={addCatalogItems} onClose={() => setCatalogOpen(false)} />}
    </div>
  );
}
