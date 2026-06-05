import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ServiceCRM",
  description: "All-in-one CRM for service businesses",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before hydration to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('crm-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
        {/* One-time purge of seeded demo records from localStorage so the app
            starts empty after the demo-data clear. Guarded by a version flag —
            anything created after this runs is kept. Bump the flag to re-purge. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(!localStorage.getItem('crm-demo-purged-v2')){['crm-extra-customers','crm-extra-jobs','crm-job-overrides','crm-extra-projects','crm-extra-quotes','crm-extra-invoices','crm-quote-overrides','crm-invoice-overrides','crm-agreements-extra','crm-extra-campaigns','crm-photos-files-v2','crm-dispatch-settings'].forEach(function(k){localStorage.removeItem(k)});localStorage.setItem('crm-demo-purged-v2','1')}}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
