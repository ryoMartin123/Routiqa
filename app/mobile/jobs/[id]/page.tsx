"use client";

// ─── Technician job command screen ────────────────────────
// One job, one clear next action. The bottom is a single status-based primary
// CTA (Scheduled → Start Route, En route → Arrived, In progress → Complete…),
// with secondary transitions tucked beneath it. Contact actions are a compact
// row; the contextual "+" opens job quick-actions. No global search/nav bar here.

import { useMemo, useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Phone, MessageSquare, Navigation, Camera, User, Clock, MapPin, AlertTriangle,
  FileText, ClipboardCheck, Wrench, ChevronRight, Briefcase, CheckCircle2, Circle,
  Plus, PlusCircle, X, StickyNote, Package, CheckSquare, Flag, Play, DollarSign, Trash2,
  Receipt, Search, Pencil,
} from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Section, Card, DetailRow, StatusChip, EmptyState, prettyType, ACCENT } from "@/components/mobile/ui";
import { getJob, getWorkOrder, updateWorkOrderById, type JobStatus, type WorkOrderLineItem, type ChecklistItem } from "@/lib/jobs/data";
import { getAllItems, getItem, type Item } from "@/lib/items/data";
import { ITEM_TYPE_CONFIG } from "@/lib/items/types";
import { consumeFromTruck, returnToTruck, findStockItem } from "@/lib/inventory/data";
import { techTruckName } from "@/lib/mobile/truck";
import { getTasksForJob } from "@/lib/tasks/data";
import { getCustomer } from "@/lib/customers/data";
import { getFiles } from "@/lib/files/data";
import { getJobPhotoChecklist, checklistProgress } from "@/lib/files/checklist";
import PhotoCapture from "@/components/mobile/PhotoCapture";
import BottomSheet from "@/components/mobile/BottomSheet";
import { primaryAction, secondaryActions, setMyJobStatus, getMobileCaps, getCurrentTech } from "@/lib/mobile/data";
import { getJobMaterials, addJobMaterial, removeJobMaterial } from "@/lib/mobile/materials";
import { getAllInvoices, recordPayment, createInvoiceFromWorkOrder, type InvoiceRecord } from "@/lib/quotes/data";
import { getAppointmentsForJob, updateAppointment } from "@/lib/appointments/data";

const PRIMARY_ICON: Partial<Record<JobStatus, React.ElementType>> = {
  en_route: Flag, in_progress: CheckCircle2, waiting_on_parts: Play, waiting_on_customer: Play,
};
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Catalog item → work-order line kind (part / labor / fee).
const kindForItemType = (t: Item["type"]): WorkOrderLineItem["kind"] =>
  t === "labor" || t === "service" ? "labor"
  : t === "fee" || t === "discount" || t === "membership" ? "fee"
  : "part";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [capture, setCapture] = useState(false);
  const [qa, setQa] = useState(false);
  const [matSheet, setMatSheet] = useState(false);
  const [catalogSheet, setCatalogSheet] = useState(false);
  const [customLineSheet, setCustomLineSheet] = useState(false);
  const [signSheet, setSignSheet] = useState(false);
  const [paySheet, setPaySheet] = useState<InvoiceRecord | null>(null);
  const caps = useMemo(() => getMobileCaps(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick forces a re-read after a status change
  const job = useMemo(() => getJob(id), [id, tick]);
  const customer = useMemo(() => (job ? getCustomer(job.accountId) : undefined), [job]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tasks = useMemo(() => (job ? getTasksForJob(job.id) : []), [job, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick refreshes after capture
  const photos = useMemo(() => (job ? getFiles({ jobId: job.id }) : []), [job, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checklist = useMemo(() => (job ? getJobPhotoChecklist(job.id, job.type) : []), [job, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const materials = useMemo(() => (job ? getJobMaterials(job.id) : []), [job, tick]);
  // Priced work order for field-pricing techs — the same lineItems store the desktop
  // WorkOrderBilling + Create-invoice bridge use.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const wo = useMemo(() => (job ? getWorkOrder(job.id) : undefined), [job, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catalog = useMemo(() => (job ? getAllItems().filter(i => i.active && i.companyId === job.companyId) : []), [job]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const invoices = useMemo(() => (job && caps.invoicesView ? getAllInvoices().filter(i => i.jobId === job.id) : []), [job, tick]);

  if (!job) {
    return (<div><MobileHeader title="Job" back /><EmptyState icon={Briefcase} title="Job not found" hint="It may have been removed or reassigned." /></div>);
  }

  // Scheduled jobs lead with in-app navigation; everything else is a status step.
  const startRoute = (job.status === "scheduled" || job.status === "new") && !!job.propertyAddress;
  const primary = startRoute ? null : primaryAction(job.status);
  const secondary = secondaryActions(job.status);
  const PrimIcon = primary ? PRIMARY_ICON[primary.to] : undefined;
  const go = (to: JobStatus) => { setMyJobStatus(job.id, to); setTick(t => t + 1); };
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.propertyAddress || job.customerName)}`;
  const hasBottom = startRoute || !!primary || secondary.length > 0;
  const prog = checklistProgress(checklist);

  // ── Priced Parts & Labor (field-pricing techs) ──
  const partsPriced = caps.woPricing && !!wo;
  const woLines = wo?.lineItems ?? [];
  const woSubtotal = woLines.reduce((s, li) => s + li.qty * li.unitPrice, 0);
  const saveWoLines = (lines: WorkOrderLineItem[]) => {
    if (wo) updateWorkOrderById(wo.id, { lineItems: lines });
    setTick(t => t + 1);
  };
  const truckName = techTruckName(getCurrentTech());
  const addCatalogLine = (it: Item) => {
    const qty = it.defaultQuantity || 1;
    saveWoLines([...woLines, {
      id: `woli-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      kind: kindForItemType(it.type), description: it.name, qty,
      unitPrice: it.unitPrice, itemId: it.id, taxable: it.taxable, unitCost: it.unitCost,
    }]);
    // Deduct from the tech's truck when the part is stocked there (services/labor no-op).
    if (it.sku && truckName) consumeFromTruck(it.sku, truckName, qty, { jobId: job.id, createdBy: getCurrentTech().fullName, notes: wo?.title });
  };
  const addCustomLine = (name: string, qty: number, price: number) => saveWoLines([...woLines, {
    id: `woli-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, kind: "part", description: name, qty, unitPrice: price,
  }]);
  const removeWoLine = (lineId: string) => {
    const line = woLines.find(l => l.id === lineId);
    saveWoLines(woLines.filter(l => l.id !== lineId));
    // Put truck stock back if this line consumed it.
    const sku = line?.itemId ? getItem(line.itemId)?.sku : undefined;
    if (sku && truckName) returnToTruck(sku, truckName, line!.qty);
  };
  const invoiceFromWo = () => {
    if (!wo) return;
    const inv = createInvoiceFromWorkOrder(wo.id);
    setTick(t => t + 1);
    if (inv) setPaySheet(inv);   // straight to Collect payment
  };
  // ── Multi-day context: which day of the run is this, and what did the
  //    previous day's crew leave behind? ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dayVisits = useMemo(() =>
    getAppointmentsForJob(id).filter(a => a.scheduledDate && a.status !== "canceled")
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
    [id, tick]);
  const todayISO = new Date().toISOString().slice(0, 10);
  const multiDay = dayVisits.length >= 2;
  // Today's visit, else the next upcoming, else the last one.
  const dayIdx = (() => {
    const t = dayVisits.findIndex(v => v.scheduledDate === todayISO);
    if (t >= 0) return t;
    const up = dayVisits.findIndex(v => v.scheduledDate > todayISO);
    return up >= 0 ? up : dayVisits.length - 1;
  })();
  const currentVisit = multiDay ? dayVisits[dayIdx] : undefined;
  const handoffFrom = multiDay
    ? [...dayVisits.slice(0, dayIdx)].reverse().find(v => v.handoffNote?.trim())
    : undefined;

  const woDone = (wo?.checklist ?? []).filter(c => c.isComplete).length;
  const patchWoItem = (ciId: string, patch: Partial<ChecklistItem>) => {
    if (wo) updateWorkOrderById(wo.id, { checklist: wo.checklist.map(c => c.id === ciId ? { ...c, ...patch } : c) });
    setTick(t => t + 1);
  };
  const saveSignature = (name: string, dataUrl: string) => {
    if (wo) updateWorkOrderById(wo.id, { signatureName: name, signatureDataUrl: dataUrl, signedAt: new Date().toISOString() });
    setTick(t => t + 1);
  };

  return (
    <div>
      <MobileHeader title={job.customerName} subtitle={prettyType(job.type)} back
        right={<div className="flex items-center gap-1.5">
          <StatusChip status={job.status} />
          <button onClick={() => setQa(true)} aria-label="Quick actions" className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}><Plus className="w-4 h-4" /></button>
        </div>} />

      <div className="px-4 space-y-5" style={{ paddingBottom: hasBottom ? 132 : 24 }}>
        {/* Compact contact row */}
        <div className="flex gap-2">
          <ContactBtn icon={Phone} label="Call" href={customer?.phone ? `tel:${customer.phone}` : undefined} />
          <ContactBtn icon={MessageSquare} label="Message" href={customer?.phone ? `sms:${customer.phone}` : undefined} />
          <ContactBtn icon={Navigation} label="Directions" to={`/mobile/navigate/${job.id}`} />
        </div>

        {/* Appointment */}
        <Section title="Appointment">
          <Card>
            {(job.priority === "urgent" || job.priority === "high") && (
              <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: job.priority === "urgent" ? "#dc2626" : "#f59e0b" }} />
                <span className="text-sm font-semibold capitalize" style={{ color: "var(--text-primary)" }}>{job.priority} priority</span>
              </div>
            )}
            <DetailRow icon={Clock} label="Window" value={`${job.scheduledDate}${job.scheduledTime ? ` · ${job.scheduledTime}` : ""} (${job.durationMinutes} min)`} />
            <DetailRow icon={MapPin} label="Address" value={<a href={mapsHref} target="_blank" rel="noreferrer" style={{ color: ACCENT }}>{job.propertyAddress || "No address on file"}</a>} />
            <DetailRow icon={User} label="Assigned to" value={job.assignedTo} />
            {multiDay && <DetailRow icon={Flag} label="Multi-day job" value={`Day ${dayIdx + 1} of ${dayVisits.length}`} />}
          </Card>
        </Section>

        {/* Crew handoff — yesterday's note in, today's note out */}
        {multiDay && (
          <Section title="Crew handoff">
            <Card className="p-4 space-y-3">
              {handoffFrom && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                    From Day {dayVisits.indexOf(handoffFrom) + 1} · {new Date(`${handoffFrom.scheduledDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-primary)" }}>{handoffFrom.handoffNote}</p>
                </div>
              )}
              {currentVisit && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>End of Day {dayIdx + 1} — for the next crew</p>
                  <textarea defaultValue={currentVisit.handoffNote ?? ""} rows={2}
                    onBlur={e => { updateAppointment(currentVisit.id, { handoffNote: e.target.value }); setTick(t => t + 1); }}
                    placeholder="Where you left off, what to start on…"
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                    style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }} />
                </div>
              )}
            </Card>
          </Section>
        )}

        {/* Notes — internal customer notes only for roles the CRM grants the mask */}
        {(job.description || (caps.internalNotes && customer?.notes)) && (
          <Section title="Notes">
            <Card className="p-4 space-y-3">
              {job.description && <div><p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Job</p><p className="text-sm" style={{ color: "var(--text-primary)" }}>{job.description}</p></div>}
              {caps.internalNotes && customer?.notes && <div><p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Internal · customer</p><p className="text-sm" style={{ color: "var(--text-secondary)" }}>{customer.notes}</p></div>}
            </Card>
          </Section>
        )}

        {/* Photos */}
        <Section title="Photos" action={<span className="text-xs" style={{ color: "var(--text-muted)" }}>{prog.done}/{prog.total} required</span>}>
          {checklist.length > 0 && (
            <Card className="p-3 mb-2.5">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {checklist.map(c => (
                  <span key={c.key} className="inline-flex items-center gap-1.5 text-xs">
                    {c.captured ? <CheckCircle2 className="w-4 h-4" style={{ color: "#16a34a" }} /> : <Circle className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
                    <span style={{ color: c.captured ? "var(--text-secondary)" : "var(--text-muted)" }}>{c.name}</span>
                  </span>
                ))}
              </div>
            </Card>
          )}
          <div className="grid grid-cols-3 gap-2.5">
            <button onClick={() => setCapture(true)} className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-transform"
              style={{ border: `1.5px dashed ${ACCENT}66`, backgroundColor: ACCENT + "0d" }}>
              <Camera className="w-6 h-6" style={{ color: ACCENT }} /><span className="text-[11px] font-medium" style={{ color: ACCENT }}>Add</span>
            </button>
            {photos.map(p => (
              <div key={p.id} className="relative aspect-square rounded-2xl flex items-center justify-center overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                {p.previewUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                  : <Camera className="w-5 h-5" style={{ color: "var(--text-muted)" }} />}
                {p.phase && <span className="absolute top-1 left-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white capitalize" style={{ backgroundColor: p.phase === "before" ? "#239c8d" : p.phase === "during" ? "#3b82f6" : "#10b981" }}>{p.phase}</span>}
              </div>
            ))}
          </div>
        </Section>

        {/* Work order checklist (typed steps) + job tasks */}
        <Section title="Checklist & tasks"
          action={wo && wo.checklist.length > 0 ? <span className="text-xs" style={{ color: "var(--text-muted)" }}>{woDone}/{wo.checklist.length}</span> : undefined}>
          {(!wo || wo.checklist.length === 0) && tasks.length === 0 ? (
            <Card className="px-4 py-5"><p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>No checklist items for this job.</p></Card>
          ) : (
            <>
              {wo && wo.checklist.length > 0 && (
                <Card className={tasks.length > 0 ? "mb-2.5" : undefined}>
                  {[...wo.checklist].sort((a, b) => a.sortOrder - b.sortOrder).map((c, i) => (
                    <WoStep key={c.id} item={c} first={i === 0}
                      onToggle={() => patchWoItem(c.id, { isComplete: !c.isComplete })}
                      onPatch={patch => patchWoItem(c.id, patch)} />
                  ))}
                </Card>
              )}
              {tasks.length > 0 && (
                <Card>
                  {tasks.map((t, i) => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                      <ClipboardCheck className="w-4 h-4 shrink-0" style={{ color: t.status === "completed" ? "#16a34a" : "var(--text-muted)" }} />
                      <span className="text-sm flex-1" style={{ color: "var(--text-primary)", textDecoration: t.status === "completed" ? "line-through" : "none" }}>{t.title}</span>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}
        </Section>

        {/* Parts & Labor — priced, catalog-backed (field-pricing techs). Same WO
            lineItems the desktop uses; turns into an invoice right here. */}
        {partsPriced ? (
          <Section title="Parts & labor" action={woLines.length > 0 ? <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--text-secondary)" }}>{money(woSubtotal)}</span> : undefined}>
            <Card>
              {woLines.map((li, i) => (
                <div key={li.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <Package className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{li.description}</p>
                    <p className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{li.qty} × {money(li.unitPrice)}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{money(li.qty * li.unitPrice)}</span>
                  <button onClick={() => removeWoLine(li.id)} aria-label="Remove" className="p-1.5 -mr-1.5 active:opacity-60"><Trash2 className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></button>
                </div>
              ))}
              <button onClick={() => setCatalogSheet(true)} className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-[var(--bg-surface-2)]" style={{ borderTop: woLines.length ? "1px solid var(--border)" : "none" }}>
                <PlusCircle className="w-4 h-4" style={{ color: ACCENT }} /><span className="text-sm flex-1 text-left font-medium" style={{ color: ACCENT }}>Add from catalog</span><ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              </button>
              <button onClick={() => setCustomLineSheet(true)} className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-[var(--bg-surface-2)]" style={{ borderTop: "1px solid var(--border)" }}>
                <Wrench className="w-4 h-4" style={{ color: "var(--text-muted)" }} /><span className="text-sm flex-1 text-left" style={{ color: "var(--text-primary)" }}>Add custom line</span><ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              </button>
            </Card>
            {woLines.length > 0 && (
              <button onClick={invoiceFromWo} className="w-full min-h-[50px] mt-2.5 rounded-2xl flex items-center justify-center gap-2 text-[15px] font-bold text-white active:scale-[0.99] transition-transform" style={{ backgroundColor: "#16a34a" }}>
                <Receipt className="w-5 h-5" /> Invoice &amp; collect · {money(woSubtotal)}
              </button>
            )}
          </Section>
        ) : (
          /* Usage-only log (office prices it) */
          <Section title="Materials & equipment" action={materials.length > 0 ? <span className="text-xs" style={{ color: "var(--text-muted)" }}>{materials.length} logged</span> : undefined}>
            <Card>
              {materials.map((m, i) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <Package className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <span className="text-sm flex-1 truncate" style={{ color: "var(--text-primary)" }}>{m.name}</span>
                  <span className="text-sm tabular-nums" style={{ color: "var(--text-secondary)" }}>× {m.qty}</span>
                  <button onClick={() => { removeJobMaterial(job.id, m.id); setTick(t => t + 1); }} aria-label={`Remove ${m.name}`} className="p-1.5 -mr-1.5 active:opacity-60">
                    <Trash2 className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  </button>
                </div>
              ))}
              <button onClick={() => setMatSheet(true)} className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-[var(--bg-surface-2)]" style={{ borderTop: materials.length ? "1px solid var(--border)" : "none" }}>
                <Wrench className="w-4 h-4" style={{ color: ACCENT }} /><span className="text-sm flex-1 text-left font-medium" style={{ color: ACCENT }}>Log materials used</span><ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              </button>
            </Card>
          </Section>
        )}

        {/* Customer / property / equipment */}
        {caps.customersView && (
          <Link href={`/mobile/customers/${job.accountId}`} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl active:bg-[var(--bg-surface-2)]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
            <FileText className="w-4 h-4" style={{ color: "var(--text-muted)" }} /><span className="text-sm flex-1 text-left" style={{ color: "var(--text-primary)" }}>Customer, property &amp; equipment</span><ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </Link>
        )}

        {/* Customer sign-off — capture approval / completion signature on the WO */}
        {wo && (
          <Section title="Customer sign-off">
            <Card className="p-4">
              {wo.signatureDataUrl ? (
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={wo.signatureDataUrl} alt="Signature" className="w-full rounded-xl" style={{ height: 120, objectFit: "contain", backgroundColor: "#fff", border: "1px solid var(--border)" }} />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Signed by <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{wo.signatureName || "Customer"}</span></p>
                    <button onClick={() => setSignSheet(true)} className="text-xs font-semibold active:opacity-60" style={{ color: ACCENT }}>Re-sign</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setSignSheet(true)} className="w-full min-h-[48px] rounded-2xl flex items-center justify-center gap-2 text-[15px] font-semibold active:scale-[0.99] transition-transform" style={{ border: `1.5px dashed ${ACCENT}66`, color: ACCENT, backgroundColor: ACCENT + "0d" }}>
                  <Pencil className="w-4 h-4" /> Get customer signature
                </button>
              )}
            </Card>
          </Section>
        )}

        {/* Financials — only when the CRM reveals totals to this role */}
        {caps.financials && (job.estimatedAmount || invoices.length > 0) && (
          <Section title="Financials">
            <Card>
              {job.estimatedAmount && <DetailRow icon={DollarSign} label="Estimated" value={job.estimatedAmount} />}
              {invoices.map(inv => (
                <div key={inv.id} className="px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{inv.invoiceNumber} · ${inv.total.toLocaleString("en-US")}</p>
                      <p className="text-xs capitalize" style={{ color: inv.balanceDue > 0 ? "#d97706" : "#16a34a" }}>
                        {inv.balanceDue > 0 ? `$${inv.balanceDue.toLocaleString("en-US")} due` : inv.status.replace(/_/g, " ")}
                      </p>
                    </div>
                    {caps.collectPayments && inv.balanceDue > 0 && (
                      <button onClick={() => setPaySheet(inv)} className="shrink-0 px-3 py-2 rounded-xl text-[13px] font-bold text-white active:scale-95 transition-transform" style={{ backgroundColor: "#16a34a" }}>
                        Collect payment
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          </Section>
        )}
      </div>

      {/* One sticky, status-based primary action */}
      {hasBottom && (
        <div className="fixed left-0 right-0 bottom-0 z-40 px-4 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.85rem)", backgroundColor: "var(--bg-page)", borderTop: "1px solid var(--border)", boxShadow: "0 -8px 24px -12px rgba(0,0,0,0.3)" }}>
          {startRoute ? (
            <Link href={`/mobile/navigate/${job.id}`} className="w-full min-h-[54px] rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-white active:scale-[0.99] transition-transform" style={{ backgroundColor: ACCENT, boxShadow: `0 10px 28px -10px ${ACCENT}` }}>
              <Navigation className="w-5 h-5" /> Start Route
            </Link>
          ) : primary ? (
            <button onClick={() => go(primary.to)} className="w-full min-h-[54px] rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-white active:scale-[0.99] transition-transform" style={{ backgroundColor: ACCENT, boxShadow: `0 10px 28px -10px ${ACCENT}` }}>
              {PrimIcon && <PrimIcon className="w-5 h-5" />} {primary.label}
            </button>
          ) : null}
          {secondary.length > 0 && (
            <div className="flex items-center justify-center gap-5 mt-2.5">
              {secondary.map(s => (
                <button key={s.to} onClick={() => go(s.to)} className="text-[13px] font-semibold active:opacity-60" style={{ color: s.tone === "warn" ? "#d97706" : "var(--text-muted)" }}>{s.label}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <QuickSheet open={qa} onClose={() => setQa(false)}
        onPhoto={() => { setQa(false); setCapture(true); }}
        onTask={() => { setQa(false); router.push("/mobile/tasks"); }} />

      <PhotoCapture open={capture} onClose={() => setCapture(false)} accountId={job.accountId} accountName={job.customerName}
        jobId={job.id} defaultCategory={checklist.find(c => !c.captured)?.key} onSaved={() => setTick(t => t + 1)} />

      <MaterialSheet open={matSheet} onClose={() => setMatSheet(false)} jobId={job.id} onSaved={() => setTick(t => t + 1)} />
      <CatalogSheet open={catalogSheet} onClose={() => setCatalogSheet(false)} items={catalog} truckName={truckName} onAdd={addCatalogLine} />
      <CustomLineSheet open={customLineSheet} onClose={() => setCustomLineSheet(false)} onAdd={addCustomLine} />
      {signSheet && <SignatureSheet defaultName={job.customerName} onClose={() => setSignSheet(false)} onSave={saveSignature} />}
      {caps.collectPayments && <PaymentSheet invoice={paySheet} onClose={() => setPaySheet(null)} onSaved={() => setTick(t => t + 1)} />}
    </div>
  );
}

// Log a material/part against the job (name + qty) — writes the field store.
function MaterialSheet({ open, onClose, jobId, onSaved }: { open: boolean; onClose: () => void; jobId: string; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const save = () => {
    if (!name.trim()) return;
    addJobMaterial(jobId, name, qty, getCurrentTech().fullName);
    setName(""); setQty(1); onSaved(); onClose();
  };
  return (
    <BottomSheet open={open} onClose={onClose} title="Log material" subtitle="Recorded on this job for the office">
      <div className="space-y-3 pb-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 40/5 µF dual run capacitor" autoFocus={open}
          className="w-full rounded-xl px-3.5 py-3 text-[15px] outline-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }} />
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium flex-1" style={{ color: "var(--text-secondary)" }}>Quantity</span>
          <div className="flex items-center rounded-xl" style={{ border: "1px solid var(--border)" }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-4 py-2.5 text-lg active:opacity-60" style={{ color: "var(--text-secondary)" }}>−</button>
            <span className="w-8 text-center text-[15px] font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{qty}</span>
            <button onClick={() => setQty(q => q + 1)} className="px-4 py-2.5 text-lg active:opacity-60" style={{ color: "var(--text-secondary)" }}>+</button>
          </div>
        </div>
        <button onClick={save} disabled={!name.trim()}
          className="w-full min-h-[50px] rounded-2xl text-base font-bold text-white active:scale-[0.99] transition-transform disabled:opacity-40"
          style={{ backgroundColor: ACCENT }}>
          Add to job
        </button>
      </div>
    </BottomSheet>
  );
}

// Pull a priced service/part from the catalog onto the work order (tap to add).
// Shows how many the tech has on their truck (by SKU) so they can see stock.
function CatalogSheet({ open, onClose, items, truckName, onAdd }: { open: boolean; onClose: () => void; items: Item[]; truckName?: string; onAdd: (it: Item) => void }) {
  const [q, setQ] = useState("");
  const filtered = items.filter(i => !q || i.name.toLowerCase().includes(q.toLowerCase()) || (i.sku ?? "").toLowerCase().includes(q.toLowerCase()));
  return (
    <BottomSheet open={open} onClose={onClose} title="Add from catalog" subtitle={truckName ? `Tap to add · stock shown for ${truckName}` : "Services & common parts — tap to add"}>
      <div className="pb-2">
        <div className="flex items-center gap-2 rounded-xl px-3.5 mb-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)" }}>
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search services & parts" autoFocus={open}
            className="flex-1 py-3 text-[15px] outline-none bg-transparent" style={{ color: "var(--text-primary)" }} />
        </div>
        <div className="max-h-[52vh] overflow-y-auto -mx-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No matching items.</p>
          ) : filtered.map(it => {
            const cfg = ITEM_TYPE_CONFIG[it.type];
            const stock = it.sku && truckName ? findStockItem(it.sku, truckName) : undefined;
            return (
              <button key={it.id} onClick={() => onAdd(it)} className="w-full flex items-center gap-2.5 px-3 py-3 rounded-xl active:bg-[var(--bg-surface-2)]">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{it.name}</p>
                  {stock && <p className="text-[11px]" style={{ color: stock.qtyOnHand > 0 ? "#059669" : "#dc2626" }}>{stock.qtyOnHand > 0 ? `${stock.qtyOnHand} on truck` : "Out on truck"}</p>}
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>{money(it.unitPrice)}</span>
                <Plus className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}

// Add a one-off priced line that isn't in the catalog.
function CustomLineSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (name: string, qty: number, price: number) => void }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const save = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), qty, Number(price) || 0);
    setName(""); setQty(1); setPrice(""); onClose();
  };
  return (
    <BottomSheet open={open} onClose={onClose} title="Custom line" subtitle="A one-off part or charge not in the catalog">
      <div className="space-y-3 pb-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Custom fabricated bracket" autoFocus={open}
          className="w-full rounded-xl px-3.5 py-3 text-[15px] outline-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }} />
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium flex-1" style={{ color: "var(--text-secondary)" }}>Quantity</span>
          <div className="flex items-center rounded-xl" style={{ border: "1px solid var(--border)" }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-4 py-2.5 text-lg active:opacity-60" style={{ color: "var(--text-secondary)" }}>−</button>
            <span className="w-8 text-center text-[15px] font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{qty}</span>
            <button onClick={() => setQty(q => q + 1)} className="px-4 py-2.5 text-lg active:opacity-60" style={{ color: "var(--text-secondary)" }}>+</button>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl px-3.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)" }}>
          <span className="text-lg font-semibold" style={{ color: "var(--text-muted)" }}>$</span>
          <input value={price} onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" inputMode="decimal"
            className="flex-1 py-3 text-lg font-semibold outline-none bg-transparent" style={{ color: "var(--text-primary)" }} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>each</span>
        </div>
        <button onClick={save} disabled={!name.trim()}
          className="w-full min-h-[50px] rounded-2xl text-base font-bold text-white active:scale-[0.99] transition-transform disabled:opacity-40"
          style={{ backgroundColor: ACCENT }}>
          Add line
        </button>
      </div>
    </BottomSheet>
  );
}

// Sign-on-glass — the customer signs with a finger; saved as a PNG on the WO.
function SignatureSheet({ defaultName, onClose, onSave }: { defaultName: string; onClose: () => void; onSave: (name: string, dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const dirty = useRef(false);
  const [name, setName] = useState(defaultName);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.max(1, rect.width) * ratio;
    c.height = Math.max(1, rect.height) * ratio;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111827";
  }, []);

  const pt = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const down = (e: React.PointerEvent) => { drawing.current = true; last.current = pt(e); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current!.getContext("2d")!; const p = pt(e);
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p; dirty.current = true; if (!hasInk) setHasInk(true);
  };
  const up = () => { drawing.current = false; last.current = null; };
  const clear = () => { const c = canvasRef.current; if (!c) return; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); dirty.current = false; setHasInk(false); };
  const save = () => {
    const c = canvasRef.current; if (!c || !dirty.current) return;
    onSave(name.trim() || defaultName, c.toDataURL("image/png"));
    onClose();
  };

  return (
    <BottomSheet open onClose={onClose} title="Customer signature" subtitle="Sign in the box to approve">
      <div className="space-y-3 pb-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Signer name"
          className="w-full rounded-xl px-3.5 py-3 text-[15px] outline-none"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }} />
        <div className="relative">
          <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
            className="w-full rounded-xl touch-none" style={{ height: 180, border: "1px solid var(--border)", backgroundColor: "#fff", cursor: "crosshair" }} />
          {!hasInk && <span className="absolute inset-0 flex items-center justify-center text-sm pointer-events-none" style={{ color: "#9ca3af" }}>Sign here</span>}
          <button onClick={clear} className="absolute top-2 right-3 text-xs font-semibold active:opacity-60" style={{ color: "var(--text-muted)" }}>Clear</button>
        </div>
        <button onClick={save} disabled={!hasInk}
          className="w-full min-h-[50px] rounded-2xl text-base font-bold text-white active:scale-[0.99] transition-transform disabled:opacity-40"
          style={{ backgroundColor: "#16a34a" }}>
          Save signature
        </button>
      </div>
    </BottomSheet>
  );
}

// Collect a payment on an open invoice — records through the CRM store, so the
// office sees the invoice settle immediately. Only rendered for roles the CRM
// grants payments.create.
function PaymentSheet({ invoice, onClose, onSaved }: { invoice: InvoiceRecord | null; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const balance = invoice?.balanceDue ?? 0;
  const parsed = Math.min(balance, Number(amount) || 0);
  const collect = () => {
    if (!invoice || parsed <= 0) return;
    recordPayment(invoice.id, parsed);
    setAmount(""); onSaved(); onClose();
  };
  return (
    <BottomSheet open={!!invoice} onClose={onClose} title="Collect payment" subtitle={invoice ? `${invoice.invoiceNumber} · $${balance.toLocaleString("en-US")} due` : undefined}>
      <div className="space-y-3 pb-2">
        <div className="flex items-center gap-2 rounded-xl px-3.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-input)" }}>
          <span className="text-lg font-semibold" style={{ color: "var(--text-muted)" }}>$</span>
          <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={String(balance)}
            inputMode="decimal" className="flex-1 py-3 text-lg font-semibold outline-none bg-transparent" style={{ color: "var(--text-primary)" }} />
          <button onClick={() => setAmount(String(balance))} className="text-xs font-bold active:opacity-60" style={{ color: ACCENT }}>Full balance</button>
        </div>
        <button onClick={collect} disabled={parsed <= 0}
          className="w-full min-h-[50px] rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-white active:scale-[0.99] transition-transform disabled:opacity-40"
          style={{ backgroundColor: "#16a34a" }}>
          <DollarSign className="w-5 h-5" /> Collect {parsed > 0 ? `$${parsed.toLocaleString("en-US")}` : "payment"}
        </button>
        <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>Marks the invoice paid in the office instantly.</p>
      </div>
    </BottomSheet>
  );
}

function ContactBtn({ icon: Icon, label, href, to }: { icon: React.ElementType; label: string; href?: string; to?: string }) {
  const cls = "flex-1 min-h-[44px] rounded-xl flex items-center justify-center gap-1.5 text-[13px] font-semibold active:scale-[0.98] transition-transform";
  const enabled = !!(href || to);
  const style = { border: "1px solid var(--border)", color: enabled ? "var(--text-primary)" : "var(--text-muted)", backgroundColor: "var(--bg-surface)" } as React.CSSProperties;
  const inner = <><Icon className="w-4 h-4" /> {label}</>;
  if (to) return <Link href={to} className={cls} style={style}>{inner}</Link>;   // in-app route (built-in navigation)
  return href ? <a href={href} className={cls} style={style}>{inner}</a> : <span className={cls} style={{ ...style, opacity: 0.5 }}>{inner}</span>;
}

// Contextual quick actions for this job (separate from the status CTA).
function QuickSheet({ open, onClose, onPhoto, onTask }: { open: boolean; onClose: () => void; onPhoto: () => void; onTask: () => void }) {
  const ACTIONS = [
    { icon: StickyNote, label: "Add note", color: "#0f8578", onClick: onClose },
    { icon: Camera, label: "Take photo", color: "#0891b2", onClick: onPhoto },
    { icon: Package, label: "Add material", color: "#f59e0b", onClick: onClose },
    { icon: CheckSquare, label: "Create task", color: "#16a34a", onClick: onTask },
    { icon: AlertTriangle, label: "Log issue", color: "#dc2626", onClick: onClose },
  ];
  return (
    <div className={`fixed inset-0 z-[60] flex flex-col justify-end ${open ? "" : "pointer-events-none"}`} onClick={onClose}>
      <div className="absolute inset-0 transition-opacity duration-300" style={{ backgroundColor: "rgba(0,0,0,0.45)", opacity: open ? 1 : 0 }} />
      <div onClick={e => e.stopPropagation()} className="relative rounded-t-3xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] transition-transform duration-300"
        style={{ transform: open ? "translateY(0)" : "translateY(110%)", transitionTimingFunction: open ? "cubic-bezier(0.22,1,0.36,1)" : "cubic-bezier(0.55,0,1,0.45)", backgroundColor: "var(--bg-surface)", borderTop: "1px solid var(--border)", boxShadow: "0 -16px 48px rgba(0,0,0,0.35)" }}>
        <div className="w-9 h-1 rounded-full mx-auto mb-3" style={{ backgroundColor: "var(--border)" }} />
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Quick actions</p>
          <button onClick={onClose} className="p-1.5 rounded-full active:bg-[var(--bg-surface-2)]"><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {ACTIONS.map(a => (
            <button key={a.label} onClick={a.onClick} className="flex flex-col items-center gap-2 py-3.5 rounded-2xl active:scale-[0.97] transition-transform" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: a.color + "1a" }}><a.icon className="w-5 h-5" style={{ color: a.color }} /></span>
              <span className="text-[11px] font-medium text-center leading-tight" style={{ color: "var(--text-primary)" }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Typed work-order checklist step (mobile) ─────────────
// Same semantics as the desktop WO detail: answering a typed step sets its
// value AND completes it; clearing un-completes. Untyped check-off and photo
// steps are whole-row tap targets. Choice steps use touch chips, not dropdowns.
const stepInput = "w-full rounded-xl px-3 py-2.5 text-sm outline-none";
const stepInputStyle: React.CSSProperties = { border: "1px solid var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" };

function WoStep({ item, first, onToggle, onPatch }: {
  item: ChecklistItem;
  first: boolean;
  onToggle: () => void;
  onPatch: (p: Partial<ChecklistItem>) => void;
}) {
  const t = item.type;
  const answer = (value: string | string[], done: boolean) => onPatch({ value, isComplete: done });
  const strVal = typeof item.value === "string" ? item.value : "";
  const arrVal = Array.isArray(item.value) ? item.value : [];
  const tappable = !t || t === "photo";
  const border = first ? "none" : "1px solid var(--border)";

  const icon = item.isComplete
    ? <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#16a34a" }} />
    : <Circle className="w-5 h-5 shrink-0" style={{ color: "var(--text-muted)" }} />;
  const label = (
    <span className="text-sm flex-1 min-w-0" style={{ color: "var(--text-primary)", textDecoration: tappable && item.isComplete ? "line-through" : "none" }}>
      {item.label}
      {item.required && <span className="ml-1.5 text-[10px] font-semibold" style={{ color: "#dc2626" }}>Required</span>}
      {t === "photo" && <span className="ml-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>attach in Photos</span>}
    </span>
  );

  if (tappable) {
    return (
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-[var(--bg-surface-2)]" style={{ borderTop: border }}>
        {icon}{label}
      </button>
    );
  }

  const chip = (label: string, on: boolean, onTap: () => void) => (
    <button key={label} onClick={onTap}
      className="px-3 py-2 rounded-xl text-sm font-medium active:scale-[0.97] transition-transform"
      style={{
        border: `1.5px solid ${on ? "var(--copper-soft-border)" : "var(--border)"}`,
        backgroundColor: on ? "var(--copper-soft-bg)" : "var(--bg-surface-2)",
        color: on ? "var(--copper-text)" : "var(--text-secondary)",
      }}>{label}</button>
  );

  return (
    <div className="px-4 py-3.5" style={{ borderTop: border }}>
      <div className="flex items-center gap-3">{icon}{label}</div>
      <div className="mt-2.5 pl-8">
        {t === "short_text" && (
          <input value={strVal} onChange={e => answer(e.target.value, e.target.value.trim() !== "")}
            placeholder="Enter…" className={stepInput} style={stepInputStyle} />
        )}
        {t === "long_text" && (
          <textarea value={strVal} onChange={e => answer(e.target.value, e.target.value.trim() !== "")}
            placeholder="Enter…" rows={2} className={`${stepInput} resize-none`} style={stepInputStyle} />
        )}
        {t === "number" && (
          <div className="flex items-center gap-2">
            <input type="number" inputMode="decimal" value={strVal}
              onChange={e => answer(e.target.value, e.target.value.trim() !== "")}
              placeholder="0" className="w-32 rounded-xl px-3 py-2.5 text-sm outline-none" style={stepInputStyle} />
            {item.unit && <span className="text-sm" style={{ color: "var(--text-muted)" }}>{item.unit}</span>}
          </div>
        )}
        {t === "dropdown" && (
          <div className="flex flex-wrap gap-2">
            {(item.options ?? []).filter(o => o.trim()).map(o =>
              chip(o, strVal === o, () => { const next = strVal === o ? "" : o; answer(next, next !== ""); }))}
          </div>
        )}
        {t === "multi_select" && (
          <div className="flex flex-wrap gap-2">
            {(item.options ?? []).filter(o => o.trim()).map(o =>
              chip(o, arrVal.includes(o), () => {
                const next = arrVal.includes(o) ? arrVal.filter(x => x !== o) : [...arrVal, o];
                answer(next, next.length > 0);
              }))}
          </div>
        )}
        {t === "datetime" && (
          <input type="datetime-local" value={strVal} onChange={e => answer(e.target.value, e.target.value !== "")}
            className="rounded-xl px-3 py-2.5 text-sm outline-none" style={stepInputStyle} />
        )}
        {t === "signature" && (
          <input value={strVal} onChange={e => answer(e.target.value, e.target.value.trim() !== "")}
            placeholder="Type full name to sign"
            className={`${stepInput} italic`} style={{ ...stepInputStyle, fontFamily: "Georgia, serif" }} />
        )}
      </div>
    </div>
  );
}
