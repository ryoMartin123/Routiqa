"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, RefreshCw, XCircle, Trash2, MoreVertical,
  Calendar, User, MapPin, DollarSign, Repeat, Clock,
  CheckCircle, AlertCircle, Circle, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import HoverInfo, { Pill } from "@/components/shared/HoverInfo";
import DetailTabs from "@/components/shared/DetailTabs";
import {
  AGREEMENTS, TEMPLATES, formatValue, getAgreement, deleteAgreement, updateAgreement, materializeVisitJob, renewAgreement,
  type AgreementStatus, type VisitStatus, type CustomerAgreement,
} from "@/lib/agreements/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";

// ─── Status configs ───────────────────────────────────────
const AGREEMENT_STATUS: Record<AgreementStatus, { label: string; bg: string; color: string }> = {
  active:       { label: "Active",       bg: "#d1fae5", color: "#065f46" },
  due_soon:     { label: "Due Soon",     bg: "#fef3c7", color: "#92400e" },
  overdue:      { label: "Overdue",      bg: "#fee2e2", color: "#991b1b" },
  renewal_due:  { label: "Renewal Due",  bg: "#ffedd5", color: "#9a3412" },
  canceled:     { label: "Canceled",     bg: "var(--bg-input)", color: "var(--text-muted)" },
};

const VISIT_STATUS: Record<VisitStatus, { label: string; icon: typeof Circle; color: string }> = {
  planned:    { label: "Planned",    icon: Clock,         color: "#6b7280" },
  scheduled:  { label: "Scheduled",  icon: Circle,        color: "#6366f1" },
  completed:  { label: "Completed",  icon: CheckCircle,   color: "#10b981" },
  missed:     { label: "Missed",     icon: AlertCircle,   color: "#ef4444" },
};

const DETAIL_TABS = [
  "Overview", "Visits", "Billing", "Included Services", "Notes", "Photos & Files", "Communication", "Renewal",
];

// ─── Overview tab ─────────────────────────────────────────
function OverviewTab({ agreement }: { agreement: ReturnType<typeof AGREEMENTS[0]["visits"]["map"]> extends never ? never : typeof AGREEMENTS[0] }) {
  const template = TEMPLATES.find((t) => t.id === agreement.templateId);
  const status = AGREEMENT_STATUS[agreement.status];

  const infoRows = [
    { icon: User,      label: "Customer",        value: agreement.customer },
    { icon: MapPin,    label: "Location",        value: agreement.location },
    { icon: User,      label: "Assigned To",     value: agreement.assignedTo },
    { icon: Calendar,  label: "Start Date",      value: agreement.startDate },
    { icon: RefreshCw, label: "Renewal Date",    value: agreement.renewalDate },
    { icon: Repeat,    label: "Visit Frequency", value: agreement.visitFrequency },
    { icon: DollarSign,label: "Billing",         value: `${formatValue(agreement)} · ${agreement.billingFrequency}` },
  ];

  const completedVisits = agreement.visits.filter((v) => v.status === "completed").length;
  const scheduledVisits = agreement.visits.filter((v) => v.status === "scheduled").length;
  const missedVisits    = agreement.visits.filter((v) => v.status === "missed").length;

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: key info */}
      <div className="space-y-4">
        {/* Agreement info */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
            Agreement Info
          </p>
          <div className="space-y-2.5">
            {infoRows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2.5">
                <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                <div className="min-w-0">
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visit summary */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
            Visit Summary
          </p>
          <div className="space-y-2">
            {[
              { label: "Completed",   value: completedVisits, color: "#10b981" },
              { label: "Scheduled",   value: scheduledVisits, color: "#6366f1" },
              { label: "Missed",      value: missedVisits,    color: "#ef4444" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
                <span className="text-sm font-semibold" style={{ color: value > 0 ? color : "var(--text-muted)" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Template */}
        {template && (
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
              Based On Template
            </p>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{template.name}</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {template.description}
            </p>
          </div>
        )}
      </div>

      {/* Right: next visit + recent visits */}
      <div className="col-span-2 space-y-4">
        {/* Next visit card */}
        {agreement.nextVisit ? (
          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: agreement.status === "overdue" ? "#fff5f5" : agreement.status === "due_soon" ? "#fffbeb" : "var(--bg-surface)",
              border: `1px solid ${agreement.status === "overdue" ? "#fecaca" : agreement.status === "due_soon" ? "#fde68a" : "var(--border-subtle)"}`,
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                  Next Visit
                </p>
                <p
                  className="text-xl font-bold"
                  style={{ color: agreement.status === "overdue" ? "#dc2626" : "var(--text-primary)" }}
                >
                  {agreement.nextVisit}
                </p>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  Assigned to {agreement.assignedTo}
                </p>
                {agreement.status === "overdue" && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <AlertCircle className="w-4 h-4" style={{ color: "#dc2626" }} />
                    <span className="text-sm font-semibold" style={{ color: "#dc2626" }}>
                      Visit is overdue — reschedule immediately
                    </span>
                  </div>
                )}
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                <Calendar className="w-3.5 h-3.5" />
                Schedule
              </button>
            </div>
          </div>
        ) : (
          <div
            className="rounded-xl p-5 text-center"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No upcoming visit scheduled</p>
            <button className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700">
              Schedule a visit →
            </button>
          </div>
        )}

        {/* Visits list */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Visits</p>
            <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700">+ Add Visit</button>
          </div>
          {agreement.visits.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No visits recorded</p>
            </div>
          ) : (
            agreement.visits.map((v, i) => {
              const vs = VISIT_STATUS[v.status];
              const Icon = vs.icon;
              return (
                <div
                  key={v.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
                  style={i < agreement.visits.length - 1 ? { borderBottom: "1px solid var(--border-subtle)" } : undefined}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: vs.color }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{v.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {v.scheduled} · {v.tech}
                        {v.notes && ` · ${v.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: vs.color + "20", color: vs.color }}
                    >
                      {vs.label}
                    </span>
                    {v.status === "scheduled" && (
                      <button
                        className="text-xs px-2 py-1 rounded-lg transition-colors"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                      >
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Notes preview */}
        {agreement.notes && (
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
              Notes
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{agreement.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Visits tab ───────────────────────────────────────────
function VisitsTab({ agreement }: { agreement: typeof AGREEMENTS[0] }) {
  const router = useRouter();
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();
  const [err, setErr] = useState<string | null>(null);

  // A visit becomes a dispatchable job only when scheduled (lazy materialization);
  // we then route to that job, where time/tech are finalized and it rides the
  // standard job lifecycle. Completing the job writes back to this visit.
  function scheduleVisit(visitId: string) {
    const res = materializeVisitJob(agreement.id, visitId, {
      companyId: effectiveCompanyId ?? "co_hvac",
      locationId: effectiveLocationId ?? "loc_augusta",
      serviceAreaId: effectiveServiceAreaId ?? undefined,
    });
    if (res.error || !res.job) { setErr(res.error ?? "Could not schedule visit."); return; }
    router.push(`/jobs/${res.job.id}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          All Visits ({agreement.visits.length})
        </p>
        <button className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
          <Calendar className="w-3.5 h-3.5" />
          Add Visit
        </button>
      </div>

      {err && <p className="text-xs" style={{ color: "#dc2626" }}>{err}</p>}

      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}
      >
        {/* Header */}
        <div
          className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            gridTemplateColumns: "1fr 2fr 1fr 1fr 2fr 1fr",
            color: "var(--text-muted)",
            borderBottom: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-surface-2)",
          }}
        >
          <span>Status</span>
          <span>Visit</span>
          <span>Scheduled</span>
          <span>Tech</span>
          <span>Notes</span>
          <span>Action</span>
        </div>

        {agreement.visits.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No visits scheduled yet</p>
          </div>
        ) : (
          agreement.visits.map((v, i) => {
            const vs = VISIT_STATUS[v.status];
            const Icon = vs.icon;
            return (
              <div
                key={v.id}
                className="grid items-center px-4 py-3"
                style={{
                  gridTemplateColumns: "1fr 2fr 1fr 1fr 2fr 1fr",
                  borderBottom: i < agreement.visits.length - 1 ? "1px solid var(--border-subtle)" : "none",
                }}
              >
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit"
                  style={{ backgroundColor: vs.color + "20", color: vs.color }}
                >
                  <Icon className="w-3 h-3" />
                  {vs.label}
                </span>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{v.label}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{v.scheduled}</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{v.tech}</span>
                <span className="text-sm truncate" style={{ color: "var(--text-muted)" }}>{v.notes ?? "—"}</span>
                <div>
                  {v.jobId ? (
                    <Link href={`/jobs/${v.jobId}`}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors text-indigo-600"
                      style={{ border: "1px solid #c7d2fe" }}>
                      Open job <ChevronRight className="w-3 h-3" />
                    </Link>
                  ) : v.status === "completed" ? (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                  ) : (
                    <button onClick={() => scheduleVisit(v.id)}
                      className="text-xs px-2 py-1 rounded-lg transition-colors text-white bg-indigo-600 hover:bg-indigo-700">
                      {v.status === "missed" ? "Reschedule" : "Schedule"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Included Services tab ────────────────────────────────
function ServicesTab({ agreement }: { agreement: typeof AGREEMENTS[0] }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)", maxWidth: "560px" }}
    >
      <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        Included Services ({agreement.services.length})
      </p>
      <div className="space-y-2.5">
        {agreement.services.map((s) => (
          <div key={s} className="flex items-center gap-3">
            <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "#10b981" }} />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Renewal tab ──────────────────────────────────────────
function RenewalTab({ agreement, onRenew }: { agreement: typeof AGREEMENTS[0]; onRenew: () => void }) {
  const isRenewalDue = agreement.status === "renewal_due";
  const termMonths = agreement.renewal?.termMonths ?? 12;
  return (
    <div className="space-y-4 max-w-xl">
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: isRenewalDue ? "#fff7ed" : "var(--bg-surface)",
          border: `1px solid ${isRenewalDue ? "#fed7aa" : "var(--border-subtle)"}`,
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
          Renewal Date
        </p>
        <p
          className="text-2xl font-bold"
          style={{ color: isRenewalDue ? "#ea580c" : "var(--text-primary)" }}
        >
          {agreement.renewalDate}
        </p>
        {isRenewalDue && (
          <p className="text-sm mt-1" style={{ color: "#ea580c" }}>
            Renewal is due soon — take action to retain this agreement.
          </p>
        )}
        <button onClick={onRenew}
          className="mt-4 flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Renew for another {termMonths === 12 ? "year" : `${termMonths} months`}
        </button>
      </div>

      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
      >
        <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Renewal Actions</p>
        <div className="space-y-2">
          {["Send renewal offer", "Schedule renewal call", "Update pricing", "Generate renewal agreement"].map((action) => (
            <button
              key={action}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}
            >
              {action}
              <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Stub tab ─────────────────────────────────────────────
function StubTab({ label }: { label: string }) {
  return (
    <div
      className="rounded-xl p-10 text-center"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
    >
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</p>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Coming in Phase 1</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────
export default function AgreementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Overview");
  const [actionsOpen, setActionsOpen] = useState(false);

  function handleDelete() {
    if (confirm("Delete this agreement? This can't be undone.")) {
      deleteAgreement(id);
      router.push("/agreements");
    }
  }
  function handleCancel() {
    if (confirm("Cancel this agreement? It stays on record but is marked canceled.")) {
      updateAgreement(id, { status: "canceled" });
      setAgreement(getAgreement(id));
      setActionsOpen(false);
    }
  }
  function handleRenew() {
    renewAgreement(id);
    setAgreement(getAgreement(id));
    setActionsOpen(false);
  }

  // Seed lookup on the server; merge in session-created agreements on the client.
  const [agreement, setAgreement] = useState<CustomerAgreement | undefined>(() => AGREEMENTS.find((a) => a.id === id));
  useEffect(() => { setAgreement(getAgreement(id)); }, [id]);

  if (!agreement) {
    return (
      <div className="p-6">
        <Link href="/agreements" className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Agreements
        </Link>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Agreement not found.</p>
      </div>
    );
  }

  const s = AGREEMENT_STATUS[agreement.status];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
        {/* Top row */}
        <div className="flex items-center justify-between px-6 py-4">
          {/* Left */}
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/agreements"
              className="flex items-center gap-1.5 text-sm shrink-0 transition-colors"
              style={{ color: "var(--text-secondary)" }}
            >
              <ArrowLeft className="w-4 h-4" />
              Agreements
            </Link>
            <div className="w-px h-5 shrink-0" style={{ backgroundColor: "var(--border)" }} />
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-bold shrink-0">
                {agreement.customerInitials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                    {agreement.customer}
                  </h1>
                  <HoverInfo placement="bottom" rows={[
                    { label: "Type", node: <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{agreement.type}</span> },
                    { label: "Status", node: <Pill text={s.label} style={{ backgroundColor: s.bg, color: s.color }} /> },
                    ...(agreement.propertyLabel ? [{ label: "Property", node: <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{agreement.propertyLabel}</span> }] : []),
                    { label: "Assigned To", node: <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{agreement.assignedTo}</span> },
                  ]} />
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {agreement.location} · {formatValue(agreement)} · {agreement.visitFrequency}
                </p>
              </div>
            </div>
          </div>

          {/* Actions — consolidated into one menu */}
          <div className="relative shrink-0">
            <button onClick={() => setActionsOpen(o => !o)} aria-label="Agreement actions"
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-[var(--bg-surface-2)]"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <MoreVertical className="w-4 h-4" />
            </button>
            {actionsOpen && (
              <>
                <button aria-hidden tabIndex={-1} onClick={() => setActionsOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl overflow-hidden py-1"
                  style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <button onClick={() => { setActionsOpen(false); router.push(`/agreements/${id}/edit`); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  {agreement.status === "canceled" ? (
                    <button onClick={handleRenew}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}>
                      <RefreshCw className="w-3.5 h-3.5" /> Reactivate
                    </button>
                  ) : (
                    <button onClick={handleRenew}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-primary)" }}>
                      <RefreshCw className="w-3.5 h-3.5" /> Renew
                    </button>
                  )}
                  {agreement.status !== "canceled" && (
                    <button onClick={handleCancel}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-surface-2)]" style={{ color: "var(--text-secondary)" }}>
                      <XCircle className="w-3.5 h-3.5" /> Cancel agreement
                    </button>
                  )}
                  <div style={{ borderTop: "1px solid var(--border-subtle)" }} />
                  <button onClick={() => { setActionsOpen(false); handleDelete(); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-red-50" style={{ color: "#dc2626" }}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <DetailTabs tabs={DETAIL_TABS} active={activeTab} onChange={setActiveTab} className="px-6 py-2" />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: "var(--bg-page)" }}>
        {activeTab === "Overview"          && <OverviewTab agreement={agreement} />}
        {activeTab === "Visits"            && <VisitsTab agreement={agreement} />}
        {activeTab === "Included Services" && <ServicesTab agreement={agreement} />}
        {activeTab === "Renewal"           && <RenewalTab agreement={agreement} onRenew={handleRenew} />}
        {activeTab === "Billing"           && <StubTab label="Billing" />}
        {activeTab === "Notes"             && <StubTab label="Notes" />}
        {activeTab === "Photos & Files"    && <StubTab label="Photos & Files" />}
        {activeTab === "Communication"     && <StubTab label="Communication" />}
      </div>

    </div>
  );
}
