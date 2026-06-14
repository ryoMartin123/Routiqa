"use client";

import { CheckCircle2, Calendar, DollarSign, Star, Shield, XCircle, RefreshCw, PenLine } from "lucide-react";
import type { SectionKey, TemplateService, TemplateVisit, TemplateTerm } from "@/lib/agreements/templates";

export interface AgreementDocData {
  sections: SectionKey[];
  title: string;
  planLevel?: string;
  customerName: string;
  contactName?: string;
  propertyLabel?: string;
  locationName?: string;
  startDate?: string;
  endDate?: string;
  renewalDate?: string;
  coverage?: string[];
  services: TemplateService[];
  visits: TemplateVisit[];
  visitFrequencyLabel?: string;
  billingLabel?: string;
  billingAmount?: number;
  billingTaxable?: boolean;
  firstBillingDate?: string;
  benefits: string[];
  exclusions?: string;
  terms: TemplateTerm[];
  renewal?: { autoRenew: boolean; termMonths: number; noticeDays: number; priceIncreasePct: number };
}

function money(n?: number): string {
  return n == null ? "—" : `$${n.toLocaleString()}`;
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Star; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-3.5 h-3.5" style={{ color: "#4f46e5" }} />
      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{children}</p>
    </div>
  );
}

// Renders the customer-facing agreement document from the enabled sections.
// Read-only preview — not a legal editor (that's out of scope for now).
export default function AgreementDocumentPreview({ data }: { data: AgreementDocData }) {
  const has = (k: SectionKey) => data.sections.includes(k);
  const cancelTerm = data.terms.find(t => /cancel/i.test(t.title));
  const renewTerm = data.terms.find(t => /renew/i.test(t.title));
  const otherTerms = data.terms.filter(t => t !== cancelTerm && t !== renewTerm);

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      {/* Header */}
      {has("header") && (
        <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{data.title || "Service Agreement"}</p>
              {data.planLevel && <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{data.planLevel} plan</p>}
            </div>
            <div className="text-right text-[11px]" style={{ color: "var(--text-muted)" }}>
              {data.startDate && <p>Start: <span style={{ color: "var(--text-secondary)" }}>{data.startDate}</span></p>}
              {(data.endDate || data.renewalDate) && <p>Renews: <span style={{ color: "var(--text-secondary)" }}>{data.endDate || data.renewalDate}</span></p>}
            </div>
          </div>
        </div>
      )}

      <div className="p-6 space-y-5">
        {/* Customer */}
        {has("customer") && (
          <div>
            <SectionTitle icon={CheckCircle2}>Customer</SectionTitle>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{data.customerName}</p>
            {data.contactName && <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Contact: {data.contactName}</p>}
            {data.propertyLabel && <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{data.propertyLabel}</p>}
            {data.locationName && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{data.locationName}</p>}
          </div>
        )}

        {/* Coverage */}
        {has("coverage") && (data.coverage?.length ?? 0) > 0 && (
          <div>
            <SectionTitle icon={Shield}>Coverage</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {data.coverage!.map((c, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* Included services */}
        {has("included_services") && data.services.length > 0 && (
          <div>
            <SectionTitle icon={CheckCircle2}>Included Services</SectionTitle>
            <div className="space-y-1.5">
              {data.services.map(s => {
                const visitName = s.visitId ? data.visits.find(v => v.id === s.visitId)?.name : undefined;
                return (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: s.included ? "#10b981" : "var(--text-muted)" }} />
                    <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                      {s.quantity > 1 ? `${s.quantity}× ` : ""}{s.name}
                    </span>
                    {visitName && (
                      <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{visitName}</span>
                    )}
                  </div>
                  <span className="text-[11px] shrink-0 font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: s.included ? "#d1fae5" : "#fef3c7", color: s.included ? "#065f46" : "#92400e" }}>
                    {s.included ? "Included" : `${s.discountPct ?? 0}% off`}
                  </span>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Visit schedule */}
        {has("visit_schedule") && data.visits.length > 0 && (
          <div>
            <SectionTitle icon={Calendar}>Visit Schedule {data.visitFrequencyLabel ? `· ${data.visitFrequencyLabel}` : ""}</SectionTitle>
            <div className="space-y-1.5">
              {data.visits.map(v => (
                <div key={v.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>{v.name}</span>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {v.preferredWindow ? `${v.preferredWindow} · ` : ""}{v.durationMin}m
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Billing terms */}
        {has("billing_terms") && (
          <div>
            <SectionTitle icon={DollarSign}>Billing Terms</SectionTitle>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {money(data.billingAmount)} {data.billingLabel ? `· ${data.billingLabel}` : ""}
                {data.billingTaxable ? " · taxable" : ""}
              </span>
              {data.firstBillingDate && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>First bill: {data.firstBillingDate}</span>}
            </div>
          </div>
        )}

        {/* Benefits */}
        {has("benefits") && data.benefits.length > 0 && (
          <div>
            <SectionTitle icon={Star}>Member Benefits</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {data.benefits.map((b, i) => (
                <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text-strong)" }}>
                  <Star className="w-2.5 h-2.5" /> {b}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Exclusions */}
        {has("exclusions") && data.exclusions && (
          <div>
            <SectionTitle icon={XCircle}>Exclusions</SectionTitle>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{data.exclusions}</p>
          </div>
        )}

        {/* General terms */}
        {otherTerms.length > 0 && (
          <div className="space-y-3">
            {otherTerms.map((t, i) => (
              <div key={i}>
                <SectionTitle icon={Shield}>{t.title}</SectionTitle>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{t.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Cancellation */}
        {has("cancellation") && cancelTerm && (
          <div>
            <SectionTitle icon={XCircle}>Cancellation Terms</SectionTitle>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{cancelTerm.body}</p>
          </div>
        )}

        {/* Renewal */}
        {has("renewal") && (
          <div>
            <SectionTitle icon={RefreshCw}>Renewal Terms</SectionTitle>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {data.renewal
                ? `${data.renewal.autoRenew ? "Auto-renews" : "Renews on approval"} every ${data.renewal.termMonths} months with ${data.renewal.noticeDays} days notice${data.renewal.priceIncreasePct ? `, subject to a ${data.renewal.priceIncreasePct}% adjustment` : ""}.`
                : renewTerm?.body}
            </p>
          </div>
        )}

        {/* Signature placeholder */}
        {has("signature") && (
          <div className="pt-4" style={{ borderTop: "1px dashed var(--border)" }}>
            <SectionTitle icon={PenLine}>Approval</SectionTitle>
            <div className="grid grid-cols-2 gap-6 mt-2">
              {["Customer Signature", "Company Representative"].map(l => (
                <div key={l}>
                  <div className="h-10 rounded-lg" style={{ border: "1px dashed var(--border)", backgroundColor: "var(--bg-surface-2)" }} />
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{l}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] mt-3" style={{ color: "var(--text-muted)" }}>
              E-signature is not enabled yet — this is a placeholder for the approval block.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
