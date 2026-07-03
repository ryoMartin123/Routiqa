"use client";

// ─── Mobile shell ─────────────────────────────────────────
// Picks the navigation experience by role. Field staff get the floating bottom
// tab bar. Broad-access users get NO hamburger/drawer — their Overview screen is
// the navigation, with a floating search + quick-actions command bar at the
// bottom. "Focused" screens (a single job, active navigation) hide the global
// bar entirely so they can own the bottom with one clear action.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import MobileCommandBar from "./MobileCommandBar";
import LocationReporter from "./LocationReporter";
import { getMobileExperience, type MobileExperience } from "@/lib/mobile/data";
import { getAllJobs } from "@/lib/jobs/data";
import { upsertCustomerStubsFromJobs } from "@/lib/customers/data";
import { useDataVersion } from "@/lib/sync/useDataVersion";

// Single-job / navigation screens are their own command surface — no global bar.
function isFocused(pathname: string) {
  return /^\/mobile\/jobs\/[^/]+$/.test(pathname) || pathname.startsWith("/mobile/navigate");
}

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const [exp, setExp] = useState<MobileExperience>("field");
  useEffect(() => { setExp(getMobileExperience()); }, []);
  const pathname = usePathname();

  // Customers live in localStorage (per-device) but jobs are shared via Supabase,
  // so on this phone a job's customer record is missing → "Customer not found".
  // Reconstruct minimal customer stubs from the shared jobs whenever data changes,
  // so the field app can resolve them. Additive + mobile-only (never overwrites a
  // real customer; runs only under /mobile).
  const rev = useDataVersion();
  useEffect(() => {
    const jobs = getAllJobs();
    if (!jobs.length) return;
    upsertCustomerStubsFromJobs(jobs.map(j => ({
      id: j.accountId, name: j.customerName, initials: j.customerInitials,
      address: j.propertyAddress, companyId: j.companyId, locationId: j.locationId,
      locationName: j.locationName, serviceAreaId: j.serviceAreaId,
    })));
  }, [rev]);

  // Keyed by pathname so each route change replays the fade-rise transition.
  const page = <div key={pathname} className="mobile-page-in">{children}</div>;
  // Reports GPS to the dispatch board while the tech is clocked in (renders nothing).
  const reporter = <LocationReporter />;

  // Focused screen — render children only; the page provides its own bottom action.
  if (isFocused(pathname)) {
    return <div className="mobile-native min-h-[100dvh]" style={{ backgroundColor: "var(--bg-page)" }}>{reporter}{page}</div>;
  }

  if (exp === "full") {
    return (
      <div className="mobile-native min-h-[100dvh] flex flex-col" style={{ backgroundColor: "var(--bg-page)" }}>
        {reporter}
        <main className="flex-1" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 88px)" }}>{page}</main>
        <MobileCommandBar />
      </div>
    );
  }

  // Technician field experience — floating bottom nav.
  return (
    <div className="mobile-native min-h-[100dvh] flex flex-col" style={{ backgroundColor: "var(--bg-page)" }}>
      {reporter}
      <main className="flex-1" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 92px)" }}>{page}</main>
      <BottomNav />
    </div>
  );
}
