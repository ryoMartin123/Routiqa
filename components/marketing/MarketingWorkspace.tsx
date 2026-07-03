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
  FileText, CheckCircle2, TrendingDown, Flame, Building2, Home, Send, Zap,
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
import MarketingSettingsSection from "@/components/settings/MarketingSettingsSection";
import MarketingEmptyState from "@/components/marketing/MarketingEmptyState";
import AutomationsSection from "@/components/marketing/automations/AutomationsSection";
import LeadSourcesSection from "@/components/marketing/LeadSourcesSection";
import { PageHeader, StatCard } from "@/components/platform/ui";
import PageTitle from "@/components/shared/PageTitle";
import type { LucideIcon } from "lucide-react";
import Commentable from "@/components/comments/Commentable";

export type MarketingSection =
  | "overview" | "campaigns" | "audiences" | "templates"
  | "automations" | "lead_sources" | "performance" | "settings";

const SECTION_META: Record<MarketingSection, { title: string; description: string }> = {
  overview:     { title: "Marketing",         description: "Campaigns, templates, and audiences built from your CRM data" },
  campaigns:    { title: "Campaigns",         description: "Every campaign across email, SMS, and follow-up reminders" },
  audiences:    { title: "Audiences",         description: "Targeted segments built live from your CRM data" },
  templates:    { title: "Templates",         description: "Reusable email and SMS content for your campaigns" },
  automations:  { title: "Automations",       description: "Rule-based marketing that runs automatically on your CRM data" },
  lead_sources: { title: "Lead Sources",      description: "Track where leads come from and which sources drive revenue" },
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
  maintenance_renewal: RefreshCw, seasonal: Megaphone, call_reminder: Phone,
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

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <PageTitle title={meta.title} description={meta.description} />
        </div>
        {showNewCampaign && (
          <button onClick={() => setBuilder({})}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        )}
      </div>

      {/* ── Campaigns ── */}
      {section === "campaigns" && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <div className="grid px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ gridTemplateColumns: "2.4fr 1.4fr 1.4fr 0.8fr 1.6fr 0.8fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
            <span>Campaign</span><span>Type</span><span>Audience</span><span className="text-right">Recipients</span><span>Performance</span><span className="text-right">Status</span>
          </div>
          {campaigns.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>No campaigns yet. Create one to get started.</p>
          ) : campaigns.map((c, i) => {
            const tc = CAMPAIGN_TYPE_CONFIG[c.type]; const TI = TYPE_ICON[c.type]; const sc = CAMPAIGN_STATUS_CONFIG[c.status];
            const aud = getAudience(c.audienceKey);
            const openPct = c.stats && c.stats.delivered > 0 ? Math.round((c.stats.opened / c.stats.delivered) * 100) : null;
            return (
              <Commentable key={c.id} inset anchor={{ recordType: "marketing", recordId: c.id, recordLabel: c.name }}>
              <div className="grid px-5 py-3 items-center" style={{ gridTemplateColumns: "2.4fr 1.4fr 1.4fr 0.8fr 1.6fr 0.8fr", borderBottom: i < campaigns.length - 1 ? "1px solid var(--border)" : "none" }}>
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
                <div className="pr-2">
                  {openPct != null ? (
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
          })}
        </div>
      )}

      {/* ── Audiences ── */}
      {section === "audiences" && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
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
            return (
              <div key={t.id} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <TI className="w-3.5 h-3.5 shrink-0" style={{ color: tc.color }} />
                  <p className="text-sm font-semibold truncate flex-1" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{t.channel}</span>
                </div>
                {t.subject && <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t.subject}</p>}
                <p className="text-xs whitespace-pre-wrap line-clamp-4" style={{ color: "var(--text-muted)" }}>{t.body}</p>
              </div>
            );
          })}
        </div>
      )}

      {builder && (
        <CampaignBuilder preset={builder} onClose={() => setBuilder(null)} onCreated={() => { setBuilder(null); reload(); }} />
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
