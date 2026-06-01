"use client";

import React, { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Eye, Copy, ChevronRight, ChevronDown, FilePen, FileCheck, Briefcase, FolderKanban, TrendingUp, Send, X } from "lucide-react";
import {
  getQuote, fmt, duplicateQuote, updateQuoteStatus, convertQuoteToJob, convertQuoteToProject,
  setQuoteNotes, getQuoteActivity, type QuoteRecord,
} from "@/lib/quotes/data";
import { QUOTE_STATUS_STYLE, type QuoteStatus } from "@/lib/quotes/types";
import { getCustomer } from "@/lib/customers/data";
import QuotePreview from "@/components/quotes/QuotePreview";

const TABS = ["Details", "Notes", "Activity"];

// ─── Status action buttons per stage ─────────────────────
function StatusActions({
  status, onStatus,
}: {
  status: QuoteStatus;
  onStatus: (next: QuoteStatus) => void;
}) {
  if (status === "draft") return (
    <button onClick={() => onStatus("sent")}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
      style={{ backgroundColor: "#4f46e5", color: "#fff" }}>
      <Send className="w-3.5 h-3.5" /> Mark as Sent
    </button>
  );
  if (status === "sent" || status === "viewed") return (
    <>
      <button onClick={() => onStatus("approved")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        style={{ backgroundColor: "#10b981", color: "#fff" }}>
        <FileCheck className="w-3.5 h-3.5" /> Mark Approved
      </button>
      <button onClick={() => onStatus("rejected")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
        style={{ border: "1px solid #fecaca", color: "#dc2626" }}>
        Decline
      </button>
    </>
  );
  return null;
}

// ─── More actions menu (Duplicate / Convert / Edit / PDF) ──
function ActionsMenu({ status, onDuplicate, onConvertJob, onConvertProject }: {
  status: QuoteStatus;
  onDuplicate: () => void;
  onConvertJob: () => void;
  onConvertProject: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const canConvert = status === "approved" || status === "sent" || status === "viewed";
  const item = "flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-surface-2)]";

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
        More <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-xl overflow-hidden z-20 py-1"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.16)" }}>
          <button className={item} style={{ color: "var(--text-primary)" }} onClick={() => { setOpen(false); onDuplicate(); }}>
            <Copy className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /> Duplicate
          </button>
          {canConvert && <>
            <div className="my-1 h-px" style={{ backgroundColor: "var(--border-subtle)" }} />
            <button className={item} style={{ color: "var(--text-primary)" }} onClick={() => { setOpen(false); onConvertJob(); }}>
              <Briefcase className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /> Convert to Job
            </button>
            <button className={item} style={{ color: "var(--text-primary)" }} onClick={() => { setOpen(false); onConvertProject(); }}>
              <FolderKanban className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /> Convert to Project
            </button>
          </>}
          <div className="my-1 h-px" style={{ backgroundColor: "var(--border-subtle)" }} />
          <button className={item} style={{ color: "var(--text-muted)" }}>
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Line items table ─────────────────────────────────────
function LineItemsTable({ quoteId }: { quoteId: string }) {
  const quote = getQuote(quoteId)!;

  if (quote.lineItems.length === 0) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <div className="px-5 py-4 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No line items yet — add items to complete this quote.</p>
          {quote.internalNotes && (
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{quote.internalNotes}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {/* Header */}
      <div className="grid px-5 py-3 text-[10px] font-semibold uppercase tracking-wider"
        style={{ gridTemplateColumns: "3fr 0.6fr 1fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <span>Description</span><span className="text-right">Qty</span>
        <span className="text-right">Unit Price</span><span className="text-right">Total</span>
      </div>

      {quote.lineItems.map((item, i) => (
        <div key={item.id}
          className="grid px-5 py-3 items-start"
          style={{ gridTemplateColumns: "3fr 0.6fr 1fr 1fr", borderBottom: i < quote.lineItems.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
          <div>
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>{item.description}</p>
            {item.notes && <p className="text-xs mt-0.5 italic" style={{ color: "var(--text-muted)" }}>{item.notes}</p>}
          </div>
          <p className="text-sm text-right" style={{ color: "var(--text-secondary)" }}>{item.quantity}</p>
          <p className="text-sm text-right" style={{ color: "var(--text-secondary)" }}>{fmt(item.unitPrice)}</p>
          <p className="text-sm text-right font-medium" style={{ color: "var(--text-primary)" }}>{fmt(item.total)}</p>
        </div>
      ))}

      {/* Totals */}
      <div className="px-5 py-4 space-y-2" style={{ borderTop: "2px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <div className="flex justify-between">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>Subtotal</span>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fmt(quote.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>Tax</span>
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{fmt(quote.tax)}</span>
        </div>
        <div className="flex justify-between pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Total</span>
          <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{fmt(quote.total)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Details tab ──────────────────────────────────────────
function DetailsTab({ id }: { id: string }) {
  const quote    = getQuote(id)!;
  const customer = getCustomer(quote.customerId);
  const stageConfig = QUOTE_STATUS_STYLE[quote.status];

  const LinkedIcon = quote.linkedType === "job" ? Briefcase
    : quote.linkedType === "project" ? FolderKanban
    : quote.linkedType === "lead" ? TrendingUp
    : ChevronRight;

  const linkedHref = quote.linkedType === "job"     ? `/jobs/${quote.linkedId}`
    : quote.linkedType === "project"  ? `/projects/${quote.linkedId}`
    : quote.linkedType === "lead"     ? `/leads/${quote.linkedId}`
    : "#";

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* ── Left ─────────────────────────────────── */}
      <div className="space-y-4">
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Quote Info</p>
          <div className="space-y-2.5">
            <div className="flex justify-between"><span className="text-xs" style={{ color: "var(--text-muted)" }}>Status</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: stageConfig.bg, color: stageConfig.color }}>{stageConfig.label}</span>
            </div>
            <div className="flex justify-between"><span className="text-xs" style={{ color: "var(--text-muted)" }}>Total</span>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{quote.total > 0 ? fmt(quote.total) : "TBD"}</span>
            </div>
            {quote.expiresAt && (
              <div className="flex justify-between"><span className="text-xs" style={{ color: "var(--text-muted)" }}>Expires</span>
                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{quote.expiresAt}</span>
              </div>
            )}
            {quote.approvedAt && (
              <div className="flex justify-between"><span className="text-xs" style={{ color: "var(--text-muted)" }}>Approved</span>
                <span className="text-xs font-medium text-emerald-600">{quote.approvedAt}</span>
              </div>
            )}
            <div className="flex justify-between"><span className="text-xs" style={{ color: "var(--text-muted)" }}>Created</span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{quote.createdAt}</span>
            </div>
            <div className="flex justify-between gap-3"><span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>Salesperson</span>
              <span className="text-xs text-right" style={{ color: "var(--text-secondary)" }}>{quote.assignedTo ?? quote.createdBy}</span>
            </div>
            {quote.propertyLabel && (
              <div className="flex justify-between gap-3"><span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>Property</span>
                <span className="text-xs text-right" style={{ color: "var(--text-secondary)" }}>{quote.propertyLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* Customer */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Customer</p>
          {customer ? (
            <Link href={`/customers/${customer.id}`} className="flex items-start gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">{customer.initials}</div>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{customer.name}</p>
                {customer.phone && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{customer.phone}</p>}
                <p className="text-[10px] mt-1" style={{ color: "#4f46e5" }}>View account →</p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-bold shrink-0">{quote.customerInitials}</div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{quote.customerName}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Prospect — not yet a customer</p>
              </div>
            </div>
          )}
        </div>

        {/* Linked record */}
        {quote.linkedLabel && (
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Linked To</p>
            <Link href={linkedHref} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <LinkedIcon className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{quote.linkedLabel}</p>
                <p className="text-[10px] mt-0.5 capitalize" style={{ color: "var(--text-muted)" }}>{quote.linkedType}</p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            </Link>
          </div>
        )}
      </div>

      {/* ── Right ────────────────────────────────── */}
      <div className="col-span-2">
        <LineItemsTable quoteId={id} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState("Details");
  const [quote, setQuote] = useState(() => getQuote(id));
  const [showPreview, setShowPreview] = useState(false);

  if (!quote) {
    return (
      <div className="p-6">
        <Link href="/quotes" className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Quotes
        </Link>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Quote not found.</p>
      </div>
    );
  }

  const stageConfig = QUOTE_STATUS_STYLE[quote.status];
  const refresh = () => setQuote(getQuote(id));

  function changeStatus(next: QuoteStatus) { updateQuoteStatus(id, next); refresh(); }
  function doDuplicate() { const copy = duplicateQuote(id); if (copy) router.push(`/quotes/${copy.id}`); }
  function doConvertJob() { convertQuoteToJob(id); refresh(); }
  function doConvertProject() { convertQuoteToProject(id); refresh(); }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/quotes" className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeft className="w-4 h-4" /> Quotes
            </Link>
            <div className="w-px h-5 shrink-0" style={{ backgroundColor: "var(--border)" }} />
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <FilePen className="w-4.5 h-4.5 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-semibold font-mono" style={{ color: "var(--text-primary)" }}>{quote.quoteNumber}</h1>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: stageConfig.bg, color: stageConfig.color }}>{stageConfig.label}</span>
                  {quote.total > 0 && (
                    <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(quote.total)}</span>
                  )}
                </div>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                  {quote.title} · {quote.customerName}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusActions status={quote.status} onStatus={changeStatus} />
            <button onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
            <ActionsMenu status={quote.status} onDuplicate={doDuplicate} onConvertJob={doConvertJob} onConvertProject={doConvertProject} />
          </div>
        </div>

        <div className="flex items-center gap-0.5 px-6">
          {TABS.map(t => {
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)}
                className="relative px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap"
                style={{ color: active ? "#4f46e5" : "var(--text-muted)" }}>
                {t}
                {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-indigo-600" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {tab === "Details" && <DetailsTab id={id} />}
        {tab === "Notes" && <NotesTab quote={quote} onSaved={refresh} />}
        {tab === "Activity" && <ActivityTab quote={quote} />}
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 rounded-t-2xl" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Quote Preview</p>
              <button onClick={() => setShowPreview(false)} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
            </div>
            <QuotePreview data={{
              quoteNumber: quote.quoteNumber, title: quote.title, customerName: quote.customerName,
              propertyLabel: quote.propertyLabel, locationName: quote.locationName, expiresAt: quote.expiresAt,
              assignedTo: quote.assignedTo ?? quote.createdBy, createdAt: quote.createdAt,
              lineItems: quote.lineItems, subtotal: quote.subtotal, tax: quote.tax, total: quote.total,
              customerNotes: quote.customerNotes,
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────
function NotesTab({ quote, onSaved }: { quote: QuoteRecord; onSaved: () => void }) {
  const [customerNotes, setCustomerNotes] = useState(quote.customerNotes ?? "");
  const [internalNotes, setInternalNotes] = useState(quote.internalNotes ?? "");
  const [saved, setSaved] = useState(false);

  function save() {
    setQuoteNotes(quote.id, { customerNotes, internalNotes });
    setSaved(true); setTimeout(() => setSaved(false), 2000);
    onSaved();
  }
  const dirty = customerNotes !== (quote.customerNotes ?? "") || internalNotes !== (quote.internalNotes ?? "");

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Customer Notes <span className="normal-case font-normal">(shown on the quote)</span></label>
        <textarea value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} rows={4} placeholder="Terms, scope notes, scheduling…"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
      </div>
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Internal Notes <span className="normal-case font-normal">(team only)</span></label>
        <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3} placeholder="Internal context not shown to the customer…"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
      </div>
      <div className="flex justify-end">
        <button onClick={save} disabled={!dirty && !saved}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
          style={{ backgroundColor: saved ? "#10b981" : "#4f46e5" }}>{saved ? "Saved ✓" : "Save Notes"}</button>
      </div>
    </div>
  );
}

// ─── Activity tab ─────────────────────────────────────────
function ActivityTab({ quote }: { quote: QuoteRecord }) {
  const activity = [...getQuoteActivity(quote)].reverse();
  return (
    <div className="max-w-2xl rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>Activity</p>
      <div className="space-y-0">
        {activity.map((a, i) => (
          <div key={a.id} className="flex gap-3 pb-4 last:pb-0">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "#4f46e5" }} />
              {i < activity.length - 1 && <div className="w-px flex-1 mt-1" style={{ backgroundColor: "var(--border-subtle)" }} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>{a.message}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{a.actor} · {a.at}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
