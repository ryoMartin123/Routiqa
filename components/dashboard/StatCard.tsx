"use client";

import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
  href?: string;
  urgent?: boolean;
}

export default function StatCard({ label, value, subtext, icon, href, urgent }: StatCardProps) {
  const inner = (
    <div
      className="rounded-xl p-4 transition-colors h-full"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: urgent ? "1px solid #fecaca" : "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <span style={{ color: "var(--border)" }}>{icon}</span>
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold"
          style={{ color: urgent ? "#dc2626" : "var(--text-primary)" }}>
          {value}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{subtext}</p>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="block h-full" style={{ textDecoration: "none" }}>{inner}</Link>;
  }
  return inner;
}
