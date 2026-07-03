import { Eyebrow, SectionHeading } from "@/components/site/ui";
import { BrowserShot, PhoneShot } from "@/components/site/ProductShot";
import Reveal from "@/components/site/Reveal";
import { Check } from "lucide-react";
import type { ShotKey } from "@/components/site/screenshots";

// ─── Product showcase ─────────────────────────────────────
// Alternating feature sections driven by REAL captures of the running app
// (public/product-screenshots — regenerate with `npm run screenshots:product`).
// Text and frame reveal from opposite sides as each section scrolls in.

interface Item {
  id: string; eyebrow: string; title: string; body: string; bullets: string[];
  shot: ShotKey;
}

const ITEMS: Item[] = [
  {
    id: "crm", eyebrow: "CRM & Jobs", title: "Every customer, job, and dollar in one record",
    body: "Leads, estimates, jobs, photos, agreements, payments, and history — connected to a single customer record the whole team can see.",
    bullets: ["Lead-to-cash in one timeline", "Estimates, jobs, and invoices linked", "Property, equipment, and agreement history"],
    shot: "customers",
  },
  {
    id: "dispatch", eyebrow: "Dispatch & Routing", title: "Schedule the day and route the trucks",
    body: "A live board for drag-and-drop scheduling, a map for routing, and real-time visibility into every job and technician.",
    bullets: ["Drag-and-drop dispatch board", "Live map with jobs, techs, and routes", "Unscheduled queue that never loses work"],
    shot: "dispatchMap",
  },
  {
    id: "communications", eyebrow: "Communications", title: "Every conversation in one command center",
    body: "Calls, texts, and email flow into a single inbox tied to the customer record — with AI drafts ready when a reply is needed.",
    bullets: ["Calls, SMS, and email in one inbox", "AI reply drafts and auto-pilot", "Linked to the job and customer record"],
    shot: "inbox",
  },
  {
    id: "marketing", eyebrow: "Marketing Automation", title: "Follow-ups and campaigns that run themselves",
    body: "Turn CRM data into action: estimate follow-ups, maintenance renewals, review requests, and seasonal campaigns — automated.",
    bullets: ["Always-on automations from live CRM data", "Estimate, renewal, and review sequences", "Email, SMS, and call-task steps"],
    shot: "marketing",
  },
  {
    id: "analytics", eyebrow: "Analytics & Reporting", title: "Build the reports your business runs on",
    body: "Owner dashboards and a report builder over your real operational data — revenue, jobs, technicians, and marketing in one place.",
    bullets: ["Drag-and-drop report builder", "Operational + financial KPIs", "Per-location and per-team breakdowns"],
    shot: "analytics",
  },
];

const BACK_OFFICE: { shot: ShotKey; title: string; body: string }[] = [
  { shot: "documents", title: "Documents & SOPs", body: "Standard work, policies, and training in one library the whole company can find." },
  { shot: "hr", title: "HR & Team", body: "Employees, hiring, onboarding, reviews, and time off — next to the work itself." },
  { shot: "accounting", title: "Accounting & Payments", body: "Invoices, payments, and financial health tied to every job and customer." },
];

export default function ProductShowcase({ withIds = false }: { withIds?: boolean }) {
  return (
    <div>
      {ITEMS.map((item, i) => {
        const flip = i % 2 === 1;
        return (
          <section key={item.id} id={withIds ? item.id : undefined} className={`${i % 2 ? "site-grid-bg" : ""} border-b`} style={{ scrollMarginTop: "5rem" }}>
            <div className="mx-auto max-w-7xl px-5 lg:px-8 py-20 lg:py-24">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                <Reveal direction={flip ? "right" : "left"} className={flip ? "lg:order-2" : ""}>
                  <Eyebrow>{item.eyebrow}</Eyebrow>
                  <h2 className="mt-4 text-3xl lg:text-[2.4rem] font-bold tracking-tight leading-[1.12]" style={{ color: "var(--text-primary)" }}>{item.title}</h2>
                  <p className="mt-4 text-base lg:text-lg leading-relaxed" style={{ color: "var(--text-secondary)" }}>{item.body}</p>
                  <ul className="mt-6 space-y-3">
                    {item.bullets.map(b => (
                      <li key={b} className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "var(--accent-soft-2-bg)" }}><Check className="w-3 h-3" style={{ color: "var(--accent-text-strong)" }} /></span>
                        <span className="text-sm" style={{ color: "var(--text-primary)" }}>{b}</span>
                      </li>
                    ))}
                  </ul>
                </Reveal>
                <Reveal direction="scale" delay={0.1} className={flip ? "lg:order-1" : ""}>
                  <BrowserShot shot={item.shot} />
                </Reveal>
              </div>
            </div>
          </section>
        );
      })}

      {/* Technician mobile — two real phone captures side by side */}
      <section id={withIds ? "mobile" : undefined} className="site-grid-bg border-b" style={{ scrollMarginTop: "5rem" }}>
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-20 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <Reveal direction="left">
              <Eyebrow>Technician Mobile</Eyebrow>
              <h2 className="mt-4 text-3xl lg:text-[2.4rem] font-bold tracking-tight leading-[1.12]" style={{ color: "var(--text-primary)" }}>A field-ready app for the team in the truck</h2>
              <p className="mt-4 text-base lg:text-lg leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Technicians see their day, navigate to the next stop, capture photos and checklists, and close jobs — all from their phone.
              </p>
              <ul className="mt-6 space-y-3">
                {["Today's route with the current job front and center", "Job details, photos, and checklists on site", "Status updates flow straight back to dispatch"].map(b => (
                  <li key={b} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "var(--accent-soft-2-bg)" }}><Check className="w-3 h-3" style={{ color: "var(--accent-text-strong)" }} /></span>
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>{b}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <div className="flex justify-center items-end gap-5">
              <Reveal direction="scale" delay={0.1}><PhoneShot shot="mobileToday" width={240} /></Reveal>
              <Reveal direction="scale" delay={0.25} className="hidden sm:block -mb-8"><PhoneShot shot="mobileJob" width={205} /></Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Back office trio */}
      <section id={withIds ? "back-office" : undefined} className="border-b" style={{ scrollMarginTop: "5rem" }}>
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-20 lg:py-24">
          <SectionHeading
            center eyebrow="The back office"
            title="The rest of the business lives here too"
            sub="Documents, people, and money — run in the same platform as the work, not in three more subscriptions."
          />
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {BACK_OFFICE.map((b, i) => (
              <Reveal key={b.title} delay={i * 0.12}>
                <BrowserShot shot={b.shot} sizes="(min-width: 768px) 26rem, 100vw" />
                <h3 className="mt-5 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{b.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
