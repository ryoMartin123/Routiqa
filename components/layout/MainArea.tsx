"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import TopBar from "@/components/layout/TopBar";

// Wraps the top bar + page content and lets the user hide the top bar
// (search, location selector, notifications, Create) to reclaim vertical space.
// The preference is persisted per browser.
export default function MainArea({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    try { if (localStorage.getItem("crm-topbar-hidden") === "1") setShow(false); } catch { /* ignore */ }
  }, []);

  function toggle(next: boolean) {
    setShow(next);
    try { localStorage.setItem("crm-topbar-hidden", next ? "0" : "1"); } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {show ? (
        <TopBar onHide={() => toggle(false)} />
      ) : (
        <button
          onClick={() => toggle(true)}
          title="Show search & location bar"
          className="flex items-center justify-center gap-1.5 py-1 text-xs transition-colors hover:bg-[var(--bg-surface-2)]"
          style={{ backgroundColor: "var(--topbar-bg)", borderBottom: "1px solid var(--topbar-border)", color: "var(--text-muted)" }}
        >
          <ChevronDown className="w-3.5 h-3.5" /> Show search &amp; location bar
        </button>
      )}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
