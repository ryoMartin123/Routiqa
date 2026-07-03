"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Card, Section, ACCENT } from "@/components/mobile/ui";
import { getClockState, toggleClock } from "@/lib/mobile/data";
import { getTimecard } from "@/lib/mobile/portal";

export default function TimeCardPage() {
  const [clock, setClock] = useState<{ in: boolean }>({ in: false });
  useEffect(() => { setClock(getClockState()); }, []);
  const tc = getTimecard();

  return (
    <div>
      <MobileHeader title="Time Card" back />
      <div className="px-4 space-y-5">
        <button onClick={() => setClock(toggleClock())} className="w-full rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
          style={{ border: `1px solid ${clock.in ? "#16a34a55" : "var(--border-subtle)"}`, backgroundColor: clock.in ? "#16a34a14" : "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
          <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: (clock.in ? "#16a34a" : ACCENT) + "1a" }}><Clock className="w-5 h-5" style={{ color: clock.in ? "#16a34a" : ACCENT }} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{clock.in ? "Clocked in" : "Clocked out"}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{clock.in ? "Tap to clock out" : "Tap to clock in"}</p>
          </div>
          <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: clock.in ? "#16a34a22" : "var(--bg-surface-2)", color: clock.in ? "#16a34a" : "var(--text-muted)" }}>{clock.in ? "On the clock" : "Off"}</span>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4"><p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Hours this week</p><p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: "var(--text-primary)" }}>{tc.weekHours.toFixed(1)}</p></Card>
          <Card className="p-4"><p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Days worked</p><p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: "var(--text-primary)" }}>{tc.daysWorked}</p></Card>
        </div>

        <Section title="This week">
          <Card>
            {tc.entries.map((e, i) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                <div className="w-10 text-center shrink-0">
                  <p className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>{e.label}</p>
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{e.date}</p>
                </div>
                <p className="text-sm flex-1" style={{ color: "var(--text-secondary)" }}>{e.in} – {e.out}</p>
                <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{e.hours.toFixed(1)}h</p>
              </div>
            ))}
          </Card>
        </Section>
      </div>
    </div>
  );
}
