"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus, Search, SlidersHorizontal, CalendarClock, ImageOff, CheckCircle2 } from "lucide-react";
import { getAllJobs, getAllWorkOrders, type WorkOrderStatus } from "@/lib/jobs/data";
import WorkOrderWizard from "@/components/jobs/WorkOrderWizard";
import PageTitle from "@/components/shared/PageTitle";
import { getFiles } from "@/lib/files/data";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import ModuleSummaryCards, { type SummaryCard } from "@/components/shared/ModuleSummaryCards";
import ModuleViewToggle, { type ModuleView } from "@/components/shared/ModuleViewToggle";
import StatusTabs from "@/components/shared/StatusTabs";

const TODAY = "May 30, 2026";

const STATUS_TABS: { key: "all" | WorkOrderStatus; label: string }[] = [
  { key: "all",         label: "All"         },
  { key: "pending",     label: "Pending"     },
  { key: "in_progress", label: "In Progress" },
  { key: "completed",   label: "Completed"   },
];

export default function WorkOrdersPage() {
  const { effectiveCompanyId, effectiveLocationId } = useHierarchy();
  const [tab, setTab]       = useState<"all" | WorkOrderStatus>("all");
  const [search, setSearch] = useState("");
  const [moduleView, setModuleView] = useState<ModuleView>("list");
  const [version, setVersion]   = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Flatten work orders (seed + session) into a list with job context.
  const jobsAll = useMemo(() => getAllJobs(), [version]);
  const woList = useMemo(() =>
    getAllWorkOrders()
      .map(({ jobId, wo }) => ({ wo, job: jobsAll.find(j => j.id === jobId) }))
      .filter(({ job }) => job !== undefined),
    [jobsAll, version]);

  const contextFiltered = woList.filter(({ job }) =>
    (!effectiveCompanyId  || job!.companyId  === effectiveCompanyId) &&
    (!effectiveLocationId || job!.locationId === effectiveLocationId)
  );

  const displayed = contextFiltered
    .filter(({ wo }) => tab === "all" || wo.status === tab)
    .filter(({ wo, job }) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        wo.title.toLowerCase().includes(q) ||
        (job?.customerName ?? "").toLowerCase().includes(q)
      );
    });

  const tabCount = (key: "all" | WorkOrderStatus) =>
    key === "all"
      ? contextFiltered.length
      : contextFiltered.filter(({ wo }) => wo.status === key).length;

  // Summary metrics — respect the active context
  const woMissingPhotos = (woId: string) => getFiles({ workOrderId: woId }).every(f => f.fileType !== "image");
  const summaryCards: SummaryCard[] = [
    { icon: ClipboardList, label: "Open Work Orders",      value: String(contextFiltered.filter(({ wo }) => wo.status !== "completed").length),                            sub: "Pending + in progress", iconColor: "#4f46e5" },
    { icon: CalendarClock, label: "Assigned Today",        value: String(contextFiltered.filter(({ job }) => job!.scheduledDate === TODAY).length),                         sub: "Scheduled today",       iconColor: "#0891b2" },
    { icon: ImageOff,      label: "Missing Required Photos",value: String(contextFiltered.filter(({ wo }) => wo.status !== "pending" && woMissingPhotos(wo.id)).length),     sub: "Active without photos", iconColor: "#f59e0b" },
    { icon: CheckCircle2,  label: "Ready for Review",      value: String(contextFiltered.filter(({ wo }) => wo.status === "completed").length),                             sub: "Awaiting sign-off",     iconColor: "#10b981" },
  ];

  return (
    <div className="p-6">
      {/* Header — title · centered view toggle · action */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <PageTitle title="Work Orders" count={contextFiltered.length} description="Manage field instructions, checklists, required photos, and completion status." />
        </div>
        <ModuleViewToggle view={moduleView} onChange={setModuleView} />
        <div className="flex-1 flex justify-end">
          <button onClick={() => setWizardOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Work Order
          </button>
        </div>
      </div>

      {wizardOpen && (
        <WorkOrderWizard onClose={() => setWizardOpen(false)} onCreated={() => { setWizardOpen(false); setVersion(v => v + 1); }} />
      )}

      {moduleView === "overview" && (
        <div className="mb-5">
          <ModuleSummaryCards cards={summaryCards} />
        </div>
      )}

      {moduleView === "list" && (
      <>
        {/* Toolbar — tabs · search · filter, OUTSIDE the table card (consistent with Customers/Leads) */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <StatusTabs active={tab} onChange={k => setTab(k as typeof tab)}
            tabs={STATUS_TABS.map(t => ({ key: t.key, label: t.label, count: tabCount(t.key) }))} />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5"
              style={{ backgroundColor: "var(--bg-input)" }}>
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <input type="text" placeholder="Search work orders..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none w-44"
                style={{ color: "var(--text-primary)" }} />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
            </button>
          </div>
        </div>

        {/* Table card */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        {/* Column headers */}
        <div className="grid px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: "2.5fr 2fr 1.5fr 1fr", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", backgroundColor: "transparent" }}>
          <span>Work Order</span>
          <span>Customer / Job</span>
          <span>Property</span>
          <span>Assigned</span>
        </div>

        {/* Rows */}
        <div>
          {displayed.length === 0 ? (
            <div className="py-16 text-center">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No work orders match the current filter.</p>
            </div>
          ) : displayed.map(({ wo, job }, i) => {
            // Checklist progress
            const done  = wo.checklist.filter(c => c.isComplete).length;
            const total = wo.checklist.length;
            const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <Link key={wo.id} href={`/work-orders/${wo.id}`}
                className="grid px-4 py-3 items-center hover:bg-[var(--bg-surface-2)] transition-colors"
                style={{ gridTemplateColumns: "2.5fr 2fr 1.5fr 1fr", borderBottom: i < displayed.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>

                {/* Work order */}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{wo.title}</p>
                  {total > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="flex-1 max-w-24 h-1 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
                        <div className="h-1 rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#10b981" : "#4f46e5" }} />
                      </div>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {done}/{total}
                      </span>
                    </div>
                  )}
                </div>

                {/* Customer / Job */}
                <div className="min-w-0">
                  {job && (
                    <>
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{job.customerName}</p>
                      <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{job.title}</p>
                    </>
                  )}
                </div>

                {/* Property */}
                <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                  {job?.propertyAddress ?? "—"}
                </p>

                {/* Assigned */}
                {job && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white shrink-0">
                      {job.assignedToInitials}
                    </div>
                    <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>{job.assignedTo}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 text-xs"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)", backgroundColor: "transparent" }}>
          Showing {displayed.length} of {contextFiltered.length} work orders · Click a row to open the work order
        </div>
      </div>
      </>
      )}
    </div>
  );
}
