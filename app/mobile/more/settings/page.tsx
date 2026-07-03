"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Bell, MessageSquare, CalendarClock } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Card, Section, ACCENT } from "@/components/mobile/ui";

export default function MobileSettingsPage() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.getAttribute("data-theme") === "dark"); }, []);
  const toggleTheme = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("crm-theme", next); } catch { /* ignore */ }
    setDark(!dark);
  };
  const [notif, setNotif] = useState({ jobs: true, messages: true, schedule: false });

  return (
    <div>
      <MobileHeader title="Settings" back />
      <div className="px-4 space-y-5">
        <Section title="Appearance">
          <Card>
            <ToggleRow icon={dark ? Moon : Sun} label="Dark mode" on={dark} onToggle={toggleTheme} />
          </Card>
        </Section>

        <Section title="Notifications">
          <Card>
            <ToggleRow icon={Bell} label="New job alerts" on={notif.jobs} onToggle={() => setNotif(n => ({ ...n, jobs: !n.jobs }))} divider={false} />
            <ToggleRow icon={MessageSquare} label="Messages" on={notif.messages} onToggle={() => setNotif(n => ({ ...n, messages: !n.messages }))} />
            <ToggleRow icon={CalendarClock} label="Schedule changes" on={notif.schedule} onToggle={() => setNotif(n => ({ ...n, schedule: !n.schedule }))} />
          </Card>
        </Section>

        <Section title="About">
          <Card>
            <div className="flex items-center justify-between px-4 py-3.5"><span className="text-sm" style={{ color: "var(--text-primary)" }}>Version</span><span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>1.0.0</span></div>
          </Card>
        </Section>
        <p className="text-center text-xs pt-1" style={{ color: "var(--text-muted)" }}>Routiqa Mobile</p>
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, on, onToggle, divider = true }: { icon: React.ElementType; label: string; on: boolean; onToggle: () => void; divider?: boolean }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5" style={{ borderTop: divider ? "1px solid var(--border)" : "none" }}>
      <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--text-secondary)" }} />
      <span className="text-sm flex-1 text-left" style={{ color: "var(--text-primary)" }}>{label}</span>
      <span className="w-10 h-6 rounded-full relative shrink-0 transition-colors" style={{ backgroundColor: on ? ACCENT : "var(--bg-input)" }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: on ? "18px" : "2px" }} />
      </span>
    </button>
  );
}
