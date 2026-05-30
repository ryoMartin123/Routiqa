import { Briefcase, TrendingUp, Clock, DollarSign } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import TodaysJobs from "@/components/dashboard/TodaysJobs";
import RecentActivity from "@/components/dashboard/RecentActivity";
import UrgentPanel from "@/components/dashboard/UrgentPanel";
import RevenueSnapshot from "@/components/dashboard/RevenueSnapshot";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Tuesday, June 11 — good morning, Marcus
        </p>
        <h1 className="text-2xl font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
          Dashboard
        </h1>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Today's Jobs"
          value="12"
          subtext="4 in progress"
          trend="+3 vs yesterday"
          trendUp={true}
          icon={<Briefcase className="w-4 h-4" />}
        />
        <StatCard
          label="Open Leads"
          value="27"
          subtext="8 hot"
          trend="+12% this week"
          trendUp={true}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <StatCard
          label="Follow-ups Due"
          value="9"
          subtext="3 overdue"
          trend="Clear by 5pm"
          trendUp={false}
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          label="Revenue MTD"
          value="$48,210"
          subtext="Goal $60k"
          trend="+18% MoM"
          trendUp={true}
          icon={<DollarSign className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <TodaysJobs />
          <RecentActivity />
        </div>
        <div className="space-y-6">
          <UrgentPanel />
          <RevenueSnapshot />
        </div>
      </div>
    </div>
  );
}
