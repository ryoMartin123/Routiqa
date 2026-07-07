"use client";

// Services: the agreement scope — what we do — grouped by service type, with
// each service's "applies to" visit resolved. Tune-ups are Visits (other tab);
// these are the inspection/checklist items performed during them.

import { useMemo } from "react";
import { CheckCircle2, Wrench } from "lucide-react";
import { type CustomerAgreement } from "@/lib/agreements/data";
import { SERVICE_SCOPE_LABELS, SERVICE_APPLIES_LABELS, type ServiceScopeType } from "@/lib/agreements/settings";
import type { TemplateService } from "@/lib/agreements/templates";
import { Card, SectionLabel } from "./shared";

// Display order + accent per scope type.
const GROUP_ORDER: { key: ServiceScopeType; color: string }[] = [
  { key: "included", color: "#10b981" },
  { key: "covered_item", color: "#0891b2" },
  { key: "discounted", color: "#f59e0b" },
  { key: "optional_addon", color: "#f59e0b" },
  { key: "allowance", color: "#239c8d" },
  { key: "excluded", color: "#9ca3af" },
];

export default function ServicesTab({ agreement }: { agreement: CustomerAgreement }) {
  const visitName = useMemo(() => {
    const map = new Map((agreement.visitPlan ?? []).map(v => [v.id, v.name]));
    return (id?: string) => (id ? map.get(id) ?? "Specific visit" : null);
  }, [agreement.visitPlan]);

  const detailed = agreement.servicesDetailed;

  // Seed-style fallback: only legacy string labels exist.
  if (!detailed || detailed.length === 0) {
    const labels = agreement.services ?? [];
    return (
      <Card className="p-5" style={{ maxWidth: 640 }}>
        <SectionLabel>Included Services ({labels.length})</SectionLabel>
        <div className="space-y-2.5 mt-3">
          {labels.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No services on this agreement.</p>
          ) : labels.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#10b981" }} />
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>{s}</span>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const groups = GROUP_ORDER
    .map(g => ({ ...g, items: detailed.filter(s => (s.scopeType ?? "included") === g.key) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="space-y-4">
      {groups.map(g => (
        <Card key={g.key} className="overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
            <Wrench className="w-3.5 h-3.5" style={{ color: g.color }} />
            <SectionLabel>{SERVICE_SCOPE_LABELS[g.key]} ({g.items.length})</SectionLabel>
          </div>
          {g.items.map((s: TemplateService, i) => {
            const vn = visitName(s.visitId);
            return (
              <div key={s.id} className="flex items-start justify-between gap-3 px-4 py-3"
                style={{ borderBottom: i < g.items.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {s.quantity > 1 ? `${s.quantity}× ` : ""}{s.name}
                  </p>
                  {s.description && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{s.description}</p>}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Tag>{SERVICE_APPLIES_LABELS[s.applies ?? "per_visit"]}</Tag>
                    {s.limit != null && <Tag>Limit {s.limit}</Tag>}
                    {s.discountPct ? <Tag>{s.discountPct}% off</Tag> : null}
                    <Tag accent>{vn ? vn : "Whole agreement"}</Tag>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      ))}
    </div>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
      style={accent
        ? { backgroundColor: "var(--accent-soft-bg)", color: "var(--accent-text-strong)" }
        : { backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
      {children}
    </span>
  );
}
