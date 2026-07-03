"use client";

import { useState } from "react";
import {
  ArrowLeft, FileText, CalendarClock, Wrench, DollarSign, Star, ScrollText,
  RefreshCw, Eye, Check, Send, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAgreementDraft, type BuilderMode } from "./useAgreementDraft";
import BasicInfoSection from "./BasicInfoSection";
import VisitScheduleSection from "./VisitScheduleSection";
import ServiceScopeSection from "./ServiceScopeSection";
import BillingRulesSection from "./BillingRulesSection";
import BenefitsSection from "./BenefitsSection";
import TermsSection from "./TermsSection";
import RenewalsSection from "./RenewalsSection";
import PreviewSection from "./PreviewSection";

const SECTIONS = [
  { key: "basic",    label: "Basic Info",     icon: FileText },
  { key: "visits",   label: "Visit Schedule", icon: CalendarClock },
  { key: "services", label: "Service Scope",  icon: Wrench },
  { key: "billing",  label: "Billing Rules",  icon: DollarSign },
  { key: "benefits", label: "Benefits",       icon: Star },
  { key: "terms",    label: "Terms",          icon: ScrollText },
  { key: "renewals", label: "Renewals",       icon: RefreshCw },
  { key: "preview",  label: "Preview",        icon: Eye },
] as const;
type SectionKey = typeof SECTIONS[number]["key"];

export default function AgreementBuilderShell({ mode, agreementId, initialTemplateId, initialCustomerId, onClose, onSaved }: {
  mode: BuilderMode;
  agreementId?: string;
  initialTemplateId?: string;
  initialCustomerId?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const d = useAgreementDraft({ mode, agreementId, initialTemplateId, initialCustomerId });
  const [active, setActive] = useState<SectionKey>("basic");

  const idx = SECTIONS.findIndex(s => s.key === active);
  const isEdit = mode === "edit";
  const canActivate = d.completeness.basic && d.generatedVisits.length > 0;

  function persist(activate: boolean) {
    const id = d.save(activate);
    if (id) onSaved(id);
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--bg-app)" }}>
      {/* Header / actions */}
      <div className="sticky top-0 z-20 px-6 py-3 flex items-center gap-4" style={{ backgroundColor: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm shrink-0" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Agreements
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {isEdit ? "Customize Agreement" : "New Agreement"}
            {d.title ? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {d.title}</span> : null}
          </p>
          <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
            {d.customer ? d.customer.name : "No customer selected"} · ${d.annualValue.toLocaleString()}/yr · {d.generatedVisits.length} visit(s)/yr
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isEdit ? (
            <button onClick={() => persist(false)} disabled={!d.completeness.basic}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 cursor-pointer transition hover:brightness-110 disabled:cursor-not-allowed disabled:hover:brightness-100" style={{ backgroundColor: "#4f46e5" }}>
              <Check className="w-4 h-4" /> Save Changes
            </button>
          ) : (
            <>
              <button onClick={() => persist(false)} disabled={!d.completeness.basic}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 cursor-pointer transition hover:brightness-95 disabled:cursor-not-allowed disabled:hover:brightness-100" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
                Save Draft
              </button>
              <button onClick={() => persist(true)} disabled={!canActivate}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 cursor-pointer transition hover:brightness-110 disabled:cursor-not-allowed disabled:hover:brightness-100" style={{ backgroundColor: "#4f46e5" }}>
                <Send className="w-4 h-4" /> Activate
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-6 p-6">
        {/* Section rail */}
        <nav className="w-52 shrink-0 space-y-1 sticky top-[72px] self-start">
          {SECTIONS.map((s, i) => {
            const on = active === s.key;
            const done = d.completeness[s.key];
            return (
              <button key={s.key} onClick={() => setActive(s.key)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left"
                style={{ backgroundColor: on ? "var(--accent-soft-bg)" : "transparent", color: on ? "var(--accent-text-strong)" : "var(--text-secondary)", border: `1px solid ${on ? "var(--accent-soft-border)" : "transparent"}` }}>
                <s.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">{s.label}</span>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: done ? "#10b981" : "var(--border)" }} />
                <span className="text-[10px] tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
              </button>
            );
          })}
        </nav>

        {/* Active section */}
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
            {active === "basic"    && <BasicInfoSection d={d} />}
            {active === "visits"   && <VisitScheduleSection d={d} />}
            {active === "services" && <ServiceScopeSection d={d} />}
            {active === "billing"  && <BillingRulesSection d={d} />}
            {active === "benefits" && <BenefitsSection d={d} />}
            {active === "terms"    && <TermsSection d={d} />}
            {active === "renewals" && <RenewalsSection d={d} />}
            {active === "preview"  && <PreviewSection d={d} />}
          </div>

          {/* Prev / Next */}
          <div className="flex items-center justify-between mt-4">
            <button onClick={() => setActive(SECTIONS[Math.max(0, idx - 1)].key)} disabled={idx === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm disabled:opacity-40 cursor-pointer transition hover:bg-[var(--bg-surface-2)] disabled:cursor-not-allowed disabled:hover:bg-transparent" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            {idx < SECTIONS.length - 1 && (
              <button onClick={() => setActive(SECTIONS[idx + 1].key)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer transition hover:brightness-110" style={{ backgroundColor: "#4f46e5" }}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {!isEdit && active === "preview" && !canActivate && (
            <p className="text-[11px] text-center mt-3" style={{ color: "#dc2626" }}>
              Add a customer, property, and at least one auto-generated visit before activating.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
