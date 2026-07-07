"use client";

// Agreement Detail header: identity (title/number/customer/status/term), a single
// status-driven primary action + one secondary, and a More menu for everything
// else. Keeps the button count low per the design guardrails.

import Link from "next/link";
import {
  ArrowLeft, MoreVertical, Calendar, FileText, RefreshCw, Copy, Eye,
  Pencil, Upload, Download, XCircle, Archive, Trash2,
} from "lucide-react";
import { type CustomerAgreement } from "@/lib/agreements/data";

export interface HeaderActions {
  scheduleVisit: () => void;
  createInvoice: () => void;
  renew: () => void;
  createRenewalQuote: () => void;
  duplicate: () => void;
  preview: () => void;
  edit: () => void;
  uploadDocument: () => void;
  downloadPdf: () => void;
  cancel: () => void;
  archive: () => void;
  remove: () => void;
}

function primaryFor(status: CustomerAgreement["status"], a: HeaderActions): { label: string; icon: typeof Calendar; run: () => void; secondary?: { label: string; icon: typeof Calendar; run: () => void } } {
  switch (status) {
    case "renewal_due":
    case "overdue":
      return { label: "Renew Agreement", icon: RefreshCw, run: a.renew, secondary: { label: "Renewal Quote", icon: FileText, run: a.createRenewalQuote } };
    case "canceled":
      return { label: "Duplicate", icon: Copy, run: a.duplicate, secondary: { label: "Preview", icon: Eye, run: a.preview } };
    default: // active / due_soon — Create Invoice lives in the More menu, not as a button
      return { label: "Schedule Next Visit", icon: Calendar, run: a.scheduleVisit };
  }
}

export default function DetailHeader({ agreement, actions, menuOpen, setMenuOpen }: {
  agreement: CustomerAgreement;
  actions: HeaderActions;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
}) {
  const primary = primaryFor(agreement.status, actions);
  const term = [agreement.startDate, agreement.endDate || agreement.renewalDate].filter(Boolean).join(" → ");

  const menuItem = (icon: typeof Pencil, label: string, run: () => void, danger = false) => (
    <button onClick={() => { setMenuOpen(false); run(); }}
      className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${danger ? "hover:bg-red-50" : "hover:bg-[var(--bg-surface-2)]"}`}
      style={{ color: danger ? "#dc2626" : "var(--text-primary)" }}>
      {(() => { const I = icon; return <I className="w-3.5 h-3.5" />; })()} {label}
    </button>
  );

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        {/* Back + Identity */}
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/agreements" className="flex items-center gap-1.5 text-sm shrink-0 transition-colors hover:brightness-110" style={{ color: "var(--text-secondary)" }}>
            <ArrowLeft className="w-4 h-4" /> Agreements
          </Link>
          <div className="w-px h-9 shrink-0" style={{ backgroundColor: "var(--border)" }} />
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-input)" }}>
            <FileText className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate" style={{ color: "var(--text-primary)" }}>{agreement.type}</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {agreement.number ? `${agreement.number} · ` : ""}{agreement.customer}{term ? ` · ${term}` : ""}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {primary.secondary && (
            <button onClick={primary.secondary.run}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition hover:brightness-95"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
              <primary.secondary.icon className="w-3.5 h-3.5" /> {primary.secondary.label}
            </button>
          )}
          <button onClick={primary.run}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium text-white cursor-pointer transition hover:brightness-110"
            style={{ backgroundColor: "#0f8578" }}>
            <primary.icon className="w-3.5 h-3.5" /> {primary.label}
          </button>

          {/* More */}
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} aria-label="More actions"
              className="flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <button aria-hidden tabIndex={-1} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl overflow-hidden py-1"
                  style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  {agreement.status !== "canceled" && menuItem(FileText, "Create Invoice", actions.createInvoice)}
                  {menuItem(Pencil, "Edit Agreement", actions.edit)}
                  {menuItem(Copy, "Duplicate", actions.duplicate)}
                  {menuItem(Upload, "Upload Document", actions.uploadDocument)}
                  {menuItem(Download, "Download PDF", actions.downloadPdf)}
                  <div style={{ borderTop: "1px solid var(--border)" }} />
                  {agreement.status !== "canceled" && menuItem(XCircle, "Cancel Agreement", actions.cancel)}
                  {menuItem(Archive, "Archive", actions.archive)}
                  <div style={{ borderTop: "1px solid var(--border)" }} />
                  {menuItem(Trash2, "Delete", actions.remove, true)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
