"use client";

// ─── Dev-only device preview ──────────────────────────────
// Renders the real /mobile routes inside an iPhone frame via an iframe, so the
// field PWA can be eyeballed on desktop at true phone width. Standalone route
// (no dashboard/mobile chrome). Not linked in nav — visit /mobile-preview.

import { useEffect, useRef, useState } from "react";
import { RotateCw, ExternalLink, Home, Briefcase, Map, MessageSquare, Menu } from "lucide-react";

const ACCENT = "#0f8578";

const DEVICES = [
  { id: "ip15", name: "iPhone 15", w: 393, h: 852 },
  { id: "ip15max", name: "15 Pro Max", w: 430, h: 932 },
  { id: "ipse", name: "iPhone SE", w: 375, h: 667 },
] as const;

const SCREENS = [
  { path: "/mobile/today", label: "Today", icon: Home },
  { path: "/mobile/jobs", label: "Jobs", icon: Briefcase },
  { path: "/mobile/map", label: "Map", icon: Map },
  { path: "/mobile/messages", label: "Messages", icon: MessageSquare },
  { path: "/mobile/more", label: "More", icon: Menu },
] as const;

export default function MobilePreviewPage() {
  const [device, setDevice] = useState<(typeof DEVICES)[number]>(DEVICES[0]);
  const [path, setPath] = useState<string>(SCREENS[0].path);
  const [reloadKey, setReloadKey] = useState(0);
  const [scale, setScale] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);

  // Auto-fit the device to the available stage height.
  useEffect(() => {
    const fit = () => {
      const avail = (stageRef.current?.clientHeight ?? window.innerHeight) - 48;
      setScale(Math.min(1, avail / (device.h + 28)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [device]);

  return (
    <div className="h-[100dvh] flex flex-col" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap shrink-0" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Routiqa Mobile</span>
        <span className="text-[11px] px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: ACCENT + "22", color: ACCENT }}>DEV PREVIEW</span>

        {/* Screen switcher */}
        <div className="flex items-center rounded-lg overflow-hidden ml-2" style={{ border: "1px solid var(--border)" }}>
          {SCREENS.map(s => {
            const on = path === s.path;
            return (
              <button key={s.path} onClick={() => setPath(s.path)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors"
                style={{ backgroundColor: on ? ACCENT : "var(--bg-surface)", color: on ? "#fff" : "var(--text-secondary)" }}>
                <s.icon className="w-3.5 h-3.5" /> {s.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <select value={device.id} onChange={e => setDevice(DEVICES.find(d => d.id === e.target.value)!)}
            className="text-xs rounded-lg px-2 py-1.5 outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}>
            {DEVICES.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={() => setReloadKey(k => k + 1)} title="Reload" className="p-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><RotateCw className="w-4 h-4" /></button>
          <a href={path} target="_blank" rel="noreferrer" title="Open in new tab" className="p-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}><ExternalLink className="w-4 h-4" /></a>
        </div>
      </div>

      {/* Stage */}
      <div ref={stageRef} className="flex-1 flex items-center justify-center overflow-hidden"
        style={{ background: "radial-gradient(circle at 50% 30%, var(--bg-surface-2), var(--bg-page))" }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
          {/* Device body */}
          <div className="relative" style={{ width: device.w + 24, height: device.h + 24, borderRadius: 64, backgroundColor: "#0a0a0a", padding: 12, boxShadow: "0 40px 80px -20px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.04) inset" }}>
            {/* Side buttons */}
            <span className="absolute -left-[3px] top-[120px] w-[3px] h-9 rounded-l" style={{ backgroundColor: "#1c1c1c" }} />
            <span className="absolute -left-[3px] top-[168px] w-[3px] h-14 rounded-l" style={{ backgroundColor: "#1c1c1c" }} />
            <span className="absolute -right-[3px] top-[150px] w-[3px] h-16 rounded-r" style={{ backgroundColor: "#1c1c1c" }} />
            {/* Screen */}
            <div className="relative overflow-hidden bg-black" style={{ width: device.w, height: device.h, borderRadius: 52 }}>
              <iframe key={`${device.id}-${reloadKey}`} src={path} title="Routiqa Mobile"
                style={{ width: device.w, height: device.h, border: 0, display: "block" }} />
              {/* Dynamic island (cosmetic, doesn't block taps) */}
              {device.id !== "ipse" && (
                <div className="absolute left-1/2 -translate-x-1/2 top-2 rounded-full pointer-events-none" style={{ width: 112, height: 30, backgroundColor: "#000" }} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
