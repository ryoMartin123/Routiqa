"use client";

// ─── Documents & Company Info — dashboard ─────────────────
// Operational overview of the knowledge base: recently updated, published SOPs,
// docs needing review, missing vendor/sub compliance docs, popular folders, and
// recent activity. Mock data; accent = the Documents app icon color.

import Link from "next/link";
import {
  FileText, CheckCircle2, FilePen, FolderTree, ArrowRight, Clock, AlertTriangle, Activity,
} from "lucide-react";
import { PageHeader, StatCard } from "@/components/platform/ui";
import { appById } from "@/lib/platform/apps";
import {
  totalDocs, publishedSOPs, needingReview, foldersMissingComplianceDocs, popularFolders,
  recentlyUpdated, getActivity, folderPath, STATUS_COLOR,
} from "@/lib/documents/mock";

const ACCENT = appById("documents")?.accent ?? "#f59e0b";

export default function DocumentsDashboard() {
  const total = totalDocs();
  const sops = publishedSOPs();
  const review = needingReview();
  const missing = foldersMissingComplianceDocs();
  const popular = popularFolders();
  const recent = recentlyUpdated(6);
  const activity = getActivity().slice(0, 6);

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Dashboard" subtitle="SOPs, policies, templates, vendor docs, and company knowledge — all in one library." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Documents" value={String(total)} hint="In the library" icon={FileText} accent={ACCENT} />
        <StatCard label="Published SOPs" value={String(sops.length)} hint="Live procedures" icon={CheckCircle2} accent="#10b981" />
        <StatCard label="Needing Review" value={String(review.length)} hint="Draft / in review" icon={FilePen} accent="#f59e0b" />
        <StatCard label="Compliance Gaps" value={String(missing.length)} hint="Empty vendor/sub folders" icon={AlertTriangle} accent="#ef4444" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recently updated */}
        <Panel title="Recently Updated" icon={Clock} href="/documents/library">
          <ul className="space-y-2.5">
            {recent.map(d => (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{d.title}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{d.type} · {d.owner} · {d.updated}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] shrink-0" style={{ color: "var(--text-secondary)" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[d.status] }} /> {d.status}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Needing review */}
        <Panel title="Documents Needing Review" icon={FilePen} href="/documents/library">
          {review.length === 0 ? <Empty text="Nothing waiting on review." /> : (
            <ul className="space-y-2.5">
              {review.slice(0, 6).map(d => (
                <li key={d.id} className="flex items-center justify-between gap-3">
                  <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{d.title}</p>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLOR[d.status] + "22", color: STATUS_COLOR[d.status] }}>{d.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Published SOPs */}
        <Panel title="Published SOPs" icon={CheckCircle2} href="/documents/library">
          <ul className="space-y-2">
            {sops.slice(0, 6).map(d => (
              <li key={d.id} className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
                <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{d.title}</span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Missing vendor/sub docs */}
        <Panel title="Missing Vendor / Subcontractor Docs" icon={AlertTriangle} href="/documents/library">
          {missing.length === 0 ? <Empty text="All vendor & subcontractor folders have documents." /> : (
            <ul className="space-y-2">
              {missing.map(f => (
                <li key={f.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{folderPath(f.id).map(x => x.name).join(" / ")}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "#fee2e2", color: "#991b1b" }}>Empty</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Popular folders */}
        <Panel title="Popular Folders" icon={FolderTree} href="/documents/library">
          <div className="grid grid-cols-2 gap-2">
            {popular.map(({ folder, count }) => (
              <div key={folder.id} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                <span className="flex items-center gap-1.5 min-w-0"><FolderTree className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} /><span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{folder.name}</span></span>
                <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{count}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Recent activity */}
        <Panel title="Recent Activity" icon={Activity} href="/documents/library">
          <ul className="space-y-2.5">
            {activity.map(a => (
              <li key={a.id} className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}><Activity className="w-3 h-3" style={{ color: "var(--text-secondary)" }} /></span>
                <div className="min-w-0"><p className="text-sm" style={{ color: "var(--text-primary)" }}>{a.text}</p><p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{a.when}</p></div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) { return <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>{text}</p>; }

function Panel({ title, icon: Icon, href, children }: { title: string; icon: typeof Clock; href: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: ACCENT + "22" }}><Icon className="w-4 h-4" style={{ color: ACCENT }} /></span>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        </div>
        <Link href={href} className="flex items-center gap-1 text-xs font-medium" style={{ color: ACCENT }}>View <ArrowRight className="w-3.5 h-3.5" /></Link>
      </div>
      {children}
    </div>
  );
}
