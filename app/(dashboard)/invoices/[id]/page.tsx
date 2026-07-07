"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, Pencil, Download, Printer, Eye, Receipt, DollarSign,
  CircleDollarSign, Wallet, Activity, Calendar, Clock, FileText,
  Copy, Ban, Trash2, X, Phone,
} from "lucide-react";
import { getInvoice, getQuote, fmt, updateInvoiceStatus, recordPayment, duplicateInvoice, voidInvoice, deleteInvoice, updateInvoice, type InvoiceRecord } from "@/lib/quotes/data";
import { INVOICE_STATUS_STYLE, type InvoiceStatus } from "@/lib/quotes/types";
import { getCustomer } from "@/lib/customers/data";
import { getJob, getWorkOrderById } from "@/lib/jobs/data";
import InvoicePreview from "@/components/quotes/InvoicePreview";
import Commentable from "@/components/comments/Commentable";
import InvoiceWizard from "@/components/quotes/InvoiceWizard";
import { downloadInvoicePdf } from "@/lib/quotes/pdf";
import DetailTabs from "@/components/shared/DetailTabs";
import ActionsMenu, { type ActionItem } from "@/components/shared/ActionsMenu";

const TABS = ["Overview", "Notes", "Activity"];

type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

// ─── Shared detail primitives (same language as Job / Work Order overviews) ──
function Stat({ icon: Icon, label, value, sub, accent }: { icon: IconType; label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color: accent ?? "var(--text-muted)" }} />
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
      <p className="text-base font-bold leading-tight truncate" style={{ color: accent ?? "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}
function DCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl ${className}`} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>{children}</div>;
}
function DLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{children}</p>;
}
function InfoRow({ icon: Icon, label, value }: { icon?: IconType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
        <div className="text-sm font-medium break-words" style={{ color: "var(--text-primary)" }}>{value || "—"}</div>
      </div>
    </div>
  );
}

// ─── Line items card — fills the column height, totals pinned at the bottom.
// Reads as a quiet list, not a spreadsheet: each line is description + total,
// with "qty × unit" as a muted subline when there's more than one unit.
function InvoiceLineItems({ invoice }: { invoice: InvoiceRecord }) {
  const n = invoice.lineItems.length;
  return (
    <DCard className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-baseline justify-between px-5 pt-4 shrink-0">
        <DLabel>Line Items</DLabel>
        <span className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{n} {n === 1 ? "item" : "items"}</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-5 pt-1 pb-2">
        {invoice.lineItems.map((item, i) => (
          <div key={item.id} className="flex items-start justify-between gap-6 py-3"
            style={{ borderBottom: i < n - 1 ? "1px solid var(--border-subtle)" : "none" }}>
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.description}</p>
              {item.quantity !== 1 && (
                <p className="text-xs mt-0.5 tabular-nums" style={{ color: "var(--text-muted)" }}>{item.quantity} × {fmt(item.unitPrice)}</p>
              )}
              {item.notes && <p className="text-xs mt-0.5 italic" style={{ color: "var(--text-muted)" }}>{item.notes}</p>}
            </div>
            <p className="text-sm font-medium tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>{fmt(item.total)}</p>
          </div>
        ))}
      </div>
      {/* Totals — a quiet right-aligned stack */}
      <div className="px-5 py-4 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="ml-auto w-full max-w-[260px] space-y-1.5">
          <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
            <span>Subtotal</span><span className="tabular-nums">{fmt(invoice.subtotal)}</span>
          </div>
          {invoice.tax > 0 && (
            <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
              <span>Tax</span><span className="tabular-nums">{fmt(invoice.tax)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-2 mt-1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Total</span>
            <span className="text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{fmt(invoice.total)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Balance due</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: invoice.balanceDue > 0 ? (invoice.status === "past_due" ? "#dc2626" : "var(--text-primary)") : "#16a34a" }}>
              {invoice.balanceDue > 0 ? fmt(invoice.balanceDue) : "Paid in full"}
            </span>
          </div>
        </div>
      </div>
    </DCard>
  );
}

// A linked record shown the same way tasks show "Linked To": a color-coded
// inline link with an arrow that nudges on hover. Color encodes the record type
// (same palette as the Invoices list). The relation phrase says how the invoice
// relates to the record ("Billed from", "Part of", "Created from").
const LINK_COLOR: Record<string, string> = { job: "#0a5c53", work_order: "#0891b2", project: "#5b21b6", quote: "#6d28d9", agreement: "#059669", customer: "#0a5c53" };
function LinkedRow({ href, label, type, relation }: { href: string; label: string; type: string; relation: string }) {
  const color = LINK_COLOR[type] ?? "var(--text-secondary)";
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider">
        <span style={{ color: "var(--text-muted)" }}>{relation}</span>
        <span style={{ color: "var(--text-muted)" }}> · </span>
        <span className="capitalize" style={{ color }}>{type.replace(/_/g, " ")}</span>
      </p>
      <Link href={href} className="group inline-flex items-center gap-1 text-[13px] font-medium max-w-full hover:underline mt-0.5"
        style={{ color, textDecoration: "none" }}>
        <span className="truncate">{label}</span>
        <ArrowUpRight className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </div>
  );
}

// ─── Overview tab — full height, Stat cards + details + line items ──────────
function OverviewTab({ id }: { id: string }) {
  const invoice  = getInvoice(id)!;
  const customer = getCustomer(invoice.customerId);
  const sourceQuote = invoice.quoteId ? getQuote(invoice.quoteId) : null;
  const st = INVOICE_STATUS_STYLE[invoice.status];
  const isOverdue = invoice.status === "past_due";
  const collected = invoice.total - invoice.balanceDue;

  // Records this invoice ties back to. The work order (whose captured lines are
  // what's billed) is the primary link; the job it belongs to nests under it so
  // the hierarchy reads work order → job. The job uses its real title rather
  // than the "Work Order: …" linkedLabel.
  const workOrder = invoice.workOrderId ? getWorkOrderById(invoice.workOrderId) : undefined;
  const jobEntry = invoice.linkedType === "job" && invoice.linkedId
    ? { href: `/jobs/${invoice.linkedId}`, label: getJob(invoice.linkedId)?.title ?? invoice.linkedLabel ?? "Job" }
    : null;
  const otherEntry =
    invoice.linkedType === "project" && invoice.linkedId ? { href: `/projects/${invoice.linkedId}`, label: invoice.linkedLabel ?? "Project", type: "project" } :
    invoice.linkedType === "agreement" && invoice.linkedId ? { href: `/agreements/${invoice.linkedId}`, label: invoice.linkedLabel ?? "Agreement", type: "agreement" } :
    null;
  const hasLinks = Boolean(workOrder || jobEntry || otherEntry || sourceQuote);

  return (
    <div className="min-h-full w-full flex flex-col gap-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <Stat icon={Activity} label="Status" value={st.label} accent={st.color} sub={invoice.isDeposit ? "Deposit" : undefined} />
        <Stat icon={DollarSign} label="Total" value={fmt(invoice.total)} />
        <Stat icon={CircleDollarSign} label="Collected" value={fmt(collected)} accent={collected > 0 ? "#16a34a" : undefined} />
        <Stat icon={Wallet} label={invoice.balanceDue > 0 ? "Balance Due" : "Paid"}
          value={invoice.balanceDue > 0 ? fmt(invoice.balanceDue) : "Paid in full"}
          accent={invoice.balanceDue > 0 ? (isOverdue ? "#dc2626" : undefined) : "#16a34a"}
          sub={invoice.balanceDue > 0 ? `Due ${invoice.dueDate}${isOverdue ? " · overdue" : ""}` : invoice.paidAt} />
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Left (2/3): Invoice Details, then Line Items filling the rest */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          <DCard className="p-4 shrink-0">
            <DLabel>Invoice Details</DLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3">
              <InfoRow icon={Activity} label="Status" value={<span style={{ color: st.color, fontWeight: 600 }}>{st.label}</span>} />
              <InfoRow icon={Receipt} label="Invoice #" value={<span className="font-mono">{invoice.invoiceNumber}</span>} />
              <InfoRow icon={FileText} label="Description" value={invoice.title} />
              <InfoRow icon={DollarSign} label="Total" value={fmt(invoice.total)} />
              <InfoRow icon={Wallet} label="Balance Due" value={<span style={{ color: invoice.balanceDue > 0 ? (isOverdue ? "#dc2626" : undefined) : "#16a34a", fontWeight: 600 }}>{invoice.balanceDue > 0 ? fmt(invoice.balanceDue) : "Paid in full"}</span>} />
              <InfoRow icon={Calendar} label="Due Date" value={<span style={{ color: isOverdue ? "#dc2626" : undefined }}>{invoice.dueDate}{isOverdue ? " · overdue" : ""}</span>} />
              <InfoRow icon={Clock} label="Created" value={invoice.createdAt} />
              {invoice.paidAt && <InfoRow icon={CircleDollarSign} label="Paid" value={<span style={{ color: "#16a34a" }}>{invoice.paidAt}</span>} />}
              {invoice.isDeposit && <InfoRow icon={Wallet} label="Type" value="Deposit" />}
            </div>
          </DCard>

          <div className="flex-1 min-h-0"><InvoiceLineItems invoice={invoice} /></div>
        </div>

        {/* Right: Linked To (tasks-style) + Customer */}
        <div className="flex flex-col gap-4 min-h-0">
          <DCard className="p-4 shrink-0">
            <DLabel>Customer</DLabel>
            {customer ? (
              <div className="flex items-center gap-3 mt-3">
                <div className="w-8 h-8 rounded-full bg-[var(--copper-soft-bg)] flex items-center justify-center text-[var(--copper-text)] text-[10px] font-bold shrink-0">{customer.initials}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{customer.name}</p>
                  {customer.phone && <p className="text-xs mt-0.5 inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}><Phone className="w-3 h-3" /> {customer.phone}</p>}
                </div>
                <Link href={`/customers/${customer.id}`}
                  className="group inline-flex items-center gap-1 text-[11px] font-medium shrink-0 hover:underline"
                  style={{ color: "var(--accent-text)", textDecoration: "none" }}>
                  View account
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3 mt-3">
                <div className="w-8 h-8 rounded-full bg-[var(--copper-soft-bg)] flex items-center justify-center text-[10px] font-bold text-[var(--copper-text)] shrink-0">{invoice.customerInitials}</div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{invoice.customerName}</p>
              </div>
            )}
          </DCard>

          {hasLinks && (
            <DCard className="p-4 flex-1">
              <DLabel>Linked Records</DLabel>
              <div className="mt-3 space-y-3.5">
                {/* Nesting mirrors the real hierarchy: the job is the parent, the
                    work order (whose lines this invoice bills) sits under it. */}
                {jobEntry && (
                  <div>
                    <LinkedRow relation="For" href={jobEntry.href} label={jobEntry.label} type="job" />
                    {workOrder && (
                      <div className="mt-2.5 ml-1.5 pl-3" style={{ borderLeft: "2px solid var(--border)" }}>
                        <LinkedRow relation="Billed from" href={`/work-orders/${workOrder.id}`} label={workOrder.title || "Work Order"} type="work_order" />
                      </div>
                    )}
                  </div>
                )}
                {!jobEntry && workOrder && <LinkedRow relation="Billed from" href={`/work-orders/${workOrder.id}`} label={workOrder.title || "Work Order"} type="work_order" />}
                {otherEntry && <LinkedRow relation="For" href={otherEntry.href} label={otherEntry.label} type={otherEntry.type} />}
                {sourceQuote && <LinkedRow relation="Created from" href={`/quotes/${sourceQuote.id}`} label={sourceQuote.quoteNumber} type="quote" />}
              </div>
            </DCard>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Record-payment modal ─────────────────────────────────
function PaymentModal({ balanceDue, invoiceNumber, onSubmit, onClose }: {
  balanceDue: number; invoiceNumber: string; onSubmit: (amount: number) => void; onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(balanceDue));
  const val = parseFloat(amount) || 0;
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Record Payment</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Balance due on {invoiceNumber}: <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(balanceDue)}</span></p>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Payment amount</label>
            <input type="number" min={0} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} autoFocus
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>
        </div>
        <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={() => onSubmit(val)} disabled={val <= 0}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#10b981" }}>
            Record {fmt(val)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState("Overview");
  const [invoice, setInvoice] = useState(() => getInvoice(id));
  const [showPreview, setShowPreview] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPay, setShowPay] = useState(false);

  if (!invoice) {
    return (
      <div className="p-6">
        <Link href="/invoices" className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </Link>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Invoice not found.</p>
      </div>
    );
  }

  const refresh = () => setInvoice(getInvoice(id));

  const previewData = {
    invoiceNumber: invoice.invoiceNumber, title: invoice.title, customerName: invoice.customerName,
    locationName: invoice.locationName, dueDate: invoice.dueDate, createdAt: invoice.createdAt,
    lineItems: invoice.lineItems, subtotal: invoice.subtotal, tax: invoice.tax, total: invoice.total,
    balanceDue: invoice.balanceDue, paidAt: invoice.paidAt, customerNotes: invoice.customerNotes,
    stamp: invoice.status === "paid" ? "PAID" : undefined,
  };

  function setStatus(next: InvoiceStatus) { updateInvoiceStatus(id, next); refresh(); }
  function submitPayment(amount: number) { recordPayment(id, amount); setShowPay(false); refresh(); }
  function downloadPdf() { downloadInvoicePdf(previewData); }
  function printInvoice() {
    const prev = document.title;
    document.title = `${invoice!.invoiceNumber} — ${invoice!.customerName}`;
    const restore = () => { document.title = prev; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
  }
  function doDuplicate() { const copy = duplicateInvoice(id); if (copy) router.push(`/invoices/${copy.id}`); }
  function doVoid() { if (window.confirm(`Void ${invoice!.invoiceNumber}?`)) { voidInvoice(id); refresh(); } }
  function doDelete() {
    if (window.confirm(`Permanently delete ${invoice!.invoiceNumber}? This cannot be undone — use Void to cancel an invoice while keeping the record.`)) {
      deleteInvoice(id);
      router.push("/invoices");
    }
  }

  const canPay = invoice.status === "sent" || invoice.status === "partially_paid" || invoice.status === "past_due";
  // Every header action lives in the shared 4-dot menu.
  const actions: (ActionItem | false)[] = [
    invoice.status === "draft" && { label: "Send invoice", icon: Receipt, onClick: () => setStatus("sent") },
    canPay && { label: "Record payment", icon: DollarSign, onClick: () => setShowPay(true) },
    { label: "Preview", icon: Eye, onClick: () => setShowPreview(true) },
    { label: "Download PDF", icon: Download, onClick: downloadPdf },
    { label: "Print", icon: Printer, onClick: printInvoice },
    { label: "Edit", icon: Pencil, onClick: () => setShowEdit(true), separated: true },
    { label: "Duplicate", icon: Copy, onClick: doDuplicate },
    (invoice.status !== "void" && invoice.status !== "paid") && { label: "Void invoice", icon: Ban, onClick: doVoid, danger: true, separated: true },
    { label: "Delete invoice", icon: Trash2, onClick: doDelete, danger: true },
  ];

  return (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/invoices" className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeft className="w-4 h-4" /> Invoices
            </Link>
            <div className="w-px h-5 shrink-0" style={{ backgroundColor: "var(--border)" }} />
            <Commentable anchor={{ recordType: "invoice", recordId: id, recordLabel: invoice.invoiceNumber }}>
              <div className="min-w-0">
                <h1 className="text-base font-semibold font-mono truncate" style={{ color: "var(--text-primary)" }}>{invoice.invoiceNumber}</h1>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{invoice.customerName}</p>
              </div>
            </Commentable>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ActionsMenu actions={actions} />
          </div>
        </div>

        <DetailTabs tabs={TABS} active={tab} onChange={setTab} className="px-6 py-2" />
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {tab === "Overview" && <OverviewTab id={id} />}
        {tab === "Notes"    && <InvoiceNotesTab invoice={invoice} onSaved={refresh} />}
        {tab === "Activity" && <InvoiceActivityTab invoice={invoice} />}
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 rounded-t-2xl" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Invoice Preview</p>
              <button onClick={() => setShowPreview(false)} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
            </div>
            <InvoicePreview data={previewData} />
          </div>
        </div>
      )}

      {/* Hidden printable document */}
      <div className="print-doc" aria-hidden>
        <InvoicePreview data={previewData} />
      </div>

      {showPay && <PaymentModal balanceDue={invoice.balanceDue} invoiceNumber={invoice.invoiceNumber} onSubmit={submitPayment} onClose={() => setShowPay(false)} />}
      {showEdit && <InvoiceWizard editInvoice={invoice} onClose={() => setShowEdit(false)} onCreated={() => { setShowEdit(false); refresh(); }} />}
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────
function InvoiceNotesTab({ invoice, onSaved }: { invoice: InvoiceRecord; onSaved: () => void }) {
  const [customerNotes, setCustomerNotes] = useState(invoice.customerNotes ?? "");
  const [internalNotes, setInternalNotes] = useState(invoice.internalNotes ?? "");
  const [saved, setSaved] = useState(false);
  const dirty = customerNotes !== (invoice.customerNotes ?? "") || internalNotes !== (invoice.internalNotes ?? "");
  function save() {
    updateInvoice(invoice.id, { customerNotes, internalNotes });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    onSaved();
  }
  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Invoice Notes <span className="normal-case font-normal">(shown on the invoice)</span></label>
        <textarea value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} rows={4} placeholder="Payment terms, remittance details…"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
      </div>
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Internal Notes <span className="normal-case font-normal">(team only)</span></label>
        <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} placeholder="Internal context not shown to the customer…"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
      </div>
      <div className="flex justify-end">
        <button onClick={save} disabled={!dirty && !saved}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
          style={{ backgroundColor: saved ? "#10b981" : "#0f8578" }}>{saved ? "Saved ✓" : "Save Notes"}</button>
      </div>
    </div>
  );
}

// ─── Activity tab (created → sent → payments → paid) ──────
function InvoiceActivityTab({ invoice }: { invoice: InvoiceRecord }) {
  const events: { label: string; detail?: string; at?: string; color: string }[] = [];
  events.push({ label: "Invoice created", detail: invoice.invoiceNumber, at: invoice.createdAt, color: "#6b7280" });
  if (invoice.status !== "draft") events.push({ label: "Marked sent", detail: `Due ${invoice.dueDate}`, color: "#0f8578" });
  (invoice.payments ?? []).forEach(p => events.push({ label: "Payment recorded", detail: fmt(p.amount), at: p.at, color: "#16a34a" }));
  if (invoice.status === "paid" && invoice.paidAt) events.push({ label: "Paid in full", at: invoice.paidAt, color: "#16a34a" });
  if (invoice.status === "void") events.push({ label: "Invoice voided", color: "#dc2626" });

  return (
    <div className="max-w-2xl">
      <DCard className="p-5">
        <DLabel>Activity</DLabel>
        <div className="mt-4 space-y-0">
          {events.map((e, i) => (
            <div key={i} className="flex gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: e.color }} />
                {i < events.length - 1 && <div className="w-px flex-1 mt-1" style={{ backgroundColor: "var(--border-subtle)" }} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>{e.label}{e.detail ? <span style={{ color: "var(--text-muted)" }}> · {e.detail}</span> : null}</p>
                {e.at && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{e.at}</p>}
              </div>
            </div>
          ))}
        </div>
      </DCard>
    </div>
  );
}
