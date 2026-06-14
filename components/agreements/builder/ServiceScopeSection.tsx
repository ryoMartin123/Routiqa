"use client";

import { useMemo, useState } from "react";
import UiSelect from "@/components/ui/Select";
import NumberStepper from "@/components/ui/NumberStepper";
import { getTemplates as getWorkOrderTemplates } from "@/lib/work-order-templates/data";
import { getAllItems } from "@/lib/items/data";
import {
  SERVICE_SCOPE_LABELS, SERVICE_APPLIES_LABELS,
  type ServiceScopeType, type ServiceApplies,
} from "@/lib/agreements/settings";
import type { UseAgreementDraft } from "./useAgreementDraft";
import { SectionHead, SummaryCard, Empty, Field, Mini, TextInput } from "./ui";

const SCOPE_OPTIONS = (Object.keys(SERVICE_SCOPE_LABELS) as ServiceScopeType[]).map(k => ({ value: k, label: SERVICE_SCOPE_LABELS[k] }));
const APPLIES_OPTIONS = (Object.keys(SERVICE_APPLIES_LABELS) as ServiceApplies[]).map(k => ({ value: k, label: SERVICE_APPLIES_LABELS[k] }));
const SCOPE_TONE: Record<ServiceScopeType, "accent" | "warn" | "muted" | "default"> = {
  included: "accent", covered_item: "accent", discounted: "warn", optional_addon: "warn", allowance: "default", excluded: "muted",
};

export default function ServiceScopeSection({ d }: { d: UseAgreementDraft }) {
  const [open, setOpen] = useState<string | null>(null);
  const woOptions = useMemo(() => [{ value: "", label: "None" }, ...getWorkOrderTemplates().filter(t => t.active).map(t => ({ value: t.id, label: t.name }))], []);
  const itemOptions = useMemo(() => [{ value: "", label: "None" }, ...getAllItems().map(i => ({ value: i.id, label: i.name }))], []);
  const availableLib = d.serviceLib.filter(lib => !d.services.some(s => s.name === lib.name));

  return (
    <div>
      <SectionHead title="Service Scope" subtitle="What we do — included services, add-ons, covered items, allowances, and exclusions."
        action={
          <div className="w-56">
            <UiSelect size="sm" value="" placeholder="+ Add from library…" onChange={(id) => { d.addServiceFromLib(id); }}
              options={availableLib.map(s => ({ value: s.id, label: s.name }))} />
          </div>
        } />

      <button onClick={() => { d.addBlankService(); }} className="text-xs font-medium mb-3" style={{ color: "#4f46e5" }}>+ Add a custom service</button>

      {d.services.length === 0 ? (
        <Empty>No services yet. Load one from your library or add a custom service.</Empty>
      ) : (
        <div className="space-y-2.5">
          {d.services.map(s => (
            <SummaryCard key={s.id} title={s.name || "New service"}
              meta={`${SERVICE_APPLIES_LABELS[s.applies]}${s.quantity && s.quantity !== "1" ? ` · qty ${s.quantity}` : ""}${s.limit ? ` · limit ${s.limit}` : ""}`}
              badges={[{ label: SERVICE_SCOPE_LABELS[s.scopeType], tone: SCOPE_TONE[s.scopeType] }]}
              expanded={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} onRemove={() => { d.removeService(s.id); if (open === s.id) setOpen(null); }}>
              <div className="space-y-3">
                <Field label="Service Name"><TextInput value={s.name} onChange={e => d.setService(s.id, { name: e.target.value })} placeholder="e.g. Spring Tune-up" /></Field>
                <Field label="Description" hint="optional"><TextInput value={s.description} onChange={e => d.setService(s.id, { description: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Mini label="Service Type"><UiSelect size="sm" value={s.scopeType} onChange={k => d.setService(s.id, { scopeType: k as ServiceScopeType })} options={SCOPE_OPTIONS} /></Mini>
                  <Mini label="Applies"><UiSelect size="sm" value={s.applies} onChange={k => d.setService(s.id, { applies: k as ServiceApplies })} options={APPLIES_OPTIONS} /></Mini>
                  <Mini label="Quantity"><NumberStepper size="sm" min={0} value={s.quantity} onChange={v => d.setService(s.id, { quantity: v })} /></Mini>
                  <Mini label="Limit (optional)"><NumberStepper size="sm" min={0} value={s.limit} onChange={v => d.setService(s.id, { limit: v })} placeholder="No limit" /></Mini>
                  <Mini label="Linked Item (optional)"><UiSelect size="sm" value={s.itemId} onChange={k => d.setService(s.id, { itemId: k })} options={itemOptions} /></Mini>
                  <Mini label="Linked Work Order (optional)"><UiSelect size="sm" value={s.workOrderTemplateId} onChange={k => d.setService(s.id, { workOrderTemplateId: k })} options={woOptions} /></Mini>
                </div>
              </div>
            </SummaryCard>
          ))}
        </div>
      )}
    </div>
  );
}
