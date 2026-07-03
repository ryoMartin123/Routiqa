"use client";

import { useState } from "react";
import { X, Megaphone, Users } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import {
  getAudience, getTemplatesForType, createCampaign,
  CAMPAIGN_TYPE_CONFIG, type CampaignType,
} from "@/lib/marketing/data";
import { enabledCampaignTypes, enabledAudiences } from "@/lib/marketing/settings";

export interface CampaignBuilderPreset { audienceKey?: string; type?: CampaignType }

export default function CampaignBuilder({ preset, onClose, onCreated }: {
  preset?: CampaignBuilderPreset;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const auds = enabledAudiences();
  const typeOpts = enabledCampaignTypes().map(k => ({ value: k, label: CAMPAIGN_TYPE_CONFIG[k].label }));
  const initAudience = preset?.audienceKey ?? auds[0]?.key ?? "open_estimates";
  const initType = preset?.type ?? getAudience(initAudience)?.defaultType ?? enabledCampaignTypes()[0] ?? "email";

  const [name, setName] = useState("");
  const [type, setType] = useState<CampaignType>(initType);
  const [audienceKey, setAudienceKey] = useState(initAudience);
  const [templateId, setTemplateId] = useState("");
  const [when, setWhen] = useState<"now" | "schedule" | "draft">("now");
  const [scheduledFor, setScheduledFor] = useState("");

  const audience = getAudience(audienceKey);
  const recipients = audience ? audience.count() : 0;
  const templates = getTemplatesForType(type);
  const channelLabel = CAMPAIGN_TYPE_CONFIG[type].channel;
  const canCreate = Boolean(name.trim());

  function create() {
    const c = createCampaign({
      name, type, audienceKey, templateId: templateId || undefined, recipients,
      sendNow: when === "now",
      scheduledFor: when === "schedule" ? (scheduledFor || undefined) : undefined,
    });
    onCreated(c.id);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-surface)", boxShadow: "0 16px 48px rgba(0,0,0,0.24)" }}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4" style={{ color: "#e11d48" }} />
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>New Campaign</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll-y px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Campaign Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Spring Tune-Up Promo"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Type</label>
              <UiSelect value={type} onChange={v => { setType(v as CampaignType); setTemplateId(""); }} options={typeOpts} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Template <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
              <UiSelect value={templateId} onChange={setTemplateId} placeholder="No template"
                options={[{ value: "", label: "No template" }, ...templates.map(t => ({ value: t.id, label: t.name }))]} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Audience</label>
            <UiSelect value={audienceKey} onChange={setAudienceKey} options={auds.map(a => ({ value: a.key, label: a.name }))} />
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--accent-soft-bg)" }}>
              <Users className="w-3.5 h-3.5" style={{ color: "var(--accent-text)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--accent-text)" }}>{recipients} recipient{recipients === 1 ? "" : "s"}</span>
              {audience && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>· {audience.description}</span>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Send</label>
            <div className="flex items-center rounded-lg overflow-hidden w-fit" style={{ border: "1px solid var(--border)" }}>
              {([{ k: "now", l: "Send now" }, { k: "schedule", l: "Schedule" }, { k: "draft", l: "Save as draft" }] as const).map(o => {
                const active = when === o.k;
                return (
                  <button key={o.k} onClick={() => setWhen(o.k)} className="px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{ backgroundColor: active ? "#e11d48" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)" }}>{o.l}</button>
                );
              })}
            </div>
            {when === "schedule" && (
              <div className="mt-2 w-48"><DatePicker value={scheduledFor} onChange={setScheduledFor} placeholder="Pick a send date" /></div>
            )}
          </div>

          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            No messages are actually sent — this {channelLabel === "task" ? "creates reminders" : `${channelLabel} send is mocked`} and records the campaign for tracking.
          </p>
        </div>

        <div className="px-6 py-4 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={create} disabled={!canCreate}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: "#e11d48" }}>
            {when === "now" ? "Launch Campaign" : when === "schedule" ? "Schedule Campaign" : "Save Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
