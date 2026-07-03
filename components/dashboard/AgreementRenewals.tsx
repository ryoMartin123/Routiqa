"use client";

// Upcoming agreement renewals — agreements whose renewal date falls within the
// next 90 days (or are already flagged renewal_due/overdue). Surfaces revenue at
// risk and routes to the agreement for one-click renewal. Wired to the live
// agreements store; canceled agreements are excluded.

import { useMemo } from "react";
import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";
import { getAllAgreements, AGREEMENT_STATUS_META } from "@/lib/agreements/data";

const WINDOW_DAYS = 90;
const MS_PER_DAY = 86_400_000;

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function AgreementRenewals() {
  const { rows, atRisk } = useMemo(() => {
    const now = Date.now();
    const rows = getAllAgreements()
      .filter(a => a.status !== "canceled")
      .map(a => {
        const due = new Date(a.renewalDate).getTime();
        const days = isNaN(due) ? null : Math.round((due - now) / MS_PER_DAY);
        return { a, days };
      })
      // Renewal-flagged statuses always show; otherwise only those due within the window.
      .filter(({ a, days }) =>
        a.status === "renewal_due" || a.status === "overdue" ||
        (days !== null && days <= WINDOW_DAYS)
      )
      .sort((x, y) => (x.days ?? Infinity) - (y.days ?? Infinity))
      .slice(0, 6);

    const atRisk = rows.reduce((s, { a }) => s + (a.annualValue || 0), 0);
    return { rows, atRisk };
  }, []);

  return (
    <div className="rounded-xl overflow-hidden h-full min-h-0 flex flex-col"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" style={{ color: "#059669" }} />
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Agreement Renewals</h2>
          {atRisk > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
              {money(atRisk)} at risk
            </span>
          )}
        </div>
        <Link href="/agreements" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
          View all <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center px-5 py-8 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No renewals due in the next {WINDOW_DAYS} days.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto dashboard-widget-content">
          {rows.map(({ a, days }, i) => {
            const meta = AGREEMENT_STATUS_META[a.status];
            const overdue = days !== null && days < 0;
            const when = days === null ? a.renewalDate
              : overdue ? `${Math.abs(days)}d overdue`
              : days === 0 ? "Due today"
              : `in ${days}d`;
            return (
              <Link key={a.id} href={`/agreements/${a.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-surface-2)] transition-colors"
                style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none", textDecoration: "none" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{a.customer}</p>
                  <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {a.type} · {a.renewalDate}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{money(a.annualValue || 0)}/yr</p>
                  <p className="text-[10px] font-medium" style={{ color: overdue ? "#dc2626" : meta?.color ?? "var(--text-muted)" }}>{when}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
