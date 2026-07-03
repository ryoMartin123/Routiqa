"use client";

// ─── ChartView — renders a ReportResult ───────────────────
// Minimal, professional charts (no chart lib), styled with Routiqa tokens.
// Restrained monochrome-indigo system: a single accent, opacity ramps for
// categories, thin geometry, faint gridlines. One switch over the viz type.

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { ReportResult, VizType } from "@/lib/analytics/types";
import { formatValue, formatFull } from "@/lib/analytics/engine";

const ACCENT = "#4f46e5";
const ACCENT_RGB = "79,70,229";
const GRID = "var(--border-subtle)";
// Opacity ramp for categorical series — monochrome, not rainbow.
const shade = (i: number, n: number) => `rgba(${ACCENT_RGB},${(1 - (i / Math.max(1, n - 1)) * 0.62).toFixed(3)})`;

export default function ChartView({ result, viz, metricLabel, compact }: { result: ReportResult; viz: VizType; metricLabel: string; compact?: boolean }) {
  const { points, format, total, deltaPct = 0, previous = 0 } = result;
  const fmt = (v: number) => formatValue(v, format);
  const fmtFull = (v: number) => formatFull(v, format);
  const n = points.length;

  if (viz === "kpi") return <KpiCard label={metricLabel} value={fmtFull(total)} delta={deltaPct} compact={compact} />;
  if (viz === "trend") return <KpiCard label={metricLabel} value={fmtFull(total)} delta={deltaPct} spark={points.map(p => p.value)} compact={compact} />;
  if (viz === "gauge") return <Gauge total={total} max={format === "percent" ? 100 : niceMax(Math.max(total, previous))} valueText={fmtFull(total)} delta={deltaPct} compact={compact} />;
  if (viz === "comparison") return (
    <div className="flex items-stretch gap-2.5 h-full">
      <Stat label="This period" value={fmtFull(total)} strong />
      <Stat label="Previous" value={fmtFull(previous)} />
      <div className="flex-1 flex flex-col items-center justify-center rounded-xl border" style={{ borderColor: "var(--border-subtle)" }}>
        <Delta delta={deltaPct} big />
        <span className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>vs last</span>
      </div>
    </div>
  );

  const max = Math.max(1, ...points.map(p => p.value));

  if (viz === "line") return <LineChart points={points} />;

  if (viz === "bar") return (
    <div className="h-full flex flex-col">
      <div className="flex-1 relative">
        <Gridlines />
        <div className="absolute inset-0 flex items-end justify-between gap-1.5 px-0.5">
          {points.map((p, i) => (
            <div key={i} className="flex-1 flex items-end justify-center group min-w-0 h-full relative">
              <span className="absolute -top-0.5 text-[9px] font-semibold tabular-nums opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-secondary)" }}>{fmt(p.value)}</span>
              <div className="w-full max-w-[26px] rounded-[2px] transition-colors" style={{ height: `${(p.value / max) * 100}%`, minHeight: 2, backgroundColor: ACCENT, opacity: 0.92 }} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between gap-1 mt-1.5 px-0.5">
        {points.map((p, i) => <span key={i} className="flex-1 text-center text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{p.label}</span>)}
      </div>
    </div>
  );

  if (viz === "hbar" || viz === "leaderboard") return (
    <div className="h-full overflow-y-auto thin-scroll-y space-y-2.5 pr-0.5">
      {points.map((p, i) => (
        <div key={i} className="flex items-center gap-2.5">
          {viz === "leaderboard" && <span className="w-4 text-right text-[11px] font-semibold tabular-nums shrink-0" style={{ color: "var(--text-muted)" }}>{i + 1}</span>}
          <span className="w-24 text-xs truncate shrink-0" style={{ color: "var(--text-secondary)" }}>{p.label}</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-input)" }}>
            <div className="h-full rounded-full" style={{ width: `${(p.value / max) * 100}%`, backgroundColor: shade(i, n) }} />
          </div>
          <span className="w-14 text-right text-xs font-semibold tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );

  if (viz === "donut") return <Donut points={points} fmt={fmt} fmtTotal={fmtFull(total)} />;
  if (viz === "pie") return <Pie points={points} fmt={fmt} />;

  if (viz === "funnel") {
    // A funnel is inherently descending — sort so each stage is narrower than the
    // one above, and size every bar off the largest so nothing overflows.
    const sorted = [...points].sort((a, b) => b.value - a.value);
    const fmax = Math.max(1, sorted[0]?.value ?? 1);
    return (
      <div className="h-full flex flex-col justify-center gap-2">
        {sorted.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 text-[11px] truncate shrink-0" style={{ color: "var(--text-secondary)" }}>{p.label}</span>
            <div className="flex-1 flex justify-center min-w-0">
              <div className="h-5 rounded-[3px]" style={{ width: `${Math.max(8, (p.value / fmax) * 100)}%`, backgroundColor: shade(i, sorted.length) }} />
            </div>
            <span className="w-20 text-right tabular-nums text-[11px] shrink-0" style={{ color: "var(--text-primary)" }}>
              {fmt(p.value)} <span style={{ color: "var(--text-muted)" }}>· {Math.round((p.value / fmax) * 100)}%</span>
            </span>
          </div>
        ))}
      </div>
    );
  }

  // table
  return (
    <div className="h-full overflow-y-auto thin-scroll-y">
      <table className="w-full text-sm">
        <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>
          <th className="text-left py-1.5 font-medium text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Group</th>
          <th className="text-right py-1.5 font-medium text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{metricLabel}</th>
        </tr></thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="py-2" style={{ color: "var(--text-secondary)" }}>{p.label}</td>
              <td className="py-2 text-right tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>{fmtFull(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Pieces ──
function Gridlines() {
  return (
    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
      {[0, 1, 2, 3].map(i => <div key={i} style={{ borderTop: `1px solid ${GRID}` }} />)}
    </div>
  );
}
function KpiCard({ label, value, delta, spark, compact }: { label: string; value: string; delta: number; spark?: number[]; compact?: boolean }) {
  return (
    <div className="h-full flex flex-col justify-center">
      <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className={`font-semibold tabular-nums leading-none mt-1.5 ${compact ? "text-3xl" : "text-[44px]"}`} style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{value}</p>
      <div className="mt-2"><Delta delta={delta} /></div>
      {spark && spark.length > 1 && <Sparkline values={spark} />}
    </div>
  );
}
function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center rounded-xl border p-2" style={{ borderColor: "var(--border-subtle)" }}>
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className={`tabular-nums mt-0.5 ${strong ? "text-2xl font-semibold" : "text-xl font-medium"}`} style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{value}</span>
    </div>
  );
}
function Delta({ delta, big }: { delta: number; big?: boolean }) {
  const up = delta >= 0; const c = up ? "#16a34a" : "#dc2626"; const Icon = up ? ArrowUpRight : ArrowDownRight;
  return <span className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${big ? "text-base" : "text-xs"}`} style={{ color: c }}><Icon className={big ? "w-4 h-4" : "w-3.5 h-3.5"} />{Math.abs(delta)}%</span>;
}
function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values), min = Math.min(...values), rng = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${26 - ((v - min) / rng) * 24}`).join(" ");
  return <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="w-full h-7 mt-3"><polyline points={pts} fill="none" stroke={ACCENT} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>;
}
function LineChart({ points }: { points: { label: string; value: number }[] }) {
  if (points.length < 2) return <Empty />;
  const max = Math.max(...points.map(p => p.value)), min = Math.min(...points.map(p => p.value)), rng = max - min || 1;
  const xy = points.map((p, i) => ({ x: (i / (points.length - 1)) * 100, y: 100 - ((p.value - min) / rng) * 84 - 8 }));
  const line = xy.map(p => `${p.x},${p.y}`).join(" ");
  const area = `0,100 ${line} 100,100`;
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 relative">
        <Gridlines />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} stopOpacity="0.16" /><stop offset="100%" stopColor={ACCENT} stopOpacity="0" /></linearGradient></defs>
          <polygon points={area} fill="url(#ag)" />
          <polyline points={line} fill="none" stroke={ACCENT} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={xy[xy.length - 1].x} cy={xy[xy.length - 1].y} r="2" fill={ACCENT} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="flex justify-between mt-1.5 px-0.5">
        {points.map((p, i) => (i % Math.ceil(points.length / 6) === 0 || i === points.length - 1) && <span key={i} className="text-[9px]" style={{ color: "var(--text-muted)" }}>{p.label}</span>)}
      </div>
    </div>
  );
}
function Donut({ points, fmt, fmtTotal }: { points: { label: string; value: number }[]; fmt: (v: number) => string; fmtTotal: string }) {
  const n = points.length;
  const sum = points.reduce((s, p) => s + p.value, 0) || 1;
  let acc = 0; const R = 15.9, C = 2 * Math.PI * R;
  return (
    <div className="h-full flex items-center gap-4">
      <svg viewBox="0 0 40 40" className="h-full max-h-[150px] -rotate-90 shrink-0">
        {points.map((p, i) => { const frac = p.value / sum; const dash = `${Math.max(0, frac * C - 0.6)} ${C}`; const off = -acc * C; acc += frac; return <circle key={i} cx="20" cy="20" r={R} fill="none" stroke={shade(i, n)} strokeWidth="4.5" strokeDasharray={dash} strokeDashoffset={off} />; })}
        <text x="20" y="20" transform="rotate(90 20 20)" textAnchor="middle" dominantBaseline="middle" fontSize="5" fontWeight="600" fill="var(--text-primary)">{fmtTotal}</text>
      </svg>
      <div className="flex-1 min-w-0 space-y-2 overflow-y-auto thin-scroll-y max-h-full">
        {points.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: shade(i, n) }} />
            <span className="truncate flex-1" style={{ color: "var(--text-secondary)" }}>{p.label}</span>
            <span className="font-medium tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
function Gauge({ total, max, valueText, delta, compact }: { total: number; max: number; valueText: string; delta: number; compact?: boolean }) {
  const frac = Math.max(0, Math.min(1, total / (max || 1)));
  const cx = 50, cy = 50, r = 38, nr = 30;
  const rad = (d: number) => (d * Math.PI) / 180;
  const deg = 180 - 180 * frac;            // 180° (left) → 0° (right)
  const at = (ang: number, radius: number): [number, number] => [cx + radius * Math.cos(rad(ang)), cy - radius * Math.sin(rad(ang))];
  const [vx, vy] = at(deg, r);
  const [nx, ny] = at(deg, nr);
  const track = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const value = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${vx} ${vy}`;
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <svg viewBox="0 0 100 56" className="w-full" style={{ maxHeight: compact ? 96 : 130 }}>
        <path d={track} fill="none" stroke="var(--bg-input)" strokeWidth="7" strokeLinecap="round" />
        {frac > 0.01 && <path d={value} fill="none" stroke={ACCENT} strokeWidth="7" strokeLinecap="round" />}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--text-primary)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="2.6" fill="var(--text-primary)" />
      </svg>
      <p className={`font-semibold tabular-nums leading-none -mt-2 ${compact ? "text-2xl" : "text-[34px]"}`} style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{valueText}</p>
      <div className="mt-1.5"><Delta delta={delta} /></div>
    </div>
  );
}
function Pie({ points, fmt }: { points: { label: string; value: number }[]; fmt: (v: number) => string }) {
  const n = points.length;
  const sum = points.reduce((s, p) => s + p.value, 0) || 1;
  const cx = 20, cy = 20, r = 18.5;
  let acc = 0;
  const wedges = points.map((p, i) => {
    const a0 = (acc / sum) * 2 * Math.PI - Math.PI / 2; acc += p.value;
    const a1 = (acc / sum) * 2 * Math.PI - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = n === 1 ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}` : `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
    return <path key={i} d={d} fill={shade(i, n)} stroke="var(--bg-surface)" strokeWidth="0.6" />;
  });
  return (
    <div className="h-full flex items-center gap-4">
      <svg viewBox="0 0 40 40" className="h-full max-h-[150px] shrink-0">{wedges}</svg>
      <div className="flex-1 min-w-0 space-y-2 overflow-y-auto thin-scroll-y max-h-full">
        {points.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: shade(i, n) }} />
            <span className="truncate flex-1" style={{ color: "var(--text-secondary)" }}>{p.label}</span>
            <span className="font-medium tabular-nums shrink-0" style={{ color: "var(--text-primary)" }}>{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function Empty() { return <div className="h-full flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>Not enough data to plot.</div>; }
