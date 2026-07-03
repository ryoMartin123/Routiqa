"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, BarChart3, Copy, Trash2, Pencil, Sparkles, ArrowRight } from "lucide-react";
import PageTitle from "@/components/shared/PageTitle";
import StatusTabs from "@/components/shared/StatusTabs";
import ChartView from "@/components/analytics/ChartView";
import { getReports, deleteReport, duplicateReport } from "@/lib/analytics/store";
import { runReport } from "@/lib/analytics/engine";
import { sourceById, metricById, vizById } from "@/lib/analytics/catalog";
import type { ReportConfig } from "@/lib/analytics/types";

const ACCENT = "#4f46e5";
type Tab = "all" | "mine" | "templates";

export default function AnalyticsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportConfig[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const reload = () => setReports(getReports());
  useEffect(() => { reload(); }, []);

  const mine = useMemo(() => reports.filter(r => !r.template), [reports]);
  const templates = useMemo(() => reports.filter(r => r.template), [reports]);
  const shown = tab === "mine" ? mine : tab === "templates" ? templates : reports;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <PageTitle title="Analytics" description="Build custom widgets and KPIs from your CRM, jobs, and accounting data — then drop them on any dashboard." />
        <Link href="/analytics/builder" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white active:scale-[0.99] transition-transform" style={{ backgroundColor: ACCENT }}>
          <Plus className="w-4 h-4" /> New widget
        </Link>
      </div>

      <div className="mb-5">
        <StatusTabs active={tab} onChange={k => setTab(k as Tab)} tabs={[
          { key: "all", label: "All analytics", count: reports.length },
          { key: "mine", label: "My widgets", count: mine.length },
          { key: "templates", label: "CRM templates", count: templates.length },
        ]} />
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: "var(--bg-surface-2)" }}><BarChart3 className="w-7 h-7" style={{ color: "var(--text-muted)" }} /></div>
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {tab === "templates" ? "No templates" : tab === "mine" ? "No widgets yet" : "No reports yet"}
          </p>
          <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
            {tab === "templates" ? "Starter templates appear here." : "Build a custom KPI or chart from your CRM data."}
          </p>
          {tab !== "templates" && (
            <Link href="/analytics/builder" className="group flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: ACCENT }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center transition-all group-hover:brightness-95" style={{ backgroundColor: ACCENT + "1a" }}><Plus className="w-3.5 h-3.5" /></span>
              Create your first widget
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map(r => <ReportCard key={r.id} cfg={r} onChange={reload} onOpen={() => router.push(`/analytics/builder?id=${r.id}`)} />)}
        </div>
      )}
    </div>
  );
}

function ReportCard({ cfg, onOpen, onChange }: { cfg: ReportConfig; onOpen: () => void; onChange: () => void }) {
  const result = useMemo(() => runReport(cfg), [cfg]);
  const source = sourceById(cfg.source); const metric = metricById(cfg.metric); const viz = vizById(cfg.viz);
  const isTemplate = !!cfg.template;
  return (
    <div className="group rounded-2xl overflow-hidden flex flex-col transition-transform hover:-translate-y-0.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
      <button onClick={onOpen} className="text-left p-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{cfg.name || "Untitled widget"}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-muted)" }}>{viz?.label}</span>
        </div>
        <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{metric?.label} · {source?.label}</p>
      </button>
      <button onClick={onOpen} className="px-4 text-left" style={{ height: 132 }}>
        <ChartView result={result} viz={cfg.viz} metricLabel={metric?.label ?? ""} compact />
      </button>
      <div className="flex items-center justify-between px-3 py-2 mt-2" style={{ borderTop: "1px solid var(--border)" }}>
        {isTemplate ? (
          <>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: ACCENT }}><Sparkles className="w-3 h-3" /> CRM template</span>
            <button onClick={onOpen} className="group inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors hover:bg-[color-mix(in_srgb,var(--accent-text)_22%,transparent)]" style={{ backgroundColor: ACCENT + "14", color: ACCENT }}>Use template <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 ease-out group-hover:-rotate-45" /></button>
          </>
        ) : (
          <>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>My widget</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <IconBtn icon={Pencil} title="Edit" onClick={onOpen} />
              <IconBtn icon={Copy} title="Duplicate" onClick={() => { duplicateReport(cfg.id); onChange(); }} />
              <IconBtn icon={Trash2} title="Delete" danger onClick={() => { deleteReport(cfg.id); onChange(); }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function IconBtn({ icon: Icon, title, onClick, danger }: { icon: React.ElementType; title: string; onClick: () => void; danger?: boolean }) {
  return <button title={title} onClick={onClick} className="p-1.5 rounded-lg active:bg-[var(--bg-surface-2)]"><Icon className="w-4 h-4" style={{ color: danger ? "#dc2626" : "var(--text-muted)" }} /></button>;
}
