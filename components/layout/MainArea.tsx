"use client";

import { useState, useEffect, Suspense } from "react";
import { ChevronDown } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import CommentPinsLayer from "@/components/comments/CommentPinsLayer";

// Wraps the top bar + page content and lets the user hide the top bar
// (search, location selector, notifications, Create) to reclaim vertical space.
// The preference is persisted per browser.
export default function MainArea({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);
  // True only while the bar is mid-fold. We must clip overflow during the
  // animation (so the content folds cleanly) AND while collapsed — but NOT once
  // it's fully open, or the top-bar dropdowns (App switcher, location selector)
  // would be clipped by the wrapper and disappear below the page.
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem("crm-topbar-hidden") === "1") setShow(false); } catch { /* ignore */ }
  }, []);

  function toggle(next: boolean) {
    setShow(next);
    setAnimating(true);
    // Fallback in case transitionend never fires — never leave overflow clipped.
    window.setTimeout(() => setAnimating(false), 360);
    try { localStorage.setItem("crm-topbar-hidden", next ? "0" : "1"); } catch { /* ignore */ }
  }

  // Open + idle ⇒ let dropdowns overflow; otherwise clip while folding/collapsed.
  const clip = !show || animating;

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* The bar collapses/expands with the same easing as the sidebar slide.
          grid-template-rows 1fr⇄0fr animates the height smoothly. */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: show ? "1fr" : "0fr" }}
        onTransitionEnd={(e) => { if (e.propertyName === "grid-template-rows") setAnimating(false); }}
      >
        <div style={{ overflow: clip ? "hidden" : "visible" }}>
          <TopBar onHide={() => toggle(false)} />
        </div>
      </div>
      {/* Reveal strip — always mounted, folded the opposite way to the bar so the
          two animate in lockstep: as the bar collapses the strip expands over the
          same 300ms, with no instant pop in height. */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: show ? "0fr" : "1fr" }}
      >
        <div className="overflow-hidden">
          <button
            onClick={() => toggle(true)}
            title="Show search & location bar"
            tabIndex={show ? -1 : 0}
            className="w-full flex items-center justify-center gap-1.5 py-1 text-xs transition-colors hover:bg-[var(--bg-surface-2)]"
            style={{ backgroundColor: "var(--topbar-bg)", borderBottom: "1px solid var(--topbar-border)", color: "var(--text-muted)" }}
          >
            <ChevronDown className="w-3.5 h-3.5" /> Show search &amp; location bar
          </button>
        </div>
      </div>
      {/* scrollbar-gutter:stable reserves the scrollbar lane so the content width
          never jumps when the bar appears/disappears during a route or skeleton
          swap (the "screen shake"). */}
      <main className="flex-1 overflow-y-auto flex flex-col" style={{ scrollbarGutter: "stable" }}>
        {/* Positioned wrapper so comment pins can anchor to page coordinates and
            scroll with the content. flex-1 gives it a definite height (so full-
            height pages like the inbox fill correctly) while still growing taller
            than the viewport when a page's content overflows. */}
        <div className="relative flex-1" data-comment-region>
          {children}
          <Suspense fallback={null}><CommentPinsLayer /></Suspense>
        </div>
      </main>
    </div>
  );
}
