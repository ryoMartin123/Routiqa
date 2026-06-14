"use client";

import AgreementDocumentPreview from "@/components/agreements/AgreementDocumentPreview";
import type { UseAgreementDraft } from "./useAgreementDraft";
import { SectionHead, cardStyle } from "./ui";

export default function PreviewSection({ d }: { d: UseAgreementDraft }) {
  const stats = [
    { label: "Services", value: d.services.filter(s => s.name.trim()).length },
    { label: "Visit types", value: d.visits.filter(v => v.name.trim()).length },
    { label: "Generated visits / yr", value: d.generatedVisits.length },
    { label: "Benefits", value: d.benefits.length },
    { label: "Annual value", value: `$${d.annualValue.toLocaleString()}` },
  ];

  return (
    <div>
      <SectionHead title="Preview" subtitle="The customer-facing agreement document, generated from your sections." />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl px-3 py-2.5" style={cardStyle}>
            <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      <AgreementDocumentPreview data={d.docData} />
    </div>
  );
}
