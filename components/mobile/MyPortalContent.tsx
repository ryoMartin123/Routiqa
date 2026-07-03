"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, GraduationCap, FileText, User, DollarSign, CalendarDays, ChevronRight, HardHat, LayoutGrid, Moon, Sun } from "lucide-react";
import { Card, Section, ACCENT } from "@/components/mobile/ui";
import { getTimecard, getTraining } from "@/lib/mobile/portal";
import { getMobileExperience, setMobileExperience, type MobileExperience } from "@/lib/mobile/data";
import { useTheme } from "@/components/providers/ThemeProvider";

// Shared My Portal body — rendered both on the /mobile/more/portal page and in
// the slide-up sheet opened from the profile icon. `onNavigate` lets the sheet
// close itself when a link is tapped.
export default function MyPortalContent({ onNavigate }: { onNavigate?: () => void }) {
  const tc = useMemo(() => getTimecard(), []);
  const trainingDue = useMemo(() => getTraining().filter(t => t.status !== "complete").length, []);
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  const [exp, setExp] = useState<MobileExperience>("full");
  useEffect(() => { setExp(getMobileExperience()); }, []);
  const target: MobileExperience = exp === "full" ? "field" : "full";
  const switchView = () => { setMobileExperience(target); window.location.href = "/mobile/today"; };

  const LINKS = [
    { icon: Clock, label: "Time Card", sub: `${tc.weekHours.toFixed(1)}h this week`, href: "/mobile/more/timecard", color: "#16a34a" },
    { icon: GraduationCap, label: "Training", sub: `${trainingDue} to finish`, href: "/mobile/more/training", color: "#f59e0b" },
    { icon: FileText, label: "Documents & SOPs", sub: "Handbook, policies", href: "/mobile/more/documents", color: "#2563eb" },
    { icon: User, label: "Profile", sub: "Your details", href: "/mobile/more/profile", color: "#a855f7" },
  ];

  return (
    <div className="px-4 pt-1 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4"><Clock className="w-5 h-5 mb-2" style={{ color: "#16a34a" }} /><p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{tc.weekHours.toFixed(1)}h</p><p className="text-xs" style={{ color: "var(--text-muted)" }}>Hours this week</p></Card>
        <Card className="p-4"><DollarSign className="w-5 h-5 mb-2" style={{ color: ACCENT }} /><p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>Jun 30</p><p className="text-xs" style={{ color: "var(--text-muted)" }}>Next pay date</p></Card>
        <Card className="p-4"><CalendarDays className="w-5 h-5 mb-2" style={{ color: "#0891b2" }} /><p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Mon</p><p className="text-xs" style={{ color: "var(--text-muted)" }}>Next shift 7:30 AM</p></Card>
        <Card className="p-4"><GraduationCap className="w-5 h-5 mb-2" style={{ color: "#f59e0b" }} /><p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{trainingDue}</p><p className="text-xs" style={{ color: "var(--text-muted)" }}>Training due</p></Card>
      </div>

      <Section title="Appearance">
        <Card>
          <button onClick={() => setTheme(dark ? "light" : "dark")} className="w-full flex items-center gap-3 px-4 py-3.5">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: ACCENT + "1a" }}>
              {dark ? <Moon className="w-4 h-4" style={{ color: ACCENT }} /> : <Sun className="w-4 h-4" style={{ color: ACCENT }} />}
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Dark mode</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{dark ? "On" : "Off"}</p>
            </div>
            <span className="w-10 h-6 rounded-full relative shrink-0 transition-colors" style={{ backgroundColor: dark ? ACCENT : "var(--bg-input)" }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: dark ? "18px" : "2px" }} />
            </span>
          </button>
        </Card>
      </Section>

      <Section title="Self-service">
        <Card>
          {LINKS.map((l, i) => (
            <Link key={l.href} href={l.href} onClick={onNavigate} className="flex items-center gap-3 px-4 py-3.5 active:bg-[var(--bg-surface-2)]" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: l.color + "1a" }}><l.icon className="w-4 h-4" style={{ color: l.color }} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{l.label}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{l.sub}</p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            </Link>
          ))}
        </Card>
      </Section>

      {/* Dev: switch mobile experience */}
      <button onClick={switchView} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold active:scale-[0.99] transition-transform" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface-2)" }}>
        {target === "field" ? <><HardHat className="w-4 h-4" /> View as technician (field)</> : <><LayoutGrid className="w-4 h-4" /> Switch to full menu</>}
      </button>
    </div>
  );
}
