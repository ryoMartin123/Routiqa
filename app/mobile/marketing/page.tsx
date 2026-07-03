"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Megaphone, Send, MailOpen, Users } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Card, Section, EmptyState, ACCENT } from "@/components/mobile/ui";
import { getCampaigns } from "@/lib/marketing/data";
import { getLeadSources, totals } from "@/lib/marketing/lead-sources";

const money = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n}`;
const CRIMSON = "#e11d48";

export default function MobileMarketingPage() {
  const campaigns = useMemo(() => getCampaigns(), []);
  const sources = useMemo(() => getLeadSources().filter(s => s.active), []);
  const t = totals(sources);
  const active = campaigns.filter(c => c.status === "active" || c.status === "scheduled");
  const reached = campaigns.reduce((s, c) => s + (c.stats?.delivered ?? 0), 0);
  const openable = campaigns.filter(c => c.stats && c.stats.delivered > 0);
  const avgOpen = openable.length ? Math.round(openable.reduce((s, c) => s + (c.stats!.opened / c.stats!.delivered), 0) / openable.length * 100) : 0;
  const topSources = [...sources].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const maxRev = Math.max(1, ...topSources.map(s => s.revenue));

  return (
    <div>
      <MobileHeader title="Marketing" subtitle="Campaigns & lead sources" back />
      <div className="px-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Kpi icon={Megaphone} label="Active campaigns" value={String(active.length)} color={CRIMSON} />
          <Kpi icon={Send} label="Reached" value={reached.toLocaleString()} color="#2563eb" />
          <Kpi icon={MailOpen} label="Avg open rate" value={`${avgOpen}%`} color="#f59e0b" />
          <Kpi icon={Users} label="Leads (90d)" value={String(t.leads)} color="#16a34a" />
        </div>

        <Section title="Revenue by source">
          <Card className="p-4">
            <div className="space-y-2.5">
              {topSources.map(s => (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="w-28 text-xs truncate shrink-0" style={{ color: "var(--text-secondary)" }}>{s.name}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-input)" }}><div className="h-full rounded-full" style={{ width: `${(s.revenue / maxRev) * 100}%`, backgroundColor: CRIMSON }} /></div>
                  <span className="w-12 text-right text-xs font-semibold tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>{money(s.revenue)}</span>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        <Section title="Campaigns">
          {campaigns.length === 0 ? <Card className="px-4 py-6"><EmptyState icon={Megaphone} title="No campaigns" /></Card> : (
            <Card>
              {campaigns.slice(0, 8).map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{c.stats?.delivered ? `${c.stats.delivered.toLocaleString()} delivered` : c.type}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0" style={{ backgroundColor: c.status === "active" ? "#16a34a22" : "var(--bg-surface-2)", color: c.status === "active" ? "#16a34a" : "var(--text-muted)" }}>{c.status}</span>
                </div>
              ))}
            </Card>
          )}
        </Section>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" style={{ color }} /><p className="text-[11px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{label}</p></div>
      <p className="text-xl font-bold mt-1 tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
    </Card>
  );
}
