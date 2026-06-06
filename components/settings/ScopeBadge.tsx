"use client";

// ─── ScopeBadge ───────────────────────────────────────────
// A small pill on a settings section that states, at a glance, which layer the
// section is edited at: Global Only, Organization Level, Company Level, Branch
// Level — or "Company Default + Branch Overrides" when branches customize it.

import { LAYER_META, type Layer } from "@/lib/settings-scope/types";

export type BadgeLevel = "any" | Layer;

export default function ScopeBadge({ level, childOverrides }: { level: BadgeLevel; childOverrides?: boolean }) {
  if (level === "any") return <Pill color="#6b7280" label="Global Only" />;

  const meta = LAYER_META[level];
  if (level === "company" && childOverrides) {
    return <Pill color={meta.color} label="Company Default + Branch Overrides" />;
  }
  return <Pill color={meta.color} label={`${meta.label} Level`} />;
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
      style={{ backgroundColor: color + "1a", color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
