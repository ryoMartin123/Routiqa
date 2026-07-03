"use client";

// ─── Inventory & Procurement · Subcontractors ─────────────
// Subcontractors are a special vendor type with extra compliance + trade fields.
// Each links to a Vendor master record. CRM projects/phases link via mock
// assignments. Mock/local state. List + detail drawer + add + create-assignment.

import { useMemo, useState } from "react";
import {
  HardHat, Plus, Search, SlidersHorizontal, MoreHorizontal, Pencil, AlertTriangle,
  CheckCircle2, ShieldCheck, FileText, X, Briefcase,
} from "lucide-react";
import UiSelect from "@/components/ui/Select";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import StatusTabs from "@/components/shared/StatusTabs";
import { PageHeader, StatCard } from "@/components/platform/ui";
import {
  getSubcontractors, getSubcontractor, createSubcontractor, updateSubcontractor,
  getAssignmentsForSub, activeAssignmentCount, createAssignment,
  subCompliance, subComplianceWarnings,
  SUB_TRADES, SUB_STATUS_STYLE, ASSIGNMENT_STATUS_STYLE, DOC_KIND_LABELS, MOCK_PROJECTS, MOCK_JOBS,
  type Subcontractor, type SubTrade, type SubStatus, type DocStatus, type AssignmentStatus,
} from "@/lib/inventory/data";
import {
  ACCENT, money, Slideover, DrawerTabs, InfoRow, ComplianceBadge, Dot, LinkedChip,
  Field, inp, inpStyle, DrawerBlockTitle,
} from "@/components/inventory/procurementUi";

const SUB_COLS = "1.6fr 1fr 1fr 1.1fr 0.8fr 0.7fr 0.8fr 0.8fr 0.7fr";
const DOC_STATUSES: DocStatus[] = ["valid", "expiring", "expired", "missing"];

function DocPill({ status }: { status: DocStatus }) {
  const map: Record<DocStatus, { label: string; bg: string; color: string }> = {
    valid: { label: "Valid", bg: "#d1fae5", color: "#065f46" },
    expiring: { label: "Expiring", bg: "#fef3c7", color: "#92400e" },
    expired: { label: "Expired", bg: "#fee2e2", color: "#991b1b" },
    missing: { label: "Missing", bg: "#fee2e2", color: "#991b1b" },
  };
  const s = map[status];
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>;
}

export default function Subcontractors() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const subs = useMemo(() => getSubcontractors(), [tick]);

  const [view, setView] = useState<ModuleView>("list");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [fTrade, setFTrade] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState<Subcontractor | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const activeCount = subs.filter(s => s.status !== "inactive").length;
  const approvedCount = subs.filter(s => s.status === "approved").length;
  const missingDocs = subs.filter(s => subCompliance(s) === "issue").length;
  const assignedCount = subs.filter(s => activeAssignmentCount(s.id) > 0).length;

  const TAB_FNS: Record<string, (s: Subcontractor) => boolean> = {
    all: () => true,
    approved: s => s.status === "approved",
    pending_review: s => s.status === "pending_review",
    missing_documents: s => s.status === "missing_documents" || subCompliance(s) === "issue",
    on_hold: s => s.status === "on_hold",
  };
  const tabFn = TAB_FNS[tab] ?? TAB_FNS.all;

  const q = search.trim().toLowerCase();
  const filtered = subs.filter(s => {
    if (!tabFn(s)) return false;
    if (q && !`${s.companyName} ${s.trade} ${s.serviceArea ?? ""}`.toLowerCase().includes(q)) return false;
    if (fTrade !== "all" && s.trade !== fTrade) return false;
    return true;
  });
  const activeFilters = fTrade !== "all" ? 1 : 0;
  const openSub = openId ? getSubcontractor(openId) : undefined;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0"><PageHeader title="Subcontractors" subtitle="Manage approved subcontractors, trades, compliance documents, scopes, and project assignments." /></div>
        <ModuleViewToggle view={view} onChange={setView} listLabel="Subs" accent={ACCENT} />
        <div className="flex-1 flex justify-end">
          <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white shrink-0 hover:brightness-110" style={{ backgroundColor: ACCENT }}>
            <Plus className="w-4 h-4" /> Add Subcontractor
          </button>
        </div>
      </div>

      {view === "overview" && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          <StatCard label="Active Subcontractors" value={String(activeCount)} hint="Not inactive" icon={HardHat} accent={ACCENT} />
          <StatCard label="Approved" value={String(approvedCount)} hint="Ready to assign" icon={ShieldCheck} accent="#10b981" />
          <StatCard label="Missing Compliance Docs" value={String(missingDocs)} hint="Action needed" icon={AlertTriangle} accent="#ef4444" />
          <StatCard label="Assigned to Projects" value={String(assignedCount)} hint="Active assignments" icon={Briefcase} accent="#0ea5e9" />
        </div>
      )}

      {view === "list" && (
      <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <StatusTabs accent={ACCENT} active={tab} onChange={setTab}
          tabs={[
            { key: "all", label: "All", count: subs.length },
            { key: "approved", label: "Approved", count: subs.filter(TAB_FNS.approved).length },
            { key: "pending_review", label: "Pending", count: subs.filter(TAB_FNS.pending_review).length },
            { key: "missing_documents", label: "Compliance", count: subs.filter(TAB_FNS.missing_documents).length },
          ]} />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ backgroundColor: "var(--bg-input)" }}>
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subcontractors..." className="bg-transparent text-sm outline-none w-48" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="relative">
            <button onClick={() => setFiltersOpen(o => !o)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ border: `1px solid ${activeFilters ? ACCENT + "66" : "var(--border)"}`, backgroundColor: activeFilters ? ACCENT + "14" : "var(--bg-surface)", color: activeFilters ? ACCENT : "var(--text-secondary)" }}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter{activeFilters > 0 && <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ backgroundColor: ACCENT + "26", color: ACCENT }}>{activeFilters}</span>}
            </button>
            {filtersOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 w-64" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <div className="flex items-center justify-between mb-3"><p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Filters</p>{activeFilters > 0 && <button onClick={() => setFTrade("all")} className="text-xs" style={{ color: ACCENT }}>Clear</button>}</div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Trade</label>
                  <UiSelect size="sm" value={fTrade} onChange={setFTrade} options={[{ value: "all", label: "Any trade" }, ...SUB_TRADES.map(t => ({ value: t, label: t }))]} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <div className="overflow-x-auto thin-scroll-x">
          <div style={{ minWidth: 1060 }}>
            <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider items-center" style={{ gridTemplateColumns: SUB_COLS, gap: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
              <span>Subcontractor</span><span>Trade</span><span>Status</span><span>Service Area</span><span>Insurance</span><span>W-9</span><span>License</span><span className="text-center">Assignments</span><span className="text-right">Actions</span>
            </div>
            {filtered.length === 0 ? (
              <div className="py-14 text-center"><p className="text-sm" style={{ color: "var(--text-muted)" }}>No subcontractors match the current filters.</p></div>
            ) : filtered.map((s, i) => (
              <div key={s.id} onClick={() => setOpenId(s.id)} className="grid px-4 py-3 items-center cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]"
                style={{ gridTemplateColumns: SUB_COLS, gap: "0.75rem", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div className="min-w-0 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: ACCENT + "1f" }}><HardHat className="w-4 h-4" style={{ color: ACCENT }} /></span>
                  <div className="min-w-0"><p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.companyName}</p><p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{s.primaryContactName ?? ""}</p></div>
                </div>
                <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{s.trade}</div>
                <div><Dot style={SUB_STATUS_STYLE[s.status]} /></div>
                <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{s.serviceArea ?? "—"}</div>
                <div><DocPill status={s.insuranceStatus} /></div>
                <div><DocPill status={s.w9Status} /></div>
                <div><DocPill status={s.licenseStatus} /></div>
                <div className="text-center text-sm tabular-nums" style={{ color: activeAssignmentCount(s.id) ? "var(--text-primary)" : "var(--text-muted)" }}>{activeAssignmentCount(s.id)}</div>
                <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setEditing(s)} title="Edit" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setOpenId(s.id)} title="More" className="p-1.5 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><MoreHorizontal className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
      )}

      {openSub && <SubDrawer sub={openSub} onClose={() => setOpenId(null)} onEdit={() => setEditing(openSub)} onChanged={refresh} />}
      {editing && <SubModal sub={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────
type STab = "overview" | "compliance" | "assignments" | "history" | "documents" | "rates" | "activity" | "notes";
function SubDrawer({ sub, onClose, onEdit, onChanged }: { sub: Subcontractor; onClose: () => void; onEdit: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<STab>("overview");
  const [assignTick, setAssignTick] = useState(0);
  const [assigning, setAssigning] = useState(false);
  const assignments = useMemo(() => getAssignmentsForSub(sub.id), [sub.id, assignTick]);
  const warnings = subComplianceWarnings(sub);

  return (
    <Slideover title={sub.companyName} subtitle={`${sub.trade} · ${sub.serviceArea ?? ""}`} onClose={onClose}
      footer={<>
        <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Close</button>
        <button onClick={onEdit} className="text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>Edit</button>
      </>}>
      <div className="px-5 pt-4 flex items-center gap-2 flex-wrap">
        <Dot style={SUB_STATUS_STYLE[sub.status]} />
        <ComplianceBadge level={subCompliance(sub)} />
      </div>
      {warnings.length > 0 && (
        <div className="mx-5 mt-3 rounded-lg px-3 py-2 flex items-start gap-2" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#b45309" }} />
          <p className="text-xs" style={{ color: "#92400e" }}>{warnings.join(" · ")}</p>
        </div>
      )}
      <div className="mt-3"><DrawerTabs<STab> active={tab} onChange={setTab} tabs={[
        { key: "overview", label: "Overview" }, { key: "compliance", label: "Compliance" }, { key: "assignments", label: "Assignments" },
        { key: "history", label: "Work History" }, { key: "documents", label: "Documents" }, { key: "rates", label: "Rates" }, { key: "activity", label: "Activity" }, { key: "notes", label: "Notes" },
      ]} /></div>

      <div className="p-5">
        {tab === "overview" && (
          <div>
            <InfoRow label="Trade">{sub.trade}</InfoRow>
            <InfoRow label="Status">{SUB_STATUS_STYLE[sub.status].label}</InfoRow>
            <InfoRow label="Contact">{sub.primaryContactName ?? "—"}</InfoRow>
            <InfoRow label="Phone">{sub.phone ?? "—"}</InfoRow>
            <InfoRow label="Email">{sub.email ?? "—"}</InfoRow>
            <InfoRow label="Service area">{sub.serviceArea ?? "—"}</InfoRow>
            <InfoRow label="Default rate">{sub.defaultRate ?? "—"}</InfoRow>
          </div>
        )}
        {tab === "compliance" && (
          <div className="space-y-2">
            <CompRow label="W-9" status={sub.w9Status} />
            <CompRow label="Insurance" status={sub.insuranceStatus} detail={sub.insuranceExpiration ? `Expires ${sub.insuranceExpiration}` : undefined} />
            <CompRow label="License" status={sub.licenseStatus} detail={sub.licenseNumber ? `#${sub.licenseNumber}${sub.licenseExpiration ? ` · exp ${sub.licenseExpiration}` : ""}` : undefined} />
            <CompRow label="Contract" status={sub.contractStatus} />
          </div>
        )}
        {tab === "assignments" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <DrawerBlockTitle>Project Assignments</DrawerBlockTitle>
              <button onClick={() => setAssigning(true)} className="text-xs font-medium flex items-center gap-1" style={{ color: ACCENT }}><Plus className="w-3.5 h-3.5" /> New Assignment</button>
            </div>
            {assignments.length === 0 ? <Empty text="No project assignments yet." /> : (
              <div className="space-y-2">
                {assignments.map(a => (
                  <div key={a.id} className="rounded-lg px-3 py-2.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">{a.projectName && <LinkedChip label={a.projectName} />}</div>
                      <Dot style={ASSIGNMENT_STATUS_STYLE[a.status]} />
                    </div>
                    {a.phaseName && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{a.phaseName}</p>}
                    <p className="text-sm mt-1" style={{ color: "var(--text-primary)" }}>{a.scopeOfWork}</p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{a.scheduledDate ? `Scheduled ${a.scheduledDate}` : "Unscheduled"}{a.contractAmount != null ? ` · ${money(a.contractAmount)}` : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === "history" && <Empty text="Completed work history lands in a later phase." />}
        {tab === "documents" && (
          sub.documents.length === 0 ? <Empty text="No documents on file. Files are stored in the Documents app." /> : (
            <div className="space-y-1.5">
              {sub.documents.map(d => (
                <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)" }}>
                  <span className="flex items-center gap-2 min-w-0"><FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /><span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{DOC_KIND_LABELS[d.kind]}</span></span>
                  <DocPill status={d.status} />
                </div>
              ))}
            </div>
          )
        )}
        {tab === "rates" && <div><InfoRow label="Default rate">{sub.defaultRate ?? "—"}</InfoRow><p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>Trade-specific rate sheets land in a later phase.</p></div>}
        {tab === "activity" && <Empty text="Activity timeline lands in a later phase." />}
        {tab === "notes" && (sub.notes ? <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{sub.notes}</p> : <Empty text="No notes." />)}
      </div>

      {assigning && <AssignmentModal subId={sub.id} onClose={() => setAssigning(false)} onSaved={() => { setAssigning(false); setAssignTick(t => t + 1); onChanged(); }} />}
    </Slideover>
  );
}

function CompRow({ label, status, detail }: { label: string; status: DocStatus; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg" style={{ border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        {status === "valid" ? <CheckCircle2 className="w-4 h-4" style={{ color: "#10b981" }} /> : <AlertTriangle className="w-4 h-4" style={{ color: "#ef4444" }} />}
        <div><p className="text-sm" style={{ color: "var(--text-primary)" }}>{label}</p>{detail && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{detail}</p>}</div>
      </div>
      <DocPill status={status} />
    </div>
  );
}

function Empty({ text }: { text: string }) { return <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>{text}</p>; }

// ─── Create assignment modal ──────────────────────────────
function AssignmentModal({ subId, onClose, onSaved }: { subId: string; onClose: () => void; onSaved: () => void }) {
  const [projectId, setProjectId] = useState("");
  const [jobId, setJobId] = useState("");
  const [scope, setScope] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<AssignmentStatus>("proposed");
  const [notes, setNotes] = useState("");

  function save() {
    const project = MOCK_PROJECTS.find(p => p.id === projectId);
    createAssignment({
      subcontractorId: subId, projectId: projectId || undefined, projectName: project?.name,
      jobId: jobId || undefined, scopeOfWork: scope.trim() || "—", scheduledDate: date.trim() || undefined,
      status, contractAmount: amount ? parseFloat(amount) : undefined, notes: notes.trim() || undefined,
    });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>New Assignment</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project" hint="placeholder"><UiSelect value={projectId} onChange={setProjectId} options={[{ value: "", label: "Select project…" }, ...MOCK_PROJECTS.map(p => ({ value: p.id, label: p.name }))]} /></Field>
            <Field label="Job" hint="optional"><UiSelect value={jobId} onChange={setJobId} options={[{ value: "", label: "None" }, ...MOCK_JOBS.map(j => ({ value: j.id, label: j.name }))]} /></Field>
            <Field label="Scope of work" className="col-span-2"><textarea value={scope} onChange={e => setScope(e.target.value)} rows={2} placeholder="Describe the scope…" className={`${inp} resize-none`} style={inpStyle} /></Field>
            <Field label="Scheduled date"><input value={date} onChange={e => setDate(e.target.value)} placeholder="Jul 10, 2026" className={inp} style={inpStyle} /></Field>
            <Field label="Contract amount"><div className="flex items-center gap-1.5 rounded-lg px-3" style={inpStyle}><span className="text-xs" style={{ color: "var(--text-muted)" }}>$</span><input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full py-2 text-sm outline-none bg-transparent" style={{ color: "var(--text-primary)" }} /></div></Field>
            <Field label="Status"><UiSelect value={status} onChange={v => setStatus(v as AssignmentStatus)} options={(Object.keys(ASSIGNMENT_STATUS_STYLE) as AssignmentStatus[]).map(s => ({ value: s, label: ASSIGNMENT_STATUS_STYLE[s].label }))} /></Field>
            <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} className={inp} style={inpStyle} /></Field>
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Project/job links are mock placeholders — they connect to CRM Projects in a later phase.</p>
        </div>
        <div className="px-5 py-3 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} className="text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>Save Assignment</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add / edit subcontractor modal ───────────────────────
function SubModal({ sub, onClose, onSaved }: { sub: Subcontractor | "new"; onClose: () => void; onSaved: () => void }) {
  const isNew = sub === "new";
  const b = isNew ? null : sub;
  const [companyName, setCompanyName] = useState(b?.companyName ?? "");
  const [trade, setTrade] = useState<SubTrade>(b?.trade ?? "Electrical");
  const [status, setStatus] = useState<SubStatus>(b?.status ?? "pending_review");
  const [contactName, setContactName] = useState(b?.primaryContactName ?? "");
  const [phone, setPhone] = useState(b?.phone ?? "");
  const [email, setEmail] = useState(b?.email ?? "");
  const [serviceArea, setServiceArea] = useState(b?.serviceArea ?? "");
  const [defaultRate, setDefaultRate] = useState(b?.defaultRate ?? "");
  const [insuranceStatus, setInsuranceStatus] = useState<DocStatus>(b?.insuranceStatus ?? "missing");
  const [insuranceExpiration, setInsuranceExpiration] = useState(b?.insuranceExpiration ?? "");
  const [w9Status, setW9Status] = useState<DocStatus>(b?.w9Status ?? "missing");
  const [licenseStatus, setLicenseStatus] = useState<DocStatus>(b?.licenseStatus ?? "missing");
  const [licenseNumber, setLicenseNumber] = useState(b?.licenseNumber ?? "");
  const [contractStatus, setContractStatus] = useState<DocStatus>(b?.contractStatus ?? "missing");
  const [notes, setNotes] = useState(b?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!companyName.trim()) { setError("Company name is required."); return; }
    const payload = {
      companyName: companyName.trim(), trade, status,
      primaryContactName: contactName.trim() || undefined, phone: phone.trim() || undefined, email: email.trim() || undefined,
      serviceArea: serviceArea.trim() || undefined, defaultRate: defaultRate.trim() || undefined,
      insuranceStatus, insuranceExpiration: insuranceExpiration.trim() || undefined, w9Status,
      licenseStatus, licenseNumber: licenseNumber.trim() || undefined, contractStatus, notes: notes.trim() || undefined,
    };
    if (isNew) createSubcontractor(payload);
    else updateSubcontractor((sub as Subcontractor).id, payload);
    onSaved();
  }

  const docOpts = DOC_STATUSES.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }));

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[92vh] rounded-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{isNew ? "Add Subcontractor" : "Edit Subcontractor"}</p>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company name *" className="col-span-2"><input value={companyName} onChange={e => setCompanyName(e.target.value)} className={inp} style={inpStyle} autoFocus /></Field>
            <Field label="Trade"><UiSelect value={trade} onChange={v => setTrade(v as SubTrade)} options={SUB_TRADES.map(t => ({ value: t, label: t }))} /></Field>
            <Field label="Status"><UiSelect value={status} onChange={v => setStatus(v as SubStatus)} options={(Object.keys(SUB_STATUS_STYLE) as SubStatus[]).map(s => ({ value: s, label: SUB_STATUS_STYLE[s].label }))} /></Field>
            <Field label="Primary contact"><input value={contactName} onChange={e => setContactName(e.target.value)} className={inp} style={inpStyle} /></Field>
            <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} className={inp} style={inpStyle} /></Field>
            <Field label="Email"><input value={email} onChange={e => setEmail(e.target.value)} className={inp} style={inpStyle} /></Field>
            <Field label="Service area"><input value={serviceArea} onChange={e => setServiceArea(e.target.value)} placeholder="Augusta, GA" className={inp} style={inpStyle} /></Field>
            <Field label="Default rate"><input value={defaultRate} onChange={e => setDefaultRate(e.target.value)} placeholder="$85/hr" className={inp} style={inpStyle} /></Field>
            <Field label="License #"><input value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} className={inp} style={inpStyle} /></Field>
          </div>
          <DrawerBlockTitle>Compliance</DrawerBlockTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label="W-9"><UiSelect value={w9Status} onChange={v => setW9Status(v as DocStatus)} options={docOpts} /></Field>
            <Field label="Insurance"><UiSelect value={insuranceStatus} onChange={v => setInsuranceStatus(v as DocStatus)} options={docOpts} /></Field>
            <Field label="Insurance expiration"><input value={insuranceExpiration} onChange={e => setInsuranceExpiration(e.target.value)} placeholder="Mar 1, 2027" className={inp} style={inpStyle} /></Field>
            <Field label="License"><UiSelect value={licenseStatus} onChange={v => setLicenseStatus(v as DocStatus)} options={docOpts} /></Field>
            <Field label="Contract"><UiSelect value={contractStatus} onChange={v => setContractStatus(v as DocStatus)} options={docOpts} /></Field>
          </div>
          <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inp} resize-none`} style={inpStyle} /></Field>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Adding a subcontractor also creates its linked vendor master record. Compliance files live in the Documents app.</p>
        </div>
        {error && <div className="mx-5 mb-3 px-3 py-2 rounded-lg text-xs shrink-0" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>{error}</div>}
        <div className="px-5 py-3 flex items-center justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} className="text-sm font-medium px-4 py-2 rounded-lg text-white" style={{ backgroundColor: ACCENT }}>{isNew ? "Add Subcontractor" : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}
