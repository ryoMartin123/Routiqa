"use client";

// ─── Marketing app workspace ──────────────────────────────
// The Marketing app is section-driven by the platform sidebar (Dashboard /
// Campaigns / Audiences / Templates / Automations / Lead Sources / Performance /
// Settings) rather than in-page tabs. Each nav item routes to a real URL and
// renders the matching section here. The "New Campaign" builder is shared across
// the action sections. Automations / Lead Sources / Performance are scaffolded
// with clean empty states — wired for real CRM-powered data in a later pass.

import { useEffect, useState } from "react";
import {
  Plus, Megaphone, Mail, MessageSquare, Star, FilePen, RefreshCw, Phone, Users,
  FileText, CheckCircle2, TrendingDown, Flame, Building2, Home, Send, Zap, ArrowRight, Sparkles, Pencil, Workflow,
} from "lucide-react";
import {
  getCampaigns, getTemplates, getAudience, AUDIENCES,
  CAMPAIGN_TYPE_CONFIG, CAMPAIGN_STATUS_CONFIG,
  type Campaign, type MarketingTemplate, type CampaignType,
} from "@/lib/marketing/data";
import { enabledAudiences } from "@/lib/marketing/settings";
import {
  getAutomations, STATUS_CONFIG as AUTO_STATUS, type MarketingAutomation,
} from "@/lib/marketing/automations";
import CampaignBuilder, { type CampaignBuilderPreset } from "@/components/marketing/CampaignBuilder";
import CampaignDetail from "@/components/marketing/CampaignDetail";
import DesignStudio from "@/components/design-studio/DesignStudio";
import TextTemplateModal from "@/components/marketing/TextTemplateModal";
import AudienceBuilder from "@/components/marketing/AudienceBuilder";
import {
  createTemplate, updateTemplate, getSavedAudiences, customAudienceLabel, resolveRecipients,
  type SavedAudience,
} from "@/lib/marketing/data";
import { starterEmailDesign, designFromText, plainTextFromDesign } from "@/lib/design-studio/model";
import MarketingSettingsSection from "@/components/settings/MarketingSettingsSection";
import MarketingEmptyState from "@/components/marketing/MarketingEmptyState";
import AutomationsSection from "@/components/marketing/automations/AutomationsSection";
import LeadSourcesSection from "@/components/marketing/LeadSourcesSection";
import IntegrationsSection from "@/components/marketing/IntegrationsSection";
import { PageHeader, StatCard } from "@/components/platform/ui";
import PageTitle from "@/components/shared/PageTitle";
import type { LucideIcon } from "lucide-react";
import Commentable from "@/components/comments/Commentable";

export type MarketingSection =
  | "overview" | "campaigns" | "audiences" | "templates"
  | "automations" | "lead_sources" | "integrations" | "performance" | "settings";

const SECTION_META: Record<MarketingSection, { title: string; description: string }> = {
  overview:     { title: "Marketing",         description: "Campaigns, templates, and audiences built from your CRM data" },
  campaigns:    { title: "Campaigns",         description: "Every campaign across email, SMS, and follow-up reminders" },
  audiences:    { title: "Audiences",         description: "Targeted segments built live from your CRM data" },
  templates:    { title: "Templates",         description: "Reusable email and SMS content for your campaigns" },
  automations:  { title: "Automations",       description: "Rule-based marketing that runs automatically on your CRM data" },
  lead_sources: { title: "Lead Sources",      description: "Track where leads come from and which sources drive revenue" },
  integrations: { title: "Integrations",      description: "Connect ads, delivery, and lead-capture tools to your marketing" },
  performance:  { title: "Performance",       description: "Marketing results across campaigns, sources, and revenue" },
  settings:     { title: "Marketing Settings", description: "Campaign types, audiences, templates, and sender branding" },
};

// The metrics the Performance section will fill in once real attribution lands.
// Rendered as a layout-ready grid with em-dash placeholders (not fake numbers).
const PERFORMANCE_METRICS: string[] = [
  "Leads generated", "Active campaigns", "Messages sent", "Replies", "Booked jobs",
  "Estimates created", "Revenue attributed", "Cost per lead", "Conversion rate", "ROI",
];

const TYPE_ICON: Record<CampaignType, LucideIcon> = {
  email: Mail, sms: MessageSquare, review_request: Star, estimate_followup: FilePen,
  maintenance_renewal: RefreshCw, seasonal: Megaphone, call_reminder: Phone, sequence: Workflow,
};
const AUDIENCE_ICON: Record<string, LucideIcon> = {
  open_estimates: FilePen, approved_unscheduled: CheckCircle2, lost_leads: TrendingDown,
  hot_leads: Flame, no_agreement: FileText, agreement_renewals: RefreshCw,
  recent_completed: Star, commercial: Building2, residential: Home,
};

export default function MarketingWorkspace({ section }: { section: MarketingSection }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [auds, setAuds] = useState(AUDIENCES);
  const [autos, setAutos] = useState<MarketingAutomation[]>([]);
  const [builder, setBuilder] = useState<CampaignBuilderPreset | null>(null);
  // Design Studio — open on an existing email template or a brand-new one.
  const [studio, setStudio] = useState<{ template: MarketingTemplate | null } | null>(null);
  // SMS / call-script text editor + the "New Template" chooser menu.
  const [textModal, setTextModal] = useState<{ kind: "sms" | "call"; template: MarketingTemplate | null } | null>(null);
  const [newMenu, setNewMenu] = useState(false);
  // Campaign detail drawer — opened from the table and right after launch.
  const [detailId, setDetailId] = useState<string | null>(null);
  // Saved-audience editor (Audiences section).
  const [audienceModal, setAudienceModal] = useState<{ audience: SavedAudience | null } | null>(null);
  // Lead Sources scaffold has no builder yet — its CTA surfaces a quiet "on the
  // way" note rather than a dead button.

  function reload() {
    setCampaigns(getCampaigns());
    setTemplates(getTemplates());
    setAuds(enabledAudiences());
    setAutos(getAutomations());
    setCounts(Object.fromEntries(AUDIENCES.map(a => [a.key, a.count()])));
  }
  useEffect(reload, []);

  // Settings is a self-contained section component with its own chrome.
  if (section === "settings") {
    return (
      <div className="p-6 space-y-5">
        <PageTitle title={SECTION_META.settings.title} description={SECTION_META.settings.description} />
        <MarketingSettingsSection />
      </div>
    );
  }

  // Automations is a full sub-app (list + step builder), not a placeholder.
  if (section === "automations") return <AutomationsSection />;

  // Lead Sources — performance tracking by source.
  if (section === "lead_sources") return <LeadSourcesSection />;

  // Integrations — the connection command center.
  if (section === "integrations") return <IntegrationsSection />;

  // ── Performance scaffold (clean empty state, no fake data) ──
  if (section === "performance") {
    const meta = SECTION_META[section];
    return (
      <div className="p-6 space-y-5">
        <PageTitle title={meta.title} description={meta.description} />
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
          {PERFORMANCE_METRICS.map(label => (
            <div key={label} className="rounded-xl px-4 py-3.5"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <p className="text-[11px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: "var(--text-secondary)" }}>—</p>
            </div>
          ))}
        </div>
        <MarketingEmptyState
          icon={TrendingDown}
          title="No performance data yet"
          description="Metrics fill in here as campaigns run — leads generated, replies, booked jobs, and revenue attributed back to your marketing."
          ctaLabel="Create a campaign"
          onCta={() => setBuilder({})}
        />
        {builder && (
          <CampaignBuilder preset={builder} onClose={() => setBuilder(null)} onCreated={() => setBuilder(null)} />
        )}
      </div>
    );
  }

  const active = campaigns.filter(c => c.status === "active" || c.status === "scheduled");
  const totalReached = campaigns.reduce((s, c) => s + (c.stats?.delivered ?? 0), 0);
  const openable = campaigns.filter(c => c.stats && c.stats.delivered > 0);
  const avgOpen = openable.length
    ? Math.round(openable.reduce((s, c) => s + (c.stats!.opened / c.stats!.delivered), 0) / openable.length * 100)
    : 0;

  // ── Dashboard (Overview) — platform-style: header + StatCards + data panels ──
  if (section === "overview") {
    const activeAutos = autos.filter(a => a.status === "active");
    const topAudiences = [...auds].map(a => ({ key: a.key, name: a.name, n: counts[a.key] ?? 0 })).sort((x, y) => y.n - x.n).slice(0, 5);
    return (
      <div className="p-6 space-y-5">
        <PageHeader title="Marketing Dashboard" subtitle="Campaigns, audiences, automations, and performance from your CRM." accent="#e11d48" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Campaigns"   value={String(active.length)}      hint={`${campaigns.length} total`}     icon={Megaphone} accent="#e11d48" />
          <StatCard label="Active Automations" value={String(activeAutos.length)} hint={`${autos.length} total`}         icon={Zap}       accent="#7c3aed" />
          <StatCard label="Contacts Reached"   value={String(totalReached)}       hint="Across all sends"                icon={Send}      accent="#10b981" />
          <StatCard label="Avg Open Rate"      value={`${avgOpen}%`}              hint={`${openable.length} measured`}   icon={Mail}      accent="#f59e0b" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DashPanel title="Active Campaigns" icon={Megaphone} accent="#e11d48" empty="No active campaigns yet."
            rows={active.slice(0, 5).map(c => ({ key: c.id, left: c.name, right: CAMPAIGN_STATUS_CONFIG[c.status].label }))} />
          <DashPanel title="Automations" icon={Zap} accent="#7c3aed" empty="No automations yet."
            rows={autos.slice(0, 5).map(a => ({ key: a.id, left: a.name, right: AUTO_STATUS[a.status].label }))} />
          <DashPanel title="Top Audiences" icon={Users} accent="#059669" empty="No audiences available."
            rows={topAudiences.map(a => ({ key: a.key, left: a.name, right: String(a.n) }))} />
          <DashPanel title="Recent Templates" icon={FileText} accent="#0891b2" empty="No templates yet."
            rows={templates.slice(0, 5).map(t => ({ key: t.id, left: t.name, right: t.channel.toUpperCase() }))} />
        </div>

        {builder && (
          <CampaignBuilder preset={builder} onClose={() => setBuilder(null)} onCreated={() => { setBuilder(null); reload(); }} />
        )}
      </div>
    );
  }

  const meta = SECTION_META[section];
  // The global "New Campaign" action lives only in the Campaigns section.
  const showNewCampaign = section === "campaigns";

  // Design Studio save — derive the plain-text body so campaigns/SMS previews
  // and the card fallback keep working without a design-aware renderer.
  function saveDesign(out: { name: string; subject?: string; design: Parameters<typeof plainTextFromDesign>[0] }) {
    const body = plainTextFromDesign(out.design);
    if (studio?.template) updateTemplate(studio.template.id, { name: out.name, subject: out.subject, body, design: out.design });
    else createTemplate({ name: out.name, type: "email", subject: out.subject, body, design: out.design });
    setStudio(null);
    reload();
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <PageTitle title={meta.title} description={meta.description} />
        </div>
        {section === "audiences" && (
          <button onClick={() => setAudienceModal({ audience: null })}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Audience
          </button>
        )}
        {section === "templates" && (
          <div className="relative shrink-0">
            <button onClick={() => setNewMenu(o => !o)}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> New Template
            </button>
            {newMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNewMenu(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl z-50 p-1.5"
                  style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  {([
                    { label: "Email", desc: "Design Studio", icon: Mail, onClick: () => setStudio({ template: null }) },
                    { label: "SMS", desc: "Short text + merge fields", icon: MessageSquare, onClick: () => setTextModal({ kind: "sms", template: null }) },
                    { label: "Call script", desc: "What the caller says", icon: Phone, onClick: () => setTextModal({ kind: "call", template: null }) },
                  ] as const).map(item => (
                    <button key={item.label} onClick={() => { setNewMenu(false); item.onClick(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors hover:bg-[var(--bg-surface-2)]">
                      <item.icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#e11d48" }} />
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.label}</span>
                      <span className="ml-auto text-[10px]" style={{ color: "var(--text-muted)" }}>{item.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {showNewCampaign && (
          <button onClick={() => setBuilder({})}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        )}
      </div>

      {/* ── Campaigns — one-time sends and sequences live apart: a blast is
             launched and done, a sequence stays alive across days ── */}
      {section === "campaigns" && (() => {
        const oneTime = campaigns.filter(c => c.type !== "sequence");
        const sequences = campaigns.filter(c => c.type === "sequence");

        const renderRow = (c: Campaign, i: number, count: number) => {
          const tc = CAMPAIGN_TYPE_CONFIG[c.type]; const TI = TYPE_ICON[c.type]; const sc = CAMPAIGN_STATUS_CONFIG[c.status];
          const aud = getAudience(c.audienceKey);
          const isSeq = c.type === "sequence";
          const openPct = c.stats && c.stats.delivered > 0 ? Math.round((c.stats.opened / c.stats.delivered) * 100) : null;
          // Sequence progress: which step fires next, and when.
          const steps = c.sequence ?? [];
          const fired = steps.filter(s => s.status === "sent").length;
          const next = steps.find(s => s.status !== "sent");
          return (
            <Commentable key={c.id} inset anchor={{ recordType: "marketing", recordId: c.id, recordLabel: c.name }}>
            <div onClick={() => setDetailId(c.id)}
              className="grid px-5 py-3 items-center cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]"
              style={{ gridTemplateColumns: "2.4fr 1.4fr 1.4fr 0.8fr 1.6fr 0.8fr", borderBottom: i < count - 1 ? "1px solid var(--border)" : "none" }}>
              <div className="min-w-0 pr-2">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{c.sentAt ? `Sent ${c.sentAt}` : `Created ${c.createdAt}`}</p>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                <TI className="w-3.5 h-3.5 shrink-0" style={{ color: tc.color }} />
                <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{tc.label}</span>
              </div>
              <span className="text-xs truncate pr-2" style={{ color: "var(--text-secondary)" }}>{aud?.name ?? c.audienceKey}</span>
              <span className="text-sm font-semibold text-right" style={{ color: "var(--text-primary)" }}>{c.recipients}</span>
              <div className="pr-2 pl-4">
                {isSeq && steps.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-1">
                      {steps.map(s => (
                        <span key={s.id} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: s.status === "sent" ? "#7c3aed" : "var(--bg-input)" }} />
                      ))}
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                      {fired === steps.length ? "All steps fired"
                        : c.status === "active" ? `Step ${fired + 1} of ${steps.length}${next?.dueDate ? ` · next ${next.dueDate}` : " · ready to run"}`
                        : `${steps.length} steps · not launched`}
                    </p>
                  </div>
                ) : openPct != null ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${openPct}%`, backgroundColor: "#e11d48" }} />
                    </div>
                    <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{openPct}% open</span>
                  </div>
                ) : <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>—</span>}
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
              </div>
            </div>
            </Commentable>
          );
        };

        const group = (title: string, icon: React.ElementType, hint: string, list: Campaign[], perfLabel: string) => {
          const GI = icon;
          return (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <GI className="w-4 h-4" style={{ color: "#e11d48" }} />
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{list.length}</span>
                <span className="ml-auto text-[11px]" style={{ color: "var(--text-muted)" }}>{hint}</span>
              </div>
              <div className="grid px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ gridTemplateColumns: "2.4fr 1.4fr 1.4fr 0.8fr 1.6fr 0.8fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                <span>Campaign</span><span>Type</span><span>Audience</span><span className="text-right">Recipients</span><span className="pl-4">{perfLabel}</span><span className="text-right">Status</span>
              </div>
              {list.map((c, i) => renderRow(c, i, list.length))}
            </div>
          );
        };

        return (
          <div className="space-y-4">
            {campaigns.length === 0 && (
              <div className="rounded-xl py-12 text-center" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No campaigns yet. Create one to get started.</p>
              </div>
            )}
            {oneTime.length > 0 && group("One-time sends", Megaphone, "Launched once against a snapshot audience — send, then done.", oneTime, "Performance")}
            {sequences.length > 0 && group("Sequences", Workflow, "Multi-step — everyone moves through the same dated steps after launch.", sequences, "Progress")}
          </div>
        );
      })()}

      {/* ── Audiences ── */}
      {section === "audiences" && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {/* Saved audiences — the user's own segments, editable */}
          {getSavedAudiences().map(a => {
            const n = resolveRecipients(a.id).length;
            return (
              <div key={a.id} className="group rounded-xl p-4 flex flex-col relative" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#e11d4814" }}>
                    <Sparkles className="w-4 h-4" style={{ color: "#e11d48" }} />
                  </div>
                  <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{n}</span>
                </div>
                <p className="text-sm font-semibold mt-2" style={{ color: "var(--text-primary)" }}>{a.name}</p>
                <p className="text-xs mt-0.5 flex-1" style={{ color: "var(--text-muted)" }}>{a.description ?? customAudienceLabel(a.custom)}</p>
                <button onClick={() => setAudienceModal({ audience: a })} title="Edit audience"
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--bg-surface-2)]"
                  style={{ color: "var(--text-muted)" }}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setBuilder({ audienceKey: a.id })} disabled={n === 0}
                  className="mt-3 w-full text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
                  style={{ border: "1px solid var(--accent-soft-border)", color: "var(--accent-text)", backgroundColor: "var(--accent-soft-bg)" }}>
                  Create campaign →
                </button>
              </div>
            );
          })}
          {auds.map(a => {
            const AI = AUDIENCE_ICON[a.key] ?? Users; const n = counts[a.key] ?? 0;
            return (
              <div key={a.key} className="rounded-xl p-4 flex flex-col" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-input)" }}>
                    <AI className="w-4 h-4" style={{ color: "#e11d48" }} />
                  </div>
                  <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{n}</span>
                </div>
                <p className="text-sm font-semibold mt-2" style={{ color: "var(--text-primary)" }}>{a.name}</p>
                <p className="text-xs mt-0.5 flex-1" style={{ color: "var(--text-muted)" }}>{a.description}</p>
                <button onClick={() => setBuilder({ audienceKey: a.key, type: a.defaultType })} disabled={n === 0}
                  className="mt-3 w-full text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
                  style={{ border: "1px solid var(--accent-soft-border)", color: "var(--accent-text)", backgroundColor: "var(--accent-soft-bg)" }}>
                  Create campaign →
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Templates ── */}
      {section === "templates" && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {templates.map(t => {
            const tc = CAMPAIGN_TYPE_CONFIG[t.type]; const TI = TYPE_ICON[t.type];
            const designable = t.channel === "email";
            return (
              // The whole card opens its editor; the arrow slides in on hover (CRM card pattern).
              <button key={t.id}
                onClick={() => designable
                  ? setStudio({ template: t })
                  : setTextModal({ kind: t.channel === "sms" ? "sms" : "call", template: t })}
                className="group text-left rounded-xl p-4 relative transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <TI className="w-3.5 h-3.5 shrink-0" style={{ color: tc.color }} />
                  <p className="text-sm font-semibold truncate flex-1" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                </div>
                {/* Body text only — uniform card height across email / SMS / script. */}
                <p className="text-xs whitespace-pre-wrap line-clamp-4" style={{ color: "var(--text-muted)" }}>{t.body}</p>
                <ArrowRight className="absolute bottom-3.5 right-3.5 w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
                  style={{ color: "#e11d48" }} />
              </button>
            );
          })}
        </div>
      )}

      {builder && (
        <CampaignBuilder preset={builder} onClose={() => setBuilder(null)} onCreated={id => { setBuilder(null); reload(); setDetailId(id); }} />
      )}
      {detailId && (
        <CampaignDetail campaignId={detailId} onClose={() => setDetailId(null)} onChanged={reload}
          onEdit={id => { setDetailId(null); setBuilder({ editId: id }); }} />
      )}
      {textModal && (
        <TextTemplateModal kind={textModal.kind} template={textModal.template}
          onClose={() => setTextModal(null)} onSaved={() => { setTextModal(null); reload(); }} />
      )}
      {audienceModal && (
        <AudienceBuilder audience={audienceModal.audience}
          onClose={() => setAudienceModal(null)}
          onSaved={() => { setAudienceModal(null); reload(); }} />
      )}
      {studio && (
        <DesignStudio mode="email" backLabel="Templates"
          initialName={studio.template?.name ?? ""}
          initialSubject={studio.template?.subject}
          initialDesign={studio.template
            ? (studio.template.design ?? designFromText("email", studio.template.body))
            : starterEmailDesign()}
          onSave={saveDesign} onClose={() => setStudio(null)} />
      )}
    </div>
  );
}

// ── Dashboard panel — a compact titled list with a clean empty state ──
function DashPanel({ title, icon: Icon, accent, rows, empty }: {
  title: string; icon: LucideIcon; accent: string;
  rows: { key: string; left: string; right: string }[]; empty: string;
}) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "22" }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </span>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm py-3" style={{ color: "var(--text-muted)" }}>{empty}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map(r => (
            <li key={r.key} className="flex items-center justify-between gap-3 py-1.5" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{r.left}</span>
              <span className="text-xs font-medium shrink-0" style={{ color: "var(--text-muted)" }}>{r.right}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
