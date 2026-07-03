"use client";

// ─── Technician job command screen ────────────────────────
// One job, one clear next action. The bottom is a single status-based primary
// CTA (Scheduled → Start Route, En route → Arrived, In progress → Complete…),
// with secondary transitions tucked beneath it. Contact actions are a compact
// row; the contextual "+" opens job quick-actions. No global search/nav bar here.

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Phone, MessageSquare, Navigation, Camera, User, Clock, MapPin, AlertTriangle,
  FileText, ClipboardCheck, Wrench, ChevronRight, Briefcase, CheckCircle2, Circle,
  Plus, X, StickyNote, Package, CheckSquare, Flag, Play, DollarSign, Trash2,
} from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Section, Card, DetailRow, StatusChip, EmptyState, prettyType, ACCENT } from "@/components/mobile/ui";
import { getJob, type JobStatus } from "@/lib/jobs/data";
import { getTasksForJob } from "@/lib/tasks/data";
import { getCustomer } from "@/lib/customers/data";
import { getFiles } from "@/lib/files/data";
import { getJobPhotoChecklist, checklistProgress } from "@/lib/files/checklist";
import PhotoCapture from "@/components/mobile/PhotoCapture";
import BottomSheet from "@/components/mobile/BottomSheet";
import { primaryAction, secondaryActions, setMyJobStatus, getMobileCaps, getCurrentTech } from "@/lib/mobile/data";
import { getJobMaterials, addJobMaterial, removeJobMaterial } from "@/lib/mobile/materials";
import { getAllInvoices, recordPayment, type InvoiceRecord } from "@/lib/quotes/data";

const PRIMARY_ICON: Partial<Record<JobStatus, React.ElementType>> = {
  en_route: Flag, in_progress: CheckCircle2, waiting_on_parts: Play, waiting_on_customer: Play,
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [capture, setCapture] = useState(false);
  const [qa, setQa] = useState(false);
  const [matSheet, setMatSheet] = useState(false);
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
          </Card>
        </Section>

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
                {p.phase && <span className="absolute top-1 left-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white capitalize" style={{ backgroundColor: p.phase === "before" ? "#6366f1" : p.phase === "during" ? "#3b82f6" : "#10b981" }}>{p.phase}</span>}
              </div>
            ))}
          </div>
        </Section>

        {/* Checklist / job tasks */}
        <Section title="Checklist & tasks">
          {tasks.length === 0 ? (
            <Card className="px-4 py-5"><p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>No checklist items for this job.</p></Card>
          ) : (
            <Card>
              {tasks.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <ClipboardCheck className="w-4 h-4 shrink-0" style={{ color: t.status === "completed" ? "#16a34a" : "var(--text-muted)" }} />
                  <span className="text-sm flex-1" style={{ color: "var(--text-primary)", textDecoration: t.status === "completed" ? "line-through" : "none" }}>{t.title}</span>
                </div>
              ))}
            </Card>
          )}
        </Section>

        {/* Materials — a real field log against this job */}
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
            {caps.customersView && (
              <Link href={`/mobile/customers/${job.accountId}`} className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-[var(--bg-surface-2)]" style={{ borderTop: "1px solid var(--border)" }}>
                <FileText className="w-4 h-4" style={{ color: "var(--text-muted)" }} /><span className="text-sm flex-1 text-left" style={{ color: "var(--text-primary)" }}>Customer, property &amp; equipment</span><ChevronRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              </Link>
            )}
          </Card>
        </Section>

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
    { icon: StickyNote, label: "Add note", color: "#4f46e5", onClick: onClose },
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
