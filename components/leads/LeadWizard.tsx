"use client";

import { useMemo, useState } from "react";
import { X, TrendingUp, Building2, UserPlus, ChevronLeft, ChevronRight, Check } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import AccountCombobox from "@/components/customers/AccountCombobox";
import NewCustomerModal from "@/components/customers/NewCustomerModal";
import { getCustomer } from "@/lib/customers/data";
import { getBoardCandidates } from "@/lib/users/data";
import {
  createLead, LEAD_SOURCE_LABELS, LEAD_STAGE_CONFIG,
  type LeadSource, type LeadStage,
} from "@/lib/leads/data";

// Creation stages a lead can start in — exclude the terminal Won/Lost columns.
const START_STAGES = (Object.entries(LEAD_STAGE_CONFIG) as [LeadStage, { label: string; order: number }][])
  .filter(([, c]) => c.order <= 6)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([key, c]) => ({ value: key, label: c.label }));

const SOURCE_OPTIONS = (Object.entries(LEAD_SOURCE_LABELS) as [LeadSource, string][])
  .map(([value, label]) => ({ value, label }));

type AccountMode = "" | "existing" | "new";

export default function LeadWizard({ preset, onClose, onCreated }: {
  preset?: { accountId?: string; lockAccount?: boolean };
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [step, setStep] = useState(preset?.accountId ? 2 : 1);
  const [mode, setMode] = useState<AccountMode>(preset?.accountId ? "existing" : "");
  const [accountId, setAccountId] = useState(preset?.accountId ?? "");
  const [showNewAccount, setShowNewAccount] = useState(false);

  // Lead fields (Step 2)
  const [title, setTitle]   = useState("");
  const [source, setSource] = useState<LeadSource>("phone");
  const [stage, setStage]   = useState<LeadStage>("new_lead");
  const [estVal, setEstVal] = useState("");
  const [tech, setTech]     = useState("");
  const [notes, setNotes]   = useState("");

  const account = accountId ? getCustomer(accountId) : undefined;
  const roster = useMemo(
    () => (account ? getBoardCandidates(account.companyId, account.locationId).map(u => u.fullName) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account?.companyId, account?.locationId],
  );

  function openNewAccount() { setMode("new"); setShowNewAccount(true); }

  function handleCreate() {
    if (!account || !title.trim()) return;
    const addr = [account.address, [account.city, account.state].filter(Boolean).join(", "), account.zip]
      .filter(Boolean).join(", ");
    const lead = createLead({
      companyId: account.companyId, locationId: account.locationId, locationName: account.locationName,
      serviceAreaId: account.serviceAreaId, accountId: account.id,
      title: title.trim(), source, stage,
      estimatedValue: estVal.trim() || undefined,
      assignedTo: tech || undefined,
      customerName: account.name, customerPhone: account.phone, customerEmail: account.email,
      customerAddress: addr || undefined,
      notes: notes.trim() || undefined,
    });
    onCreated(lead.id);
  }

  const canCreate = Boolean(account && title.trim() && source);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp className="w-4 h-4 shrink-0" style={{ color: "#0f8578" }} />
            <div className="min-w-0">
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>New Lead</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{step === 1 ? "Choose an account" : "Lead details"}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto thin-scroll-y px-6 py-4 space-y-4">
          {step === 1 && (
            <>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Who is this lead for?</p>
              <div className="grid grid-cols-2 gap-3">
                <ChoiceCard active={mode === "existing"} icon={Building2} title="Existing account"
                  desc="Search and pick an account" onClick={() => setMode("existing")} />
                <ChoiceCard active={mode === "new"} icon={UserPlus} title="New account"
                  desc="Create a prospect, then continue" onClick={openNewAccount} />
              </div>

              {mode === "existing" && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Account *</label>
                  <AccountCombobox value={accountId} onChange={setAccountId} onCreateNew={openNewAccount} />
                </div>
              )}

              {account && (
                <div className="rounded-xl p-3 flex items-center justify-between gap-3" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{account.name}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                      {account.status} · {[account.city, account.state].filter(Boolean).join(", ")}{account.locationName ? ` · ${account.locationName}` : ""}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "#d1fae5", color: "#065f46" }}>Selected</span>
                </div>
              )}
            </>
          )}

          {step === 2 && account && (
            <>
              {/* Account summary (locked at this step) */}
              <div className="rounded-xl p-3 flex items-center justify-between gap-3" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{account.name}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{account.status}{account.phone ? ` · ${account.phone}` : ""}</p>
                </div>
                {!preset?.lockAccount && (
                  <button onClick={() => setStep(1)} className="text-xs font-medium shrink-0" style={{ color: "var(--accent-text)" }}>Change</button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Lead Title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. New AC system — whole home"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Source *</label>
                  <UiSelect value={source} onChange={v => setSource(v as LeadSource)} options={SOURCE_OPTIONS} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Stage</label>
                  <UiSelect value={stage} onChange={v => setStage(v as LeadStage)} options={START_STAGES} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Estimated Value</label>
                  <input value={estVal} onChange={e => setEstVal(e.target.value)} placeholder="e.g. $8,500"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Assigned To</label>
                  <UiSelect value={tech} onChange={setTech} options={[{ value: "", label: "Unassigned" }, ...roster.map(r => ({ value: r, label: r }))]} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Context, what they asked for, next step…"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-between gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={() => (step === 2 && !preset?.lockAccount ? setStep(1) : onClose())}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            {step === 2 && !preset?.lockAccount ? <><ChevronLeft className="w-3.5 h-3.5" /> Back</> : "Cancel"}
          </button>
          {step === 1 ? (
            <button onClick={() => setStep(2)} disabled={!account}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#0f8578" }}>
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button onClick={handleCreate} disabled={!canCreate}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#0f8578" }}>
              <Check className="w-3.5 h-3.5" /> Create Lead
            </button>
          )}
        </div>
      </div>

      {/* New account → reuse the customer popup, forced to Prospect, and
          continue straight into the lead once it's created. */}
      {showNewAccount && (
        <NewCustomerModal
          open
          forceStatus="Prospect"
          onClose={() => setShowNewAccount(false)}
          onCreated={(c) => { setShowNewAccount(false); setAccountId(c.id); setMode("existing"); }}
        />
      )}
    </div>
  );
}

function ChoiceCard({ active, icon: Icon, title, desc, onClick }: {
  active: boolean; icon: typeof Building2; title: string; desc: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} type="button"
      className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
      style={{ border: `2px solid ${active ? "#0f8578" : "var(--border)"}`, backgroundColor: active ? "#f5f3ff" : "var(--bg-surface-2)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: active ? "#0f8578" : "var(--bg-input)" }}>
        <Icon className="w-4 h-4" style={{ color: active ? "#ffffff" : "var(--text-muted)" }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: active ? "#0f8578" : "var(--text-primary)" }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</p>
      </div>
    </button>
  );
}
