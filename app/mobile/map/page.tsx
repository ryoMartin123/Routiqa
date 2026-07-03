"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Navigation, X, ChevronRight } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { getCurrentTech } from "@/lib/mobile/data";
import { getMapJobs, getMapTechnicians, buildRoute, geocodeJobAddresses } from "@/lib/dispatch-map/data";
import { prettyType, ACCENT } from "@/components/mobile/ui";
import { todayYMD } from "@/lib/utils/schedule";

const GoogleMapView = dynamic(() => import("@/components/map/GoogleMapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>Loading map…</div>,
});

export default function MobileMapPage() {
  const { loaded } = useGoogleMaps();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selId, setSelId] = useState<string | null>(null);

  const me = useMemo(() => getCurrentTech(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey re-reads as geocoding resolves
  const allJobs = useMemo(() => getMapJobs(), [refreshKey]);
  const today = todayYMD();
  const myJobs = useMemo(() => allJobs.filter(j => j.assignedTo === me?.fullName && j.scheduledDate === today), [allJobs, me, today]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey re-anchors as geocoding resolves
  const myTech = useMemo(() => getMapTechnicians().find(t => t.name === me?.fullName), [me, refreshKey]);
  const route = useMemo(() => (myTech ? buildRoute(myTech, allJobs) : null), [myTech, allJobs]);
  const sel = selId ? myJobs.find(j => j.id === selId) : undefined;

  useEffect(() => {
    if (loaded && myJobs.length) geocodeJobAddresses(myJobs, () => setRefreshKey(k => k + 1));
  }, [loaded, myJobs]);

  return (
    <div>
      <MobileHeader title="My Route" subtitle={`${myJobs.length} stop${myJobs.length === 1 ? "" : "s"} today`} />
      <div className="relative mx-4 rounded-2xl overflow-hidden" style={{ height: "calc(100dvh - 9rem)", minHeight: 380, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
        <GoogleMapView jobs={myJobs} techs={myTech ? [myTech] : []} route={route} selectedJobId={selId}
          onSelectJob={setSelId} flyTo={sel ? { lat: sel.lat, lng: sel.lng } : (myTech?.current ?? null)} showTechs cluster={false} />

        {/* Selected job → bottom sheet card */}
        {sel && (
          <div className="absolute left-3 right-3 bottom-3 rounded-2xl p-3.5" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.22)" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>{sel.customerName}</p>
                <p className="text-sm truncate" style={{ color: "var(--text-muted)" }}>{sel.scheduledTime} · {prettyType(sel.type)}</p>
              </div>
              <button onClick={() => setSelId(null)} className="p-1 -mr-1 rounded-full active:bg-[var(--bg-surface-2)]"><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${sel.lat},${sel.lng}`} target="_blank" rel="noreferrer"
                className="min-h-[46px] rounded-xl flex items-center justify-center gap-2 text-sm font-semibold active:scale-[0.99] transition-transform" style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <Navigation className="w-4 h-4" /> Directions
              </a>
              <Link href={`/mobile/jobs/${sel.id}`} className="min-h-[46px] rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-white active:scale-[0.99] transition-transform" style={{ backgroundColor: ACCENT }}>
                Open job <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
