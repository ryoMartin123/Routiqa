"use client";

// ─── SMS / call-script template editor ────────────────────
// Emails get the Design Studio; SMS and call scripts are deliberately plain
// text with merge fields. SMS shows a live character / segment counter and a
// STOP-compliance nudge; a call script is the outline a CSR reads when the
// campaign creates call tasks.

import { useState } from "react";
import { X, MessageSquare, Phone } from "lucide-react";
import { createTemplate, updateTemplate, type MarketingTemplate } from "@/lib/marketing/data";
import { MERGE_FIELDS } from "@/lib/design-studio/model";

const ROSE = "#e11d48";   // marketing app accent

const KIND_META = {
  sms: {
    icon: MessageSquare, title: "SMS Template", type: "sms" as const, rows: 4,
    starter: "Hi {{first_name}}, it's {{company}}. \n\nReply STOP to opt out.",
    hint: "Keep it short and include “Reply STOP to opt out” — carriers require it.",
  },
  call: {
    icon: Phone, title: "Call Script", type: "call_reminder" as const, rows: 9,
    starter: "Intro: Hi {{first_name}}, this is ____ with {{company}}.\nReason: Following up on {{job_title}}.\nAsk: Can we get you on the schedule this week?\nIf no answer: leave a voicemail and note the task.",
    hint: "Shown on the call task the campaign creates — what the caller says, line by line.",
  },
};

export default function TextTemplateModal({ kind, template, onClose, onSaved }: {
  kind: "sms" | "call";
  template: MarketingTemplate | null;
  onClose: () => void;
  onSaved: (t: MarketingTemplate) => void;
}) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const [name, setName] = useState(template?.name ?? "");
  const [body, setBody] = useState(template?.body ?? meta.starter);

  // SMS segment math: 160 chars fit one segment; longer messages split into
  // 153-char segments (GSM-7). Merge fields expand at send time, so this is
  // a floor, not a guarantee — the hint says as much.
  const len = body.length;
  const segments = len === 0 ? 0 : len <= 160 ? 1 : Math.ceil(len / 153);

  function save() {
    if (!name.trim()) return;
    const saved = template
      ? updateTemplate(template.id, { name: name.trim(), body })
      : createTemplate({ name, type: meta.type, body });
    if (saved) onSaved(saved);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" style={{ color: ROSE }} />
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{template ? `Edit ${meta.title}` : `New ${meta.title}`}</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll-y px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={kind === "sms" ? "e.g. On-the-Way SMS" : "e.g. Renewal Call Script"} autoFocus
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{kind === "sms" ? "Message" : "Script"}</label>
              {kind === "sms" && (
                <span className="text-[11px] tabular-nums" style={{ color: len > 160 ? "#b45309" : "var(--text-muted)" }}>
                  {len} chars · {segments} segment{segments === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={meta.rows}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none leading-relaxed"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
            <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{meta.hint}</p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Merge fields <span className="font-normal" style={{ color: "var(--text-muted)" }}>· tap to add</span></label>
            <div className="flex flex-wrap gap-1">
              {MERGE_FIELDS.map(f => (
                <button key={f} onClick={() => setBody(b => `${b}${b.endsWith(" ") || b === "" ? "" : " "}${f}`)}
                  className="text-[10px] px-1.5 py-0.5 rounded font-mono transition-colors hover:bg-[var(--bg-surface-2)]"
                  style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{f}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={save} disabled={!name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: ROSE }}>
            {template ? "Save Changes" : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
