"use client";

import { useEffect, useState } from "react";
import {
  Plus, Megaphone, Mail, MessageSquare, Star, FilePen, RefreshCw, Phone, Users,
  FileText, CheckCircle2, TrendingDown, Flame, Building2, Home, Send,
} from "lucide-react";
import {
  getCampaigns, getTemplates, getAudience, AUDIENCES,
  CAMPAIGN_TYPE_CONFIG, CAMPAIGN_STATUS_CONFIG,
  type Campaign, type MarketingTemplate, type CampaignType,
} from "@/lib/marketing/data";
import { enabledAudiences } from "@/lib/marketing/settings";
import CampaignBuilder, { type CampaignBuilderPreset } from "@/components/marketing/CampaignBuilder";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";
import StatusTabs from "@/components/shared/StatusTabs";
import type { LucideIcon } from "lucide-react";
import Commentable from "@/components/comments/Commentable";

const TYPE_ICON: Record<CampaignType, LucideIcon> = {
  email: Mail, sms: MessageSquare, review_request: Star, estimate_followup: FilePen,
  maintenance_renewal: RefreshCw, seasonal: Megaphone, call_reminder: Phone,
};
const AUDIENCE_ICON: Record<string, LucideIcon> = {
  open_estimates: FilePen, approved_unscheduled: CheckCircle2, lost_leads: TrendingDown,
  hot_leads: Flame, no_agreement: FileText, agreement_renewals: RefreshCw,
  recent_completed: Star, commercial: Building2, residential: Home,
};

export default function MarketingPage() {
  const [tab, setTab] = useState<"overview" | "campaigns" | "audiences" | "templates">("overview");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [auds, setAuds] = useState(AUDIENCES);
  const [builder, setBuilder] = useState<CampaignBuilderPreset | null>(null);

  function reload() {
    setCampaigns(getCampaigns());
    setTemplates(getTemplates());
    setAuds(enabledAudiences());
    setCounts(Object.fromEntries(AUDIENCES.map(a => [a.key, a.count()])));
  }
  useEffect(reload, []);

  const active = campaigns.filter(c => c.status === "active" || c.status === "scheduled");
  const totalReached = campaigns.reduce((s, c) => s + (c.stats?.delivered ?? 0), 0);
  const openable = campaigns.filter(c => c.stats && c.stats.delivered > 0);
  const avgOpen = openable.length
    ? Math.round(openable.reduce((s, c) => s + (c.stats!.opened / c.stats!.delivered), 0) / openable.length * 100)
    : 0;

  const cards: SummaryCard[] = [
    { icon: Megaphone, label: "Active Campaigns", value: String(active.length), sub: `${campaigns.length} total`, iconColor: "#4f46e5" },
    { icon: Send,      label: "Total Reached",    value: String(totalReached),   sub: "Across all sends", iconColor: "#10b981" },
    { icon: Mail,      label: "Avg Open Rate",    value: `${avgOpen}%`,          sub: `${openable.length} measured`, iconColor: "#f59e0b" },
    { icon: FileText,  label: "Templates",        value: String(templates.length), sub: "Reusable content", iconColor: "#0891b2" },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Marketing</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Campaigns, templates, and audiences built from your CRM data</p>
        </div>
        <button onClick={() => setBuilder({})}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      <StatusTabs active={tab} onChange={k => setTab(k as typeof tab)}
        tabs={[
          { key: "overview",  label: "Overview" },
          { key: "campaigns", label: "Campaigns", count: campaigns.length },
          { key: "audiences", label: "Audiences", count: auds.length },
          { key: "templates", label: "Templates", count: templates.length },
        ]} />

      {/* ── Overview ── */}
      {tab === "overview" && (
        <ModuleSummaryCards moduleKey="marketing" cards={cards} />
      )}

      {/* ── Campaigns ── */}
      {tab === "campaigns" && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
          <div className="grid px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ gridTemplateColumns: "2.4fr 1.4fr 1.4fr 0.8fr 1.6fr 0.8fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
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
              <div className="grid px-5 py-3 items-center" style={{ gridTemplateColumns: "2.4fr 1.4fr 1.4fr 0.8fr 1.6fr 0.8fr", borderBottom: i < campaigns.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
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
                        <div className="h-1.5 rounded-full" style={{ width: `${openPct}%`, backgroundColor: "#4f46e5" }} />
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
      {tab === "audiences" && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {auds.map(a => {
            const AI = AUDIENCE_ICON[a.key] ?? Users; const n = counts[a.key] ?? 0;
            return (
              <div key={a.key} className="rounded-xl p-4 flex flex-col" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-input)" }}>
                    <AI className="w-4 h-4" style={{ color: "#4f46e5" }} />
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
      {tab === "templates" && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {templates.map(t => {
            const tc = CAMPAIGN_TYPE_CONFIG[t.type]; const TI = TYPE_ICON[t.type];
            return (
              <div key={t.id} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
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
        <CampaignBuilder preset={builder} onClose={() => setBuilder(null)} onCreated={() => { setBuilder(null); setTab("campaigns"); reload(); }} />
      )}
    </div>
  );
}
