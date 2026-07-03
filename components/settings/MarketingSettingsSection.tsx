"use client";

import { useState } from "react";
import { Megaphone, Send, Users, FileText, Plus, Pencil, Trash2, Mail } from "lucide-react";
import UiSelect from "@/components/ui/Select";
import { Toggle, SettingsCard, SectionHeader, FieldLabel, SaveButtons, ToggleRow, inputCls, inputStyle } from "@/components/settings/ui";
import {
  AUDIENCES, CAMPAIGN_TYPE_CONFIG,
  getTemplates, createTemplate, updateTemplate, deleteTemplate,
  type CampaignType, type MarketingTemplate,
} from "@/lib/marketing/data";
import {
  getMarketingSettings, saveMarketingSettings, defaultMarketingSettings, type MarketingSettings,
} from "@/lib/marketing/settings";

type Tab = "sender" | "types" | "audiences" | "templates";
const TABS: { key: Tab; label: string; icon: typeof Send }[] = [
  { key: "sender",    label: "Sender & Branding", icon: Send },
  { key: "types",     label: "Campaign Types",    icon: Megaphone },
  { key: "audiences", label: "Audiences",         icon: Users },
  { key: "templates", label: "Templates",         icon: FileText },
];
const TYPE_KEYS = Object.keys(CAMPAIGN_TYPE_CONFIG) as CampaignType[];

export default function MarketingSettingsSection() {
  const [tab, setTab] = useState<Tab>("sender");
  const [settings, setSettings] = useState<MarketingSettings>(() => getMarketingSettings());
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(mut: (s: MarketingSettings) => void) {
    setSettings(prev => { const next = structuredClone(prev); mut(next); return next; });
    setDirty(true); setSaved(false);
  }
  function save() { saveMarketingSettings(settings); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  function reset() { const d = defaultMarketingSettings(); setSettings(d); saveMarketingSettings(d); setDirty(false); setSaved(false); }

  const disabledTypes = new Set(settings.disabledTypes);
  const disabledAudiences = new Set(settings.disabledAudiences);

  // Templates are saved immediately (separate store); bump to re-read.
  const [tplVer, setTplVer] = useState(0);
  const templates = getTemplates(); void tplVer;
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <SectionHeader title="Marketing" subtitle="Customize campaign types, audience segments, templates, and sender branding."
        right={tab !== "templates" ? <SaveButtons onSave={save} onReset={reset} dirty={dirty} saved={saved} /> : undefined} />

      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: active ? "#4f46e5" : "var(--bg-surface)", color: active ? "#fff" : "var(--text-secondary)", border: `1px solid ${active ? "#4f46e5" : "var(--border)"}` }}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Sender & Branding ── */}
      {tab === "sender" && (
        <SettingsCard icon={Send} title="Sender & Branding" subtitle="Defaults applied to outgoing email and SMS campaigns.">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>From Name</FieldLabel>
              <input className={inputCls} style={inputStyle} value={settings.sender.fromName}
                onChange={e => update(s => { s.sender.fromName = e.target.value; })} />
            </div>
            <div>
              <FieldLabel>From Email</FieldLabel>
              <input className={inputCls} style={inputStyle} value={settings.sender.fromEmail}
                onChange={e => update(s => { s.sender.fromEmail = e.target.value; })} />
            </div>
            <div>
              <FieldLabel>Reply-To</FieldLabel>
              <input className={inputCls} style={inputStyle} value={settings.sender.replyTo}
                onChange={e => update(s => { s.sender.replyTo = e.target.value; })} />
            </div>
            <div>
              <FieldLabel>SMS Sender ID</FieldLabel>
              <input className={inputCls} style={inputStyle} value={settings.sender.smsSender}
                onChange={e => update(s => { s.sender.smsSender = e.target.value; })} />
            </div>
            <div className="col-span-2">
              <FieldLabel>Email Footer</FieldLabel>
              <textarea rows={2} className={inputCls + " resize-none"} style={inputStyle} value={settings.sender.emailFooter}
                onChange={e => update(s => { s.sender.emailFooter = e.target.value; })} />
            </div>
          </div>
          <div className="mt-3">
            <ToggleRow label="Include unsubscribe link" description="Append a one-click unsubscribe footer to marketing emails (recommended)."
              on={settings.sender.includeUnsubscribe} onChange={v => update(s => { s.sender.includeUnsubscribe = v; })} />
          </div>
        </SettingsCard>
      )}

      {/* ── Campaign Types ── */}
      {tab === "types" && (
        <SettingsCard icon={Megaphone} title="Campaign Types" subtitle="Which campaign types appear in the New Campaign builder.">
          <div className="space-y-1">
            {TYPE_KEYS.map(t => {
              const cfg = CAMPAIGN_TYPE_CONFIG[t];
              return (
                <ToggleRow key={t} label={cfg.label} description={`Channel: ${cfg.channel}`}
                  on={!disabledTypes.has(t)}
                  onChange={v => update(s => {
                    s.disabledTypes = v ? s.disabledTypes.filter(x => x !== t) : [...s.disabledTypes, t];
                  })} />
              );
            })}
          </div>
        </SettingsCard>
      )}

      {/* ── Audiences ── */}
      {tab === "audiences" && (
        <SettingsCard icon={Users} title="Audience Segments" subtitle="Saved segments available when targeting a campaign. Counts are live.">
          <div className="space-y-1">
            {AUDIENCES.map(a => (
              <ToggleRow key={a.key} label={`${a.name} · ${a.count()}`} description={a.description}
                on={!disabledAudiences.has(a.key)}
                onChange={v => update(s => {
                  s.disabledAudiences = v ? s.disabledAudiences.filter(x => x !== a.key) : [...s.disabledAudiences, a.key];
                })} />
            ))}
          </div>
        </SettingsCard>
      )}

      {/* ── Templates ── */}
      {tab === "templates" && (
        <SettingsCard icon={FileText} title="Templates" subtitle="Reusable email & SMS content with merge tags like {{first_name}}."
          action={
            <button onClick={() => { const t = createTemplate({ name: "New Template", type: "email", subject: "", body: "" }); setTplVer(v => v + 1); setEditing(t.id); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>
              <Plus className="w-3.5 h-3.5" /> New Template
            </button>
          }>
          <div className="space-y-2">
            {templates.map(t => editing === t.id ? (
              <TemplateEditor key={t.id} template={t} onDone={() => { setEditing(null); setTplVer(v => v + 1); }} onChange={() => setTplVer(v => v + 1)} />
            ) : (
              <TemplateRow key={t.id} template={t} onEdit={() => setEditing(t.id)} onDelete={() => { deleteTemplate(t.id); setTplVer(v => v + 1); }} />
            ))}
            {templates.length === 0 && <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>No templates yet.</p>}
          </div>
        </SettingsCard>
      )}
    </div>
  );
}

// ─── Template row + editor ────────────────────────────────
function TemplateRow({ template: t, onEdit, onDelete }: { template: MarketingTemplate; onEdit: () => void; onDelete: () => void }) {
  const cfg = CAMPAIGN_TYPE_CONFIG[t.type];
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-input)" }}>
        {t.channel === "sms" ? <Mail className="w-3.5 h-3.5" style={{ color: cfg.color }} /> : <Mail className="w-3.5 h-3.5" style={{ color: cfg.color }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.name}</p>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{t.channel}</span>
        </div>
        <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{t.subject || t.body}</p>
      </div>
      <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{cfg.label}</span>
      <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-[var(--bg-input)]" style={{ color: "var(--text-muted)" }}><Pencil className="w-3.5 h-3.5" /></button>
      <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#9ca3af" }}><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function TemplateEditor({ template: t, onDone, onChange }: { template: MarketingTemplate; onDone: () => void; onChange: () => void }) {
  const [name, setName] = useState(t.name);
  const [type, setType] = useState<CampaignType>(t.type);
  const [subject, setSubject] = useState(t.subject ?? "");
  const [body, setBody] = useState(t.body);
  const channel = CAMPAIGN_TYPE_CONFIG[type].channel;

  function done() {
    updateTemplate(t.id, { name: name.trim() || "Untitled Template", type, subject: channel === "email" ? subject : undefined, body });
    onChange(); onDone();
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ border: "2px solid #c7d2fe", backgroundColor: "var(--bg-surface)" }}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Template Name</FieldLabel>
          <input className={inputCls} style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <FieldLabel>Type</FieldLabel>
          <UiSelect value={type} onChange={v => setType(v as CampaignType)}
            options={(Object.keys(CAMPAIGN_TYPE_CONFIG) as CampaignType[]).map(k => ({ value: k, label: CAMPAIGN_TYPE_CONFIG[k].label }))} />
        </div>
      </div>
      {channel === "email" && (
        <div>
          <FieldLabel>Subject</FieldLabel>
          <input className={inputCls} style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject line" />
        </div>
      )}
      <div>
        <FieldLabel>Body</FieldLabel>
        <textarea rows={5} className={inputCls + " resize-none thin-scroll-y font-mono text-xs"} style={inputStyle} value={body} onChange={e => setBody(e.target.value)}
          placeholder="Use merge tags like {{first_name}}, {{company}}…" />
      </div>
      <div className="flex justify-end">
        <button onClick={done} className="px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: "#4f46e5" }}>Done</button>
      </div>
    </div>
  );
}
