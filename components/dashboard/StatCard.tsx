import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  subtext: string;
  trend: string;
  trendUp: boolean;
  icon: React.ReactNode;
}

export default function StatCard({
  label,
  value,
  subtext,
  trend,
  trendUp,
  icon,
}: StatCardProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start justify-between">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </p>
        <span style={{ color: "var(--border)" }}>{icon}</span>
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          {value}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {subtext}
        </p>
      </div>
      <div className="flex items-center gap-1 mt-3">
        {trendUp ? (
          <TrendingUp className="w-3.5 h-3.5" style={{ color: "#10b981" }} />
        ) : (
          <TrendingDown className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
        )}
        <span
          className="text-xs font-medium"
          style={{ color: trendUp ? "#059669" : "#d97706" }}
        >
          {trend}
        </span>
      </div>
    </div>
  );
}
