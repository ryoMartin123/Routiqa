"use client";

// ─── Ecosystem hero ───────────────────────────────────────
// The hero visual: ten app nodes orbit a central platform window, wired to the
// core with animated connectors. A workflow loop walks the apps in operational
// order — the active node lights up, an energy pulse runs along its connector,
// and the center window morphs to that app's crafted module preview with a
// status caption. Branded composition in the product's design language — not a
// raw screenshot. Click any node to jump; hover pauses; reduced-motion is static.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Wordmark from "@/components/site/Wordmark";
import { ECOSYSTEM_APPS } from "@/components/site/apps";
import { APP_PREVIEWS } from "@/components/site/AppPreviews";
import { SHOTS } from "@/components/site/screenshots";

const HOLD_MS = 3000;

// Node centers (% of the composition) — a ring of 10 around the core at 50/50.
const RING: [number, number][] = [
  [50, 5], [76.5, 14], [93, 36.5], [93, 63.5], [76.5, 86],
  [50, 95], [23.5, 86], [7, 63.5], [7, 36.5], [23.5, 14],
];

export default function EcosystemHero() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (paused || reduced.current) return;
    const t = setTimeout(() => setIndex(i => (i + 1) % ECOSYSTEM_APPS.length), HOLD_MS);
    return () => clearTimeout(t);
  }, [index, paused]);

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* ── lg+: orbital composition ── */}
      <div className="hidden lg:block relative mx-auto max-w-[1120px] h-[660px] site-reveal">
        {/* connectors + orbit ring */}
        <svg className="absolute inset-0 w-full h-full z-0" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <ellipse cx="50" cy="50" rx="43" ry="45" fill="none" stroke="var(--border-subtle)" strokeWidth="0.12" strokeDasharray="0.8 1.6" />
          {RING.map(([x, y], i) => {
            const on = i === index;
            return (
              <g key={i}>
                <line x1="50" y1="50" x2={x} y2={y} stroke="var(--accent-icon)" strokeWidth={on ? 0.28 : 0.14} opacity={on ? 0.85 : 0.3} className={on ? "" : "site-connector"} />
                {on && <line x1="50" y1="50" x2={x} y2={y} stroke="#a5b4fc" strokeWidth="0.4" strokeLinecap="round" className="site-comet" />}
              </g>
            );
          })}
        </svg>

        {/* core glow */}
        <div className="site-stage-glow absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[430px] z-0" />

        {/* app nodes */}
        {ECOSYSTEM_APPS.map((app, i) => {
          const [x, y] = RING[i];
          const on = i === index;
          return (
            <button
              key={app.id}
              onClick={() => setIndex(i)}
              className={`absolute z-20 flex items-center gap-2 pl-2 pr-3.5 py-2 rounded-full text-left whitespace-nowrap transition-all duration-500 ${on ? "site-node-pulse" : ""}`}
              style={{
                left: `${x}%`, top: `${y}%`,
                backgroundColor: "var(--bg-surface)",
                border: `1px solid ${on ? "var(--accent-text)" : "var(--border-subtle)"}`,
                boxShadow: on ? "0 14px 40px -12px rgba(79,70,229,0.45)" : "var(--shadow-card)",
                opacity: on ? 1 : 0.8,
                transform: `translate(-50%, -50%) scale(${on ? 1.08 : 1})`,
              }}
            >
              <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500" style={{ backgroundColor: on ? "#4f46e5" : "var(--accent-soft-bg)" }}>
                <app.icon className="w-3.5 h-3.5" style={{ color: on ? "#fff" : "var(--accent-text)" }} />
              </span>
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{app.short}</span>
            </button>
          );
        })}

        {/* central platform window */}
        <div className="absolute z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[46%]">
          <CoreWindow index={index} />
        </div>
      </div>

      {/* ── < lg: window + app chip grid ── */}
      <div className="lg:hidden site-reveal">
        <div className="mx-auto max-w-md"><CoreWindow index={index} /></div>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {ECOSYSTEM_APPS.map((app, i) => {
            const on = i === index;
            return (
              <button key={app.id} onClick={() => setIndex(i)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all duration-500"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: `1px solid ${on ? "var(--accent-text)" : "var(--border-subtle)"}`,
                  opacity: on ? 1 : 0.75,
                }}
              >
                <app.icon className="w-3.5 h-3.5 shrink-0" style={{ color: on ? "var(--accent-text)" : "var(--text-muted)" }} />
                <span className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{app.short}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// The central "platform" window — one shell, ten crossfading module previews.
function CoreWindow({ index }: { index: number }) {
  const active = ECOSYSTEM_APPS[index];
  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 40px 100px -30px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05)" }}>
      {/* chrome */}
      <div className="flex items-center gap-2 px-3.5 h-10 border-b" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-surface-2)" }}>
        <Wordmark markSize={20} />
        <span className="flex gap-1.5 ml-1">
          {["#ef4444", "#f59e0b", "#22c55e"].map(c => <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />)}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 h-6 rounded-md text-[11px] font-semibold" style={{ backgroundColor: "var(--accent-soft-2-bg)", color: "var(--accent-text-strong)" }}>
          <active.icon className="w-3 h-3" />
          {active.name}
        </span>
      </div>

      {/* module preview (stacked crossfade) */}
      <div className="relative h-52 sm:h-56" style={{ backgroundColor: "var(--bg-page)" }}>
        {ECOSYSTEM_APPS.map((app, i) => {
          const Preview = APP_PREVIEWS[app.id];
          const on = i === index;
          return (
            <div key={app.id} className="absolute inset-0 overflow-hidden transition-all duration-500"
              style={{ opacity: on ? 1 : 0, transform: on ? "scale(1)" : "scale(0.97)", pointerEvents: "none" }} aria-hidden={!on}>
              {app.shot && app.focus ? (
                <>
                  {/* the app's real surface, softened into ambience */}
                  <Image src={SHOTS[app.shot].src} alt="" fill sizes="40rem" aria-hidden
                    className="object-cover object-top"
                    style={{ filter: "blur(4px) saturate(1.1)", opacity: 0.35, transform: "scale(1.08)" }} />
                  <div className="absolute inset-0" style={{ background: "radial-gradient(85% 100% at 50% 45%, transparent 0%, var(--bg-page) 96%)" }} />
                  {/* magnifier lens: the important region of the SAME capture,
                      crisp and enlarged (focal point + zoom from apps.ts) */}
                  <div className="relative h-full flex items-center justify-center p-4 sm:p-5">
                    <div key={String(on)} className="site-build-in relative w-[82%] rounded-xl overflow-hidden"
                      style={{ aspectRatio: "16 / 9.5", border: "1px solid var(--border)", boxShadow: "0 24px 70px -18px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)" }}>
                      <Image src={SHOTS[app.shot].src} alt={SHOTS[app.shot].alt} fill sizes="34rem"
                        className="object-cover"
                        style={{
                          objectPosition: `${app.focus.x}% ${app.focus.y}%`,
                          transform: `scale(${app.focus.zoom})`,
                          transformOrigin: `${app.focus.x}% ${app.focus.y}%`,
                        }} />
                      <span className="absolute left-2.5 bottom-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                        style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 88%, transparent)", backdropFilter: "blur(8px)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}>
                        <app.icon className="w-3 h-3" style={{ color: "var(--accent-text)" }} />
                        {app.focus.label}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                /* no capture (Team Workspace) — crafted module panel */
                <div className="relative h-full p-4 sm:p-5">
                  <div key={String(on)} className="h-full max-w-sm mx-auto"><Preview /></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* workflow caption + position */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-t" style={{ borderColor: "var(--border-subtle)" }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#10b981" }} />
        <span key={active.id} className="site-build-in text-[11px] font-semibold truncate" style={{ color: "var(--text-secondary)" }}>{active.caption}</span>
        <span className="ml-auto flex gap-1 shrink-0">
          {ECOSYSTEM_APPS.map((_, i) => (
            <span key={i} className="h-1 rounded-full transition-all" style={{ width: i === index ? 14 : 4, backgroundColor: i === index ? "#4f46e5" : "var(--border)" }} />
          ))}
        </span>
      </div>
    </div>
  );
}
