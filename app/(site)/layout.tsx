import type { Metadata } from "next";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";

// The public marketing site — structurally separate from the logged-in app:
// its own light, premium B2B chrome (announcement bar + mega nav + footer),
// no CRM providers, no app theme dependency.

export const metadata: Metadata = {
  title: "Routiqa — The all-in-one operating platform for service businesses",
  description:
    "Routiqa brings CRM, dispatch, marketing, communication, accounting, HR, projects, reporting, and Riq AI into one connected workspace built for the trades.",
  openGraph: {
    title: "Routiqa — The all-in-one operating platform for service businesses",
    description:
      "One connected platform for CRM, dispatch, marketing, accounting, HR, field operations, and Riq AI.",
    siteName: "Routiqa",
    type: "website",
  },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ scrollBehavior: "smooth" }}>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
