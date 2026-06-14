"use client";

// Overview: the six summary cards + a clean read-only summary of the agreement.

import { User, MapPin, Tag, Calendar, RefreshCw, DollarSign, CalendarClock, UserCog, Building2 } from "lucide-react";
import {
  formatValue, nextBillingDate, agreementVisitProgress, type CustomerAgreement,
} from "@/lib/agreements/data";
import SummaryCards from "./SummaryCards";
import { Card, SectionLabel, InfoRow, AGREEMENT_STATUS } from "./shared";

function fmtDate(d: Date | null): string {
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export default function OverviewTab({ agreement }: { agreement: CustomerAgreement }) {
  const s = AGREEMENT_STATUS[agreement.status];
  const progress = agreementVisitProgress(agreement);
  const nextBill = nextBillingDate(agreement);

  return (
    <div className="space-y-5">
      <SummaryCards agreement={agreement} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agreement details */}
        <Card className="p-4 lg:col-span-2">
          <SectionLabel>Agreement Details</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3">
            <InfoRow icon={Tag}        label="Agreement" value={agreement.type} />
            <InfoRow icon={Building2}  label="Agreement #" value={agreement.number ?? "—"} />
            <InfoRow icon={User}       label="Customer / Account" value={agreement.customer} />
            <InfoRow icon={MapPin}     label="Service Location" value={agreement.propertyLabel ?? agreement.location} />
            <InfoRow icon={Tag}        label="Type / Industry" value={`${agreement.type} · ${agreement.industry}`} />
            <InfoRow icon={Calendar}   label="Status" value={<span style={{ color: s.color === "var(--text-muted)" ? "var(--text-primary)" : s.color, fontWeight: 600 }}>{s.label}</span>} />
            <InfoRow icon={Calendar}   label="Start Date" value={agreement.startDate} />
            <InfoRow icon={Calendar}   label="End Date" value={agreement.endDate ?? "—"} />
            <InfoRow icon={RefreshCw}  label="Renewal Date" value={agreement.renewalDate} />
            <InfoRow icon={RefreshCw}  label="Renewal" value={agreement.renewal?.autoRenew ? "Auto-renew" : "Manual"} />
          </div>
        </Card>

        {/* People + next steps */}
        <div className="space-y-4">
          <Card className="p-4">
            <SectionLabel>People</SectionLabel>
            <div className="space-y-3 mt-3">
              <InfoRow icon={User}    label="Primary Contact" value={agreement.contactName ?? "—"} />
              <InfoRow icon={UserCog} label="Assigned Manager / Sales" value={agreement.assignedTo} />
            </div>
          </Card>

          <Card className="p-4">
            <SectionLabel>Billing &amp; Visits</SectionLabel>
            <div className="space-y-3 mt-3">
              <InfoRow icon={DollarSign}   label="Billing" value={`${formatValue(agreement)} · ${agreement.billingLabel ?? agreement.billingFrequency}`} />
              <InfoRow icon={DollarSign}   label="Next Billing Date" value={fmtDate(nextBill)} />
              <InfoRow icon={CalendarClock}label="Next Scheduled Visit" value={agreement.nextVisit ?? "None planned"} />
              <InfoRow icon={CalendarClock}label="Visit Progress" value={`${progress.done} of ${progress.total} completed`} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
