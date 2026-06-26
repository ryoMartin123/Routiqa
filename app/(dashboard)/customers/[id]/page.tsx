"use client";

import React, { use, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft, Pencil, Trash2,
  Phone, Mail, MapPin, Building2, Calendar,
  CheckCircle, Circle, AlertCircle,
  ChevronRight, Plus, MessageSquare, Info, MoreVertical,
  UserPlus, User, Home, TrendingUp, Tag, Layers,
  Briefcase, ClipboardList, FilePen, FileCheck,
  Receipt, DollarSign, FileText, RefreshCw,
  Image as ImageIcon, Paperclip, Smartphone, CheckSquare,
  Search, Clock, Star, ArrowDownUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/shared/StatusBadge";
import {
  getCustomer, getContacts, getProperties, saveProperties, getEquipment, getJobs, getLeads, getNotes, getTasks, addNote,
  type Contact, type Property, type CustomerType, type CustomerStatus,
  type JobStatus, type LeadStatus, type NoteType, type EquipmentStatus, type PropertyType,
  type CustomerNote,
} from "@/lib/customers/data";
import { getAllCompanies, getAllLocations } from "@/lib/hierarchy/data";
import { formatPhone, validatePhone, validateEmail } from "@/lib/utils/validation";
import { getAgreementsForCustomer, AGREEMENT_STATUS_META } from "@/lib/agreements/data";
import { QUOTE_STATUS_STYLE, INVOICE_STATUS_STYLE } from "@/lib/quotes/types";
import { getQuotesForCustomer, getInvoicesForCustomer, fmt as fmtCurrency } from "@/lib/quotes/data";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomers } from "@/components/providers/CustomerProvider";
import EditCustomerModal from "@/components/customers/EditCustomerModal";
import LeadWizard from "@/components/leads/LeadWizard";
import QuoteTypeChooser from "@/components/quotes/create/QuoteTypeChooser";
import { AddressAutocomplete, EMPTY_ADDRESS, type ParsedAddress } from "@/components/address/AddressAutocomplete";
import UiSelect from "@/components/ui/Select";
import PhotoGallery from "@/components/files/PhotoGallery";
import { getActivityEvents } from "@/lib/activity/data";
import { type ActivityEvent, type EventType } from "@/lib/activity/types";
import Commentable from "@/components/comments/Commentable";
import DetailTabs from "@/components/shared/DetailTabs";
import RecordTasks from "@/components/tasks/RecordTasks";
import AgreementSummaryCard from "@/components/agreements/AgreementSummaryCard";
import JobWizard from "@/components/jobs/JobWizard";
import { getWorkOrder, type WorkOrder, type WorkOrderStatus } from "@/lib/jobs/data";

// ─── Badge helpers ────────────────────────────────────────
// Saturated dot colors for the shared StatusBadge (dot + text) indicator.
function typeDot(type: CustomerType) {
  return type === "Commercial" ? "#f59e0b" : "#6b7280";
}
function statusDot(status: CustomerStatus) {
  return status === "Customer" ? "#10b981" : "#6366f1";
}
function jobStatusStyle(s: JobStatus) {
  if (s === "Completed")   return { bg: "#d1fae5", color: "#065f46" };
  if (s === "Scheduled")   return { bg: "#e0e7ff", color: "#3730a3" };
  if (s === "In Progress") return { bg: "#fef3c7", color: "#92400e" };
  return { bg: "var(--bg-input)", color: "var(--text-muted)" };
}
function leadStatusStyle(s: LeadStatus) {
  if (s === "Won")       return { bg: "#d1fae5", color: "#065f46" };
  if (s === "Quoted")    return { bg: "#e0e7ff", color: "#3730a3" };
  if (s === "Contacted") return { bg: "#fef3c7", color: "#92400e" };
  if (s === "Lost")      return { bg: "#fee2e2", color: "#991b1b" };
  return { bg: "var(--bg-input)", color: "var(--text-muted)" };
}
const NOTE_ICON: Record<NoteType, typeof MessageSquare> = {
  note: MessageSquare, call: Phone, email: Mail, visit: MapPin,
};
const WO_STATUS_STYLE: Record<WorkOrderStatus, { label: string; bg: string; color: string }> = {
  pending:     { label: "Pending",     bg: "var(--bg-input)", color: "var(--text-muted)" },
  in_progress: { label: "In Progress", bg: "#fef3c7",         color: "#92400e" },
  completed:   { label: "Completed",   bg: "#d1fae5",         color: "#065f46" },
};

const TABS = ["Overview", "Contacts", "Properties", "Equipment", "Jobs", "Tasks", "Leads", "Agreements", "Photos & Files", "Notes", "Communication", "Billing", "History"];

// ─── Account structure display label ─────────────────────
const STRUCTURE_LABEL: Record<string, string> = {
  residential:         "Single Property",
  property_management: "Property Management",
  multi_site:          "Multi-Site",
  commercial:          "Commercial",
  other:               "Other",
};

// ─── Pill + hover-details popover ─────────────────────────
// Replaces a noisy row of inline status/type pills with a single subtle "ⓘ"
// trigger; the pills surface on hover (or keyboard focus) only when wanted.
function Pill({ text, style }: { text: string; style: React.CSSProperties }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={style}>
      {text}
    </span>
  );
}

function HoverInfo({ rows }: {
  rows: { label: string; node: React.ReactNode }[];
}) {
  return (
    <span className="relative inline-flex group/info align-middle shrink-0">
      <button
        type="button"
        aria-label="Show details"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors hover:bg-[var(--bg-surface-2)]"
        style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
      >
        <Info className="w-3 h-3" />
      </button>
      {/* Opens BELOW the trigger; pt-2 is a hover "bridge" so moving the
          cursor into the panel keeps it open. */}
      <span
        role="tooltip"
        className={cn(
          "absolute top-full left-0 pt-2 z-30 opacity-0 invisible transition-opacity duration-150",
          "group-hover/info:opacity-100 group-hover/info:visible group-focus-within/info:opacity-100 group-focus-within/info:visible",
        )}
      >
        <span
          className="flex flex-col divide-y rounded-xl overflow-hidden min-w-[200px]"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)", borderColor: "var(--border-subtle)" }}
        >
          {rows.map(r => (
            <span key={r.label} className="flex items-center justify-between gap-4 px-3 py-2" style={{ borderColor: "var(--border-subtle)" }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{r.label}</span>
              {r.node}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

// ─── Overview tab ─────────────────────────────────────────
function OverviewTab({ id, onTab }: { id: string; onTab: (tab: string) => void }) {
  const customer    = getCustomer(id)!;
  const contacts    = getContacts(id);
  const properties  = getProperties(id);
  const jobs        = getJobs(id);
  const tasks       = getTasks(id);
  const agreements  = getAgreementsForCustomer(id, customer.name);
  const quotes      = getQuotesForCustomer(id);
  const invoices    = getInvoicesForCustomer(id);
  const events      = getActivityEvents(id);

  const company     = getAllCompanies().find(c => c.id === customer.companyId);
  const location    = getAllLocations().find(l => l.id === customer.locationId);

  const primary     = contacts.find(c => c.isPrimary) ?? contacts[0];
  const primaryProp = properties.find(p => p.isPrimary) ?? properties[0];

  const openJobs    = jobs.filter(j => j.status === "Scheduled" || j.status === "In Progress");
  const scheduledJobs = jobs.filter(j => j.status === "Scheduled");
  const inProgress  = jobs.filter(j => j.status === "In Progress");
  const openTasks   = tasks.filter(t => t.status !== "completed");
  const openQuotes  = quotes.filter(q => !["accepted", "converted", "declined", "expired", "paid"].includes(q.status));
  const openInvoices = invoices.filter(i => i.balanceDue > 0);
  const pastDue     = invoices.filter(i => i.status === "past_due");

  const quoteValue  = openQuotes.reduce((s, q) => s + q.total, 0);
  const outstanding = openInvoices.reduce((s, i) => s + i.balanceDue, 0);

  // Active agreements (everything except canceled) for the left-column summary.
  const activeAgreements = agreements.filter(a => a.status !== "canceled");

  // Work orders live on the jobs module, keyed by job id; surface the ones tied
  // to this account's jobs that still need attention (not yet completed).
  const workOrders = jobs
    .map(j => { const wo = getWorkOrder(j.id); return wo ? { job: j, wo } : null; })
    .filter((w): w is { job: typeof jobs[number]; wo: WorkOrder } => w !== null);
  const attentionWOs = workOrders.filter(w => w.wo.status !== "completed");

  const ts = (s?: string | null) => { if (!s) return Infinity; const t = new Date(s).getTime(); return isNaN(t) ? Infinity : t; };
  const nextApptJob  = [...scheduledJobs].sort((a, b) => ts(a.date) - ts(b.date))[0] ?? null;
  const nextVisitStr = agreements.map(a => a.nextVisit).filter(Boolean).sort((a, b) => ts(a) - ts(b))[0] ?? null;
  const nextTask     = [...openTasks].sort((a, b) => ts(a.dueDate) - ts(b.dueDate))[0] ?? null;
  const lastService  = [...jobs.filter(j => j.status === "Completed")].sort((a, b) => ts(b.date) - ts(a.date))[0]?.date ?? null;

  const nextActionItems = ([
    nextApptJob  ? { label: nextApptJob.title, date: nextApptJob.date, t: ts(nextApptJob.date) } : null,
    nextVisitStr ? { label: "Agreement visit", date: nextVisitStr, t: ts(nextVisitStr) } : null,
    nextTask     ? { label: nextTask.title, date: nextTask.dueDate, t: ts(nextTask.dueDate) } : null,
  ].filter(Boolean) as { label: string; date: string; t: number }[]).sort((a, b) => a.t - b.t);
  const nextAction = nextActionItems[0] ?? null;

  const summary: { icon: typeof Briefcase; label: string; value: string; sub?: string; accent?: string }[] = [
    { icon: CheckCircle, label: "Status",      value: customer.status, sub: customer.type },
    { icon: Briefcase,   label: "Open Work",   value: String(openJobs.length), sub: `${inProgress.length} active · ${scheduledJobs.length} scheduled` },
    { icon: FilePen,     label: "Open Quotes", value: String(openQuotes.length), sub: quoteValue > 0 ? `${fmtCurrency(quoteValue)} value` : "$0 value" },
    { icon: DollarSign,  label: "Balance",     value: outstanding > 0 ? fmtCurrency(outstanding) : "Paid up", accent: outstanding > 0 ? "#dc2626" : "#10b981", sub: `${openInvoices.length} open invoice${openInvoices.length === 1 ? "" : "s"}${pastDue.length ? ` · ${pastDue.length} past due` : ""}` },
    { icon: Calendar,    label: "Next Action", value: nextAction ? nextAction.date : "—", sub: nextAction ? nextAction.label : "Nothing scheduled" },
  ];

  // Open jobs minus the highlighted "next scheduled" so it isn't shown twice.
  const otherOpenJobs = openJobs.filter(j => j.id !== nextApptJob?.id);

  return (
    <div className="h-full flex flex-col gap-5">
      {/* ── Summary cards (compact) ─────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 shrink-0">
        {summary.map(c => (
          <div key={c.label} className="rounded-xl px-3 py-2.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <c.icon className="w-3 h-3" style={{ color: c.accent ?? "var(--text-muted)" }} />
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{c.label}</p>
            </div>
            <p className="text-sm font-bold leading-tight truncate" style={{ color: c.accent ?? "var(--text-primary)" }}>{c.value}</p>
            {c.sub && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Snapshot grid: wide account (left) · current work (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">
        {/* LEFT — one wide account container (matches Agreement Overview) */}
        <Card title="Account" className="lg:col-span-2 h-full">
            {/* Detail-list style, mirroring the Agreement Details card: icon · muted
                label · bold value, two clean columns, generous whitespace. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <DetailField icon={Building2}   label="Account"          value={customer.name} />
              <DetailField icon={CheckCircle} label="Status"           value={<span style={{ color: statusDot(customer.status), fontWeight: 600 }}>{customer.status}</span>} />
              <DetailField icon={Briefcase}   label="Type"             value={customer.type} />
              <DetailField icon={Calendar}    label="Customer Since"   value={customer.since} />
              <DetailField icon={Layers}      label="Structure"        value={STRUCTURE_LABEL[customer.accountType] ?? customer.accountType} />
              <DetailField icon={Building2}   label="Company"          value={company?.name} />
              <DetailField icon={User}        label="Primary Contact"  value={primary?.name} />
              <DetailField icon={MapPin}      label="Location"         value={location?.name} />
              <DetailField icon={Phone}       label="Phone"            value={primary?.phone} />
              <DetailField icon={Home}        label="Primary Property" value={primaryProp ? `${primaryProp.label || "Primary Address"} — ${primaryProp.address}, ${primaryProp.city}` : undefined} />
              <DetailField icon={Mail}        label="Email"            value={primary?.email} />
              <DetailField icon={Tag}         label="Tags" value={customer.tags.length > 0
                ? <span className="inline-flex flex-wrap items-center gap-1 align-middle">{customer.tags.map(t => <span key={t} className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{t}</span>)}</span>
                : undefined} />
            </div>
          </Card>

        {/* RIGHT — what needs doing (fills the column so it ends level with the
            left Account card regardless of how much content each side has) */}
        <div className="h-full flex flex-col gap-4">
          <SectionCard title="Active Work" count={openJobs.length} action={{ label: "View all", onClick: () => onTab("Jobs") }}>
            {nextApptJob && (
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>Next scheduled</p>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{nextApptJob.title}</p>
                  <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>{nextApptJob.date}{nextApptJob.tech ? ` · ${nextApptJob.tech}` : ""}</span>
                </div>
              </div>
            )}
            {!nextApptJob && otherOpenJobs.length === 0 ? <Empty text="No open jobs" /> : otherOpenJobs.slice(0, 3).map((job, i) => {
              const s = jobStatusStyle(job.status);
              return (
                <Row key={job.id} last={i === otherOpenJobs.slice(0, 3).length - 1 && attentionWOs.length === 0}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{job.title}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{job.date}{job.tech ? ` · ${job.tech}` : ""}</p>
                  </div>
                  <StatusBadge label={job.status} color={s.color} />
                </Row>
              );
            })}
            {/* Work orders folded in — only when some need attention */}
            {attentionWOs.length > 0 && (
              <>
                <div className="px-4 pt-2.5 pb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Work orders needing attention</p>
                </div>
                {attentionWOs.slice(0, 2).map((w, i) => {
                  const done  = w.wo.checklist.filter(c => c.isComplete).length;
                  const total = w.wo.checklist.length;
                  const st    = WO_STATUS_STYLE[w.wo.status];
                  return (
                    <Row key={w.wo.id} last={i === Math.min(1, attentionWOs.length - 1)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{w.wo.title}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{w.job.title}{total > 0 ? ` · ${done}/${total} checklist` : ""}</p>
                      </div>
                      <StatusBadge label={st.label} color={st.color} />
                    </Row>
                  );
                })}
              </>
            )}
          </SectionCard>

          <SectionCard title="Recent Activity" count={events.length} action={{ label: "View all", onClick: () => onTab("History") }} className="flex-1 min-h-0">
            {events.length === 0 ? <Empty text="No activity yet" /> : events.slice(0, 3).map((e, i) => {
              const cfg = EVENT_CONFIG[e.eventType];
              const Icon = cfg.icon;
              const c = SYSTEM_EVENTS.has(e.eventType) || e.createdBy === "—" ? "var(--text-muted)" : CATEGORY_COLOR[categoryOf(e.eventType)];
              return (
                <Row key={e.id} last={i === Math.min(2, events.length - 1)}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mr-2.5" style={{ backgroundColor: typeof c === "string" && c.startsWith("#") ? c + "1a" : "var(--bg-input)" }}>
                    <Icon className="w-3 h-3" style={{ color: c }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug truncate" style={{ color: "var(--text-primary)" }}>{e.title}</p>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{cfg.label} · {e.displayDate}{e.createdBy ? ` · ${e.createdBy}` : ""}</p>
                  </div>
                </Row>
              );
            })}
          </SectionCard>
        </div>
      </div>

      {/* ── Agreements — full-width, fills the remaining vertical space ── */}
      <div className="flex-1 min-h-0 rounded-xl flex flex-col overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Agreements</p>
            {activeAgreements.length > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{activeAgreements.length}</span>}
          </div>
          <button onClick={() => onTab("Agreements")} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View all</button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden p-4">
          {activeAgreements.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No active agreements</p>
              <button onClick={() => onTab("Agreements")} className="mt-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700">Create an agreement →</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {activeAgreements.map(a => {
                const meta = AGREEMENT_STATUS_META[a.status];
                return (
                  <Link key={a.id} href={`/agreements/${a.id}`}
                    className="rounded-lg p-3 transition-colors hover:bg-[var(--bg-surface-2)]"
                    style={{ border: "1px solid var(--border-subtle)", textDecoration: "none" }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{a.type}</p>
                      <StatusBadge label={meta?.label ?? a.status} color={meta?.color ?? "#6b7280"} size="sm" className="shrink-0" />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span className="truncate">Next visit {a.nextVisit ?? "—"}</span>
                      <span className="shrink-0">Renews {a.renewalDate}</span>
                    </div>
                    <p className="text-sm font-semibold mt-1.5" style={{ color: "var(--text-primary)" }}>{a.annualValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}/yr</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Contacts tab ─────────────────────────────────────────
const CONTACT_ROLES = [
  "Primary Contact", "Homeowner", "Property Manager", "Tenant",
  "Owner", "Billing Contact", "Facility Manager",
  "Maintenance Coordinator", "Decision Maker", "Other",
];

interface ContactForm {
  name: string; role: string; phone: string; email: string;
  preferredContact: "phone" | "email" | "text"; notes: string; isPrimary: boolean;
}
const EMPTY_CONTACT_FORM: ContactForm = {
  name: "", role: "Homeowner", phone: "", email: "",
  preferredContact: "text", notes: "", isPrimary: false,
};

function ContactCard({
  contact, onSetPrimary,
}: { contact: Contact; onSetPrimary: (id: string) => void }) {
  const initials = contact.name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  return (
    <div className="rounded-xl p-4" style={{
      backgroundColor: "var(--bg-surface)",
      border: `1px solid ${contact.isPrimary ? "#c7d2fe" : "var(--border-subtle)"}`,
      boxShadow: "var(--shadow-card)",
    }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${contact.isPrimary ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-600"}`}>
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{contact.name}</p>
              {contact.isPrimary && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }}>Primary</span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{contact.role ?? "Contact"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!contact.isPrimary && (
            <button onClick={() => onSetPrimary(contact.id)}
              className="text-[11px] px-2 py-1 rounded-lg transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Set as Primary
            </button>
          )}
          <button className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Contact details */}
      <div className="mt-3 space-y-1.5">
        {contact.phone && (
          <div className="flex items-center gap-2 flex-wrap">
            <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>{contact.phone}</span>
            {contact.preferredContact === "phone" && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#4f46e5" }}>Preferred</span>
            )}
            <div className="ml-auto flex gap-1">
              <button className="text-[11px] px-2 py-0.5 rounded-lg transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Call</button>
              <button className="text-[11px] px-2 py-0.5 rounded-lg transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Text</button>
            </div>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{contact.email}</span>
            {contact.preferredContact === "email" && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#e0e7ff", color: "#4f46e5" }}>Preferred</span>
            )}
            <button className="ml-auto text-[11px] px-2 py-0.5 rounded-lg transition-colors shrink-0" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Email</button>
          </div>
        )}
      </div>

      {contact.notes && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{contact.notes}</p>
        </div>
      )}
    </div>
  );
}

function AddContactForm({
  form, errors, onChange, onSave, onCancel,
}: {
  form: ContactForm;
  errors: Record<string, string>;
  onChange: (k: keyof ContactForm, v: ContactForm[keyof ContactForm]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>New Contact</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Name <span style={{ color: "#ef4444" }}>*</span></label>
          <input value={form.name} onChange={e => onChange("name", e.target.value)}
            placeholder="Full name"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: `1px solid ${errors.name ? "#ef4444" : "var(--border)"}`, backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          {errors.name && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.name}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Role</label>
          <UiSelect value={form.role} onChange={v => onChange("role", v)}
            options={CONTACT_ROLES.map(r => ({ value: r, label: r }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Phone</label>
          <input type="tel" value={form.phone} onChange={e => onChange("phone", formatPhone(e.target.value))}
            placeholder="(000) 000-0000"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: `1px solid ${errors.phone ? "#ef4444" : "var(--border)"}`, backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          {errors.phone && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.phone}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Email</label>
          <input type="email" value={form.email} onChange={e => onChange("email", e.target.value)}
            placeholder="email@example.com"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: `1px solid ${errors.email ? "#ef4444" : "var(--border)"}`, backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          {errors.email && <p className="text-xs mt-1" style={{ color: "#ef4444" }}>{errors.email}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Preferred Contact Method</label>
        <div className="flex gap-2">
          {(["phone", "email", "text"] as const).map(m => (
            <button key={m} onClick={() => onChange("preferredContact", m)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
              style={{
                border: `1.5px solid ${form.preferredContact === m ? "#4f46e5" : "var(--border)"}`,
                backgroundColor: form.preferredContact === m ? "#e0e7ff" : "transparent",
                color: form.preferredContact === m ? "#4f46e5" : "var(--text-secondary)",
              }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Notes</label>
        <textarea value={form.notes} onChange={e => onChange("notes", e.target.value)}
          placeholder="Optional notes..." rows={2}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
      </div>

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isPrimary} onChange={e => onChange("isPrimary", e.target.checked)}
            className="w-3.5 h-3.5 accent-indigo-600" />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Mark as primary contact</span>
        </label>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button onClick={onSave} disabled={!form.name.trim()}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors">
            Save Contact
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactsTab({ id }: { id: string }) {
  const [contacts, setContacts]     = useState<Contact[]>(() => getContacts(id));
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState<ContactForm>({ ...EMPTY_CONTACT_FORM, isPrimary: contacts.length === 0 });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  function changeForm(k: keyof ContactForm, v: ContactForm[keyof ContactForm]) {
    setForm(f => ({ ...f, [k]: v }));
    setFormErrors(e => { const n = { ...e }; delete n[k as string]; return n; });
  }

  function handleSetPrimary(contactId: string) {
    setContacts(prev => prev.map(c => ({ ...c, isPrimary: c.id === contactId })));
  }

  function handleSave() {
    const errs: Record<string, string> = {};
    if (!form.name.trim())  errs.name  = "Name is required";
    if (form.phone.trim()) { const e = validatePhone(form.phone); if (e) errs.phone = e; }
    if (form.email.trim()) { const e = validateEmail(form.email); if (e) errs.email = e; }
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    const newContact: Contact = {
      id: `c-${Date.now()}`,
      customerId: id,
      name: form.name.trim(),
      role: form.role,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      preferredContact: form.preferredContact,
      notes: form.notes.trim() || undefined,
      isPrimary: form.isPrimary || contacts.length === 0,
    };

    setContacts(prev => {
      const updated = form.isPrimary
        ? [newContact, ...prev.map(c => ({ ...c, isPrimary: false }))]
        : [...prev, newContact];
      return updated;
    });
    setShowAdd(false);
    setForm({ ...EMPTY_CONTACT_FORM, isPrimary: false });
    setFormErrors({});
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {contacts.length} {contacts.length === 1 ? "Contact" : "Contacts"}
        </p>
        <button
          onClick={() => { setShowAdd(true); setForm({ ...EMPTY_CONTACT_FORM, isPrimary: contacts.length === 0 }); }}
          disabled={showAdd}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Contact
        </button>
      </div>

      {showAdd && (
        <AddContactForm
          form={form} errors={formErrors}
          onChange={changeForm}
          onSave={handleSave}
          onCancel={() => { setShowAdd(false); setFormErrors({}); }}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        {contacts.map(c => (
          <Commentable key={c.id}
            anchor={{
              recordType: "customer", recordId: id, recordLabel: getCustomer(id)?.name ?? "Account",
              section: "Contacts", subId: c.id, subLabel: c.name,
            }}>
            <ContactCard contact={c} onSetPrimary={handleSetPrimary} />
          </Commentable>
        ))}
      </div>
    </div>
  );
}

// ─── Properties tab ───────────────────────────────────────
const PROPERTY_TYPES: PropertyType[] = ["Residential", "Commercial", "Industrial", "Multi-Family"];

interface PropertyFormData {
  label: string;
  parsedAddress: ParsedAddress;
  type: PropertyType;
  notes: string; isPrimary: boolean;
}
const EMPTY_PROPERTY_FORM: PropertyFormData = {
  label: "", parsedAddress: { ...EMPTY_ADDRESS },
  type: "Residential",
  notes: "", isPrimary: false,
};

function PropertyCard({ property, onEdit }: { property: Property; onEdit: () => void }) {
  const statusActive = (property.status ?? "active") === "active";

  return (
    <div className="rounded-xl" style={{
      backgroundColor: "var(--bg-surface)",
      border: `1px solid ${property.isPrimary ? "#c7d2fe" : "var(--border-subtle)"}`,
      boxShadow: "var(--shadow-card)",
    }}>
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {property.label ?? property.address}
            </p>
            <HoverInfo rows={[
              ...(property.isPrimary
                ? [{ label: "Role", node: <Pill text="Primary" style={{ backgroundColor: "#e0e7ff", color: "#3730a3" }} /> }]
                : []),
              { label: "Type", node: <Pill text={property.type} style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }} /> },
              { label: "Status", node: <StatusBadge label={statusActive ? "Active" : "Inactive"} color={statusActive ? "#10b981" : "#9ca3af"} size="sm" /> },
            ]} />
          </div>
        </div>
        <button onClick={onEdit} className="text-xs px-2 py-1 rounded-lg shrink-0 ml-3 transition-colors hover:bg-[var(--bg-surface-2)]" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          Edit
        </button>
      </div>

      {/* Detail rows */}
      <div className="px-5 py-4 space-y-2">
        <div className="flex items-start gap-2.5">
          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
          <div>
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>{property.address}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{property.city}, {property.state} {property.zip}</p>
          </div>
        </div>

        {property.accessNotes && (
          <div className="mt-1 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Notes</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{property.accessNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AddPropertyForm({
  form, errors, onChange, onSave, onCancel, isEditing,
}: {
  form: PropertyFormData;
  errors: Record<string, string>;
  onChange: (k: keyof PropertyFormData, v: PropertyFormData[keyof PropertyFormData]) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
}) {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-surface)", border: "2px solid #c7d2fe", boxShadow: "var(--shadow-card)" }}>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4f46e5" }}>{isEditing ? "Edit Property" : "New Property"}</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Property Label</label>
          <input value={form.label} onChange={e => onChange("label", e.target.value)}
            placeholder="e.g. Main Office, Unit 4B"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Property Type</label>
          <UiSelect value={form.type} onChange={v => onChange("type", v as PropertyType)}
            options={PROPERTY_TYPES.map(t => ({ value: t, label: t }))} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
          Address <span style={{ color: "#ef4444" }}>*</span>
        </label>
        <AddressAutocomplete
          value={form.parsedAddress}
          onChange={addr => onChange("parsedAddress", addr)}
          placeholder="Start typing a street address…"
          required
          error={errors.address}
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Notes <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
        <textarea value={form.notes} onChange={e => onChange("notes", e.target.value)}
          placeholder="Gate codes, key box locations, parking, contact on site..." rows={2}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
      </div>

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isPrimary} onChange={e => onChange("isPrimary", e.target.checked)}
            className="w-3.5 h-3.5 accent-indigo-600" />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Primary property</span>
        </label>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button onClick={onSave}
            disabled={!form.parsedAddress.addressLine1.trim() || form.parsedAddress.validationStatus === "unvalidated"}
            title={form.parsedAddress.validationStatus === "unvalidated" ? "Confirm the address before saving" : undefined}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors">
            {isEditing ? "Save Changes" : "Save Property"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PropertiesTab({ id }: { id: string }) {
  const [properties, setProperties] = useState<Property[]>(() => getProperties(id));
  const [showAdd, setShowAdd]       = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<PropertyFormData>({ ...EMPTY_PROPERTY_FORM });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const isEditing = editingId !== null;

  function changeForm(k: keyof PropertyFormData, v: PropertyFormData[keyof PropertyFormData]) {
    setForm(f => ({ ...f, [k]: v }));
    setFormErrors(e => {
      const n = { ...e }; delete n[k as string];
      // The address field surfaces its error under the "address" key.
      if (k === "parsedAddress") delete n.address;
      return n;
    });
  }

  function closeForm() { setShowAdd(false); setEditingId(null); setForm({ ...EMPTY_PROPERTY_FORM }); setFormErrors({}); }

  function startEdit(p: Property) {
    setShowAdd(false);
    setEditingId(p.id);
    setForm({
      label: p.label ?? "",
      parsedAddress: {
        ...EMPTY_ADDRESS,
        addressLine1: p.address, city: p.city, state: p.state || "GA", postalCode: p.zip,
        formattedAddress: [p.address, p.city, p.state].filter(Boolean).join(", "),
        // Already-saved address — treat as confirmed so the user isn't forced to
        // re-validate it unless they actually change a field.
        validationStatus: "user_confirmed",
      },
      type: p.type,
      notes: p.accessNotes ?? "",
      isPrimary: p.isPrimary,
    });
    setFormErrors({});
  }

  function handleSave() {
    if (!form.parsedAddress.addressLine1.trim()) { setFormErrors({ address: "Address is required" }); return; }
    // Require the address to have been checked by Google before saving. Leaving a
    // field triggers validation; "unvalidated" means it hasn't run/finished yet.
    if (form.parsedAddress.validationStatus === "unvalidated") {
      setFormErrors({ address: "Verifying address… confirm the address before saving." });
      return;
    }

    const fields = {
      label:       form.label.trim() || undefined,
      address:     form.parsedAddress.addressLine1,
      city:        form.parsedAddress.city,
      state:       form.parsedAddress.state,
      zip:         form.parsedAddress.postalCode,
      type:        form.type,
      accessNotes: form.notes.trim() || undefined,
    };

    let next: Property[];
    if (editingId) {
      next = properties.map(p => {
        if (p.id === editingId) return { ...p, ...fields, isPrimary: form.isPrimary };
        return form.isPrimary ? { ...p, isPrimary: false } : p;
      });
    } else {
      const hasPrimary = properties.some(p => p.isPrimary);
      const newProp: Property = {
        id: `p-${Date.now()}`, customerId: id, ...fields, status: "active",
        isPrimary: form.isPrimary || !hasPrimary,
      };
      next = newProp.isPrimary ? [newProp, ...properties.map(p => ({ ...p, isPrimary: false }))] : [...properties, newProp];
    }
    // Persist so the account truly holds multiple properties (job wizard picker,
    // profile, etc. all read the same store).
    saveProperties(id, next);
    setProperties(next);
    closeForm();
  }

  const hasPrimary = properties.some(p => p.isPrimary);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {properties.length} {properties.length === 1 ? "Property" : "Properties"}
        </p>
        <button
          onClick={() => { setEditingId(null); setShowAdd(true); setForm({ ...EMPTY_PROPERTY_FORM, isPrimary: !hasPrimary }); }}
          disabled={showAdd || isEditing}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Property
        </button>
      </div>

      {(showAdd || isEditing) && (
        <AddPropertyForm
          form={form} errors={formErrors}
          onChange={changeForm}
          onSave={handleSave}
          onCancel={closeForm}
          isEditing={isEditing}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        {properties.map(p => (
          <Commentable key={p.id}
            anchor={{
              recordType: "customer", recordId: id, recordLabel: getCustomer(id)?.name ?? "Account",
              section: "Properties", subId: p.id, subLabel: p.label || p.address,
            }}>
            <PropertyCard property={p} onEdit={() => startEdit(p)} />
          </Commentable>
        ))}
      </div>
    </div>
  );
}

// ─── Jobs tab ─────────────────────────────────────────────
function JobsTab({ id }: { id: string }) {
  const jobs = getJobs(id);
  // Return target so the job page's back link comes back to this tab.
  const backHref  = `/customers/${id}?tab=Jobs`;
  const backLabel = getCustomer(id)?.name ?? "Customer";
  const jobHref = (jobId: string) =>
    `/jobs/${jobId}?back=${encodeURIComponent(backHref)}&backLabel=${encodeURIComponent(backLabel)}`;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Job
        </button>
      </div>
      {jobs.length === 0 ? <StubContent label="No jobs yet" /> : (
        <TableCard cols="1.5fr 1fr 1fr 1fr 1fr 1fr">
          <TableHead cols={["Title", "Type", "Date", "Tech", "Amount", "Status"]} />
          {jobs.map((job, i) => {
            const s = jobStatusStyle(job.status);
            return (
              <Link
                key={job.id}
                href={jobHref(job.id)}
                className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr", borderBottom: i < jobs.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{job.title}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{job.type}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{job.date}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{job.tech}</span>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{job.amount ?? "—"}</span>
                <StatusBadge label={job.status} color={s.color} />
              </Link>
            );
          })}
        </TableCard>
      )}
    </div>
  );
}

// ─── Leads tab ────────────────────────────────────────────
function LeadsTab({ id }: { id: string }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [, setRefresh] = useState(0);
  const leads = getLeads(id);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setWizardOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Lead
        </button>
      </div>
      {wizardOpen && (
        <LeadWizard
          preset={{ accountId: id, lockAccount: true }}
          onClose={() => setWizardOpen(false)}
          onCreated={() => { setWizardOpen(false); setRefresh(r => r + 1); }}
        />
      )}
      {leads.length === 0 ? <StubContent label="No leads yet" /> : (
        <TableCard cols="2fr 1fr 1fr 1fr 1fr">
          <TableHead cols={["Title", "Status", "Date", "Source", "Value"]} />
          {leads.map((lead, i) => {
            const s = leadStatusStyle(lead.status);
            return (
              <TableRow key={lead.id} last={i === leads.length - 1} cols="2fr 1fr 1fr 1fr 1fr">
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{lead.title}</span>
                <StatusBadge label={lead.status} color={s.color} />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{lead.date}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{lead.source ?? "—"}</span>
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{lead.value ?? "TBD"}</span>
              </TableRow>
            );
          })}
        </TableCard>
      )}
    </div>
  );
}

// ─── Agreements tab ───────────────────────────────────────
function AgreementsTab({ id }: { id: string }) {
  const customer   = getCustomer(id)!;
  const router     = useRouter();
  const newHref    = `/agreements/new?customer=${id}`;
  const agreements = getAgreementsForCustomer(id, customer.name);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => router.push(newHref)} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Agreement
        </button>
      </div>
      {agreements.length === 0 ? (
        <StubContent label="No agreements yet">
          <button onClick={() => router.push(newHref)} className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700">Set up an agreement →</button>
        </StubContent>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {agreements.map(a => <AgreementSummaryCard key={a.id} agreement={a} />)}
        </div>
      )}

    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────
function NotesTab({ id }: { id: string }) {
  const [draft, setDraft] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("note");
  const [notes, setNotes] = useState<CustomerNote[]>(() => getNotes(id));

  function handleSave() {
    if (!draft.trim()) return;
    const saved = addNote(id, draft.trim(), noteType);
    setNotes(prev => [saved, ...prev]);
    setDraft("");
    setNoteType("note");
  }

  return (
    <div className="space-y-4">
      {/* Add note */}
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="w-full resize-none text-sm outline-none bg-transparent"
          style={{ color: "var(--text-primary)" }}
        />
        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="flex gap-1">
            {(["note", "call", "email", "visit"] as const).map(t => (
              <button key={t} onClick={() => setNoteType(t)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors"
                style={{
                  border: `1px solid ${noteType === t ? "#4f46e5" : "var(--border)"}`,
                  backgroundColor: noteType === t ? "#e0e7ff" : "transparent",
                  color: noteType === t ? "#4f46e5" : "var(--text-secondary)",
                }}>
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={!draft.trim()}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            Save Note
          </button>
        </div>
      </div>

      {/* Notes grid */}
      {notes.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No notes yet</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {notes.map((note) => {
            const Icon = NOTE_ICON[note.type];
            return (
              <div key={note.id} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{note.user}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{note.type}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{note.date}</span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{note.text}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Equipment tab ────────────────────────────────────────
const EQUIP_STATUS: Record<EquipmentStatus, { label: string; bg: string; color: string }> = {
  operational:   { label: "Operational",   bg: "#d1fae5", color: "#065f46" },
  needs_service: { label: "Needs Service", bg: "#fef3c7", color: "#92400e" },
  retired:       { label: "Retired",       bg: "var(--bg-input)", color: "var(--text-muted)" },
};

function EquipmentTab({ id }: { id: string }) {
  const items = getEquipment(id);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
          <span className="text-base leading-none">+</span> Add Equipment
        </button>
      </div>
      {items.length === 0 ? (
        <StubContent label="No equipment recorded">
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Add HVAC systems, water heaters, or other equipment for this account.</p>
        </StubContent>
      ) : (
        <TableCard cols="">
          <div
            className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}
          >
            {["Equipment", "Brand", "Model", "Serial #", "Installed", "Last Service", "Status"].map(h => <span key={h}>{h}</span>)}
          </div>
          {items.map((eq, i) => {
            const s = EQUIP_STATUS[eq.status];
            return (
              <div
                key={eq.id}
                className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr", borderBottom: i < items.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{eq.name}</p>
                  {eq.notes && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{eq.notes}</p>}
                </div>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{eq.brand ?? "—"}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{eq.model ?? "—"}</span>
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{eq.serialNumber ?? "—"}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{eq.installDate ?? "—"}</span>
                <span className="text-sm" style={{ color: eq.lastServiceDate ? "var(--text-secondary)" : "var(--text-muted)" }}>{eq.lastServiceDate ?? "—"}</span>
                <StatusBadge label={s.label} color={s.color} />
              </div>
            );
          })}
        </TableCard>
      )}
    </div>
  );
}

// ─── Billing tab ──────────────────────────────────────────
// Placeholder layout — wired to real data when Phase 2 quote/invoice
// builder is built. Column shapes match lib/quotes/types.ts exactly.

const QUOTE_COLS  = ["Quote #", "Title", "Linked To", "Status", "Total", "Expires"];
const INVOICE_COLS = ["Invoice #", "Title", "Linked To", "Status", "Total", "Balance Due", "Due Date"];

function BillingSection({
  title,
  cols,
  buttonLabel,
  statusStyles,
}: {
  title: string;
  cols: string[];
  buttonLabel: string;
  statusStyles: Record<string, { label: string; bg: string; color: string }>;
}) {
  const exampleStatuses = Object.values(statusStyles).slice(0, 3);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
        <button
          disabled
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg opacity-40 cursor-not-allowed"
          style={{ backgroundColor: "#4f46e5", color: "#fff" }}
          title="Coming in Phase 2"
        >
          <Plus className="w-3.5 h-3.5" /> {buttonLabel}
        </button>
      </div>

      {/* Column headers */}
      <div
        className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{
          gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
          color: "var(--text-muted)",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-surface-2)",
        }}
      >
        {cols.map(c => <span key={c}>{c}</span>)}
      </div>

      {/* Empty state */}
      <div className="px-4 py-10 text-center space-y-3">
        <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          No {title.toLowerCase()} yet
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {title === "Quotes"
            ? "Quotes can be linked to a lead, job, project, or created directly on the account."
            : "Invoices can be generated from an approved quote or created manually against a job, project, or agreement."}
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          {exampleStatuses.map(s => (
            <span
              key={s.label}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: s.bg, color: s.color }}
            >
              {s.label}
            </span>
          ))}
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>· · ·</span>
        </div>
      </div>
    </div>
  );
}

function BillingTab({ id }: { id: string }) {
  const router = useRouter();
  const [wizard, setWizard] = useState(false);
  const [, forceRefresh] = useState(0);
  const quotes   = getQuotesForCustomer(id);
  const invoices = getInvoicesForCustomer(id);
  const outstanding = invoices.filter(i => i.balanceDue > 0).reduce((s, i) => s + i.balanceDue, 0);

  function Section({ title, onNew, children }: { title: string; onNew?: () => void; children: React.ReactNode }) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
          <button onClick={onNew} disabled={!onNew}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg disabled:opacity-40"
            style={{ backgroundColor: "#4f46e5", color: "#fff" }}>
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {wizard && (
        <QuoteTypeChooser preset={{ customerId: id, lockCustomer: true }}
          onClose={() => setWizard(false)} />
      )}
      {outstanding > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ backgroundColor: "#fef3c7", border: "1px solid #fde68a" }}>
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#92400e" }} />
          <p className="text-xs font-medium" style={{ color: "#92400e" }}>
            {fmtCurrency(outstanding)} outstanding across {invoices.filter(i => i.balanceDue > 0).length} unpaid invoice(s)
          </p>
        </div>
      )}

      {/* Quotes */}
      <Section title={`Quotes (${quotes.length})`} onNew={() => setWizard(true)}>
        {quotes.length === 0 ? (
          <div className="px-4 py-8 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No quotes yet</p></div>
        ) : (
          <>
            <div className="grid px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: "1fr 2fr 1.2fr 0.8fr 0.8fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
              <span>Quote #</span><span>Title</span><span>Linked To</span><span>Status</span><span className="text-right">Total</span>
            </div>
            {quotes.map((q, i) => {
              const s = QUOTE_STATUS_STYLE[q.status];
              return (
                <Link key={q.id} href={`/quotes/${q.id}`}
                  className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                  style={{ gridTemplateColumns: "1fr 2fr 1.2fr 0.8fr 0.8fr", borderBottom: i < quotes.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
                  <span className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{q.quoteNumber}</span>
                  <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{q.title}</span>
                  <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{q.linkedLabel ?? "—"}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block"
                    style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                  <span className="text-sm font-semibold text-right" style={{ color: "var(--text-primary)" }}>
                    {q.total > 0 ? fmtCurrency(q.total) : "TBD"}
                  </span>
                </Link>
              );
            })}
          </>
        )}
      </Section>

      {/* Invoices */}
      <Section title={`Invoices (${invoices.length})`}>
        {invoices.length === 0 ? (
          <div className="px-4 py-8 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No invoices yet</p></div>
        ) : (
          <>
            <div className="grid px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: "1fr 2fr 1.2fr 0.8fr 0.7fr 0.7fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
              <span>Invoice #</span><span>Title</span><span>Linked To</span><span>Status</span><span className="text-right">Total</span><span className="text-right">Balance</span>
            </div>
            {invoices.map((inv, i) => {
              const s = INVOICE_STATUS_STYLE[inv.status];
              return (
                <Link key={inv.id} href={`/invoices/${inv.id}`}
                  className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                  style={{ gridTemplateColumns: "1fr 2fr 1.2fr 0.8fr 0.7fr 0.7fr", borderBottom: i < invoices.length - 1 ? "1px solid var(--border-subtle)" : "none", textDecoration: "none" }}>
                  <span className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{inv.invoiceNumber}</span>
                  <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{inv.title}</span>
                  <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{inv.linkedLabel ?? "—"}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block"
                    style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                  <span className="text-sm font-semibold text-right" style={{ color: "var(--text-primary)" }}>{fmtCurrency(inv.total)}</span>
                  <span className="text-sm font-semibold text-right"
                    style={{ color: inv.balanceDue > 0 ? (inv.status === "past_due" ? "#dc2626" : "var(--text-primary)") : "#10b981" }}>
                    {inv.balanceDue > 0 ? fmtCurrency(inv.balanceDue) : "Paid"}
                  </span>
                </Link>
              );
            })}
          </>
        )}
      </Section>
    </div>
  );
}

// ─── History tab ──────────────────────────────────────────
// A broad, compact customer activity feed — jobs, communication, notes, billing,
// files, agreements, tasks, and system activity. The time sits in a left gutter
// connected to each row (not floating far right), rows are grouped by day with
// relative headers, and system-generated entries render quieter than human ones.

type EventConfig = {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
};

const EVENT_CONFIG: Record<EventType, EventConfig> = {
  account_created:    { icon: UserPlus,      label: "Account Created" },
  contact_added:      { icon: User,          label: "Contact Added" },
  property_added:     { icon: Home,          label: "Property Added" },
  lead_created:       { icon: TrendingUp,    label: "Lead Created" },
  lead_stage_changed: { icon: TrendingUp,    label: "Lead Stage Changed" },
  job_created:        { icon: Briefcase,     label: "Job Created" },
  job_scheduled:      { icon: Calendar,      label: "Job Scheduled" },
  job_completed:      { icon: CheckCircle,   label: "Job Completed" },
  work_order_created: { icon: ClipboardList, label: "Work Order Created" },
  quote_created:      { icon: FilePen,       label: "Quote Created" },
  quote_sent:         { icon: FilePen,       label: "Quote Sent" },
  quote_accepted:     { icon: FileCheck,     label: "Quote Accepted" },
  invoice_created:    { icon: Receipt,       label: "Invoice Created" },
  payment_received:   { icon: DollarSign,    label: "Payment Received" },
  agreement_created:  { icon: FileText,      label: "Agreement Created" },
  agreement_renewed:  { icon: RefreshCw,     label: "Agreement Renewed" },
  photo_uploaded:     { icon: ImageIcon,     label: "Photo Uploaded" },
  file_uploaded:      { icon: Paperclip,     label: "File Uploaded" },
  note_added:         { icon: MessageSquare, label: "Note Added" },
  email_sent:         { icon: Mail,          label: "Email Sent" },
  sms_sent:           { icon: Smartphone,    label: "SMS Sent" },
  call_logged:        { icon: Phone,         label: "Call Logged" },
  task_created:       { icon: CheckSquare,   label: "Task Created" },
  task_completed:     { icon: CheckSquare,   label: "Task Completed" },
};

// Filter-chip categories + their accent colors (dark-mode friendly tints).
type HistoryCategory = "all" | "jobs" | "communication" | "notes" | "billing" | "files" | "agreements" | "system";
const HISTORY_CHIPS: { key: HistoryCategory; label: string }[] = [
  { key: "all", label: "All" }, { key: "jobs", label: "Jobs" }, { key: "communication", label: "Communication" },
  { key: "notes", label: "Notes" }, { key: "billing", label: "Billing" }, { key: "files", label: "Files" },
  { key: "agreements", label: "Agreements" }, { key: "system", label: "System" },
];
const CATEGORY_COLOR: Record<Exclude<HistoryCategory, "all">, string> = {
  jobs: "#6366f1", communication: "#0ea5e9", notes: "#f59e0b", billing: "#8b5cf6", files: "#14b8a6", agreements: "#10b981", system: "#6b7280",
};
const ALL_COLOR = "#6366f1";

function categoryOf(t: EventType): Exclude<HistoryCategory, "all"> {
  switch (t) {
    case "job_created": case "job_scheduled": case "job_completed": case "work_order_created": return "jobs";
    case "email_sent": case "sms_sent": case "call_logged": return "communication";
    case "note_added": return "notes";
    case "invoice_created": case "payment_received": case "quote_created": case "quote_sent": case "quote_accepted": return "billing";
    case "photo_uploaded": case "file_uploaded": return "files";
    case "agreement_created": case "agreement_renewed": return "agreements";
    default: return "system";
  }
}
// High-signal milestones surfaced by the "Important only" toggle.
const IMPORTANT_EVENTS = new Set<EventType>(["job_scheduled", "job_completed", "payment_received", "invoice_created", "quote_accepted", "agreement_created", "agreement_renewed", "work_order_created"]);
// Auto/system entries that render quieter than human activity.
const SYSTEM_EVENTS = new Set<EventType>(["account_created", "contact_added", "property_added", "lead_created", "lead_stage_changed"]);

// The contextual "related action" per event — navigates to the right profile tab.
function actionFor(t: EventType): { label: string; tab: string } | null {
  switch (t) {
    case "job_created": case "job_scheduled": case "job_completed": case "work_order_created": return { label: "View Job", tab: "Jobs" };
    case "email_sent": case "sms_sent": case "call_logged": return { label: "Reply", tab: "Communication" };
    case "note_added": return { label: "View Note", tab: "Notes" };
    case "invoice_created": case "payment_received": return { label: "Open Invoice", tab: "Billing" };
    case "quote_created": case "quote_sent": case "quote_accepted": return { label: "View Quote", tab: "Billing" };
    case "photo_uploaded": case "file_uploaded": return { label: "View Files", tab: "Photos & Files" };
    case "agreement_created": case "agreement_renewed": return { label: "View Agreement", tab: "Agreements" };
    case "lead_created": case "lead_stage_changed": return { label: "View Lead", tab: "Leads" };
    case "contact_added": return { label: "View Contacts", tab: "Contacts" };
    case "property_added": return { label: "View Properties", tab: "Properties" };
    case "task_created": case "task_completed": return { label: "View Tasks", tab: "Tasks" };
    default: return null;
  }
}

function eventInitials(name: string): string {
  const p = (name || "").trim().split(/\s+/);
  if (!p[0] || name === "—") return "•";
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}
function eventTime(iso: string): string | null {
  if (!/T\d{2}:\d{2}/.test(iso)) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
// Relative date headers: Today, Yesterday, then "Mon, Jun 23" (+ year if not current).
function dayHeading(iso: string): string {
  const d = new Date(/T/.test(iso) ? iso : iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

function HistoryTab({ id, onTab }: { id: string; onTab: (tab: string) => void }) {
  const events = useMemo(() => getActivityEvents(id), [id]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<HistoryCategory>("all");
  const [newestFirst, setNewestFirst] = useState(true);
  const [importantOnly, setImportantOnly] = useState(false);

  const s = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = events.filter(e => {
      if (cat !== "all" && categoryOf(e.eventType) !== cat) return false;
      if (importantOnly && !IMPORTANT_EVENTS.has(e.eventType)) return false;
      if (s && !`${e.title} ${e.description ?? ""} ${e.createdBy} ${EVENT_CONFIG[e.eventType].label}`.toLowerCase().includes(s)) return false;
      return true;
    });
    return newestFirst ? list : [...list].reverse();   // events arrive newest-first
  }, [events, cat, importantOnly, s, newestFirst]);

  const countFor = (key: HistoryCategory) => key === "all" ? events.length : events.filter(e => categoryOf(e.eventType) === key).length;

  // Group consecutive rows by calendar day for the date headers.
  const groups: { day: string; items: typeof filtered }[] = [];
  for (const e of filtered) {
    const day = (e.createdAt || "").slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }

  const toggleBase = "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors";

  return (
    <div className="space-y-4">
      {/* Toolbar — search + sort/important */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1 min-w-[200px] max-w-sm" style={{ backgroundColor: "var(--bg-input)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search history..." className="bg-transparent text-sm outline-none w-full" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <button onClick={() => setNewestFirst(v => !v)} className={toggleBase}
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }} title="Toggle sort order">
              <ArrowDownUp className="w-3.5 h-3.5" /> {newestFirst ? "Newest first" : "Oldest first"}
            </button>
            <button onClick={() => setImportantOnly(v => !v)} className={toggleBase}
              style={importantOnly
                ? { border: "1px solid #f59e0b59", backgroundColor: "#f59e0b1a", color: "#f59e0b" }
                : { border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <Star className="w-3.5 h-3.5" style={{ fill: importantOnly ? "#f59e0b" : "none" }} /> Important only
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {HISTORY_CHIPS.map(c => {
            const active = cat === c.key;
            const color = c.key === "all" ? ALL_COLOR : CATEGORY_COLOR[c.key];
            const n = countFor(c.key);
            return (
              <button key={c.key} onClick={() => setCat(c.key)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                style={active
                  ? { backgroundColor: color + "1f", color, border: `1px solid ${color}59` }
                  : { backgroundColor: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
                {c.label}
                <span className="text-[10px]" style={{ color: active ? color : "var(--text-muted)", opacity: 0.8 }}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center rounded-xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No matching history.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
            <div key={group.day}>
              {/* Date header */}
              <div className="flex items-center gap-2.5 mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider shrink-0" style={{ color: "var(--text-secondary)" }}>{dayHeading(group.day)}</p>
                <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-subtle)" }} />
                <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{group.items.length}</span>
              </div>

              <div className="space-y-0.5">
                {group.items.map(event => {
                  const config = EVENT_CONFIG[event.eventType];
                  const Icon = config.icon;
                  const time = eventTime(event.createdAt);
                  const quiet = SYSTEM_EVENTS.has(event.eventType) || event.createdBy === "—";
                  const color = quiet ? "var(--text-muted)" : CATEGORY_COLOR[categoryOf(event.eventType)];
                  const action = actionFor(event.eventType);
                  return (
                    <div key={event.id} className="flex gap-3 rounded-lg px-2 py-2 -mx-2 transition-colors hover:bg-[var(--bg-surface-2)]">
                      {/* Time gutter — connected to the row */}
                      <div className="w-12 shrink-0 text-right pt-1">
                        <span className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{time ?? ""}</span>
                      </div>

                      {/* Category icon node */}
                      <div className="shrink-0 pt-0.5">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: quiet ? "var(--bg-input)" : color + "1a", border: `1px solid ${quiet ? "var(--border-subtle)" : color + "33"}` }}>
                          <Icon className="w-3.5 h-3.5" style={{ color }} />
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: quiet ? "var(--bg-input)" : color + "1a", color: quiet ? "var(--text-muted)" : color }}>
                            {config.label}
                          </span>
                          {quiet && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>System</span>}
                        </div>
                        <p className="text-sm font-medium mt-1 leading-snug" style={{ color: quiet ? "var(--text-secondary)" : "var(--text-primary)" }}>{event.title}</p>
                        {event.description && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{event.description}</p>}

                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: event.createdBy === "—" ? "#9ca3af" : "#6366f1" }}>{eventInitials(event.createdBy)}</span>
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{event.createdBy === "—" ? "System" : event.createdBy}</span>
                          </span>
                          {action && (
                            <>
                              <span className="text-[11px]" style={{ color: "var(--border)" }}>·</span>
                              <button onClick={() => onTab(action.tab)} className="inline-flex items-center gap-0.5 text-[11px] font-medium transition-colors hover:underline" style={{ color: "var(--accent-text)" }}>
                                {action.label} <ChevronRight className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stub tab ─────────────────────────────────────────────
function StubTab({ label, link }: { label: string; link?: string }) {
  return (
    <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Coming in Phase 1</p>
      {link && <Link href={link} className="mt-2 block text-xs font-medium text-indigo-600 hover:text-indigo-700">Open {label} module →</Link>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
function CustomerDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id }       = use(params);
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { deleteCustomer } = useCustomers();

  // Open on the tab named in the URL (?tab=Jobs) so returning from a linked
  // record lands where the user left off; default to Overview.
  const urlTab = searchParams.get("tab");
  const [tab, setTabState] = useState(urlTab && TABS.includes(urlTab) ? urlTab : "Overview");
  const [editing, setEditing]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [createModal, setCreateModal] = useState<null | "job" | "quote" | "lead">(null);
  const [refreshKey, setRefreshKey] = useState(0);   // bump to re-read customer after an edit

  // Keep the active tab in the URL so browser-back / in-app back links restore it.
  function setTab(t: string) {
    setTabState(t);
    router.replace(`/customers/${id}?tab=${encodeURIComponent(t)}`, { scroll: false });
  }

  const customer = getCustomer(id);

  function handleDelete() {
    deleteCustomer(id);
    router.push("/customers");
  }

  if (!customer) {
    return (
      <div className="p-6">
        <Link href="/customers" className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Customers
        </Link>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Customer not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
        {/* Top row */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/customers" className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeft className="w-4 h-4" /> Customers
            </Link>
            <div className="w-px h-5 shrink-0" style={{ backgroundColor: "var(--border)" }} />
            <Commentable anchor={{ recordType: "customer", recordId: id, recordLabel: customer.name }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {customer.initials}
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{customer.name}</h1>
                <p className="text-xs mt-0.5 truncate flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                  <MapPin className="w-3 h-3 shrink-0" />
                  {customer.address}, {customer.city}, {customer.state}
                </p>
              </div>
            </div>
            </Commentable>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Primary action */}
            <button onClick={() => setCreateModal("job")}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-white transition hover:brightness-110"
              style={{ backgroundColor: "#4f46e5" }}>
              <Briefcase className="w-3.5 h-3.5" /> Create Job
            </button>

            {/* More menu — secondary create actions + account management */}
            <div className="relative">
              <button onClick={() => setActionsOpen(o => !o)} aria-label="More actions"
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                <MoreVertical className="w-4 h-4" />
              </button>
              {actionsOpen && (
                <>
                  {/* click-away catcher */}
                  <button aria-hidden tabIndex={-1} onClick={() => setActionsOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-xl overflow-hidden py-1"
                    style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                    {([
                      { icon: FilePen,       label: "Create Quote",  onClick: () => setCreateModal("quote") },
                      { icon: TrendingUp,    label: "Create Lead",   onClick: () => setCreateModal("lead") },
                      { icon: MessageSquare, label: "Add Note",      onClick: () => setTab("Notes") },
                      { icon: Receipt,       label: "Create Invoice",onClick: () => setTab("Billing") },
                      { icon: Paperclip,     label: "Upload File",   onClick: () => setTab("Photos & Files") },
                      { icon: Smartphone,    label: "Send Message",  onClick: () => setTab("Communication") },
                    ] as const).map(item => (
                      <button key={item.label} onClick={() => { setActionsOpen(false); item.onClick(); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}>
                        <item.icon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /> {item.label}
                      </button>
                    ))}
                    <div className="h-px my-1" style={{ backgroundColor: "var(--border-subtle)" }} />
                    <button onClick={() => { setActionsOpen(false); setEditing(true); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}>
                      <Pencil className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /> Edit Account
                    </button>
                    <button onClick={() => { setActionsOpen(false); setConfirmDelete(true); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-red-50" style={{ color: "#dc2626" }}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sub-tabs — same flat pill as the main tabs, in amber instead of indigo */}
        <DetailTabs tabs={TABS} active={tab} onChange={setTab} className="px-6 py-2" />
      </div>

      {/* Tab content — keyed on refreshKey so tabs re-read after an edit.
          Card-grid tabs (Contacts, Properties, Equipment) comment per-row inside
          the tab; table/dense tabs get a section-level anchor here. */}
      <div key={refreshKey} className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {(() => {
          const section = (s: string, node: React.ReactNode) => (
            <Commentable anchor={{ recordType: "customer", recordId: id, recordLabel: customer.name, section: s }}>{node}</Commentable>
          );
          return (
            <>
              {tab === "Overview"       && (
                <Commentable className="h-full" anchor={{ recordType: "customer", recordId: id, recordLabel: customer.name, section: "Overview" }}>
                  <OverviewTab id={id} onTab={setTab} />
                </Commentable>
              )}
              {tab === "Contacts"       && <ContactsTab    id={id} />}
              {tab === "Properties"     && <PropertiesTab  id={id} />}
              {tab === "Equipment"      && section("Equipment", <EquipmentTab id={id} />)}
              {tab === "Jobs"           && section("Jobs", <JobsTab id={id} />)}
              {tab === "Tasks"          && section("Tasks", <RecordTasks type="customer" id={id} />)}
              {tab === "Leads"          && section("Leads", <LeadsTab id={id} />)}
              {tab === "Agreements"     && section("Agreements", <AgreementsTab id={id} />)}
              {tab === "Notes"          && section("Notes", <NotesTab id={id} />)}
              {tab === "Photos & Files" && section("Photos & Files", <PhotoGallery recordLevel="account" scope={{ accountId: id }} accountName={customer.name} />)}
              {tab === "Communication"  && <StubTab label="Communication" link="/inbox" />}
              {tab === "Billing"        && section("Billing", <BillingTab id={id} />)}
              {tab === "History"        && section("History", <HistoryTab id={id} onTab={setTab} />)}
            </>
          );
        })()}
      </div>

      {/* Create flows — driven from the header actions */}
      {createModal === "job"   && <JobWizard preset={{ customerId: id, lockCustomer: true }} onClose={() => setCreateModal(null)} onCreated={() => { setCreateModal(null); setRefreshKey(k => k + 1); }} />}
      {createModal === "quote" && <QuoteTypeChooser preset={{ customerId: id, lockCustomer: true }} onClose={() => setCreateModal(null)} />}
      {createModal === "lead"  && <LeadWizard preset={{ accountId: id, lockAccount: true }} onClose={() => setCreateModal(null)} onCreated={() => { setCreateModal(null); setRefreshKey(k => k + 1); }} />}

      {/* Edit account — mounted on open so the form re-seeds from current data */}
      {editing && (
        <EditCustomerModal
          customer={customer}
          open
          onClose={() => setEditing(false)}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
            <div className="px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#fee2e2" }}>
                  <AlertCircle className="w-5 h-5" style={{ color: "#dc2626" }} />
                </div>
                <div>
                  <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Delete account?</h2>
                  <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                    This permanently removes <span className="font-medium" style={{ color: "var(--text-primary)" }}>{customer.name}</span> and its account record. Contacts, properties, jobs, and history tied to this account will no longer be accessible. This can&apos;t be undone.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <button onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                Cancel
              </button>
              <button onClick={handleDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: "#dc2626" }}>
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerDetailPage(props: { params: Promise<{ id: string }> }) {
  // Suspense boundary required because the content reads useSearchParams.
  return (
    <Suspense fallback={null}>
      <CustomerDetailContent {...props} />
    </Suspense>
  );
}

// ─── Shared UI primitives ─────────────────────────────────
// Detail-list field matching the Agreement Details card: leading icon, a small
// muted label, and a bold value beneath it. Falls back to "—" when empty.
function DetailField({ icon: Icon, label, value }: { icon?: typeof Phone; label: string; value?: React.ReactNode }) {
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

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{label}</span>
      {children}
    </div>
  );
}

function Val({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-right truncate" style={{ color: "var(--text-primary)" }}>{children}</span>;
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-4 ${className}`} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ icon: Icon, value }: { icon: typeof Phone; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function SectionCard({
  title, count, action, children, className = "",
}: {
  title: string;
  count: number;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl overflow-hidden flex flex-col ${className}`} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
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

function Row({ children, last }: { children: React.ReactNode; last: boolean }) {
  return (
    <div className="flex items-center px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors" style={!last ? { borderBottom: "1px solid var(--border-subtle)" } : undefined}>
      {children}
    </div>
  );
}

function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{text}</p>
      {children}
    </div>
  );
}

function StubContent({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</p>
      {children}
    </div>
  );
}

function TableCard({ cols, children }: { cols: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  );
}

function TableHead({ cols }: { cols: string[] }) {
  return (
    <div className={`grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider`} style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)`, color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
      {cols.map(c => <span key={c}>{c}</span>)}
    </div>
  );
}

function TableRow({ cols, last, children }: { cols: string; last: boolean; children: React.ReactNode }) {
  return (
    <div className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors" style={{ gridTemplateColumns: cols, borderBottom: !last ? "1px solid var(--border-subtle)" : "none" }}>
      {children}
    </div>
  );
}
