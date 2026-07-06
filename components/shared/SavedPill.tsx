"use client";

// ─── Notice host (the SavedPill, grown up) ────────────────
// ONE transient-feedback anchor for the whole app — fixed bottom-right. Green
// "Saved" pills and quiet red error notices share the same spot and the same
// fade rhythm, so the app always talks to the user from one place.
// Mounted ONCE in the dashboard layout; fire from anywhere via pingSaved() /
// pingError(msg).

import { useEffect, useRef, useState } from "react";

const NOTICE_EVENT = "crm:notice";
type NoticeKind = "saved" | "error";
type Notice = { kind: NoticeKind; message?: string };

function ping(kind: NoticeKind, message?: string): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<Notice>(NOTICE_EVENT, { detail: { kind, message } }));
}
// Fire right after persisting a change. Safe to call from anywhere (no-op on server).
// Pass a message for one-off successes ("Account created — …"); default is "Saved".
export function pingSaved(message?: string): void { ping("saved", message); }
// A brief, non-blocking error/rejection notice (e.g. an invalid board drop).
export function pingError(message: string): void { ping("error", message); }

export default function SavedPill() {
  const [notice, setNotice] = useState<Notice | null>(null);  // mounted (during show + fade)
  const [visible, setVisible] = useState(false);              // opacity target
  const hideT = useRef(0);
  const unmountT = useRef(0);

  useEffect(() => {
    const onNotice = (e: Event) => {
      const n = (e as CustomEvent<Notice>).detail;
      window.clearTimeout(hideT.current);
      window.clearTimeout(unmountT.current);
      setNotice(n);
      setVisible(false);
      // Double rAF so the mounted opacity:0 / translateY state paints BEFORE we
      // flip to visible — otherwise it pops in without the transition. Mirrors
      // the fade-out on the way down.
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      // hold (errors and custom messages linger longer — there's text to read),
      // then fade, then unmount
      const hold = n.kind === "error" ? 3200 : n.message ? 2200 : 1400;
      hideT.current = window.setTimeout(() => setVisible(false), hold);
      unmountT.current = window.setTimeout(() => setNotice(null), hold + 350);
    };
    window.addEventListener(NOTICE_EVENT, onNotice);
    return () => {
      window.removeEventListener(NOTICE_EVENT, onNotice);
      window.clearTimeout(hideT.current);
      window.clearTimeout(unmountT.current);
    };
  }, []);

  if (!notice) return null;

  const fade: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(4px)",
    transition: "opacity 300ms ease, transform 300ms ease",
  };

  if (notice.kind === "error") {
    // Charcoal card so the red reads clearly on any page background; no outline.
    return (
      <div role="alert" className="fixed bottom-4 right-4 z-[80] text-xs font-medium px-3.5 py-2 rounded-lg pointer-events-none"
        style={{ backgroundColor: "#1f2430", color: "#fca5a5", boxShadow: "0 8px 24px -8px rgba(0,0,0,0.45)", ...fade }}>
        {notice.message}
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[80] flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full pointer-events-none"
      style={{
        backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)",
        boxShadow: "0 8px 24px -8px rgba(0,0,0,0.35)", color: "#16a34a", ...fade,
      }}>
      <span className="relative flex h-2 w-2">
        {visible && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "#16a34a" }} />}
        <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: "#16a34a" }} />
      </span>
      {notice.message ?? "Saved"}
    </div>
  );
}
