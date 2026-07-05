"use client";

import React, { use, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, Eye, Copy, ChevronRight, FileCheck,
  Briefcase, FolderKanban, TrendingUp, Send, X, Download, Printer, Archive, ArchiveRestore,
  Trash2, RotateCcw, Link2, RefreshCw, XCircle, Clock, Receipt,
  FileText, Tag, DollarSign, CheckCircle, Calendar, MapPin, User, MessageSquare, Palette,
  Zap, LayoutTemplate, SlidersHorizontal, Layers, Plus, Upload, Image as ImageIcon,
  FileBox, Trash,
} from "lucide-react";
import {
  getQuote, fmt, duplicateQuote, updateQuoteStatus, convertQuoteToJob, convertQuoteToProject,
  getQuoteActivity, reopenQuote, resendQuote, archiveQuote, unarchiveQuote, deleteQuote,
  createInvoiceFromQuote, createReturnVisitFromQuote, type QuoteRecord, type QuoteActivityKind, type QuoteOption,
} from "@/lib/quotes/data";
import { getJob } from "@/lib/jobs/data";
import { downloadProposalPdf } from "@/lib/quotes/proposalPdf";
import { downloadCustomProposalPdf } from "@/lib/quotes/customProposalPdf";
import { resolveQuoteDesign, legacyDesignForQuoteDesign } from "@/lib/quotes/quoteDesigns";
import { proposalDocFromQuote } from "@/lib/quotes/proposalDoc";
import { getProposalBranding } from "@/lib/proposals/data";
import { getActiveDesign } from "@/lib/proposals/designs";
import { sectionsToBlocks } from "@/lib/quotes/blocks";
import { QUOTE_STATUS_STYLE, type QuoteStatus } from "@/lib/quotes/types";
import { getCustomer } from "@/lib/customers/data";
import ProposalFamilyDocument from "@/components/quotes/family/ProposalFamilyDocument";
import CustomProposalDocument, { type CustomDocData } from "@/components/quotes/custom/CustomProposalDocument";
import Commentable from "@/components/comments/Commentable";
import DetailTabs from "@/components/shared/DetailTabs";
import ActionsMenu from "@/components/shared/ActionsMenu";

// One adaptive detail page for every quote — the tabs are always present for
// consistency; each tab's CONTENT adapts to the quote mode + available data.
const TABS = ["Overview", "Pricing", "Options", "Files", "Activity"];

// Quote-mode badge (Quick / Template / Custom) — shown in the header next to status.
const QUOTE_MODE_META: Record<string, { label: string; color: string; icon: typeof Send }> = {
  quick:    { label: "Quick",    color: "#4f46e5", icon: Zap },
  template: { label: "Template", color: "#0891b2", icon: LayoutTemplate },
  custom:   { label: "Custom",   color: "#7c3aed", icon: SlidersHorizontal },
};
function quoteModeMeta(mode?: string) { return QUOTE_MODE_META[mode ?? "custom"] ?? QUOTE_MODE_META.custom; }

// Customer-decision + next-action are derived from status so every quote — however
// it was created — surfaces the same command-center signals on the Overview tab.
function customerDecision(status: QuoteStatus): { label: string; color: string } {
  switch (status) {
    case "draft":     return { label: "Not sent yet", color: "var(--text-muted)" };
    case "sent":      return { label: "Awaiting response", color: "#d97706" };
    case "viewed":    return { label: "Viewed by customer", color: "#0891b2" };
    case "approved":  return { label: "Approved", color: "#059669" };
    case "converted": return { label: "Approved · converted", color: "#059669" };
    case "rejected":  return { label: "Declined", color: "#dc2626" };
    case "expired":   return { label: "Expired", color: "#dc2626" };
    default:          return { label: "—", color: "var(--text-muted)" };
  }
}
function nextAction(status: QuoteStatus): string {
  switch (status) {
    case "draft":     return "Send the quote to the customer";
    case "sent":      return "Follow up — awaiting the customer's decision";
    case "viewed":    return "Follow up — customer has viewed it";
    case "approved":  return "Convert to a job or create an invoice";
    case "converted": return "Work is underway — create an invoice if needed";
    case "rejected":  return "Duplicate and revise, or archive";
    case "expired":   return "Revise & resend, or reopen as draft";
    default:          return "—";
  }
}

// Per-event icon + accent for the activity timeline (mirrors the lead/agreement
// activity styling). Amber is the default accent; completions are green, the
// rejection is red, status changes are indigo.
const QUOTE_KIND_META: Record<QuoteActivityKind, { icon: typeof Send; color: string; label: string }> = {
  created:    { icon: FileText,      color: "#d97706", label: "Created" },
  duplicated: { icon: Copy,          color: "#d97706", label: "Duplicated" },
  status:     { icon: RefreshCw,     color: "#4f46e5", label: "Status" },
  sent:       { icon: Send,          color: "#d97706", label: "Sent" },
  approved:   { icon: FileCheck,     color: "#059669", label: "Approved" },
  rejected:   { icon: XCircle,       color: "#b91c1c", label: "Rejected" },
  converted:  { icon: Briefcase,     color: "#059669", label: "Converted" },
  note:       { icon: MessageSquare, color: "#6b7280", label: "Note" },
  edited:     { icon: Pencil,        color: "#d97706", label: "Edited" },
};

// ─── Status-driven action bar ─────────────────────────────
// Visible buttons = the primary actions for the quote's current status; every
// other (uncommon / risky) action lives under More, with destructive actions
// (Archive, Delete) below a divider at the bottom.
type LucideIcon = typeof Send;
type MenuEntry = { label: string; icon: LucideIcon; onClick: () => void; danger?: boolean } | "divider";
type PrimaryBtn = { label: string; icon: LucideIcon; onClick: () => void; color: string; iconOnly?: boolean };

interface ActionHandlers {
  status: QuoteStatus;
  onPreview: () => void;
  onSend: () => void;
  onApprove: () => void;
  onReject: () => void;
  onExpire: () => void;
  onReopen: () => void;
  onResend: () => void;
  onDuplicate: () => void;
  onConvertJob: () => void;
  onConvertProject: () => void;
  onCreateInvoice: () => void;
  onDownloadPdf: () => void;
  onPrint: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  archived?: boolean;
}

function QuoteActionBar(h: ActionHandlers) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    try { navigator.clipboard?.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  // Reusable menu entries
  const PREVIEW: MenuEntry = { label: "Preview", icon: Eye, onClick: h.onPreview };
  const EDIT: MenuEntry = { label: "Edit", icon: Pencil, onClick: h.onEdit };
  const DUP:  MenuEntry = { label: "Duplicate", icon: Copy, onClick: h.onDuplicate };
  const PDF:  MenuEntry = { label: "Download PDF", icon: Download, onClick: h.onDownloadPdf };
  const PRINT: MenuEntry = { label: "Print", icon: Printer, onClick: h.onPrint };
  const COPY: MenuEntry = { label: copied ? "Link copied ✓" : "Copy Quote Link", icon: Link2, onClick: copyLink };
  const ARCH: MenuEntry = h.archived
    ? { label: "Unarchive", icon: ArchiveRestore, onClick: h.onUnarchive }
    : { label: "Archive", icon: Archive, onClick: h.onArchive };
  const DEL:  MenuEntry = { label: "Delete", icon: Trash2, onClick: h.onDelete, danger: true };

  let primary: PrimaryBtn[] = [];
  let menu: MenuEntry[] = [];

  switch (h.status) {
    case "draft":
      primary = [{ label: "Send Quote", icon: Send, onClick: h.onSend, color: "#4f46e5" }];
      menu = [PREVIEW, EDIT, DUP, PDF, PRINT, "divider", ARCH, DEL];
      break;
    case "sent":
    case "viewed":
      primary = [{ label: "Mark Approved", icon: FileCheck, onClick: h.onApprove, color: "#10b981" }];
      menu = [
        PREVIEW, EDIT, DUP,
        { label: "Resend Quote", icon: RefreshCw, onClick: h.onResend },
        COPY, PDF, PRINT,
        { label: "Mark Rejected", icon: XCircle, onClick: h.onReject },
        { label: "Mark Expired", icon: Clock, onClick: h.onExpire },
        "divider", ARCH, DEL,
      ];
      break;
    case "approved":
      primary = [{ label: "Convert to Job", icon: Briefcase, onClick: h.onConvertJob, color: "#4f46e5" }];
      menu = [
        PREVIEW, DUP, PDF, PRINT, COPY,
        { label: "Convert to Project", icon: FolderKanban, onClick: h.onConvertProject },
        { label: "Create Invoice", icon: Receipt, onClick: h.onCreateInvoice },
        "divider", ARCH,
      ];
      break;
    case "converted":
      primary = [];
      menu = [
        PREVIEW, DUP, PDF, PRINT, COPY,
        { label: "Create Invoice", icon: Receipt, onClick: h.onCreateInvoice },
        "divider", ARCH,
      ];
      break;
    case "rejected":
    case "expired":
      primary = [{ label: "Duplicate", icon: Copy, onClick: h.onDuplicate, color: "#4f46e5" }];
      menu = [
        PREVIEW,
        { label: "Reopen as Draft", icon: RotateCcw, onClick: h.onReopen },
        PDF, PRINT, "divider", ARCH, DEL,
      ];
      break;
  }

  return (
    <div className="flex items-center gap-2">
      {primary.map(p => (
        <button key={p.label} onClick={p.onClick} title={p.iconOnly ? p.label : undefined}
          className={`flex items-center gap-1.5 py-1.5 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90 ${p.iconOnly ? "px-2" : "px-3"}`}
          style={{ backgroundColor: p.color }}>
          <p.icon className="w-3.5 h-3.5" /> {!p.iconOnly && p.label}
        </button>
      ))}
      <ActionsMenu actions={menu.map((m, i) => m === "divider" ? null : ({
        label: m.label, icon: m.icon, onClick: m.onClick, danger: m.danger,
        separated: menu[i - 1] === "divider",
      }))} />
    </div>
  );
}

// ─── Line items table ─────────────────────────────────────
function LineItemsTable({ quoteId }: { quoteId: string }) {
  const quote = getQuote(quoteId)!;

  if (quote.lineItems.length === 0) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
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
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      {/* Header */}
      <div className="grid px-5 py-3 text-[10px] font-semibold uppercase tracking-wider"
        style={{ gridTemplateColumns: "3fr 0.6fr 1fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
        <span>Description</span><span className="text-right">Qty</span>
        <span className="text-right">Unit Price</span><span className="text-right">Total</span>
      </div>

      {quote.lineItems.map((item, i) => (
        <div key={item.id}
          className="grid px-5 py-3 items-start"
          style={{ gridTemplateColumns: "3fr 0.6fr 1fr 1fr", borderBottom: i < quote.lineItems.length - 1 ? "1px solid var(--border)" : "none" }}>
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
        <div className="flex justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Total</span>
          <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{fmt(quote.total)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Overview helpers (mirror Agreement/Customer overview) ─
function expiryInfo(expiresAt?: string): { text: string; overdue: boolean } | null {
  if (!expiresAt) return null;
  const t = new Date(expiresAt).getTime();
  if (isNaN(t)) return { text: "Valid", overdue: false };
  const days = Math.round((t - Date.now()) / 86_400_000);
  if (days < 0)  return { text: `Expired ${Math.abs(days)}d ago`, overdue: true };
  if (days === 0) return { text: "Expires today", overdue: true };
  return { text: `${days}d left`, overdue: false };
}

function OvCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-4 ${className}`} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>{title}</p>
      {children}
    </div>
  );
}

function DetailField({ icon: Icon, label, value }: { icon?: LucideIcon; label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-sm font-medium break-words" style={{ color: "var(--text-primary)" }}>{value || "—"}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, count, action, children, className = "" }: {
  title: string; count: number; action?: { label: string; onClick: () => void }; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-xl overflow-hidden flex flex-col ${className}`} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
          {count > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{count}</span>}
        </div>
        {action && <button onClick={action.onClick} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">{action.label}</button>}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}

// ─── Overview tab — the quote command center ──────────────
function OverviewTab({ id, onTab }: { id: string; onTab: (tab: string) => void }) {
  const quote    = getQuote(id)!;
  const customer = getCustomer(quote.customerId);
  const stageConfig = QUOTE_STATUS_STYLE[quote.status];
  const activity = [...getQuoteActivity(quote)].reverse();
  const mode = quoteModeMeta(quote.quoteMode);
  const decision = customerDecision(quote.status);
  const next = nextAction(quote.status);

  const LinkedIcon = quote.linkedType === "job" ? Briefcase
    : quote.linkedType === "project" ? FolderKanban
    : quote.linkedType === "lead" ? TrendingUp
    : ChevronRight;
  const linkedHref = quote.linkedType === "job"     ? `/jobs/${quote.linkedId}`
    : quote.linkedType === "project"  ? `/projects/${quote.linkedId}`
    : quote.linkedType === "lead"     ? `/leads/${quote.linkedId}`
    : "#";

  const exp = expiryInfo(quote.expiresAt);
  const salesperson = quote.assignedTo ?? quote.createdBy;

  const summary: { icon: LucideIcon; label: string; value: string; sub?: string; accent?: string }[] = [
    { icon: CheckCircle, label: "Status", value: stageConfig.label, accent: stageConfig.color, sub: quote.archived ? "Archived" : quote.linkedType ? `Linked ${quote.linkedType}` : "Quote" },
    { icon: DollarSign, label: "Total", value: quote.total > 0 ? fmt(quote.total) : "TBD", sub: quote.total > 0 ? `${fmt(quote.subtotal)} + ${fmt(quote.tax)} tax` : `${quote.lineItems.length} item${quote.lineItems.length === 1 ? "" : "s"}` },
    { icon: Clock, label: "Expiration", value: quote.expiresAt ?? "—", accent: exp?.overdue ? "#dc2626" : undefined, sub: exp ? exp.text : "No expiry" },
    { icon: FileCheck, label: "Customer Decision", value: decision.label, accent: decision.color },
    { icon: TrendingUp, label: "Next Action", value: next },
  ];

  return (
    <div className="h-full flex flex-col gap-5">
      {/* ── Summary cards ───────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 shrink-0">
        {summary.map(c => (
          <div key={c.label} className="rounded-xl px-3 py-2.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <c.icon className="w-3 h-3" style={{ color: c.accent ?? "var(--text-muted)" }} />
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{c.label}</p>
            </div>
            <p className="text-sm font-bold leading-tight truncate" style={{ color: c.accent ?? "var(--text-primary)" }}>{c.value}</p>
            {c.sub && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Snapshot grid: quote details (left) · customer/links/activity (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">
        {/* LEFT — wide quote details card */}
        <OvCard title="Quote Details" className="lg:col-span-2 h-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <DetailField icon={FileText}    label="Quote #"  value={<span className="font-mono">{quote.quoteNumber}</span>} />
            <DetailField icon={Tag}         label="Title"    value={quote.title} />
            <DetailField icon={mode.icon}   label="Quote Mode" value={<span style={{ color: mode.color, fontWeight: 600 }}>{mode.label}</span>} />
            <DetailField icon={CheckCircle} label="Status"   value={<span style={{ color: stageConfig.color, fontWeight: 600 }}>{stageConfig.label}</span>} />
            <DetailField icon={FileCheck}   label="Customer Decision" value={<span style={{ color: decision.color, fontWeight: 600 }}>{decision.label}</span>} />
            <DetailField icon={TrendingUp}  label="Next Action" value={next} />
            <DetailField icon={DollarSign}  label="Total"    value={quote.total > 0 ? fmt(quote.total) : "TBD"} />
            <DetailField icon={DollarSign}  label="Subtotal" value={fmt(quote.subtotal)} />
            <DetailField icon={Receipt}     label="Tax"      value={fmt(quote.tax)} />
            <DetailField icon={Calendar}    label="Created"  value={quote.createdAt} />
            <DetailField icon={Clock}       label="Expires"  value={quote.expiresAt ?? "—"} />
            {quote.approvedAt && (
              <DetailField icon={FileCheck} label="Approved" value={<span style={{ color: "#059669", fontWeight: 600 }}>{quote.approvedAt}</span>} />
            )}
            <DetailField icon={User}        label="Salesperson" value={salesperson} />
            {quote.propertyLabel && (
              <DetailField icon={MapPin}    label="Property" value={quote.propertyLabel} />
            )}
          </div>
        </OvCard>

        {/* RIGHT — customer · linked · recent activity (fills to match the left card) */}
        <div className="h-full flex flex-col gap-4">
          <OvCard title="Customer">
            {customer ? (
              <Link href={`/customers/${customer.id}`} className="group flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-[#e5e0db] flex items-center justify-center text-[#5c5545] text-[10px] font-bold shrink-0">{customer.initials}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{customer.name}</p>
                  {customer.phone && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{customer.phone}</p>}
                </div>
                <span className="text-[10px] shrink-0 whitespace-nowrap inline-flex items-center gap-0.5 transition-all group-hover:gap-1.5" style={{ color: "#4f46e5" }}>View account <span className="transition-transform group-hover:translate-x-0.5">→</span></span>
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
          </OvCard>

          {quote.linkedLabel && (
            <OvCard title="Linked To">
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
            </OvCard>
          )}

          <SectionCard title="Recent Activity" count={activity.length} action={{ label: "View all", onClick: () => onTab("Activity") }} className="flex-1 min-h-0">
            {activity.length === 0 ? (
              <div className="px-4 py-8 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No activity yet</p></div>
            ) : activity.slice(0, 4).map((a, i) => {
              const meta = QUOTE_KIND_META[a.kind];
              const Icon = meta.icon;
              const last = i === Math.min(3, activity.length - 1);
              return (
                <div key={a.id} className="flex items-center px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors" style={!last ? { borderBottom: "1px solid var(--border)" } : undefined}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mr-2.5" style={{ backgroundColor: meta.color + "1a" }}>
                    <Icon className="w-3 h-3" style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug truncate" style={{ color: "var(--text-primary)" }}>{a.message}</p>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{a.actor} · {a.at}</p>
                  </div>
                </div>
              );
            })}
          </SectionCard>
        </div>
      </div>

      {/* ── Line items — full-width card that fills the remaining vertical space ── */}
      <div className="flex-1 min-h-0 rounded-xl flex flex-col overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Line Items</p>
            {quote.lineItems.length > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{quote.lineItems.length}</span>}
          </div>
          <button onClick={() => onTab("Pricing")} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View pricing</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {quote.lineItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No line items yet</p>
              <button onClick={() => onTab("Pricing")} className="mt-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">Add pricing →</button>
            </div>
          ) : (
            <>
              {quote.lineItems.map((item, i) => (
                <div key={item.id} className="grid px-4 py-2.5 items-start" style={{ gridTemplateColumns: "3fr 0.6fr 1fr 1fr", borderBottom: "1px solid var(--border)" }}>
                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{item.name || item.description}</p>
                    {item.name && item.description && item.name !== item.description && <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{item.description}</p>}
                  </div>
                  <p className="text-sm text-right" style={{ color: "var(--text-secondary)" }}>{item.quantity}</p>
                  <p className="text-sm text-right" style={{ color: "var(--text-secondary)" }}>{fmt(item.unitPrice)}</p>
                  <p className="text-sm text-right font-medium" style={{ color: "var(--text-primary)" }}>{fmt(item.total)}</p>
                </div>
              ))}
              <div className="flex justify-end px-4 py-3 gap-6" style={{ backgroundColor: "var(--bg-surface-2)" }}>
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>Subtotal {fmt(quote.subtotal)} · Tax {fmt(quote.tax)}</span>
                <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Total {fmt(quote.total)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Return-visit modal — offered when a job-linked quote is approved ────────
// One step sets up the whole return: a new work order on the job seeded with
// the quoted lines (so billing matches the quote exactly), the job parked on
// Waiting on Parts, and an optional down-payment invoice.
function ReturnVisitModal({ quote, onClose }: { quote: QuoteRecord; onClose: () => void }) {
  const router = useRouter();
  const job = quote.jobId ? getJob(quote.jobId) : undefined;
  const [deposit, setDeposit] = useState("");
  const [created, setCreated] = useState<{ workOrderId: string; depositId?: string } | null>(null);
  const depositVal = parseFloat(deposit) || 0;

  function create() {
    const res = createReturnVisitFromQuote(quote.id, { depositAmount: depositVal > 0 ? depositVal : undefined });
    if (res) setCreated({ workOrderId: res.workOrder.id, depositId: res.deposit?.id });
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {created ? "Return visit ready" : "Set up the return visit"}
          </p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {created ? (
          <div className="p-5 space-y-3">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              A return work order was created on <span className="font-medium" style={{ color: "var(--text-primary)" }}>{job?.title ?? "the job"}</span> with the quoted lines,
              and the job is now <span className="font-medium" style={{ color: "#92400e" }}>Waiting on Parts</span>.
              {created.depositId && <> A <span className="font-medium" style={{ color: "var(--text-primary)" }}>{fmt(depositVal)}</span> down-payment invoice is ready to collect.</>}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              {created.depositId && (
                <button onClick={() => router.push(`/invoices/${created.depositId}`)}
                  className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  Collect deposit
                </button>
              )}
              <button onClick={() => router.push(`/work-orders/${created.workOrderId}`)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
                View work order
              </button>
              <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                This quote was raised on <span className="font-medium" style={{ color: "var(--text-primary)" }}>{job?.title ?? "a job"}</span>.
                Creating the return visit seeds a new work order with the {quote.lineItems.length} quoted line{quote.lineItems.length === 1 ? "" : "s"} ({fmt(quote.total)})
                and parks the job on <span className="font-medium">Waiting on Parts</span> until it's rescheduled.
              </p>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Down payment to collect now <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
                <input type="number" min={0} step="0.01" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0.00" autoFocus
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                {depositVal > 0 && <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>A {fmt(depositVal)} deposit invoice will be created — it's credited automatically on the final invoice.</p>}
              </div>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Skip</button>
              <button onClick={create} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#10b981" }}>
                Create return visit{depositVal > 0 ? ` + ${fmt(depositVal)} deposit` : ""}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState("Overview");
  const [quote, setQuote] = useState(() => getQuote(id));
  const [showPreview, setShowPreview] = useState(false);
  const [showReturnVisit, setShowReturnVisit] = useState(false);

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

  const refresh = () => setQuote(getQuote(id));

  function changeStatus(next: QuoteStatus) { updateQuoteStatus(id, next); refresh(); }
  function doDuplicate() { const copy = duplicateQuote(id); if (copy) router.push(`/quotes/${copy.id}`); }
  function doConvertJob() { const job = convertQuoteToJob(id); if (job) router.push(`/jobs/${job.id}`); else refresh(); }
  function doConvertProject() { const p = convertQuoteToProject(id); if (p) router.push(`/projects/${p.id}`); else refresh(); }
  function doReopen() { reopenQuote(id); refresh(); }
  function doResend() { resendQuote(id); refresh(); }
  function doArchive() { archiveQuote(id); router.push("/quotes"); }
  function doUnarchive() { unarchiveQuote(id); refresh(); }
  function doDelete() {
    if (!window.confirm(`Delete ${quote!.quoteNumber}? This can't be undone.`)) return;
    deleteQuote(id); router.push("/quotes");
  }
  function doCreateInvoice() { const inv = createInvoiceFromQuote(id); if (inv) router.push(`/invoices/${inv.id}`); }

  // The full customer-facing proposal used by Preview, instant PDF, and Print —
  // includes every section the quote carries, not just line items.
  const docData = proposalDocFromQuote(quote);
  // Customer-facing Quote Design saved on the quote (drives layout + style). The
  // design is chosen in the quote editor — the detail page only views it.
  const resolvedDesign = resolveQuoteDesign(quote.quoteDesignId);

  // Custom proposals are built block-by-block in the Custom Proposal Builder, so
  // they must render with the SAME block renderer (CustomProposalDocument) here —
  // the family/sections renderer would not match what the rep built.
  const isCustom = quote.quoteMode === "custom";
  const customDoc: CustomDocData | null = isCustom ? (() => {
    const blocks = (quote.blocks && quote.blocks.length) ? quote.blocks : sectionsToBlocks(quote.sections ?? [], quote.title);
    const taxRatePct = quote.subtotal > 0 ? Math.round((quote.tax / quote.subtotal) * 1000) / 10 : 0;
    return {
      branding: getProposalBranding(), quoteNumber: quote.quoteNumber, customerName: quote.customerName,
      locationName: quote.locationName, propertyLabel: quote.propertyLabel,
      createdAt: quote.createdAt, expiresAt: quote.expiresAt,
      blocks, lineItems: quote.lineItems, options: quote.options ?? [],
      subtotal: quote.subtotal, tax: quote.tax, total: quote.total, taxRatePct,
      monthly: quote.pricing?.monthly, customerNotes: quote.customerNotes, stamp: docData.stamp,
    };
  })() : null;
  const customDesign = getActiveDesign();

  // PDF: custom proposals use a block-aware generator (matches the builder); other
  // modes use the section/family PDF generator. Both download a file directly.
  function downloadPdf() {
    if (isCustom && customDoc) { void downloadCustomProposalPdf(customDoc, customDesign); return; }
    downloadProposalPdf(docData, legacyDesignForQuoteDesign(resolvedDesign.design.id));
  }

  // Print = open the system print dialog showing only the quote document.
  function printQuote() {
    const prevTitle = document.title;
    document.title = `${quote!.quoteNumber} — ${quote!.customerName}`;
    const restore = () => { document.title = prevTitle; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/quotes" className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeft className="w-4 h-4" /> Quotes
            </Link>
            <div className="w-px h-5 shrink-0" style={{ backgroundColor: "var(--border)" }} />
            <Commentable anchor={{ recordType: "quote", recordId: id, recordLabel: quote.quoteNumber }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-semibold font-mono" style={{ color: "var(--text-primary)" }}>{quote.quoteNumber}</h1>
                </div>
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                  {quote.title} · {quote.customerName}
                </p>
              </div>
            </div>
            </Commentable>
          </div>
          <div className="shrink-0">
            <QuoteActionBar
              status={quote.status}
              onPreview={() => setShowPreview(true)}
              onSend={() => changeStatus("sent")}
              onApprove={() => { changeStatus("approved"); if (quote.jobId) setShowReturnVisit(true); }}
              onReject={() => changeStatus("rejected")}
              onExpire={() => changeStatus("expired")}
              onReopen={doReopen}
              onResend={doResend}
              onDuplicate={doDuplicate}
              onConvertJob={doConvertJob}
              onConvertProject={doConvertProject}
              onCreateInvoice={doCreateInvoice}
              onDownloadPdf={downloadPdf}
              onPrint={printQuote}
              onEdit={() => router.push(`/quotes/${id}/${quote.quoteMode === "quick" ? "quick" : "custom"}`)}
              onArchive={doArchive}
              onUnarchive={doUnarchive}
              onDelete={doDelete}
              archived={!!quote.archived}
            />
          </div>
        </div>

        <DetailTabs tabs={TABS} active={tab} onChange={setTab} className="px-6 py-2" />
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {tab === "Overview" && <OverviewTab id={id} onTab={setTab} />}
        {tab === "Pricing"  && <PricingTab quote={quote} onEdit={() => router.push(`/quotes/${id}/${quote.quoteMode === "quick" ? "quick" : quote.quoteMode === "custom" ? "pricing" : "custom"}`)} />}
        {tab === "Options"  && <OptionsTab quote={quote} onEdit={() => router.push(`/quotes/${id}/${quote.quoteMode === "quick" ? "quick" : "custom"}`)} />}
        {tab === "Files"    && <FilesTab quote={quote} onDownloadPdf={downloadPdf} />}
        {tab === "Activity" && <ActivityTab quote={quote} />}
      </div>

      {/* Preview modal — flex-col card: fixed header + scrolling body (clipped by
          the card's rounded overflow, so the document never spills past the chrome). */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="w-full max-w-3xl max-h-[92vh] rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)" }}>
            <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Proposal Preview</p>
              <div className="flex items-center gap-2">
                {!isCustom && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>
                    <Palette className="w-3.5 h-3.5" /> {resolvedDesign.design.name}
                  </span>
                )}
                <button onClick={() => setShowPreview(false)} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: "#e5e7eb" }}>
              {isCustom && customDoc
                ? <CustomProposalDocument data={customDoc} design={customDesign} />
                : <ProposalFamilyDocument data={docData} family={resolvedDesign.family} variant={resolvedDesign.variant} />}
            </div>
          </div>
        </div>
      )}

      {/* Return-visit setup — offered right after approving a job-linked quote. */}
      {showReturnVisit && <ReturnVisitModal quote={quote} onClose={() => { setShowReturnVisit(false); refresh(); }} />}

      {/* Hidden printable document — the only thing shown when Print triggers. */}
      <div className="print-doc" aria-hidden>
        {isCustom && customDoc
          ? <CustomProposalDocument data={customDoc} shadow={false} design={customDesign} />
          : <ProposalFamilyDocument data={docData} shadow={false} family={resolvedDesign.family} variant={resolvedDesign.variant} />}
      </div>
    </div>
  );
}

// ─── Pricing tab — where the money lives ──────────────────
function PricingTab({ quote, onEdit }: { quote: QuoteRecord; onEdit: () => void }) {
  const pricing = quote.pricing;
  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Pricing</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Line items, taxes, and totals for this quote.</p>
        </div>
        <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          <Pencil className="w-3.5 h-3.5" /> Edit Pricing
        </button>
      </div>

      <LineItemsTable quoteId={quote.id} />

      {/* Internal pricing summary — custom quotes that ran the pricing wizard. Team-only. */}
      {pricing && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Internal Pricing Summary</p>
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>Internal only</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 px-5 py-4">
            <DetailField icon={DollarSign} label="Total Cost" value={fmt(pricing.totalCost)} />
            <DetailField icon={DollarSign} label="Sell Price" value={fmt(pricing.sellPrice)} />
            <DetailField icon={TrendingUp} label="Gross Profit" value={fmt(pricing.grossProfit)} />
            <DetailField icon={TrendingUp} label="Gross Margin" value={pct(pricing.grossMargin)} />
            <DetailField icon={TrendingUp} label="Net Profit" value={fmt(pricing.netProfit)} />
            <DetailField icon={TrendingUp} label="Net Margin" value={pct(pricing.netMargin)} />
            {pricing.monthly > 0 && <DetailField icon={Receipt} label="Est. Monthly" value={`${fmt(pricing.monthly)}/mo`} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Options tab — multiple choices, alternates, add-ons ──
function OptionsTab({ quote, onEdit }: { quote: QuoteRecord; onEdit: () => void }) {
  const options = quote.options ?? [];
  const addOns = quote.lineItems.filter(li => li.optional);
  const empty = options.length === 0 && addOns.length === 0;

  if (empty) {
    return (
      <div className="rounded-xl py-16 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <Layers className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No alternate options added</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Add Good / Better / Best options or optional add-ons to give the customer choices.</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
            <Plus className="w-4 h-4" /> Add Option
          </button>
          <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <Plus className="w-4 h-4" /> Add Add-On
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {options.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Options <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>· {options.length}</span></h2>
            <button onClick={onEdit} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Edit options</button>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {options.map(o => <OptionCardLg key={o.id} o={o} />)}
          </div>
        </div>
      )}

      {addOns.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Optional Add-ons <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>· {addOns.length}</span></h2>
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            {addOns.map((li, i) => (
              <div key={li.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: i < addOns.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{li.name || li.description}</p>
                  {li.name && li.description && li.name !== li.description && <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{li.description}</p>}
                </div>
                <p className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{fmt(li.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionCardLg({ o }: { o: QuoteOption }) {
  const accent = "#4f46e5";
  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ backgroundColor: "var(--bg-surface)", border: `1px solid ${o.featured ? accent : "var(--border-subtle)"}`, boxShadow: o.featured ? `0 0 0 3px ${accent}1a` : "var(--shadow-card)" }}>
      {o.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={o.image} alt={o.name} className="w-full" style={{ height: "120px", objectFit: "cover" }} />
      )}
      <div className="p-3.5 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 flex-wrap">
          {o.tier && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: accent + "1a", color: accent }}>{o.tier}</span>}
          {o.featured && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>Recommended</span>}
        </div>
        <p className="text-sm font-semibold mt-1.5" style={{ color: "var(--text-primary)" }}>{o.name}</p>
        {(o.brand || o.model) && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{[o.brand, o.model].filter(Boolean).join(" · ")}</p>}
        {o.description && <p className="text-xs mt-1.5 leading-snug" style={{ color: "var(--text-secondary)" }}>{o.description}</p>}
        <div className="mt-3 pt-2.5 flex items-end justify-between" style={{ borderTop: "1px solid var(--border)" }}>
          <div>
            <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{fmt(o.price)}</p>
            {o.monthlyPrice ? <p className="text-[11px] font-semibold" style={{ color: accent }}>{fmt(o.monthlyPrice)}/mo</p> : null}
          </div>
          {(o.efficiency || o.warranty) && <p className="text-[10px] text-right" style={{ color: "var(--text-muted)" }}>{[o.efficiency, o.warranty].filter(Boolean).join(" · ")}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Files tab — attachments & generated documents (mock) ─
interface QuoteFileEntry { id: string; name: string; kind: string; size?: string }
function FilesTab({ quote, onDownloadPdf }: { quote: QuoteRecord; onDownloadPdf: () => void }) {
  const [files, setFiles] = useState<QuoteFileEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).map((f, i) => ({
      id: `f-${files.length + i}-${f.name}`, name: f.name, kind: f.type || "file",
      size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
    }));
    if (picked.length) setFiles(p => [...picked, ...p]);
    if (inputRef.current) inputRef.current.value = "";
  }
  function remove(fid: string) { setFiles(p => p.filter(f => f.id !== fid)); }

  return (
    <div className="flex flex-col gap-4">
      <input ref={inputRef} type="file" multiple className="hidden" onChange={onUpload} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Files</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Photos, documents, brochures, and the generated proposal PDF for {quote.quoteNumber}.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => inputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}><Upload className="w-4 h-4" /> Upload File</button>
          <button disabled className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium opacity-50" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}><ImageIcon className="w-4 h-4" /> Attach from Media Library</button>
          <button onClick={onDownloadPdf} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><FileBox className="w-4 h-4" /> Generate PDF</button>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <FileBox className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No files yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Upload photos & documents or generate the proposal PDF. (Local preview — not saved to a server.)</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          {files.map((f, i) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < files.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-surface-2)" }}>
                {f.kind.startsWith("image/") ? <ImageIcon className="w-4 h-4" style={{ color: "#4f46e5" }} /> : <FileText className="w-4 h-4" style={{ color: "#4f46e5" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{f.name}</p>
                {f.size && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{f.size}</p>}
              </div>
              <button title="Remove" onClick={() => remove(f.id)} className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--text-muted)" }}><Trash className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Activity tab ─────────────────────────────────────────
// Full-width timeline matching the lead & agreement activity tabs: an icon on
// the connector line, a uniform surface container per event with a category
// badge, the date/time on the right, and the actor in the footer. Newest first.
function timeOf(iso?: string): string | undefined {
  if (!iso) return undefined;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return undefined;
  return new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function ActivityTab({ quote }: { quote: QuoteRecord }) {
  const activity = [...getQuoteActivity(quote)].reverse();

  if (activity.length === 0) {
    return (
      <div className="py-12 text-center rounded-xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No activity yet</p>
      </div>
    );
  }

  return (
    <div>
      {activity.map((a, i) => {
        const meta = QUOTE_KIND_META[a.kind];
        const Icon = meta.icon;
        const last = i === activity.length - 1;
        const time = timeOf(a.iso);
        return (
          <div key={a.id} className="flex gap-3">
            {/* Icon + connector */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center z-10"
                style={{ backgroundColor: meta.color + "1a", border: `1px solid ${meta.color}33` }}>
                <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
              </div>
              {!last && <div className="w-px flex-1 my-1" style={{ backgroundColor: "var(--border-subtle)" }} />}
            </div>

            {/* Content container — uniform regardless of content */}
            <div className="flex-1 min-w-0 rounded-xl px-4 py-3 mb-3 flex flex-col"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", minHeight: 80 }}>
              <div className="flex items-start justify-between gap-3">
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0"
                  style={{ backgroundColor: meta.color + "1a", color: meta.color }}>{meta.label}</span>
                <div className="text-right shrink-0">
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{a.at}</p>
                  {time && <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{time}</p>}
                </div>
              </div>
              <p className="text-sm font-medium mt-1.5 break-words leading-relaxed" style={{ color: "var(--text-primary)" }}>{a.message}</p>
              <div className="flex items-center gap-1.5 mt-auto pt-1.5">
                <User className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{a.actor || "System"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
