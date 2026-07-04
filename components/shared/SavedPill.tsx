"use client";

// ─── SavedPill ────────────────────────────────────────────
// The single auto-save indicator used across the CRM. Mount ONE per editor
// surface (fixed bottom-left, above everything). It's hidden at rest — when
// something persists it calls pingSaved(), the pill slides in as a green
// "Saved", then fades out and unmounts. This replaces manual Save buttons.

import { useEffect, useRef, useState } from "react";

const SAVED_EVENT = "crm:saved";

// Fire right after persisting a change. Safe to call from anywhere (no-op on server).
export function pingSaved(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SAVED_EVENT));
}

export default function SavedPill() {
  const [shown, setShown] = useState(false);   // mounted (during show + fade)
  const [visible, setVisible] = useState(false); // opacity target
  const hideT = useRef(0);
  const unmountT = useRef(0);

  useEffect(() => {
    const onSaved = () => {
      window.clearTimeout(hideT.current);
      window.clearTimeout(unmountT.current);
      setShown(true);
      setVisible(false);
      // Double rAF so the mounted opacity:0 / translateY state paints BEFORE we
      // flip to visible — otherwise it pops in without the transition. Mirrors
      // the fade-out on the way down.
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      // hold, then fade out, then unmount
      hideT.current = window.setTimeout(() => setVisible(false), 1400);
      unmountT.current = window.setTimeout(() => setShown(false), 1750);
    };
    window.addEventListener(SAVED_EVENT, onSaved);
    return () => {
      window.removeEventListener(SAVED_EVENT, onSaved);
      window.clearTimeout(hideT.current);
      window.clearTimeout(unmountT.current);
    };
  }, []);

  if (!shown) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[80] flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full pointer-events-none"
      style={{
        backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)",
        boxShadow: "0 8px 24px -8px rgba(0,0,0,0.35)", color: "#16a34a",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 300ms ease, transform 300ms ease",
      }}>
      <span className="relative flex h-2 w-2">
        {visible && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "#16a34a" }} />}
        <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: "#16a34a" }} />
      </span>
      Saved
    </div>
  );
}
