"use client";

import { useMemo, useState } from "react";
import { X, Pencil, Check } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { getBoardCandidates } from "@/lib/users/data";
import {
  updateLead, LEAD_SOURCE_LABELS, LEAD_STAGE_CONFIG,
  type Lead, type LeadSource, type LeadStage,
} from "@/lib/leads/data";

const STAGE_OPTIONS = (Object.entries(LEAD_STAGE_CONFIG) as [LeadStage, { label: string; order: number }][])
  .sort((a, b) => a[1].order - b[1].order)
  .map(([value, c]) => ({ value, label: c.label }));

const SOURCE_OPTIONS = (Object.entries(LEAD_SOURCE_LABELS) as [LeadSource, string][])
  .map(([value, label]) => ({ value, label }));

function initialsOf(name: string): string {
  const p = name.replace(/\(.*\)/, "").trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

const inputCls = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const inputStyle = { border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" } as const;
const labelCls = "block text-xs font-medium mb-1";
const labelStyle = { color: "var(--text-secondary)" } as const;

// Edit an existing lead's core fields (and prospect contact info when the lead
// isn't tied to a customer account). Account linkage itself isn't changed here —
// that's what the conversion / account tools are for.
export default function LeadEditModal({ lead, onClose, onSaved }: {
  lead: Lead;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isProspect = !lead.accountId;

  const [title, setTitle]   = useState(lead.title);
  const [stage, setStage]   = useState<LeadStage>(lead.stage);
  const [source, setSource] = useState<LeadSource>(lead.source);
  const [estVal, setEstVal] = useState(lead.estimatedValue ?? "");
  const [tech, setTech]     = useState(lead.assignedTo === "Unassigned" ? "" : lead.assignedTo);
  const [notes, setNotes]   = useState(lead.notes ?? "");

  // Prospect-only contact fields (linked accounts own their own contact info).
  const [name, setName]   = useState(lead.customerName);
  const [phone, setPhone] = useState(lead.customerPhone ?? "");
  const [email, setEmail] = useState(lead.customerEmail ?? "");
  const [addr, setAddr]   = useState(lead.customerAddress ?? "");

  const roster = useMemo(
    () => getBoardCandidates(lead.companyId, lead.locationId).map(u => u.fullName),
    [lead.companyId, lead.locationId],
  );

  const canSave = Boolean(title.trim() && (isProspect ? name.trim() : true));

  function handleSave() {
    if (!canSave) return;
    const assignedTo = tech.trim() || "Unassigned";
    updateLead(lead.id, {
      title: title.trim(),
      stage,
      source,
      estimatedValue: estVal.trim() || undefined,
      assignedTo,
      assignedToInitials: assignedTo === "Unassigned" ? "—" : initialsOf(assignedTo),
      notes: notes.trim() || undefined,
      ...(isProspect ? {
        customerName: name.trim(),
        customerInitials: initialsOf(name.trim()),
        customerPhone: phone.trim() || undefined,
        customerEmail: email.trim() || undefined,
        customerAddress: addr.trim() || undefined,
      } : {}),
    });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <Pencil className="w-4 h-4 shrink-0" style={{ color: "#4f46e5" }} />
            <div className="min-w-0">
              <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Edit Lead</p>
              <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{lead.customerName}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto thin-scroll-y px-6 py-4 space-y-4">
          <div>
            <label className={labelCls} style={labelStyle}>Lead Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. New AC system — whole home"
              className={inputCls} style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Stage</label>
              <UiSelect value={stage} onChange={v => setStage(v as LeadStage)} options={STAGE_OPTIONS} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Source</label>
              <UiSelect value={source} onChange={v => setSource(v as LeadSource)} options={SOURCE_OPTIONS} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Estimated Value</label>
              <input value={estVal} onChange={e => setEstVal(e.target.value)} placeholder="e.g. $8,500"
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Assigned To</label>
              <UiSelect value={tech} onChange={setTech} options={[{ value: "", label: "Unassigned" }, ...roster.map(r => ({ value: r, label: r }))]} />
            </div>
          </div>

          {isProspect && (
            <div className="rounded-xl p-3 space-y-3" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Prospect Contact</p>
              <div>
                <label className={labelCls} style={labelStyle}>Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} style={labelStyle}>Phone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} className={inputCls} style={inputStyle} />
                </div>
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Address</label>
                <input value={addr} onChange={e => setAddr(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
            </div>
          )}

          <div>
            <label className={labelCls} style={labelStyle}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Context, what they asked for, next step…"
              className={`${inputCls} resize-none`} style={inputStyle} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={handleSave} disabled={!canSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#4f46e5" }}>
            <Check className="w-3.5 h-3.5" /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
