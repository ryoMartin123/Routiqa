// ─── App module previews ──────────────────────────────────
// Small, crafted UI compositions — one per app — in the product's design
// language (tokens, indigo accent, rounded cards). These are website-ready,
// product-inspired visuals, NOT raw screenshots: each distills what the app
// does into a clean panel that reads at a glance. Width-fluid; ~7rem tall.
// Used by the ecosystem hero (center window) and the app grid cards.

import { Navigation, Check, Sparkles, Star, FileCheck2 } from "lucide-react";

// ── shared atoms ──
function Ln({ w, h = "h-1.5", c = "var(--bg-input)" }: { w: string; h?: string; c?: string }) {
  return <div className={`${h} rounded-full`} style={{ width: w, backgroundColor: c }} />;
}
function Avatar({ c = "#4f46e5", ring = false }: { c?: string; ring?: boolean }) {
  return <span className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: c, border: ring ? "2px solid var(--bg-surface)" : undefined }} />;
}
function Pill({ label, c }: { label: string; c: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: `${c}22`, color: c }}>
      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: c }} />{label}
    </span>
  );
}
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-2.5 ${className}`} style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  );
}

// ── CRM: a customer record with linked work ──
function CrmPreview() {
  return (
    <div className="h-full flex flex-col gap-2">
      <Panel>
        <div className="flex items-center gap-2">
          <Avatar />
          <div className="flex-1 space-y-1"><Ln w="42%" c="var(--text-muted)" /><Ln w="26%" /></div>
          <Pill label="Customer" c="#10b981" />
        </div>
      </Panel>
      <div className="grid grid-cols-3 gap-2 flex-1">
        {[["Job", "#6366f1"], ["Estimate", "#f59e0b"], ["Invoice", "#10b981"]].map(([label, c]) => (
          <Panel key={label} className="flex flex-col justify-between">
            <Pill label={label} c={c} />
            <Ln w="70%" h="h-1" />
          </Panel>
        ))}
      </div>
    </div>
  );
}

// ── Dispatch: technician lanes with routed blocks ──
function DispatchPreview() {
  const lanes: [string, string, string][] = [["18%", "34%", "#6366f1"], ["8%", "26%", "#0891b2"], ["30%", "22%", "#10b981"]];
  return (
    <Panel className="h-full flex flex-col justify-center gap-2.5">
      {lanes.map(([offset, w, c], i) => (
        <div key={i} className="flex items-center gap-2">
          <Avatar c={c} />
          <div className="relative flex-1 h-4 rounded-md" style={{ backgroundColor: "var(--bg-surface-2)" }}>
            <span className="absolute top-0 h-4 rounded-md" style={{ left: offset, width: w, backgroundColor: `${c}55`, borderLeft: `2px solid ${c}` }} />
            <span className="absolute top-0 h-4 rounded-md" style={{ left: `calc(${offset} + ${w} + 12%)`, width: "16%", backgroundColor: `${c}30` }} />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-1.5 text-[9px] font-semibold" style={{ color: "var(--text-muted)" }}>
        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: "#10b981" }} /> Routes optimized
      </div>
    </Panel>
  );
}

// ── Mobile: the tech's next stop ──
function MobilePreview() {
  return (
    <div className="h-full flex justify-center">
      <div className="w-[58%] rounded-2xl p-2 flex flex-col gap-1.5" style={{ backgroundColor: "#0a0a0a", border: "1px solid var(--border)" }}>
        <div className="mx-auto w-10 h-1 rounded-full" style={{ backgroundColor: "#27272a" }} />
        <div className="rounded-lg p-2 flex-1 flex flex-col justify-between" style={{ backgroundColor: "var(--bg-surface)" }}>
          <div className="space-y-1"><Ln w="55%" c="var(--text-muted)" /><Ln w="80%" /></div>
          <Pill label="En route" c="#3b82f6" />
        </div>
        <div className="rounded-lg py-1.5 flex items-center justify-center gap-1 text-[9px] font-bold text-white" style={{ backgroundColor: "#4f46e5" }}>
          <Navigation className="w-2.5 h-2.5" /> Start Route
        </div>
      </div>
    </div>
  );
}

// ── Communications: conversation with an AI draft ──
function CommunicationsPreview() {
  return (
    <div className="h-full flex flex-col justify-center gap-1.5">
      <div className="max-w-[70%] rounded-xl rounded-bl-sm px-2.5 py-1.5 space-y-1" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
        <Ln w="90%" h="h-1" /><Ln w="55%" h="h-1" />
      </div>
      <div className="max-w-[70%] self-end rounded-xl rounded-br-sm px-2.5 py-1.5 space-y-1" style={{ backgroundColor: "#4f46e5" }}>
        <Ln w="85%" h="h-1" c="rgba(255,255,255,0.55)" /><Ln w="40%" h="h-1" c="rgba(255,255,255,0.55)" />
      </div>
      <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 self-start" style={{ backgroundColor: "var(--accent-soft-bg)", border: "1px solid var(--accent-soft-border)" }}>
        <Sparkles className="w-3 h-3" style={{ color: "var(--accent-text)" }} />
        <span className="text-[9px] font-semibold" style={{ color: "var(--accent-text-strong)" }}>AI draft ready</span>
        <span className="flex gap-0.5 ml-0.5">
          {[0, 1, 2].map(i => <span key={i} className="site-blink w-1 h-1 rounded-full" style={{ backgroundColor: "var(--accent-text)", animationDelay: `${i * 0.18}s` }} />)}
        </span>
      </div>
    </div>
  );
}

// ── Marketing: an automation flow ──
function MarketingPreview() {
  return (
    <div className="h-full flex flex-col justify-center gap-2">
      <div className="flex items-center gap-1.5">
        {[["Job done", "#10b981"], ["Wait 2d", "#6b7280"], ["Review SMS", "#4f46e5"]].map(([label, c], i) => (
          <div key={label} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <span className="w-3 h-px shrink-0" style={{ backgroundColor: "var(--border)" }} />}
            <span className="text-[9px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap" style={{ backgroundColor: `${c}1f`, color: c === "#6b7280" ? "var(--text-secondary)" : c, border: `1px solid ${c}44` }}>{label}</span>
          </div>
        ))}
      </div>
      <Panel>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-semibold" style={{ color: "var(--text-muted)" }}>Reviews collected</span>
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold" style={{ color: "#f59e0b" }}><Star className="w-2.5 h-2.5 fill-current" /> 4.9</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-surface-2)" }}>
          <div className="h-full rounded-full" style={{ width: "76%", backgroundColor: "#4f46e5" }} />
        </div>
      </Panel>
    </div>
  );
}

// ── Analytics: growing bars + a KPI ──
function AnalyticsPreview() {
  const bars = [34, 52, 44, 68, 58, 82, 72, 96];
  return (
    <Panel className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-1.5">
        <Ln w="34%" c="var(--text-muted)" h="h-1" />
        <Pill label="+18%" c="#10b981" />
      </div>
      <div className="flex items-end gap-1.5 flex-1">
        {bars.map((h, i) => (
          <div key={i} className="site-grow-y flex-1 rounded-t-sm" style={{ height: `${h}%`, animationDelay: `${i * 70}ms`, background: i === bars.length - 1 ? "linear-gradient(180deg, #818cf8, #4f46e5)" : "var(--bg-input)" }} />
        ))}
      </div>
    </Panel>
  );
}

// ── Team Workspace: a channel thread ──
function WorkspacePreview() {
  return (
    <Panel className="h-full flex flex-col justify-center gap-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: "var(--text-primary)" }}>
        <span style={{ color: "var(--accent-text)" }}>#</span> operations
        <span className="flex -space-x-1 ml-auto">{["#4f46e5", "#0891b2", "#10b981"].map(c => <Avatar key={c} c={c} ring />)}</span>
      </div>
      {[["#0891b2", "72%"], ["#10b981", "48%"]].map(([c, w], i) => (
        <div key={i} className="flex items-center gap-2">
          <Avatar c={c} />
          <div className="flex-1 space-y-1"><Ln w={w} h="h-1" /><Ln w="30%" h="h-1" /></div>
        </div>
      ))}
      <span className="self-start text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-surface-2)", color: "var(--text-secondary)" }}>👍 3</span>
    </Panel>
  );
}

// ── Documents: SOP library ──
function DocumentsPreview() {
  const docs: [string, string, string][] = [["Install SOP", "Published", "#10b981"], ["Safety checklist", "Published", "#10b981"], ["Close-out report", "In review", "#f59e0b"]];
  return (
    <div className="h-full flex flex-col justify-center gap-1.5">
      {docs.map(([name, status, c]) => (
        <Panel key={name} className="flex items-center gap-2 !p-2">
          <FileCheck2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent-text)" }} />
          <span className="text-[10px] font-medium flex-1 truncate" style={{ color: "var(--text-primary)" }}>{name}</span>
          <Pill label={status} c={c} />
        </Panel>
      ))}
    </div>
  );
}

// ── Accounting: invoice settled ──
function AccountingPreview() {
  return (
    <Panel className="h-full flex flex-col justify-center gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold" style={{ color: "var(--text-primary)" }}>INV-2041</span>
        <Pill label="Paid" c="#10b981" />
      </div>
      {[["60%", "$185"], ["44%", "$375"]].map(([w, amount]) => (
        <div key={amount} className="flex items-center justify-between gap-2">
          <Ln w={w} h="h-1" />
          <span className="text-[9px] font-semibold" style={{ color: "var(--text-secondary)" }}>{amount}</span>
        </div>
      ))}
      <div className="pt-1.5 flex items-center justify-between" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <span className="text-[9px] font-semibold" style={{ color: "var(--text-muted)" }}>Total</span>
        <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>$640</span>
      </div>
    </Panel>
  );
}

// ── HR: onboarding progress ──
function HrPreview() {
  return (
    <Panel className="h-full flex flex-col justify-center gap-2">
      <div className="flex items-center gap-2">
        <span className="flex -space-x-1">{["#4f46e5", "#0891b2", "#10b981", "#f59e0b"].map(c => <Avatar key={c} c={c} ring />)}</span>
        <span className="text-[9px] font-semibold" style={{ color: "var(--text-muted)" }}>24 active · 2 onboarding</span>
      </div>
      <div>
        <div className="flex justify-between text-[9px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
          <span>Onboarding — Luis R.</span><span style={{ color: "var(--accent-text)" }}>80%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-surface-2)" }}>
          <div className="h-full rounded-full" style={{ width: "80%", backgroundColor: "#4f46e5" }} />
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[9px] font-semibold" style={{ color: "var(--text-secondary)" }}>
        <Check className="w-3 h-3" style={{ color: "#10b981" }} /> Safety training complete
      </div>
    </Panel>
  );
}

// Registry keyed by ecosystem app id (components/site/apps.ts).
export const APP_PREVIEWS: Record<string, () => React.ReactNode> = {
  crm: CrmPreview,
  dispatch: DispatchPreview,
  mobile: MobilePreview,
  communications: CommunicationsPreview,
  marketing: MarketingPreview,
  analytics: AnalyticsPreview,
  workspace: WorkspacePreview,
  documents: DocumentsPreview,
  accounting: AccountingPreview,
  hr: HrPreview,
};
