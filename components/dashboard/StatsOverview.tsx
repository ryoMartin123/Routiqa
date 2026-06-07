"use client";

import { Briefcase, TrendingUp, CheckSquare, DollarSign } from "lucide-react";
import StatCard from "./StatCard";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { ALL_JOBS } from "@/lib/jobs/data";
import { ALL_LEADS } from "@/lib/leads/data";
import { getAllTasks } from "@/lib/tasks/data";
import { ALL_INVOICES, fmt } from "@/lib/quotes/data";

const TODAY = "May 30, 2026";

export default function StatsOverview() {
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();

  const filterJob = (x: { companyId: string; locationId: string }) =>
    (!effectiveCompanyId  || x.companyId  === effectiveCompanyId) &&
    (!effectiveLocationId || x.locationId === effectiveLocationId);

  const filterLead = (x: { companyId: string; locationId: string; serviceAreaId?: string }) =>
    (!effectiveCompanyId     || x.companyId     === effectiveCompanyId) &&
    (!effectiveLocationId    || x.locationId    === effectiveLocationId) &&
    (!effectiveServiceAreaId || x.serviceAreaId === effectiveServiceAreaId);

  const todaysJobs     = ALL_JOBS.filter(filterJob).filter(j => j.scheduledDate === TODAY || j.status === "in_progress" || j.status === "en_route");
  const inProgress     = todaysJobs.filter(j => j.status === "in_progress" || j.status === "en_route").length;
  const openLeads      = ALL_LEADS.filter(filterLead).filter(l => !["won", "lost"].includes(l.stage));
  const newLeads       = openLeads.filter(l => l.stage === "new_lead").length;
  const taskFilter     = (t: { companyId: string; locationId: string }) =>
    (!effectiveCompanyId  || t.companyId  === effectiveCompanyId) &&
    (!effectiveLocationId || t.locationId === effectiveLocationId);
  const allTasks       = getAllTasks();
  const overdueTasks   = allTasks.filter(taskFilter).filter(t => t.status === "overdue").length;
  const openTasks      = allTasks.filter(taskFilter).filter(t => t.status === "open").length;
  const outstanding    = ALL_INVOICES.filter(i => !effectiveCompanyId || i.companyId === effectiveCompanyId).filter(i => i.balanceDue > 0).reduce((s, i) => s + i.balanceDue, 0);
  const overdueInvs    = ALL_INVOICES.filter(i => !effectiveCompanyId || i.companyId === effectiveCompanyId).filter(i => i.status === "past_due").length;

  return (
    <div className="grid grid-cols-4 gap-4 h-full min-h-0">
      <StatCard label="Today's Jobs"  value={todaysJobs.length} subtext={inProgress > 0 ? `${inProgress} in progress` : "None in progress"}   icon={<Briefcase   className="w-4 h-4" />} href="/jobs"     />
      <StatCard label="Open Leads"    value={openLeads.length}  subtext={newLeads > 0 ? `${newLeads} new leads` : "Pipeline healthy"}            icon={<TrendingUp  className="w-4 h-4" />} href="/leads"    />
      <StatCard label="Overdue Tasks" value={overdueTasks}      subtext={`${openTasks} open total`}                                             icon={<CheckSquare className="w-4 h-4" />} href="/tasks"    urgent={overdueTasks > 0} />
      <StatCard label="Outstanding"   value={outstanding > 0 ? fmt(outstanding) : "$0"} subtext={overdueInvs > 0 ? `${overdueInvs} overdue` : "All current"} icon={<DollarSign  className="w-4 h-4" />} href="/invoices" urgent={overdueInvs > 0}  />
    </div>
  );
}
