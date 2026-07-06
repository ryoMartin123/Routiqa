"use client";

// ─── SegmentedProgress ────────────────────────────────────
// Step progress drawn as one rectangle per step (slight border, subtle radius)
// instead of a continuous pill. The current step gets a ring so it's obvious
// what's being worked on right now. Used by the project Map header, the
// project Workflow Progress card, and work-order checklist progress.

export interface ProgressSegment {
  filled: boolean;
  color: string;            // fill (and ring) color for this step
  current?: boolean;        // the step being worked on — gets the ring
  title?: string;           // hover tooltip
  onClick?: () => void;
}

export default function SegmentedProgress({ segments, className = "" }: {
  segments: ProgressSegment[];
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {segments.map((s, i) => {
        const style: React.CSSProperties = {
          backgroundColor: s.filled ? s.color : s.current ? `${s.color}2e` : "var(--bg-input)",
          border: `1px solid ${s.filled || s.current ? `color-mix(in srgb, ${s.color} 78%, #1f2937)` : "var(--border)"}`,
          boxShadow: s.current ? `0 0 0 1.5px var(--bg-surface), 0 0 0 3px ${s.color}` : undefined,
        };
        const cls = "flex-1 h-2.5 rounded-[3px] transition-all";
        return s.onClick ? (
          <button key={i} onClick={s.onClick} title={s.title} className={`${cls} hover:brightness-95`} style={style} />
        ) : (
          <span key={i} title={s.title} className={cls} style={style} />
        );
      })}
    </div>
  );
}
