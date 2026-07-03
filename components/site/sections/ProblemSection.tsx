import { Section, SectionHeading } from "@/components/site/ui";
import Reveal from "@/components/site/Reveal";
import ProblemVisual from "@/components/site/ProblemVisual";

// ─── The problem ──────────────────────────────────────────
// Copy on the left; on the right, an animated composition of disconnected,
// drifting tools with severed links and surfacing operational failures — the
// "before" picture the ecosystem hero answers.

export default function ProblemSection() {
  return (
    <Section className="border-b">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <Reveal direction="left">
          <SectionHeading
            eyebrow="The problem"
            title="Service businesses are forced to run on disconnected tools"
            sub="A CRM here, a dispatch board there, maps in another tab, chat in another app, plus marketing, payments, documents, and spreadsheets holding it all together. Work falls through the gaps, data never lines up, and no one has the full picture."
          />
        </Reveal>
        <Reveal direction="right" delay={0.1}>
          <ProblemVisual />
        </Reveal>
      </div>
    </Section>
  );
}
