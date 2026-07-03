import { Section, SectionHeading } from "@/components/site/ui";
import Reveal from "@/components/site/Reveal";
import { Layers, Gauge, Settings2, ShieldCheck } from "lucide-react";

const REASONS = [
  { icon: Layers, title: "Connected, not bolted together", body: "Built as one platform from the ground up — not a CRM with integrations duct-taped on. Your data stays consistent everywhere." },
  { icon: Gauge, title: "Operational, not just record-keeping", body: "Routiqa runs the day: scheduling, routing, the field, payments, and follow-up — not just storing contacts." },
  { icon: Settings2, title: "Strong defaults, deep customization", body: "Start fast with sensible defaults, then tailor pipelines, job stages, forms, and automations as you scale." },
  { icon: ShieldCheck, title: "Built for multi-location operations", body: "Organization, company, location, and territory structure so growing businesses manage every branch cleanly." },
];

export default function WhyRoutiqa() {
  return (
    <Section className="border-b">
      <Reveal>
        <SectionHeading
          eyebrow="Why Routiqa"
          title="A modern, connected platform for service operations"
          sub="Most tools manage a slice of the business. Routiqa is designed to run the whole operation — clearly, reliably, and at the level of polish a serious business expects."
        />
      </Reveal>
      <div className="mt-12 grid sm:grid-cols-2 gap-5">
        {REASONS.map((r, i) => (
          <Reveal key={r.title} delay={(i % 2) * 0.12}>
          <div className="flex gap-4 rounded-2xl p-6 h-full" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft-bg)" }}><r.icon className="w-5 h-5" style={{ color: "var(--accent-text)" }} /></span>
            <div>
              <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{r.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{r.body}</p>
            </div>
          </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
