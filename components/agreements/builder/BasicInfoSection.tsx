"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import NumberStepper from "@/components/ui/NumberStepper";
import AccountSearchSelect from "@/components/customers/AccountSearchSelect";
import { getPlanTemplates, ALL_SECTIONS } from "@/lib/agreements/templates";
import type { UseAgreementDraft } from "./useAgreementDraft";
import { Field, TextInput, SectionHead, cardStyle } from "./ui";

export default function BasicInfoSection({ d, lockCustomer }: { d: UseAgreementDraft; lockCustomer?: boolean }) {
  const planTemplates = useMemo(() => getPlanTemplates().filter(t => t.active), []);
  const [coverageInput, setCoverageInput] = useState("");

  return (
    <div>
      <SectionHead title="Basic Info" subtitle="Who the agreement is for, the coverage period, and a starting template." />

      {/* Template picker */}
      <Field label="Start from a template">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
          {planTemplates.map(t => {
            const active = d.templateId === t.id;
            const blank = t.visits.length === 0;
            return (
              <button key={t.id} onClick={() => d.chooseTemplate(t.id)} className="text-left rounded-xl p-3 transition-all"
                style={{ border: `2px solid ${active ? "#4f46e5" : "var(--border)"}`, backgroundColor: active ? "var(--accent-soft-bg)" : "var(--bg-surface-2)" }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold truncate" style={{ color: active ? "var(--accent-text-strong)" : "var(--text-primary)" }}>{t.name}</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{blank ? "Blank" : t.industry}</span>
                </div>
                <p className="text-[11px] line-clamp-2" style={{ color: "var(--text-secondary)" }}>{t.description}</p>
                <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>{t.services.length} services · {t.visits.length} visit type(s)</p>
              </button>
            );
          })}
        </div>
      </Field>

      <div className="mt-5 space-y-4">
        <Field label="Agreement Title">
          <TextInput value={d.title} onChange={e => d.setTitle(e.target.value)} placeholder="e.g. HVAC Residential Maintenance" />
        </Field>

        <Field label="Customer / Account *">
          <AccountSearchSelect customers={d.customers} value={d.customerId} onChange={v => { d.setCustomerId(v); d.setPropertyId(""); }} disabled={lockCustomer} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Service Location / Property *">
            <UiSelect value={d.propertyId} onChange={d.setPropertyId} placeholder="Select a property"
              options={d.properties.map(p => ({ value: p.id, label: `${p.label ? p.label + " — " : ""}${p.address}, ${p.city}` }))} />
          </Field>
          <Field label="Contact Person" hint="optional">
            <TextInput value={d.contactName} onChange={e => d.setContactName(e.target.value)} placeholder="e.g. property manager" />
          </Field>
        </div>

        <Field label="Covered Equipment / Systems" hint="optional">
          <TextInput value={coverageInput} onChange={e => setCoverageInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); d.addCoverage(coverageInput); setCoverageInput(""); } }}
            placeholder="e.g. Carrier 3-ton AC — press Enter" />
          {d.coverage.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {d.coverage.map((c, i) => (
                <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-secondary)" }}>
                  {c}<button onClick={() => d.removeCoverage(i)}><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Start Date *"><DatePicker value={d.startDate} onChange={d.setStartDate} clearable={false} /></Field>
          <Field label="Term (months)"><NumberStepper value={d.termMonths} onChange={d.setTermMonths} min={1} disabled={Boolean(d.endDate)} /></Field>
          <Field label="End Date" hint="optional"><DatePicker value={d.endDate} onChange={d.setEndDate} placeholder="By term" /></Field>
        </div>

        <Field label="Document Sections" hint="what the customer sees on the agreement">
          <div className="flex flex-wrap gap-1.5">
            {ALL_SECTIONS.map(s => {
              const on = d.sections.includes(s.key);
              return (
                <button key={s.key} onClick={() => d.toggleSection(s.key)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                  style={{ border: `1px solid ${on ? "var(--accent-soft-border)" : "var(--border)"}`, backgroundColor: on ? "var(--accent-soft-bg)" : "var(--bg-surface)", color: on ? "var(--accent-text-strong)" : "var(--text-muted)" }}>
                  {s.label}
                </button>
              );
            })}
          </div>
        </Field>

        {!d.customerId && (
          <p className="text-xs rounded-lg px-3 py-2" style={{ ...cardStyle, color: "var(--text-muted)" }}>
            Pick a customer and property to enable activation.
          </p>
        )}
      </div>
    </div>
  );
}
