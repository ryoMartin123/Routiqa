"use client";

// ─── Product film ─────────────────────────────────────────
// A self-playing ~30s walkthrough of the platform's best moments — built like
// an edit, not a screen recording: eleven scenes over REAL captures, one
// cinematic camera move per scene (zoom/pan on a chosen focal region), hard
// cuts, captions that slide in, a fast three-cut back-office montage, and a
// story-style segmented progress bar. Click to pause/resume. Reduced motion
// gets a still poster. Loops.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import Wordmark from "@/components/site/Wordmark";
import { SHOTS, type ShotKey } from "@/components/site/screenshots";

type Move = "filmZoomIn" | "filmZoomOut" | "filmPanLeft" | "filmPanRight" | "filmPanUp";

interface Scene {
  kind: "title" | "shot" | "outro";
  dur: number;                 // ms on screen
  shot?: ShotKey;
  focus?: { x: number; y: number; zoom: number };   // starting crop (% of image)
  move?: Move;
  caption?: string;
  sub?: string;
}

const SCENES: Scene[] = [
  { kind: "title", dur: 2400, caption: "The service business OS", sub: "One platform · Ten connected apps" },
  { kind: "shot", dur: 3200, shot: "dispatchMap", focus: { x: 58, y: 45, zoom: 1.35 }, move: "filmPanRight", caption: "Route the day on a live map", sub: "Dispatch & Routing" },
  { kind: "shot", dur: 2600, shot: "dispatchBoard", focus: { x: 45, y: 28, zoom: 1.4 }, move: "filmPanLeft", caption: "Drag, drop, dispatched", sub: "Dispatch board" },
  { kind: "shot", dur: 2800, shot: "customers", focus: { x: 30, y: 34, zoom: 1.55 }, move: "filmZoomIn", caption: "Every customer in one record", sub: "CRM" },
  { kind: "shot", dur: 3000, shot: "inbox", focus: { x: 44, y: 36, zoom: 1.6 }, move: "filmZoomIn", caption: "AI answers your customers", sub: "Communications" },
  { kind: "shot", dur: 3000, shot: "marketing", focus: { x: 24, y: 30, zoom: 1.8 }, move: "filmPanUp", caption: "Follow-ups that run themselves", sub: "Marketing automation" },
  { kind: "shot", dur: 2800, shot: "analytics", focus: { x: 22, y: 30, zoom: 1.6 }, move: "filmZoomIn", caption: "Reports on live data", sub: "Analytics" },
  { kind: "shot", dur: 2800, shot: "mobileToday", focus: { x: 50, y: 20, zoom: 1.05 }, move: "filmZoomOut", caption: "The field runs on its phone", sub: "Technician mobile" },
  { kind: "shot", dur: 1400, shot: "documents", focus: { x: 30, y: 42, zoom: 1.7 }, move: "filmZoomIn", caption: "SOPs" },
  { kind: "shot", dur: 1400, shot: "accounting", focus: { x: 35, y: 18, zoom: 1.8 }, move: "filmZoomIn", caption: "Payments" },
  { kind: "shot", dur: 1400, shot: "hr", focus: { x: 35, y: 18, zoom: 1.8 }, move: "filmZoomIn", caption: "People" },
  { kind: "outro", dur: 2800, caption: "One platform. Ten connected apps.", sub: "Routiqa" },
];

export default function ProductFilm() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const remaining = useRef(SCENES[0].dur);   // ms left in the current scene (survives pause)
  const startedAt = useRef(0);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => { remaining.current = SCENES[index].dur; }, [index]);

  useEffect(() => {
    if (paused || reduced) return;
    startedAt.current = Date.now();
    const t = setTimeout(() => setIndex(i => (i + 1) % SCENES.length), remaining.current);
    return () => {
      clearTimeout(t);
      remaining.current = Math.max(200, remaining.current - (Date.now() - startedAt.current));
    };
  }, [index, paused, reduced]);

  const scene = SCENES[index];

  // Reduced motion: a still poster frame.
  if (reduced) {
    const s = SHOTS.dispatchMap;
    return (
      <FilmFrame>
        <Image src={s.src} alt={s.alt} fill sizes="40rem" className="object-cover object-top" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.65) 100%)" }} />
        <div className="absolute left-4 bottom-4">
          <p className="text-lg font-bold text-white">The service business OS</p>
          <p className="text-xs text-white/70">One platform · Ten connected apps</p>
        </div>
      </FilmFrame>
    );
  }

  return (
    <FilmFrame paused={paused} onToggle={() => setPaused(p => !p)}>
      {/* Scene (keyed remount restarts its camera move + caption) */}
      <div key={index} className="site-film-cut absolute inset-0 overflow-hidden">
        {scene.kind === "shot" && scene.shot ? (
          <>
            <div className="site-film-move absolute inset-0" style={{ animationName: scene.move, animationDuration: `${scene.dur + 500}ms` }}>
              <Image
                src={SHOTS[scene.shot].src} alt={SHOTS[scene.shot].alt} fill sizes="40rem"
                className="object-cover" priority={index <= 1}
                style={scene.focus ? {
                  objectPosition: `${scene.focus.x}% ${scene.focus.y}%`,
                  transform: `scale(${scene.focus.zoom})`,
                  transformOrigin: `${scene.focus.x}% ${scene.focus.y}%`,
                } : undefined} />
            </div>
            {/* cinematic grade: soft vignette + bottom gradient for the caption */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, transparent 30%, transparent 55%, rgba(0,0,0,0.6) 100%)" }} />
          </>
        ) : (
          /* title / outro card */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6 site-hero-bg">
            <span className="site-film-caption"><Wordmark markSize={scene.kind === "title" ? 30 : 24} /></span>
            <p className="site-film-caption text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)", animationDelay: "0.2s" }}>{scene.caption}</p>
            {scene.sub && <p className="site-film-caption text-xs" style={{ color: "var(--text-secondary)", animationDelay: "0.32s" }}>{scene.sub}</p>}
          </div>
        )}

        {/* caption */}
        {scene.kind === "shot" && (
          <div className="site-film-caption absolute left-4 bottom-6">
            {scene.sub && <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">{scene.sub}</p>}
            <p className="text-base sm:text-lg font-bold text-white leading-tight" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>{scene.caption}</p>
          </div>
        )}
      </div>

      {/* story progress: one segment per scene, active one fills over its duration */}
      <div className="absolute left-3 right-3 top-3 z-10 flex gap-1">
        {SCENES.map((s, i) => (
          <span key={i} className="h-[3px] flex-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.22)" }}>
            {i < index && <span className="block h-full w-full" style={{ backgroundColor: "#fff" }} />}
            {i === index && <span key={index} className="site-film-progress block h-full" style={{ backgroundColor: "#fff", animationDuration: `${s.dur}ms` }} />}
          </span>
        ))}
      </div>
    </FilmFrame>
  );
}

// The player shell: 16:9, rounded, dark, click to pause/resume.
function FilmFrame({ children, paused, onToggle }: { children: React.ReactNode; paused?: boolean; onToggle?: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-label={paused ? "Play walkthrough" : "Pause walkthrough"}
      className={`group relative block w-full overflow-hidden rounded-2xl text-left ${paused ? "site-film-paused" : ""}`}
      style={{ aspectRatio: "16 / 9", backgroundColor: "#0a0a0f", border: "1px solid var(--border)", boxShadow: "0 30px 80px -24px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)", cursor: onToggle ? "pointer" : "default" }}>
      {children}
      {onToggle && (
        <span className={`absolute right-3 bottom-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-opacity ${paused ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.18)" }}>
          {paused ? <Play className="w-3.5 h-3.5 text-white" /> : <Pause className="w-3.5 h-3.5 text-white" />}
        </span>
      )}
    </button>
  );
}
