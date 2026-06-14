"use client";

// Documents: the official agreement records. Live document preview + a list of
// the official records (template used, terms, signed/PDF placeholders, approval).
// General media lives in Photos & Files, not here.

import { useState } from "react";
import { FileText, FileCheck2, ScrollText, Download, History, BadgeCheck } from "lucide-react";
import { type CustomerAgreement } from "@/lib/agreements/data";
import { getPlanTemplate } from "@/lib/agreements/templates";
import AgreementDocumentPreview from "@/components/agreements/AgreementDocumentPreview";
import { Card, SectionLabel, docDataFromAgreement } from "./shared";

export default function DocumentsTab({ agreement }: { agreement: CustomerAgreement }) {
  const [soon, setSoon] = useState<string | null>(null);
  const doc = docDataFromAgreement(agreement);
  const templateName = getPlanTemplate(agreement.templateId)?.name ?? agreement.templateKey ?? "—";
  const approval = agreement.status === "canceled" ? "Canceled" : "Active / Approved";

  const records: { icon: typeof FileText; label: string; meta: string; action?: () => void }[] = [
    { icon: FileText,   label: "Agreement Document", meta: "Live preview →" },
    { icon: ScrollText, label: "Terms & Conditions", meta: `${(agreement.terms ?? []).length} clause(s)` },
    { icon: FileCheck2, label: "Signed Agreement", meta: "Not signed yet" },
    { icon: Download,   label: "Generated PDF", meta: "Download", action: () => setSoon("PDF export isn't available yet.") },
    { icon: History,    label: "Version History", meta: "1 version" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Live preview */}
      <Card className="lg:col-span-2 p-5 overflow-y-auto thin-scroll-y" style={{ maxHeight: "70vh" }}>
        <AgreementDocumentPreview data={doc} />
      </Card>

      {/* Records */}
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><BadgeCheck className="w-3.5 h-3.5" style={{ color: "#10b981" }} /><SectionLabel>Approval Status</SectionLabel></div>
          <p className="text-sm font-medium mt-1" style={{ color: "var(--text-primary)" }}>{approval}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Template: {templateName}</p>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
            <SectionLabel>Official Records</SectionLabel>
          </div>
          {records.map(({ icon: Icon, label, meta, action }, i) => (
            <button key={label} onClick={action} disabled={!action}
              className={`w-full flex items-center justify-between px-4 py-3 text-left ${action ? "cursor-pointer hover:bg-[var(--bg-surface-2)]" : "cursor-default"} transition-colors`}
              style={{ borderBottom: i < records.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{label}</span>
              </span>
              <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>{meta}</span>
            </button>
          ))}
        </Card>
        {soon && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{soon}</p>}
      </div>
    </div>
  );
}
