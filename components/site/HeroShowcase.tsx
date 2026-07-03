"use client";

// ─── Hero showcase ────────────────────────────────────────
// The centerpiece of the hero: a browser window cycling through REAL captures
// of the running product (no mockups). Tabs advance automatically with a timed
// progress bar; clicking a tab jumps the reel. Honors prefers-reduced-motion by
// pausing the auto-advance.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  LayoutDashboard, Map, MessagesSquare, Megaphone, BarChart3, type LucideIcon,
} from "lucide-react";
import Wordmark from "@/components/site/Wordmark";
import { SHOTS, type ShotKey } from "@/components/site/screenshots";

const HOLD_MS = 5200;

const SLIDES: { shot: ShotKey; label: string; icon: LucideIcon; note: string }[] = [
  { shot: "dispatchMap", label: "Dispatch", icon: Map, note: "Route the day on a live map" },
  { shot: "dashboard", label: "Dashboard", icon: LayoutDashboard, note: "Revenue and jobs at a glance" },
  { shot: "inbox", label: "Inbox", icon: MessagesSquare, note: "Every conversation, with AI drafts" },
  { shot: "marketing", label: "Marketing", icon: Megaphone, note: "Follow-ups that run themselves" },
  { shot: "analytics", label: "Analytics", icon: BarChart3, note: "Reports built on live data" },
];

export default function HeroShowcase() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (paused) return;
    timer.current = setTimeout(() => setIndex(i => (i + 1) % SLIDES.length), HOLD_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [index, paused]);

  const active = SLIDES[index];

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 40px 100px -30px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-3.5 h-10 border-b" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <span className="hidden sm:inline-flex"><Wordmark markSize={20} /></span>
        <span className="inline-flex sm:hidden w-5 h-5 rounded-md items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: "#4f46e5" }}>R</span>
        <span className="flex gap-1.5 ml-1">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#ef4444" }} />
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#22c55e" }} />
        </span>
        <span className="ml-auto min-w-0 max-w-[58%] sm:max-w-none px-3 h-6 rounded-md text-[10px] sm:text-[11px] flex items-center gap-1.5 truncate" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#22c55e" }} />
          <span className="truncate">{SHOTS[active.shot].route}</span>
        </span>
      </div>

      {/* Module tabs with timed progress on the active one */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b overflow-x-auto" style={{ borderColor: "var(--border-subtle)" }}>
        {SLIDES.map((slide, i) => {
          const Icon = slide.icon;
          const on = i === index;
          return (
            <button
              key={slide.label}
              onClick={() => setIndex(i)}
              className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors overflow-hidden"
              style={on ? { backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text-strong)" } : { color: "var(--text-muted)" }}
            >
              <Icon className="w-3.5 h-3.5" />
              {slide.label}
              {on && !paused && (
                <span
                  key={index}
                  className="site-tab-progress absolute left-0 bottom-0 h-[2px] rounded-full"
                  style={{ backgroundColor: "var(--accent-text)", animationDuration: `${HOLD_MS}ms` }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Real screenshots, crossfaded (all mounted so swaps are instant) */}
      <div className="relative" style={{ aspectRatio: "1440 / 1000", backgroundColor: "var(--bg-page)" }}>
        {SLIDES.map((slide, i) => {
          const s = SHOTS[slide.shot];
          const on = i === index;
          return (
            <div
              key={slide.shot}
              className="absolute inset-0 overflow-hidden transition-opacity duration-700"
              style={{ opacity: on ? 1 : 0 }}
              aria-hidden={!on}
            >
              <Image
                src={s.src} alt={s.alt} width={s.width} height={s.height}
                sizes="(min-width: 1024px) 48rem, 100vw" priority={i === 0}
                className={`w-full h-auto block ${on ? "site-kenburns" : ""}`}
              />
            </div>
          );
        })}

        {/* caption + reel position */}
        <div className="absolute left-3 right-3 bottom-3 z-10 flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#10b981" }} />
            {active.note}
          </div>
          <div className="ml-auto flex gap-1.5">
            {SLIDES.map((_, i) => (
              <span key={i} className="h-1 rounded-full transition-all"
                style={{ width: i === index ? 24 : 7, backgroundColor: i === index ? "#4f46e5" : "var(--border)" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
