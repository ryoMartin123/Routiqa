"use client";

// Renewal: the agreement's renewal lifecycle + actions. Renew/Cancel are wired
// to the real helpers; task/quote/month-to-month are placeholders for now.

import { useState } from "react";
import { RefreshCw, Calendar, Percent, Bell, ShieldCheck, FileText, XCircle, CalendarClock, ChevronRight } from "lucide-react";
import { type CustomerAgreement } from "@/lib/agreements/data";
import { Card, SectionLabel, InfoRow, RENEWAL_LABEL } from "./shared";

export default function RenewalTab({ agreement, onRenew, onCancel }: {
  agreement: CustomerAgreement; onRenew: () => void; onCancel: () => void;
}) {
  const [soon, setSoon] = useState<string | null>(null);
  const r = agreement.renewal;
  const termMonths = r?.termMonths ?? 12;
  const isRenewalDue = agreement.status === "renewal_due" || agreement.status === "overdue";
  const priceRule = r?.priceIncreasePct
    ? (r.priceIncreaseType === "flat" ? `+$${r.priceIncreasePct} at renewal` : `+${r.priceIncreasePct}% at renewal`)
    : "No increase";
  const placeholder = (label: string) => () => setSoon(`${label} isn't available yet.`);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Lifecycle */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="p-5" style={isRenewalDue ? { backgroundColor: "#fff7ed", border: "1px solid #fed7aa" } : undefined}>
          <SectionLabel>Renewal Date</SectionLabel>
          <p className="text-2xl font-bold mt-1" style={{ color: isRenewalDue ? "#ea580c" : "var(--text-primary)" }}>{agreement.renewalDate || "—"}</p>
          {isRenewalDue && <p className="text-sm mt-1" style={{ color: "#ea580c" }}>Renewal is due soon — take action to retain this agreement.</p>}
        </Card>

        <Card className="p-4">
          <SectionLabel>Renewal Terms</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3">
            <InfoRow icon={Calendar}    label="Term Length" value={termMonths === 12 ? "1 year" : `${termMonths} months`} />
            <InfoRow icon={Calendar}    label="Expiration Date" value={agreement.endDate ?? agreement.renewalDate} />
            <InfoRow icon={RefreshCw}   label="Renewal Type" value={RENEWAL_LABEL(r?.renewalType)} />
            <InfoRow icon={RefreshCw}   label="Auto-renew" value={r?.autoRenew ? "Yes" : "No"} />
            <InfoRow icon={Bell}        label="Reminder" value={r?.reminderDays != null ? `${r.reminderDays} days before` : "—"} />
            <InfoRow icon={Percent}     label="Price Increase" value={priceRule} />
            <InfoRow icon={ShieldCheck} label="Cancellation Notice" value={r?.noticeDays != null ? `${r.noticeDays} days` : "—"} />
            <InfoRow icon={ShieldCheck} label="Approval Required" value={r?.approvalRequired ? "Yes" : "No"} />
          </div>
        </Card>
      </div>

      {/* Actions */}
      <Card className="p-4">
        <SectionLabel>Actions</SectionLabel>
        <div className="space-y-2 mt-3">
          <button onClick={onRenew}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer transition hover:brightness-110" style={{ backgroundColor: "#0f8578" }}>
            <RefreshCw className="w-3.5 h-3.5" /> Renew for another {termMonths === 12 ? "year" : `${termMonths} months`}
          </button>
          {[
            { label: "Create renewal task", icon: CalendarClock },
            { label: "Create renewal quote", icon: FileText },
            { label: "Set month-to-month", icon: RefreshCw },
          ].map(({ label, icon: Icon }) => (
            <button key={label} onClick={placeholder(label)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <span className="flex items-center gap-2"><Icon className="w-3.5 h-3.5" /> {label}</span>
              <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            </button>
          ))}
          {agreement.status !== "canceled" && (
            <button onClick={onCancel}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors hover:bg-red-50" style={{ border: "1px solid var(--border)", color: "#dc2626" }}>
              <XCircle className="w-3.5 h-3.5" /> Cancel agreement
            </button>
          )}
          {soon && <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{soon}</p>}
        </div>
      </Card>
    </div>
  );
}
