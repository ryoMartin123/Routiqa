import { Section, SectionHeading } from "@/components/site/ui";
import Reveal from "@/components/site/Reveal";
import { Workflow, Database, Zap } from "lucide-react";

const POINTS = [
  { icon: Database, title: "One source of truth", body: "Customers, jobs, estimates, payments, and history live in one record — not scattered across tools." },
  { icon: Workflow, title: "Connected workflows", body: "A booked job flows to dispatch, the technician's phone, invoicing, and reporting automatically." },
  { icon: Zap, title: "Operational by default", body: "Strong defaults out of the box, with the depth to customize as the business grows." },
];

// The platform thesis in three numbers (moved here from the hero's spec rail).
const SPECS = [
  { value: "10", label: "connected apps", detail: "CRM to accounting — every surface the business runs on" },
  { value: "1", label: "shared data core", detail: "One customer record across office, field, and back office" },
  { value: "0", label: "integrations to babysit", detail: "Built as one system, not bolted together" },
];

export default function SolutionSection() {
  return (
    <Section className="border-b">
      <Reveal>
        <SectionHeading
          center
          eyebrow="The solution"
          title="One connected platform for the whole operation"
          sub="Routiqa brings every system a service business runs on into a single platform — so the office, the field, and the back office all work from the same data."
        />
      </Reveal>
      {/* 10 / 1 / 0 — the thesis in numbers */}
      <div className="mt-12 grid sm:grid-cols-3 gap-px rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--border-subtle)" }}>
        {SPECS.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.1}>
            <div className="h-full px-6 py-5" style={{ backgroundColor: "var(--bg-surface)" }}>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums site-gradient-text">{s.value}</span>
                <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{s.label}</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{s.detail}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-6 grid md:grid-cols-3 gap-5">
        {POINTS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.12}>
            <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-glow)" }}>
              <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: "var(--accent-soft-bg)" }}><p.icon className="w-5 h-5" style={{ color: "var(--accent-text)" }} /></span>
              <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{p.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
