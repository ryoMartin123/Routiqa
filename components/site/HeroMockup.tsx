// ─── Hero product collage ─────────────────────────────────
// A stylized, original product visual: the dispatch board as the anchor frame,
// with a revenue dashboard, customer profile, job card, a Riq suggestion panel,
// and a technician-mobile preview layered around it. Pure CSS — crisp at any
// size, no screenshots.

import { Sparkles, Phone, CheckCircle2, MapPin, Camera, CreditCard } from "lucide-react";
import { INK, BODY, BRAND } from "./ui";

const card = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  boxShadow: "0 24px 60px -24px rgba(15,23,42,0.25)",
  ...extra,
});

function Lane({ name, initials, blocks }: { name: string; initials: string; blocks: { left: string; width: string; color: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid #f1f5f9" }}>
      <div className="flex items-center gap-2 w-28 shrink-0">
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0" style={{ backgroundColor: "#e5e0db", color: "#5c5545" }}>{initials}</span>
        <span className="text-[10px] font-semibold truncate" style={{ color: INK }}>{name}</span>
      </div>
      <div className="relative flex-1 h-7 rounded-md" style={{ backgroundColor: "#f8fafc" }}>
        {blocks.map((b, i) => (
          <span key={i} className="absolute top-1 bottom-1 rounded-md px-1.5 flex items-center text-[8px] font-semibold text-white truncate"
            style={{ left: b.left, width: b.width, backgroundColor: b.color }}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}

export default function HeroMockup() {
  return (
    <div className="relative mx-auto max-w-5xl select-none" aria-hidden>
      {/* Dispatch board — the anchor frame */}
      <div className="rounded-2xl overflow-hidden" style={card()}>
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
          <span className="w-2.5 h-2.5 rounded-full bg-red-300" /><span className="w-2.5 h-2.5 rounded-full bg-amber-300" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
          <span className="ml-3 text-[11px] font-semibold" style={{ color: BODY }}>Dispatch — Today</span>
          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#eef2ff", color: BRAND }}>Live</span>
        </div>
        <div className="px-4 py-3">
          <div className="flex text-[8px] font-semibold uppercase tracking-wider pb-1.5" style={{ color: "#94a3b8" }}>
            <span className="w-28 shrink-0" />
            {["8a", "10a", "12p", "2p", "4p"].map(t => <span key={t} className="flex-1">{t}</span>)}
          </div>
          <Lane name="T. Hayes"  initials="TH" blocks={[{ left: "4%",  width: "22%", color: "#6366f1", label: "AC Tune-Up" },  { left: "43%", width: "26%", color: "#0891b2", label: "Compressor Swap" }]} />
          <Lane name="L. Romero" initials="LR" blocks={[{ left: "16%", width: "30%", color: "#10b981", label: "Water Heater Install" }, { left: "62%", width: "20%", color: "#6366f1", label: "Inspection" }]} />
          <Lane name="P. Shah"   initials="PS" blocks={[{ left: "8%",  width: "18%", color: "#f59e0b", label: "No-Cool Call" }, { left: "50%", width: "34%", color: "#8b5cf6", label: "Maintenance Route" }]} />
        </div>
      </div>

      {/* Revenue dashboard — top left */}
      <div className="absolute -left-4 lg:-left-12 -top-8 w-44 rounded-xl p-3.5 hidden sm:block" style={card()}>
        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Revenue · This Month</p>
        <p className="text-xl font-bold mt-1" style={{ color: INK }}>$248,900</p>
        <div className="mt-2 flex items-end gap-1 h-10">
          {[35, 55, 40, 70, 60, 85, 100].map((h, i) => (
            <span key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 6 ? BRAND : "#e0e7ff" }} />
          ))}
        </div>
        <p className="text-[9px] font-semibold mt-1.5" style={{ color: "#10b981" }}>↑ collected 4.2 days faster</p>
      </div>

      {/* Customer profile — left */}
      <div className="absolute -left-2 lg:-left-16 bottom-14 w-48 rounded-xl p-3.5 hidden md:block" style={card()}>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: "#e5e0db", color: "#5c5545" }}>MC</span>
          <div>
            <p className="text-[11px] font-bold" style={{ color: INK }}>Meridian Clinic</p>
            <p className="text-[9px] flex items-center gap-1" style={{ color: BODY }}><Phone className="w-2.5 h-2.5" /> (706) 555-0142</p>
          </div>
        </div>
        <div className="mt-2.5 space-y-1">
          <p className="text-[9px] flex items-center gap-1.5" style={{ color: BODY }}><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Maintenance agreement · active</p>
          <p className="text-[9px] flex items-center gap-1.5" style={{ color: BODY }}><CreditCard className="w-3 h-3 text-indigo-400" /> $0 balance · autopay on file</p>
          <p className="text-[9px] flex items-center gap-1.5" style={{ color: BODY }}><MapPin className="w-3 h-3 text-slate-400" /> 3 locations · 11 units tracked</p>
        </div>
      </div>

      {/* Riq suggestion panel — right */}
      <div className="absolute -right-3 lg:-right-14 -top-10 w-60 rounded-xl p-3.5 hidden sm:block" style={card({ border: "1px solid #ddd6fe" })}>
        <p className="text-[10px] font-bold flex items-center gap-1.5" style={{ color: "#6d28d9" }}>
          <Sparkles className="w-3 h-3" /> Riq
        </p>
        <div className="mt-2 space-y-1.5">
          {[
            "This job is missing before photos.",
            "Open estimate from 14 days ago — draft a follow-up?",
            "P. Shah is running ~20 min behind on route.",
          ].map((t, i) => (
            <p key={i} className="text-[10px] leading-snug rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "#f5f3ff", color: "#4c1d95" }}>{t}</p>
          ))}
        </div>
      </div>

      {/* Job card — bottom right of frame */}
      <div className="absolute right-6 lg:right-2 -bottom-8 w-52 rounded-xl p-3.5 hidden md:block" style={card()}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold" style={{ color: INK }}>Rooftop Unit Replacement</p>
        </div>
        <p className="text-[9px] mt-0.5" style={{ color: BODY }}>Job #2041 · Meridian Clinic</p>
        <div className="mt-2 h-1.5 rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
          <div className="h-full rounded-full" style={{ width: "72%", backgroundColor: "#10b981" }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[9px]" style={{ color: BODY }}>
          <span>8 of 11 checklist</span>
          <span className="font-semibold" style={{ color: "#10b981" }}>On schedule</span>
        </div>
      </div>

      {/* Mobile technician preview — far right */}
      <div className="absolute -right-2 lg:-right-20 bottom-6 w-36 rounded-[1.4rem] p-2.5 hidden lg:block" style={card({ borderRadius: "1.4rem" })}>
        <div className="rounded-[1rem] px-2.5 py-3" style={{ backgroundColor: "#0f172a" }}>
          <p className="text-[8px] font-semibold text-slate-400">NEXT VISIT · 1:00 PM</p>
          <p className="text-[10px] font-bold text-white mt-0.5">No-Cool Service Call</p>
          <p className="text-[8px] text-slate-400 mt-0.5">1284 Broad St · Augusta</p>
          <div className="mt-2 flex gap-1">
            <span className="flex-1 text-center text-[8px] font-semibold py-1 rounded-md text-white" style={{ backgroundColor: BRAND }}>En Route</span>
            <span className="w-6 flex items-center justify-center rounded-md" style={{ backgroundColor: "#1e293b" }}><Camera className="w-2.5 h-2.5 text-slate-300" /></span>
          </div>
        </div>
      </div>
    </div>
  );
}
