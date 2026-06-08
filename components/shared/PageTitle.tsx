"use client";

// ─── PageTitle ────────────────────────────────────────────
// Standard section header: the page title followed by a single info (ⓘ) icon.
// The record count and the section's description live inside the hover panel,
// keeping the header clean (replaces the old inline count pill + subheading).

import HoverInfo from "@/components/shared/HoverInfo";

export default function PageTitle({ title, count, description, extraRows }: {
  title:        React.ReactNode;
  count?:       number | string;
  description?: React.ReactNode;
  // Extra hover rows (e.g. an "overdue" tally) shown between count and description.
  extraRows?:   { label: string; node: React.ReactNode }[];
}) {
  const rows: { label: string; node: React.ReactNode }[] = [];
  if (count !== undefined) {
    rows.push({ label: "Total", node: <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{count}</span> });
  }
  if (extraRows) rows.push(...extraRows);
  if (description) {
    // Fixed width so the description wraps to ~2 lines; the panel grows to fit it.
    rows.push({ label: "About", node: <span className="text-xs block leading-snug text-right" style={{ color: "var(--text-secondary)", width: "12rem" }}>{description}</span> });
  }
  return (
    <div className="flex items-center gap-2">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h1>
      {rows.length > 0 && <HoverInfo rows={rows} placement="bottom" />}
    </div>
  );
}
