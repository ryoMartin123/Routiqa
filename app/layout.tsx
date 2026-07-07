import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Semi_Condensed } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import JobsHydrator from "@/components/providers/JobsHydrator";
import TechLocationsHydrator from "@/components/providers/TechLocationsHydrator";
import PlusClickEnhancer from "@/components/shared/PlusClickEnhancer";
import "./globals.css";

// Brand type: Barlow for body/UI/buttons (400–600), Barlow Semi Condensed
// (600/700) for headlines, card titles, and big numbers — applied via
// --font-family-display in globals.css.
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
});
const barlowSemi = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow-semi",
});

export const metadata: Metadata = {
  title: "Routiqa",
  description: "All-in-one platform for service businesses — CRM, dispatch, and a field-ready mobile app.",
  applicationName: "Routiqa",
  appleWebApp: { capable: true, title: "Routiqa", statusBarStyle: "black-translucent" },
};

// viewport-fit=cover lets the mobile shell paint into the iPhone safe areas; the
// shell then pads with env(safe-area-inset-*). Theme color follows light/dark.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Font variables live on <html> — the :root font stacks reference them.
  return (
    <html lang="en" className={`${barlow.variable} ${barlowSemi.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply saved theme before hydration to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('crm-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
        {/* One-time wipe of business RECORDS from localStorage (customers, leads,
            jobs, quotes, agreements, projects, campaigns, photos, work orders,
            notes, availability) so the app starts from a clean slate. Runs before any
            module initializes, so in-memory caches start empty too. Guarded by a
            version flag — bump it to wipe again. Configuration is intentionally
            preserved: dispatch boards, hierarchy, roles, users, settings, price
            book, templates, custom fields, dashboards, etc. are NOT touched. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(!localStorage.getItem('crm-records-reset-v3')){['crm-extra-customers','crm-customer-notes','crm-customer-properties','crm-extra-leads','crm-extra-jobs','crm-job-overrides','crm-work-orders','crm-dispatch-converted','crm-availability','crm-extra-projects','crm-project-phases','crm-extra-quotes','crm-extra-invoices','crm-quote-overrides','crm-invoice-overrides','crm-agreements-extra','crm-extra-campaigns','crm-extra-templates','crm-template-overrides','crm-photos-files-v2'].forEach(function(k){localStorage.removeItem(k)});localStorage.setItem('crm-records-reset-v3','1')}}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
        <JobsHydrator />
        <TechLocationsHydrator />
        <PlusClickEnhancer />
      </body>
    </html>
  );
}
