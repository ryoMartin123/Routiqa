"use client";

import { useMemo, useState } from "react";
import { X, FolderKanban, Building2, TrendingUp, ChevronLeft, ChevronRight, Check } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import AccountCombobox from "@/components/customers/AccountCombobox";
import LeadCombobox from "@/components/leads/LeadCombobox";
import { getCustomer } from "@/lib/customers/data";
import { getLead, updateLead } from "@/lib/leads/data";
import { getBoardCandidates } from "@/lib/users/data";
import {
  createProject, PROJECT_TYPE_LABELS,
  type ProjectType, type ProjectPriority,
} from "@/lib/projects/data";
import { templateForType } from "@/lib/projects/map-templates";

const TYPE_OPTIONS = (Object.entries(PROJECT_TYPE_LABELS) as [ProjectType, string][])
  .map(([value, label]) => ({ value, label }));
const PRIORITY_OPTIONS: { value: ProjectPriority; label: string }[] = [
  { value: "low", label: "Low" }, { value: "normal", label: "Normal" },
  { value: "high", label: "High" }, { value: "urgent", label: "Urgent" },
];

function initialsOf(name: string): string {
  const p = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

type SourceMode = "" | "account" | "lead";

export default function ProjectWizard({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<SourceMode>("");
  const [accountId, setAccountId] = useState("");
  const [leadId, setLeadId] = useState("");

  // Project fields (Step 2)
  const [name, setName]   = useState("");
  const [type, setType]   = useState<ProjectType>("installation");
  const [priority, setPriority] = useState<ProjectPriority>("normal");
  const [estVal, setEstVal] = useState("");
  const [tech, setTech]   = useState("");
  const [description, setDescription] = useState("");

  // Resolve the target account (the project always belongs to a customer account;
  // a lead resolves through its linked account).
  const lead = leadId ? getLead(leadId) : undefined;
  const account = mode === "lead"
    ? (lead?.accountId ? getCustomer(lead.accountId) : undefined)
    : (accountId ? getCustomer(accountId) : undefined);

  const target = useMemo(() => {
    if (account) {
      return {
        accountId: account.id, companyId: account.companyId, locationId: account.locationId,
        serviceAreaId: account.serviceAreaId, locationName: account.locationName,
        customerName: account.name, customerInitials: account.initials,
        propertyAddress: [account.address, [account.city, account.state].filter(Boolean).join(", "), account.zip].filter(Boolean).join(", ") || undefined,
      };
    }
    // Lead whose account was deleted — fall back to the lead's denormalized info.
    if (mode === "lead" && lead) {
      return {
        accountId: lead.accountId ?? "", companyId: lead.companyId, locationId: lead.locationId,
        serviceAreaId: lead.serviceAreaId, locationName: lead.locationName,
        customerName: lead.customerName, customerInitials: lead.customerInitials,
        propertyAddress: lead.customerAddress,
      };
    }
    return null;
  }, [account, mode, lead]);

  const roster = useMemo(
    () => (target ? getBoardCandidates(target.companyId, target.locationId).map(u => u.fullName) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target?.companyId, target?.locationId],
  );

  // Seed the project name/value from a chosen lead.
  function pickLead(id: string) {
    setLeadId(id);
    const l = getLead(id);
    if (l) { if (!name.trim()) setName(l.title); if (!estVal.trim() && l.estimatedValue) setEstVal(l.estimatedValue); }
  }

  function handleCreate() {
    if (!target || !name.trim()) return;
    const project = createProject({
      companyId: target.companyId, locationId: target.locationId, serviceAreaId: target.serviceAreaId,
      accountId: target.accountId, customerName: target.customerName, customerInitials: target.customerInitials,
      locationName: target.locationName, propertyAddress: target.propertyAddress,
      name: name.trim(), description: description.trim() || undefined,
      type, priority,
      estimatedValue: estVal.trim() || undefined,
      assignedTo: tech || undefined, assignedToInitials: tech ? initialsOf(tech) : undefined,
    });
    // Picked from a lead → convert it: mark Won and link to the new project so the
    // lead profile reflects the conversion.
    if (mode === "lead" && leadId) {
      updateLead(leadId, { convertedToProjectId: project.id, stage: "won" });
    }
    onCreated(project.id);
  }

  const canCreate = Boolean(target && name.trim());

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <FolderKanban className="w-4 h-4 shrink-0" style={{ color: "#4f46e5" }} />
            <div className="min-w-0">
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>New Project</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{step === 1 ? "Choose an account or lead" : "Project details"}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto thin-scroll-y px-6 py-4 space-y-4">
          {step === 1 && (
            <>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>What is this project for?</p>
              <div className="grid grid-cols-2 gap-3">
                <ChoiceCard active={mode === "account"} icon={Building2} title="Existing account"
                  desc="Search and pick an account" onClick={() => { setMode("account"); setLeadId(""); }} />
                <ChoiceCard active={mode === "lead"} icon={TrendingUp} title="From a lead"
                  desc="Converts the lead to a project" onClick={() => { setMode("lead"); setAccountId(""); }} />
              </div>

              {mode === "account" && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Account *</label>
                  <AccountCombobox value={accountId} onChange={setAccountId} dropUp />
                </div>
              )}

              {mode === "lead" && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Lead *</label>
                  <LeadCombobox value={leadId} onChange={pickLead} />
                  {target && (
                    <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                      Creating this project marks the lead as <strong>Won</strong> and links it here.
                    </p>
                  )}
                </div>
              )}

              {target && (
                <div className="rounded-xl p-3 flex items-center justify-between gap-3" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{target.customerName}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{target.locationName || "—"}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>Selected</span>
                </div>
              )}
            </>
          )}

          {step === 2 && target && (
            <>
              <div className="rounded-xl p-3 flex items-center justify-between gap-3" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{target.customerName}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{mode === "lead" ? "From lead · will convert" : "Account"}{target.locationName ? ` · ${target.locationName}` : ""}</p>
                </div>
                <button onClick={() => setStep(1)} className="text-xs font-medium shrink-0" style={{ color: "var(--accent-text)" }}>Change</button>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Project Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Whole-home HVAC replacement"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Type</label>
                  <UiSelect value={type} onChange={v => setType(v as ProjectType)} options={TYPE_OPTIONS} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Priority</label>
                  <UiSelect value={priority} onChange={v => setPriority(v as ProjectPriority)} options={PRIORITY_OPTIONS} />
                </div>
              </div>

              {/* The type selects the project's Map workflow. */}
              <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                <FolderKanban className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#4f46e5" }} />
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Creates the <span style={{ color: "#4f46e5", fontWeight: 600 }}>{templateForType(type).name}</span> workflow — milestones, linked records, and a connected project map.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Estimated Value</label>
                  <input value={estVal} onChange={e => setEstVal(e.target.value)} placeholder="e.g. $24,000"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Assigned To</label>
                  <UiSelect value={tech} onChange={setTech} options={[{ value: "", label: "Unassigned" }, ...roster.map(r => ({ value: r, label: r }))]} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  placeholder="Scope, milestones, what's included…"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-between gap-2 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={() => (step === 2 ? setStep(1) : onClose())}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            {step === 2 ? <><ChevronLeft className="w-3.5 h-3.5" /> Back</> : "Cancel"}
          </button>
          {step === 1 ? (
            <button onClick={() => setStep(2)} disabled={!target}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button onClick={handleCreate} disabled={!canCreate}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
              <Check className="w-3.5 h-3.5" /> Create Project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({ active, icon: Icon, title, desc, onClick }: {
  active: boolean; icon: typeof Building2; title: string; desc: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} type="button"
      className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
      style={{ border: `2px solid ${active ? "#4f46e5" : "var(--border)"}`, backgroundColor: active ? "#f5f3ff" : "var(--bg-surface-2)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-input)" }}>
        <Icon className="w-4 h-4" style={{ color: active ? "#ffffff" : "var(--text-muted)" }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: active ? "#4f46e5" : "var(--text-primary)" }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</p>
      </div>
    </button>
  );
}
