"use client";

// ─── Work Order detail ────────────────────────────────────
// A Work Order is a real operational record — the field-execution packet — NOT a
// shortcut to its job. It stays linked to the parent Job (why/revenue) and shows
// its Visits (appointments), but it owns its own scope, checklist, materials,
// photos and completion state. See the Jobs → Work Orders → Visits/Appointments
// model (Appointment = Visit).

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, Circle, Play, RotateCcw, Repeat, ClipboardList,
  Briefcase, User, MapPin, Phone, Mail, Calendar, Clock, Users,
  Receipt, FilePen, Activity, Tag, Building2, DollarSign, Package,
  Image as ImageIcon, Plus,
} from "lucide-react";
import {
  getWorkOrderById, updateWorkOrderById, getJob, JOB_STATUS_CONFIG, resolveJobTypeColor,
  type WorkOrderStatus,
} from "@/lib/jobs/data";
import { getAppointmentsForWorkOrder, VISIT_TYPE_CONFIG, type AppointmentStatus } from "@/lib/appointments/data";
import { getCustomer } from "@/lib/customers/data";
import { getFiles } from "@/lib/files/data";
import { getQuotesForWorkOrder, getInvoicesForWorkOrder, createQuoteFromWorkOrder, createInvoiceFromWorkOrder, fmt as fmtCurrency } from "@/lib/quotes/data";
import { QUOTE_STATUS_STYLE, INVOICE_STATUS_STYLE } from "@/lib/quotes/types";
import { usePermissions } from "@/components/providers/PermissionProvider";
import { useDataVersion } from "@/lib/sync/useDataVersion";
import StatusBadge from "@/components/shared/StatusBadge";
import ActionsMenu from "@/components/shared/ActionsMenu";
import DetailTabs from "@/components/shared/DetailTabs";
import WorkOrderBilling from "@/components/jobs/WorkOrderBilling";
import PhotoGallery from "@/components/files/PhotoGallery";
import ReturnVisitModal from "@/components/jobs/ReturnVisitModal";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const WO_STATUS: Record<WorkOrderStatus, { label: string; color: string }> = {
  pending:     { label: "Pending",     color: "#9ca3af" },
  in_progress: { label: "In Progress", color: "#f59e0b" },
  completed:   { label: "Completed",   color: "#16a34a" },
};

const APPT_STATUS: Record<AppointmentStatus, { label: string; color: string }> = {
  scheduled:   { label: "Scheduled",   color: "#0891b2" },
  en_route:    { label: "En route",    color: "#2563eb" },
  in_progress: { label: "In progress", color: "#f59e0b" },
  completed:   { label: "Completed",   color: "#16a34a" },
  canceled:    { label: "Canceled",    color: "#9ca3af" },
  no_show:     { label: "No show",     color: "#dc2626" },
};

export default function WorkOrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const rev = useDataVersion();
  const { fieldVisible } = usePermissions();
  const showPricing = fieldVisible("finance_field_pricing");   // gate billing docs like WorkOrderBilling
  const [tab, setTab] = useState("Overview");
  const [returnOpen, setReturnOpen] = useState(false);

  const wo   = useMemo(() => getWorkOrderById(id), [id, rev]);
  const job  = useMemo(() => (wo?.jobId ? getJob(wo.jobId) : undefined), [wo?.jobId, rev]);
  const visits = useMemo(() => getAppointmentsForWorkOrder(id), [id, rev]);
  const customer = useMemo(() => (job ? getCustomer(job.accountId) : undefined), [job?.accountId, rev]);
  const images = useMemo(() => getFiles({ workOrderId: id }).filter(f => f.fileType === "image"), [id, rev]);
  const quotes   = useMemo(() => getQuotesForWorkOrder(id), [id, rev]);
  const invoices = useMemo(() => getInvoicesForWorkOrder(id), [id, rev]);

  if (!wo) {
    return (
      <div className="p-6">
        <Link href="/work-orders" className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Work Orders
        </Link>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Work order not found.</p>
      </div>
    );
  }

  const st = WO_STATUS[wo.status];
  const reqItems  = wo.checklist.filter(c => c.required);
  const reqDone   = reqItems.filter(c => c.isComplete).length;
  const checklistDone = wo.checklist.filter(c => c.isComplete).length;
  const lineCount = wo.lineItems?.length ?? 0;
  const subtotal  = (wo.lineItems ?? []).reduce((s, li) => s + li.qty * li.unitPrice, 0);
  const toggle    = (ciId: string) => updateWorkOrderById(id, { checklist: wo.checklist.map(c => c.id === ciId ? { ...c, isComplete: !c.isComplete } : c) });
  const setStatus = (status: WorkOrderStatus) => updateWorkOrderById(id, { status, completedAt: status === "completed" ? new Date().toISOString() : undefined });
  const newQuote   = () => { const q = createQuoteFromWorkOrder(id); if (q) router.push(`/quotes/${q.id}`); };
  const newInvoice = () => { const inv = createInvoiceFromWorkOrder(id); if (inv) router.push(`/invoices/${inv.id}`); };

  // Completion requirements: required checklist done + at least one photo.
  const checklistMet = reqItems.length === 0 || reqDone === reqItems.length;
  const photosMet    = images.length > 0;

  // Activity feed — the work order's lifecycle, in the same timeline style as the
  // Project / Agreement activity tabs (created → visits → completion → job status).
  const fmtDT = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const activity: ActivityEntry[] = [
    { icon: ClipboardList, color: "#4f46e5", label: "Created", title: wo.title, meta: job ? job.title : undefined, user: job?.assignedTo },
    ...visits.map(v => {
      const as = APPT_STATUS[v.status];
      const vt = v.visitType ? VISIT_TYPE_CONFIG[v.visitType] : undefined;
      return {
        icon: Calendar, color: as.color, label: as.label, title: vt ? `${vt.label} visit` : "Visit",
        meta: `${v.techIds.length ? v.techIds.join(", ") : "Unassigned"} · ${v.durationMinutes} min`,
        date: v.scheduledDate ? `${v.scheduledDate}${v.scheduledTime ? ` · ${v.scheduledTime}` : ""}` : "Unscheduled",
      } as ActivityEntry;
    }),
    ...(wo.completedAt ? [{ icon: CheckCircle2, color: "#16a34a", label: "Completed", title: "Work order completed", date: fmtDT(wo.completedAt) } as ActivityEntry] : []),
    ...(job?.statusHistory ?? []).map(e => {
      const to = JOB_STATUS_CONFIG[e.to as keyof typeof JOB_STATUS_CONFIG];
      const from = JOB_STATUS_CONFIG[e.from as keyof typeof JOB_STATUS_CONFIG];
      return {
        icon: Activity, color: to?.color ?? "#9ca3af", label: to?.label ?? e.to,
        title: `${from?.label ?? e.from} → ${to?.label ?? e.to}${e.override ? " · override" : ""}`,
        meta: e.reason || undefined, user: e.byName, date: fmtDT(e.at),
      } as ActivityEntry;
    }),
  ];

  // Billing tabs only when this role can see field pricing (like WorkOrderBilling).
  const TABS = showPricing
    ? ["Overview", "Parts & Labor", "Quotes", "Invoices", "Photos & Files", "Activity"]
    : ["Overview", "Parts & Labor", "Photos & Files", "Activity"];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/work-orders" className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeft className="w-4 h-4" /> Work Orders
            </Link>
            <div className="w-px h-5 shrink-0" style={{ backgroundColor: "var(--border)" }} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{wo.title}</h1>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {job ? job.customerName : "—"}{job ? ` · ${job.title}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {wo.status === "pending" && (
              <button onClick={() => setStatus("in_progress")} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: "#4f46e5" }}>
                <Play className="w-4 h-4" /> Start work
              </button>
            )}
            {wo.status === "in_progress" && (
              <button onClick={() => setStatus("completed")} disabled={!checklistMet} title={checklistMet ? "" : "Complete required checklist items first"}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white disabled:opacity-40" style={{ backgroundColor: "#16a34a" }}>
                <CheckCircle2 className="w-4 h-4" /> Mark complete
              </button>
            )}
            <ActionsMenu actions={[
              job && { label: "Open job", icon: Briefcase, onClick: () => router.push(`/jobs/${job.id}`) },
              job && { label: "Open customer", icon: User, onClick: () => router.push(`/customers/${job.accountId}`) },
              job && { label: "Schedule return visit", icon: Repeat, onClick: () => setReturnOpen(true) },
              wo.status === "completed" && { label: "Reopen work order", icon: RotateCcw, onClick: () => setStatus("in_progress"), separated: true },
            ]} />
          </div>
        </div>
        <DetailTabs tabs={TABS} active={tab} onChange={setTab} className="px-6 py-2" />
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {tab === "Overview" && (
          <div className="flex flex-col gap-5 h-full min-h-0">
            {/* Summary stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Stat icon={Activity} label="Status" value={st.label} accent={st.color} sub={wo.completedAt ? `Done ${new Date(wo.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : undefined} />
              <Stat icon={Briefcase} label="Job Type" value={job ? cap(job.type) : "—"} sub={job?.title} />
              <Stat icon={CheckCircle2} label="Checklist" value={`${checklistDone}/${wo.checklist.length}`} sub="items done" />
              {showPricing
                ? <Stat icon={DollarSign} label="Parts & Labor" value={fmtCurrency(subtotal)} sub={`${lineCount} line${lineCount === 1 ? "" : "s"}`} />
                : <Stat icon={Package} label="Parts & Labor" value={String(lineCount)} sub="items logged" />}
              <Stat icon={Calendar} label="Visits" value={String(visits.length)} sub={visits.length ? undefined : "None scheduled"} />
              <Stat icon={ImageIcon} label="Photos" value={String(images.length)} sub="attached" />
            </div>

            {/* Details + side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <DCard className="p-4 lg:col-span-2">
                <DLabel>Work Order Details</DLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3">
                  <DRow icon={Briefcase} label="Linked Job" value={job?.title} />
                  <DRow icon={Tag} label="Job Type" value={job ? cap(job.type) : "—"} />
                  <DRow icon={User} label="Customer" value={job?.customerName} />
                  <DRow icon={MapPin} label="Property" value={job?.propertyAddress} />
                  <DRow icon={Users} label="Technician" value={job?.assignedTo} />
                  <DRow icon={Building2} label="Branch" value={job?.locationName} />
                  <DRow icon={Calendar} label="Scheduled" value={job?.scheduledDate ? `${job.scheduledDate}${job.scheduledTime ? ` · ${job.scheduledTime}` : ""}` : "—"} />
                  <DRow icon={Clock} label="Completed" value={wo.completedAt ? new Date(wo.completedAt).toLocaleString() : "—"} />
                </div>
                <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <DLabel>Scope &amp; Instructions</DLabel>
                  <p className="text-sm mt-2 whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text-secondary)" }}>{wo.instructions?.trim() || "No instructions on this work order yet."}</p>
                </div>
                {(wo.findings || wo.recommendations) && (
                  <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <DLabel>Field Notes</DLabel>
                    {wo.findings && <div className="mt-2"><p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Findings</p><p className="text-sm" style={{ color: "var(--text-secondary)" }}>{wo.findings}</p></div>}
                    {wo.recommendations && <div className="mt-2"><p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Recommendations</p><p className="text-sm" style={{ color: "var(--text-secondary)" }}>{wo.recommendations}</p></div>}
                  </div>
                )}
              </DCard>

              <div className="flex flex-col gap-4">
                {job && (
                  <DCard className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <DLabel>Linked Job</DLabel>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: resolveJobTypeColor(job.type) }} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{job.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <StatusBadge label={JOB_STATUS_CONFIG[job.status]?.label ?? job.status} color={JOB_STATUS_CONFIG[job.status]?.color ?? "#9ca3af"} size="sm" />
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>· {cap(job.type)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Link href={`/jobs/${job.id}`} className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        <Briefcase className="w-3.5 h-3.5" /> Open Job
                      </Link>
                      <Link href={`/customers/${job.accountId}`} className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        <User className="w-3.5 h-3.5" /> Customer
                      </Link>
                    </div>
                  </DCard>
                )}

                {showPricing && (
                  <DCard className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <DLabel>Billing</DLabel>
                      {(quotes.length + invoices.length) > 0 && <button onClick={() => setTab("Invoices")} className="text-[11px] font-medium hover:underline" style={{ color: "var(--accent-text)" }}>View</button>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <MiniKpi icon={FilePen} label="Quotes" value={quotes.length} />
                      <MiniKpi icon={Receipt} label="Invoices" value={invoices.length} />
                    </div>
                  </DCard>
                )}

                {customer && (
                  <DCard className="p-4">
                    <DLabel>Customer</DLabel>
                    <p className="text-sm font-medium mt-2" style={{ color: "var(--text-primary)" }}>{customer.name}</p>
                    <div className="flex flex-col gap-1 mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      {customer.phone && <span className="inline-flex items-center gap-1.5"><Phone className="w-3 h-3" /> {customer.phone}</span>}
                      {customer.email && <span className="inline-flex items-center gap-1.5"><Mail className="w-3 h-3" /> {customer.email}</span>}
                    </div>
                  </DCard>
                )}

                <DCard className="p-4">
                  <DLabel>Completion Requirements</DLabel>
                  <div className="space-y-1.5 mt-3">
                    <ReqRow met={checklistMet} label={reqItems.length ? `Required checklist (${reqDone}/${reqItems.length})` : "No required checklist items"} />
                    <ReqRow met={photosMet} label={photosMet ? `${images.length} photo${images.length === 1 ? "" : "s"} attached` : "Required photos"} />
                  </div>
                </DCard>
              </div>
            </div>

            {/* Checklist + Visits — fill the remaining height */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
              <DCard className="lg:col-span-2 overflow-hidden flex flex-col min-h-0">
                <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Checklist</p>
                  {wo.checklist.length > 0 && <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{checklistDone}/{wo.checklist.length}</span>}
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 p-4">
                  {wo.checklist.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>No checklist items.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {[...wo.checklist].sort((a, b) => a.sortOrder - b.sortOrder).map(c => (
                        <button key={c.id} onClick={() => toggle(c.id)} className="flex items-start gap-2 w-full text-left group">
                          {c.isComplete
                            ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#16a34a" }} />
                            : <Circle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
                          <span className="text-sm" style={{ color: c.isComplete ? "var(--text-muted)" : "var(--text-secondary)", textDecoration: c.isComplete ? "line-through" : "none" }}>
                            {c.label}
                            {c.required && <span className="ml-1.5 text-[10px] font-semibold" style={{ color: "#dc2626" }}>Required</span>}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </DCard>

              <DCard className="overflow-hidden flex flex-col min-h-0">
                <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Visits</p>
                  {visits.length > 0 && <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{visits.length}</span>}
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 p-4">
                  {visits.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>No visit scheduled.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {visits.map(v => {
                        const vt = v.visitType ? VISIT_TYPE_CONFIG[v.visitType] : undefined;
                        const as = APPT_STATUS[v.status];
                        return (
                          <div key={v.id} className="pb-2.5 last:pb-0" style={{ borderBottom: visits.length > 1 ? "1px solid var(--border)" : "none" }}>
                            <div className="flex items-center gap-2 flex-wrap">
                              {vt && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: vt.color + "22", color: vt.color }}>{vt.short}</span>}
                              <StatusBadge label={as.label} color={as.color} size="sm" />
                            </div>
                            <div className="flex flex-col gap-1 mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                              <span className="inline-flex items-center gap-1.5"><Clock className="w-3 h-3" /> {v.scheduledDate || "Unscheduled"}{v.scheduledTime ? ` · ${v.scheduledTime}` : ""} · {v.durationMinutes} min</span>
                              <span className="inline-flex items-center gap-1.5"><Users className="w-3 h-3" /> {v.techIds.length ? v.techIds.join(", ") : "Unassigned"}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </DCard>
            </div>
          </div>
        )}

        {tab === "Parts & Labor" && <WorkOrderBilling workOrderId={wo.id} />}

        {tab === "Quotes" && (
          <BillingTab title="Quotes" emptyText="No quotes raised from this work order yet." onNew={newQuote} newLabel="New Quote"
            rows={quotes.map(q => ({ id: q.id, href: `/quotes/${q.id}`, number: q.quoteNumber, sub: q.title, total: q.total, status: QUOTE_STATUS_STYLE[q.status].label, color: QUOTE_STATUS_STYLE[q.status].color }))} />
        )}

        {tab === "Invoices" && (
          <BillingTab title="Invoices" emptyText="No invoices built from this work order yet." onNew={newInvoice} newLabel="New Invoice"
            rows={invoices.map(inv => ({ id: inv.id, href: `/invoices/${inv.id}`, number: inv.invoiceNumber, sub: inv.title, total: inv.total, status: INVOICE_STATUS_STYLE[inv.status].label, color: INVOICE_STATUS_STYLE[inv.status].color }))} />
        )}

        {tab === "Photos & Files" && job && (
          <PhotoGallery recordLevel="work_order" scope={{ workOrderId: wo.id, jobId: job.id, accountId: job.accountId }} accountName={job.customerName} />
        )}

        {tab === "Activity" && <ActivityTimeline entries={activity} />}
      </div>

      {returnOpen && job && <ReturnVisitModal job={job} onClose={() => setReturnOpen(false)} onScheduled={() => setReturnOpen(false)} />}
    </div>
  );
}

// ─── Overview presentational primitives (match Customer/Project/Agreement overviews) ──
type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

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
function DRow({ icon: Icon, label, value }: { icon?: IconType; label: string; value: React.ReactNode }) {
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
function MiniKpi({ icon: Icon, label, value }: { icon: IconType; label: string; value: number }) {
  return (
    <div className="rounded-lg px-2.5 py-2 flex items-center gap-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
      <div className="min-w-0">
        <p className="text-base font-bold leading-none" style={{ color: "var(--text-primary)" }}>{value}</p>
        <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
    </div>
  );
}

// Minimal accent action — matches the "New Quote / New Invoice" buttons on the
// project detail page (tinted circular Plus + chip, no heavy fill).
function MiniAction({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="group flex items-center gap-1.5 text-xs font-medium transition-colors" style={{ color: "#4f46e5" }}>
      <span className="w-4 h-4 rounded-full flex items-center justify-center transition-all group-hover:brightness-95" style={{ backgroundColor: "#4f46e51a" }}><Plus className="w-3 h-3" /></span>
      {children}
    </button>
  );
}

// Full-width, viewport-adaptive Quotes / Invoices tab — header (count + New) over
// a scrollable list. Fills the available height like the Overview tab.
interface BillingRow { id: string; href: string; number: string; sub?: string; total: number; status: string; color: string }
function BillingTab({ title, emptyText, rows, onNew, newLabel }: {
  title: string; emptyText: string; rows: BillingRow[]; onNew: () => void; newLabel: string;
}) {
  return (
    <DCard className="w-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title} ({rows.length})</p>
        <MiniAction onClick={onNew}>{newLabel}</MiniAction>
      </div>
      <div>
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>{emptyText}</p></div>
        ) : rows.map((r, i) => (
          <Link key={r.id} href={r.href}
            className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
            style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono font-medium" style={{ color: "var(--text-primary)" }}>{r.number}</p>
              {r.sub && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{r.sub}</p>}
            </div>
            <StatusBadge label={r.status} color={r.color} className="shrink-0" />
            <span className="text-sm font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{r.total > 0 ? fmtCurrency(r.total) : "TBD"}</span>
          </Link>
        ))}
      </div>
    </DCard>
  );
}

// Activity timeline — same treatment as the Project / Agreement activity tabs:
// a tinted status icon on a connector line, then a surface card with a status
// pill, the title, meta, and who/when.
interface ActivityEntry { icon: IconType; color: string; label: string; title: string; meta?: string; user?: string; date?: string }
function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="py-12 text-center rounded-xl" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No activity yet</p>
      </div>
    );
  }
  return (
    <div className="w-full">
      {entries.map((e, i) => {
        const Icon = e.icon;
        const last = i === entries.length - 1;
        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center z-10" style={{ backgroundColor: e.color + "1a", border: `1px solid ${e.color}33` }}>
                <Icon className="w-3.5 h-3.5" style={{ color: e.color }} />
              </div>
              {!last && <div className="w-px flex-1 my-1" style={{ backgroundColor: "var(--border-subtle)" }} />}
            </div>
            <div className="flex-1 min-w-0 rounded-xl px-4 py-3 mb-3 flex flex-col" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", minHeight: 76 }}>
              <div className="flex items-start justify-between gap-3">
                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0" style={{ backgroundColor: e.color + "1a", color: e.color }}>{e.label}</span>
                {e.date && <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{e.date}</span>}
              </div>
              <p className="text-sm font-medium mt-1.5 break-words leading-relaxed" style={{ color: "var(--text-primary)" }}>{e.title}</p>
              {e.meta && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{e.meta}</p>}
              <div className="flex items-center gap-1.5 mt-auto pt-1.5">
                <User className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{e.user || "System"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReqRow({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {met
        ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#16a34a" }} />
        : <Circle className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
      <span className="text-sm" style={{ color: met ? "var(--text-secondary)" : "var(--text-muted)" }}>{label}</span>
    </div>
  );
}
