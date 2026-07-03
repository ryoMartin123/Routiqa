"use client";

// ─── Scroll-in reveal ─────────────────────────────────────
// Fades/slides children in the first time they enter the viewport. Progressive:
// content starts visible for non-JS visitors — the hiding class is only applied
// once the effect runs, and IntersectionObserver flips it back on scroll-in.

import { useEffect, useRef, useState } from "react";

type Direction = "up" | "left" | "right" | "scale";

const OFFSETS: Record<Direction, { x?: string; y?: string; scale?: string }> = {
  up: { y: "24px" },
  left: { x: "-32px", y: "0px" },
  right: { x: "32px", y: "0px" },
  scale: { y: "16px", scale: "0.965" },
};

export default function Reveal({
  children,
  direction = "up",
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  direction?: Direction;
  delay?: number;          // seconds
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);     // hidden + waiting for scroll-in
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // Already on screen? Show immediately (no pop for above-the-fold content).
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) { setVisible(true); return; }
    setArmed(true);
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const off = OFFSETS[direction];
  return (
    <div
      ref={ref}
      className={`${armed ? "site-io" : ""} ${visible ? "is-visible" : ""} ${className}`}
      style={{
        "--io-x": off.x ?? "0px",
        "--io-y": off.y ?? "0px",
        "--io-scale": off.scale ?? "1",
        "--io-delay": `${delay}s`,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
