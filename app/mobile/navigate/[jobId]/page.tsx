"use client";

// ─── Mobile Navigation Mode ───────────────────────────────
// Full-screen, low-distraction turn-by-turn for technicians. Route is computed
// server-side (/api/routes/compute); location comes from the device. Structured
// so a native nav layer can later replace the map + guidance while reusing the
// same engine/session/route contracts. Falls back gracefully without a maps key.

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowUp, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, RotateCcw, Flag,
  LocateFixed, Volume2, VolumeX, X, ExternalLink, Phone, MessageSquare, ChevronRight, ChevronUp, Navigation, Loader2, Gauge,
} from "lucide-react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { getJob } from "@/lib/jobs/data";
import { getCustomer } from "@/lib/customers/data";
import { prettyType } from "@/components/mobile/ui";
import { getCurrentTech, setMyJobStatus } from "@/lib/mobile/data";
import { computeRoute } from "@/lib/navigation/client";
import { decodePolyline, fmtDistance, fmtDuration, fmtClock, pointAlong } from "@/lib/navigation/geo";
import { advanceStep, distanceToNextTurn, remaining, isArrived, isOffRoute } from "@/lib/navigation/engine";
import { startSession, updateSession, endSession } from "@/lib/navigation/session";
import { useWatchPosition, type Fix } from "@/lib/navigation/useGeolocation";
import { useDeviceHeading } from "@/lib/navigation/useDeviceHeading";
import type { RouteData, LatLng, Maneuver } from "@/lib/navigation/types";

// Shortest signed angular delta from→to in degrees (−180..180), and an eased
// rotate toward a target along the short way (keeps the puck from spinning).
const shortestDelta = (from: number, to: number) => ((to - from + 540) % 360) - 180;
const lerpAngle = (from: number, to: number, t: number) => from + shortestDelta(from, to) * t;

const MANEUVER_ICON: Record<Maneuver, React.ElementType> = {
  depart: ArrowUp, straight: ArrowUp, merge: ArrowUp,
  "turn-left": CornerUpLeft, "turn-right": CornerUpRight,
  "turn-slight-left": ArrowUpLeft, "turn-slight-right": ArrowUpRight,
  "turn-sharp-left": CornerUpLeft, "turn-sharp-right": CornerUpRight,
  "ramp-left": ArrowUpLeft, "ramp-right": ArrowUpRight,
  "fork-left": ArrowUpLeft, "fork-right": ArrowUpRight,
  uturn: RotateCcw, roundabout: RotateCcw, arrive: Flag,
};

function geocode(address: string): Promise<LatLng | null> {
  return new Promise(res => {
    if (typeof google === "undefined") return res(null);
    new google.maps.Geocoder().geocode({ address }, (r, status) => {
      if (status === "OK" && r?.[0]) res({ lat: r[0].geometry.location.lat(), lng: r[0].geometry.location.lng() });
      else res(null);
    });
  });
}

export default function NavigatePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const { loaded, unavailable } = useGoogleMaps();

  const job = useMemo(() => getJob(jobId), [jobId]);
  const customer = useMemo(() => (job ? getCustomer(job.accountId) : undefined), [job]);
  const tech = useMemo(() => getCurrentTech(), []);

  const [route, setRoute] = useState<RouteData | null>(null);
  const [dest, setDest] = useState<LatLng | null>(null);
  const [phase, setPhase] = useState<"loading" | "navigating" | "arrived" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");
  const [retryTick, setRetryTick] = useState(0);   // bump to re-attempt start after a GPS denial
  // Bottom sheet — interactive drag. `detailH` is the measured height of the
  // expandable detail; `dragH` is the live height while a finger is dragging
  // (null when resting). The detail's height follows the finger, then snaps.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dragH, setDragH] = useState<number | null>(null);
  const [detailH, setDetailH] = useState(0);
  const detailWrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; base: number } | null>(null);
  const draggedRef = useRef(false);

  const onSheetTouchStart = (e: React.TouchEvent) => {
    dragRef.current = { startY: e.touches[0].clientY, base: sheetOpen ? detailH : 0 };
    draggedRef.current = false;
  };
  const onSheetTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const dy = dragRef.current.startY - e.touches[0].clientY;   // up = positive = taller
    if (Math.abs(dy) > 6) draggedRef.current = true;
    setDragH(Math.max(0, Math.min(detailH, dragRef.current.base + dy)));
  };
  const onSheetTouchEnd = () => {
    if (dragRef.current && draggedRef.current) {
      const h = dragH ?? (sheetOpen ? detailH : 0);
      setSheetOpen(h > detailH * 0.4);   // past 40% open → settle open
    }
    dragRef.current = null;
    setDragH(null);
  };
  // Tap (no meaningful drag) toggles; a drag must not also fire the tap toggle.
  const toggleSheet = () => { if (draggedRef.current) { draggedRef.current = false; return; } setSheetOpen(o => !o); };
  // Measure the expandable detail so the drag knows how far "open" is. scrollHeight
  // (not offsetHeight) so the inner's top margin is included — otherwise the
  // overflow-hidden wrapper clips the bottom row of buttons.
  useEffect(() => {
    const h = detailWrapRef.current?.scrollHeight;
    if (h) setDetailH(h);
  }, [phase, job, customer]);
  const [stepIndex, setStepIndex] = useState(0);
  const [remain, setRemain] = useState({ distance: 0, duration: 0 });
  const [eta, setEta] = useState("");
  const [turnDist, setTurnDist] = useState(0);
  const [muted, setMuted] = useState(false);
  const [following, setFollowing] = useState(true);
  const [simulating, setSimulating] = useState(false);   // dev: drive the route without real GPS
  const [simPos, setSimPos] = useState<Fix | null>(null);

  const routePath = useMemo(() => (route ? decodePolyline(route.polyline) : []), [route]);
  const startedRef = useRef(false);
  const lastWriteRef = useRef(0);
  const offSinceRef = useRef<number | null>(null);

  // ── Init: origin → destination → route → session → status "On the way" ──
  useEffect(() => {
    if (startedRef.current || (!loaded && !unavailable) || !job) return;
    startedRef.current = true;
    (async () => {
      try {
        const origin = await getOrigin();
        let destination: LatLng | null = null;
        if (loaded && job.propertyAddress) destination = await geocode(job.propertyAddress);
        if (!destination) destination = { lat: origin.lat + 0.028, lng: origin.lng + 0.032 }; // mock fallback
        setDest(destination);
        const data = await computeRoute({ origin, destination, jobId, technicianId: tech?.id });
        setRoute(data); setEta(data.etaIso); setRemain({ distance: data.distanceMeters, duration: data.durationInTrafficSeconds ?? data.durationSeconds });
        startSession({ technicianId: tech?.id ?? "me", jobId, origin, destination, destinationAddress: job.propertyAddress, route: data });
        setMyJobStatus(jobId, "en_route");   // office sees "On the way"
        setPhase("navigating");
      } catch (e) {
        setErrMsg(e instanceof Error ? e.message : "Could not start navigation"); setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, unavailable, job, retryTick]);

  // Re-attempt start (e.g. after the user grants location in iOS Settings) without
  // a full page reload.
  const retry = () => { startedRef.current = false; setErrMsg(""); setPhase("loading"); setRetryTick(t => t + 1); };

  // ── Per-fix guidance ──
  const onFix = (fix: Fix) => {
    if (!route || !dest) return;
    const idx = advanceStep(fix, route, stepIndex);
    if (idx !== stepIndex) setStepIndex(idx);
    setTurnDist(distanceToNextTurn(fix, route, idx));
    const rem = remaining(fix, route, idx);
    setRemain(rem);
    const newEta = new Date(Date.now() + rem.duration * 1000).toISOString();
    setEta(newEta);

    // Arrival
    if (isArrived(fix, dest)) { setPhase("arrived"); updateSession({ arrivalDetected: true, lastLat: fix.lat, lastLng: fix.lng, lastLocationAt: new Date().toISOString() }); return; }

    // Off-route → recompute after a short sustained period
    if (isOffRoute(fix, routePath)) {
      offSinceRef.current ??= Date.now();
      if (Date.now() - offSinceRef.current > 6000) {
        offSinceRef.current = null;
        computeRoute({ origin: fix, destination: dest, jobId, technicianId: tech?.id })
          .then(r => { setRoute(r); setStepIndex(0); updateSession({ offRoute: false, routePolyline: r.polyline }); }).catch(() => {});
      }
    } else offSinceRef.current = null;

    // Throttled session write: every 12s or 60m moved.
    const moved = !lastWriteRef.current || Date.now() - lastWriteRef.current > 12000;
    if (moved) {
      lastWriteRef.current = Date.now();
      updateSession({ lastLat: fix.lat, lastLng: fix.lng, lastLocationAt: new Date().toISOString(), distanceRemaining: rem.distance, durationRemaining: rem.duration, eta: newEta, currentStepIndex: idx, offRoute: offSinceRef.current != null });
    }
  };
  // Track continuously (except on a hard error / while simulating) so the marker
  // is live the moment the map appears — and so we can show whether GPS fixes are
  // actually arriving.
  const { position, error: geoErr } = useWatchPosition(phase !== "error" && !simulating, onFix);
  // The effective position: simulated when the dev "Simulate drive" is on.
  const livePos = simulating ? simPos : position;

  // ── Map ──
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const meRef = useRef<google.maps.Marker | null>(null);
  const beamRef = useRef<google.maps.Marker | null>(null);
  const startArrowRef = useRef<google.maps.Marker | null>(null);
  const destRef = useRef<google.maps.Marker | null>(null);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  const idleRef = useRef<number>(0);

  // Smoothing: the latest GPS target vs. the on-screen rendered state. An rAF loop
  // eases rendered→target each frame so the puck glides instead of snapping.
  const targetRef = useRef<{ lat: number; lng: number; heading: number; speed: number } | null>(null);
  const renderRef = useRef<{ lat: number; lng: number; heading: number } | null>(null);
  const beamHeadingRef = useRef(0);
  const followingRef = useRef(following);
  followingRef.current = following;

  // Compass heading (device facing). Active while navigating; permission is asked
  // on first tap below. Read by the animation loop so rotation is real-time.
  const { headingRef: compassRef, granted: compassGranted, request: requestCompass } = useDeviceHeading(phase === "navigating");

  const NAV_ZOOM = 17;
  // Routiqa nav puck: a solid indigo dot (your position) with a translucent
  // directional beam that points where you're heading/facing. Two markers so the
  // beam can rotate while the dot stays put.
  // Technician location puck — Ionicons "navigate-circle-sharp": an indigo disc
  // with a white navigation arrow that rotates to point the heading. The icon's
  // arrow natively points NE (45°), so subtract 45° to align it north-up. The
  // circle + shadow stay static (symmetric); only the arrow rotates.
  const navPuck = (heading: number): google.maps.Icon => {
    const rot = heading - 45;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 512 512"><defs><filter id="rqp" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="0.35"/></filter></defs><circle cx="256" cy="256" r="206" fill="#0f8578" stroke="#ffffff" stroke-width="22" filter="url(#rqp)"/><g transform="rotate(${rot.toFixed(1)} 256 256)"><path d="M248 409V264H103l259-114.11Z" fill="#ffffff"/></g></svg>`;
    return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), scaledSize: new google.maps.Size(38, 38), anchor: new google.maps.Point(19, 19) };
  };
  // The directional "scan": a larger gradient cone that fades from the puck out to
  // its tip (radar-sweep look). Rotation is baked into the SVG so it points the
  // right way; the apex sits on the GPS position.
  const scanCone = (heading: number): google.maps.Icon => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><defs><linearGradient id="rqscan" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0f8578" stop-opacity="0.6"/><stop offset="0.5" stop-color="#239c8d" stop-opacity="0.22"/><stop offset="1" stop-color="#4db3a5" stop-opacity="0"/></linearGradient></defs><g transform="rotate(${heading.toFixed(1)} 48 48)"><path d="M48 48 L25 4 Q48 -4 71 4 Z" fill="url(#rqscan)"/></g></svg>`;
    return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), scaledSize: new google.maps.Size(96, 96), anchor: new google.maps.Point(48, 48) };
  };
  // Init the map ONCE — centered tight on the start at a navigation zoom (no
  // fitBounds, which zoomed out to the whole route and broke the follow feel).
  useEffect(() => {
    if (!loaded || !mapDivRef.current || mapRef.current || !route) return;
    const start = position ?? routePath[0] ?? { lat: 33.47, lng: -82.0 };
    const map = new google.maps.Map(mapDivRef.current, {
      center: start, zoom: NAV_ZOOM, disableDefaultUI: true, gestureHandling: "greedy", clickableIcons: false,
      // Vector map (Map ID) so the user can freely rotate/tilt with a two-finger
      // twist. Falls back to Google's demo vector map for testing; set
      // NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID to a styled Map ID for production.
      mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
      rotateControl: true,
      headingInteractionEnabled: true,
      tiltInteractionEnabled: true,
    } as google.maps.MapOptions);
    mapRef.current = map;
    // Belt-and-suspenders: enable rotate/tilt gestures via the setters too.
    try { map.setHeadingInteractionEnabled?.(true); map.setTiltInteractionEnabled?.(true); } catch { /* older API */ }
    if (dest) {
      // Destination pin — Ionicons "location-sharp", styled premium (charcoal fill,
      // hairline white edge for contrast, soft shadow). The path's tip is at
      // (256,480) in the 512 viewBox, so the marker anchors there.
      const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 512 512"><defs><filter id="rqsh" x="-40%" y="-20%" width="180%" height="170%"><feDropShadow dx="0" dy="16" stdDeviation="22" flood-color="#000" flood-opacity="0.3"/></filter></defs><path d="M256 32C167.67 32 96 96.51 96 176c0 128 160 304 160 304s160-176 160-304c0-79.49-71.67-144-160-144m0 224a64 64 0 1 1 64-64 64.07 64.07 0 0 1-64 64" fill="#111827" stroke="#ffffff" stroke-width="14" stroke-linejoin="round" filter="url(#rqsh)"/></svg>`;
      destRef.current = new google.maps.Marker({
        position: dest, map, zIndex: 2,
        icon: { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(pinSvg), scaledSize: new google.maps.Size(36, 36), anchor: new google.maps.Point(18, 33.75) },
      });
    }
    beamRef.current = new google.maps.Marker({ position: start, map, zIndex: 998, icon: scanCone(0) });
    meRef.current = new google.maps.Marker({ position: start, map, zIndex: 999, icon: navPuck(0) });
    // Any deliberate gesture (pan, rotate, tilt) drops auto-follow so the camera
    // doesn't fight it; follow re-engages after a short idle. followingRef is set
    // directly (not just via state) so the animation loop stops re-centering on the
    // SAME frame the gesture starts — otherwise per-frame setCenter cancels the
    // two-finger rotate before it can begin.
    const dropFollow = () => { followingRef.current = false; setFollowing(false); window.clearTimeout(idleRef.current); idleRef.current = window.setTimeout(() => setFollowing(true), 8000); };
    map.addListener("dragend", dropFollow);
    map.addListener("heading_changed", dropFollow);
    map.addListener("tilt_changed", dropFollow);
    // The moment a second finger lands, pause follow so the rotate/tilt gesture is unobstructed.
    mapDivRef.current?.addEventListener("touchstart", (e) => { if ((e as TouchEvent).touches.length >= 2) dropFollow(); }, { passive: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, route]);

  // Draw / update the route line whenever the route changes (incl. reroutes).
  useEffect(() => {
    if (!mapRef.current || routePath.length === 0) return;
    const path = routePath.map(p => ({ lat: p.lat, lng: p.lng }));
    if (lineRef.current) lineRef.current.setPath(path);
    else lineRef.current = new google.maps.Polyline({ path, strokeColor: "#0f8578", strokeWeight: 8, strokeOpacity: 0.9, map: mapRef.current, zIndex: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePath]);

  // A small arrow at the route START, pointing the initial direction to go. It's a
  // real arrow shape (shaft + head) and SCALES GRADUALLY with zoom — bigger when
  // zoomed in, smaller (but never gone) when zoomed out.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || routePath.length < 2) return;
    const heading = pointAlong(routePath, 12)?.heading ?? 0;
    // Grows the more you zoom in; shrinks gradually (never vanishes) zooming out.
    const sizeForZoom = (z: number) => Math.max(12, Math.min(64, (z - 11) * 5));
    const makeIcon = (): google.maps.Icon => {
      const s = sizeForZoom(map.getZoom() ?? 17);
      const rot = heading - (map.getHeading?.() ?? 0);   // keep aligned to the road when the map rotates
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><g transform="rotate(${rot.toFixed(1)} 14 14)"><path d="M14 23 L14 10" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/><path d="M14 23 L14 10" stroke="#0b1220" stroke-width="2.4" stroke-linecap="round"/><path d="M14 4 L20 13 L14 10.5 L8 13 Z" fill="#0b1220" stroke="#ffffff" stroke-width="1" stroke-linejoin="round"/></g></svg>`;
      return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), scaledSize: new google.maps.Size(s, s), anchor: new google.maps.Point(s / 2, s / 2) };
    };
    const apply = () => startArrowRef.current?.setIcon(makeIcon());
    if (startArrowRef.current) {
      startArrowRef.current.setPosition(routePath[0]);
      startArrowRef.current.setMap(map);
      apply();
    } else {
      startArrowRef.current = new google.maps.Marker({ position: routePath[0], map, zIndex: 6, icon: makeIcon() });
    }
    const zl = map.addListener("zoom_changed", apply);
    const hl = map.addListener("heading_changed", apply);
    return () => { google.maps.event.removeListener(zl); google.maps.event.removeListener(hl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routePath]);


  // New GPS/sim fix → update the animation TARGET (the loop eases toward it).
  useEffect(() => {
    if (!livePos) return;
    const gpsHeading = typeof livePos.heading === "number" && !Number.isNaN(livePos.heading) ? livePos.heading : null;
    targetRef.current = {
      lat: livePos.lat, lng: livePos.lng,
      heading: gpsHeading ?? targetRef.current?.heading ?? 0,
      speed: livePos.speed ?? 0,
    };
    if (!renderRef.current) {                 // first fix → place immediately
      renderRef.current = { lat: livePos.lat, lng: livePos.lng, heading: targetRef.current.heading };
    }
    if (mapRef.current && following && (mapRef.current.getZoom() ?? 0) < 15) mapRef.current.setZoom(NAV_ZOOM);
  }, [livePos, following]);

  // Animation loop: ease the puck position + beam rotation toward the target every
  // frame (smooth glide), pick the facing heading (travel course when moving fast,
  // else the live compass), and keep the camera locked while following.
  useEffect(() => {
    if (!loaded || !route) return;
    let raf = 0;
    const POS_EASE = 0.16, ROT_EASE = 0.22;
    const loop = () => {
      const me = meRef.current, beam = beamRef.current, map = mapRef.current, t = targetRef.current;
      if (me && beam && map && t) {
        const r = renderRef.current ?? { lat: t.lat, lng: t.lng, heading: t.heading };
        r.lat += (t.lat - r.lat) * POS_EASE;
        r.lng += (t.lng - r.lng) * POS_EASE;
        const moving = t.speed > 2.2;                          // ~5mph: trust travel course
        const desired = moving ? t.heading : (compassRef.current ?? t.heading ?? r.heading);
        r.heading = lerpAngle(r.heading, desired, ROT_EASE);
        renderRef.current = r;
        const pos = { lat: r.lat, lng: r.lng };
        me.setPosition(pos);
        beam.setPosition(pos);
        // Compensate for user map rotation so the cone keeps pointing the real
        // direction on screen (marker icons rotate in screen space, not map space).
        const disp = r.heading - (map.getHeading?.() ?? 0);
        if (Math.abs(shortestDelta(beamHeadingRef.current, disp)) > 1.5) {
          beamHeadingRef.current = disp;
          beam.setIcon(scanCone(disp));
          me.setIcon(navPuck(disp));   // the nav arrow points the heading too
        }
        if (followingRef.current) map.setCenter(pos);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, route]);

  // Ask for compass permission on the first tap once navigating (iOS requires a
  // user gesture). Falls back silently to GPS course if denied/unavailable.
  useEffect(() => {
    if (phase !== "navigating" || compassGranted) return;
    const onGesture = () => { void requestCompass(); };
    window.addEventListener("touchend", onGesture, { once: true });
    window.addEventListener("click", onGesture, { once: true });
    return () => { window.removeEventListener("touchend", onGesture); window.removeEventListener("click", onGesture); };
  }, [phase, compassGranted, requestCompass]);

  // Dev: simulate driving the route — feeds synthetic fixes along the polyline at
  // ~driving speed so the camera-follow + turn guidance can be verified without
  // real movement.
  useEffect(() => {
    if (!simulating || routePath.length < 2) return;
    setFollowing(true);
    let meters = 0;
    const METERS_PER_TICK = 70;   // ~63 mph at the 400ms tick — fast enough to see
    const id = window.setInterval(() => {
      meters += METERS_PER_TICK;
      const p = pointAlong(routePath, meters);
      if (!p) { window.clearInterval(id); return; }
      const fix: Fix = { lat: p.point.lat, lng: p.point.lng, heading: p.heading, speed: 28, accuracy: 5, at: Date.now() };
      setSimPos(fix);
      onFix(fix);
    }, 400);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulating, routePath]);

  const step = route?.steps[stepIndex];
  const Icon = step ? MANEUVER_ICON[step.maneuver] : Navigation;
  const mapsHref = dest ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job?.propertyAddress ?? "")}`;

  function stop() { endSession("canceled"); if (job) setMyJobStatus(jobId, "scheduled"); router.back(); }
  function confirmArrival() { endSession("completed"); setMyJobStatus(jobId, "in_progress"); router.replace(`/mobile/jobs/${jobId}`); }

  if (!job) return <div className="min-h-[100dvh] flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>Job not found.</div>;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ backgroundColor: "#0b0b0f" }}>
      {/* Map / placeholder */}
      <div className="absolute inset-0">
        {loaded ? <div ref={mapDivRef} className="w-full h-full" /> : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#11131a", backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{unavailable ? "Map preview unavailable — guidance still active" : "Loading map…"}</p>
          </div>
        )}
      </div>

      {/* Top next-turn banner */}
      {phase !== "error" && (
        <div className="relative z-10 m-3 rounded-2xl p-4 flex items-center gap-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)", backgroundColor: "rgba(20,22,30,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#0f8578" }}><Icon className="w-8 h-8 text-white" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold leading-tight truncate" style={{ color: "#fff" }}>{phase === "arrived" ? "Arriving" : step ? fmtDistance(turnDist || step.distanceMeters) : "—"}</p>
            <p className="text-base leading-snug truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{step?.instruction ?? "Calculating route…"}{step?.streetName ? ` onto ${step.streetName}` : ""}</p>
          </div>
        </div>
      )}

      {/* Live GPS status — tells you if fixes are actually arriving */}
      <div className="relative z-10 mx-3 -mt-1 flex justify-center">
        {(() => {
          const color = simulating ? "#a78bfa" : geoErr ? "#f87171" : livePos ? "#34d399" : "#fbbf24";
          const label = simulating ? "Simulating drive" : geoErr ? `GPS error: ${geoErr}` : livePos ? `Live · ±${Math.round(livePos.accuracy ?? 0)}m${following ? "" : " · tap ⊕ to recenter"}` : "Searching for GPS…";
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: "rgba(20,22,30,0.85)", border: "1px solid rgba(255,255,255,0.12)", color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />{label}
            </span>
          );
        })()}
      </div>

      {/* Right-side controls */}
      <div className="absolute right-3 z-10 flex flex-col gap-2.5" style={{ bottom: "calc(env(safe-area-inset-bottom) + 220px)" }}>
        <Ctrl onClick={() => { window.clearTimeout(idleRef.current); setFollowing(true); if (livePos && mapRef.current) { mapRef.current.panTo(livePos); mapRef.current.setZoom(NAV_ZOOM); } }} active={following}><LocateFixed className="w-5 h-5" /></Ctrl>
        <Ctrl onClick={() => { if (simulating) setSimPos(null); setSimulating(s => !s); }} active={simulating}><Gauge className="w-5 h-5" /></Ctrl>
        <Ctrl onClick={() => setMuted(m => !m)}>{muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</Ctrl>
        <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(20,22,30,0.92)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }}><ExternalLink className="w-5 h-5" /></a>
      </div>

      {/* Bottom sheet — compact (arrival + distance); drag/tap up for full details */}
      <div
        className="mt-auto relative z-10 rounded-t-3xl px-4 pt-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)", backgroundColor: "rgba(18,20,28,0.97)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 -10px 44px rgba(0,0,0,0.55)" }}>
        {phase === "loading" ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}><Loader2 className="w-4 h-4 animate-spin" /> Starting route…</div>
        ) : phase === "error" ? (
          (() => {
            const denied = (errMsg || geoErr || "").toLowerCase().match(/permission|denied/) != null;
            return (
              <div className="py-1">
                <p className="text-sm font-semibold" style={{ color: "#fff" }}>{denied ? "Location access needed" : "Couldn’t start navigation"}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {denied
                    ? "Turn on location for Safari: iOS Settings → Privacy & Security → Location Services → Safari Websites → While Using (Precise on), then tap Try again."
                    : (errMsg || geoErr)}
                </p>
                <button onClick={retry} className="mt-3 w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold" style={{ backgroundColor: "#0f8578", color: "#fff" }}><RotateCcw className="w-4 h-4" /> Try again</button>
                <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="mt-2 w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "#fff" }}><ExternalLink className="w-4 h-4" /> Open in Google Maps</a>
              </div>
            );
          })()
        ) : (
          <div onTouchStart={onSheetTouchStart} onTouchMove={onSheetTouchMove} onTouchEnd={onSheetTouchEnd} style={{ touchAction: "none" }}>
            {/* Grabber — drag or tap */}
            <button onClick={toggleSheet} className="block mx-auto mb-2.5 py-1" aria-label={sheetOpen ? "Collapse" : "Expand"}>
              <span className="block w-9 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.28)" }} />
            </button>

            {/* Compact row: always visible — arrival + distance */}
            <button onClick={toggleSheet} className="w-full flex items-center gap-3 text-left">
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold leading-none" style={{ color: "#34d399" }}>{eta ? fmtClock(eta) : "—"}</p>
                <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>arrival</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold leading-none" style={{ color: "#fff" }}>{fmtDistance(remain.distance)}</p>
                <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{fmtDuration(remain.duration)}</p>
              </div>
              <ChevronUp className="w-5 h-5 shrink-0 transition-transform duration-300" style={{ color: "rgba(255,255,255,0.4)", transform: (dragH ?? (sheetOpen ? detailH : 0)) > detailH * 0.5 ? "rotate(180deg)" : "none" }} />
            </button>

            {/* Expanded detail — height follows the finger while dragging, then
                springs to rest. overflow-hidden clips it as it grows/shrinks. */}
            <div
              ref={detailWrapRef}
              className="overflow-hidden"
              style={{
                height: dragH != null ? dragH : (sheetOpen ? detailH : 0),
                opacity: detailH ? Math.min(1, (dragH != null ? dragH : (sheetOpen ? detailH : 0)) / (detailH * 0.55)) : 0,
                transition: dragH != null ? "none" : "height 0.34s cubic-bezier(0.22,1,0.36,1), opacity 0.34s ease",
              }}
            >
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="rounded-2xl p-3 mb-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Destination</p>
                  <p className="text-sm font-semibold truncate" style={{ color: "#fff" }}>{job.customerName}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>{prettyType(job.type)}</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.75)" }}>{job.propertyAddress ?? "—"}</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Action icon={Phone} label="Call" href={customer?.phone ? `tel:${customer.phone}` : undefined} />
                  <Action icon={MessageSquare} label="Text" href={customer?.phone ? `sms:${customer.phone}` : undefined} />
                  <Action icon={ChevronRight} label="Details" onClick={() => router.push(`/mobile/jobs/${jobId}`)} />
                  <Action icon={X} label="Stop" onClick={stop} danger />
                </div>
              </div>
            </div>

            {/* Arrival CTA always takes priority */}
            {phase === "arrived" && (
              <button onClick={confirmArrival} className="mt-3 w-full py-3.5 rounded-2xl text-base font-bold" style={{ backgroundColor: "#16a34a", color: "#fff" }}>You’ve arrived — Start job</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getOrigin(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new Error("Location unavailable on this device"));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      e => reject(new Error(e.code === e.PERMISSION_DENIED ? "Location permission denied" : "Couldn’t get your location")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
    );
  });
}

function Ctrl({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return <button onClick={onClick} className="w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-transform" style={{ backgroundColor: active ? "#0f8578" : "rgba(20,22,30,0.92)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" }}>{children}</button>;
}
function Action({ icon: Icon, label, href, onClick, danger }: { icon: React.ElementType; label: string; href?: string; onClick?: () => void; danger?: boolean }) {
  const cls = "flex flex-col items-center gap-1 py-2.5 rounded-2xl active:scale-[0.97] transition-transform";
  const style = { backgroundColor: danger ? "rgba(220,38,38,0.18)" : "rgba(255,255,255,0.06)", color: danger ? "#f87171" : "#fff" } as React.CSSProperties;
  const inner = <><Icon className="w-5 h-5" /><span className="text-[11px] font-medium">{label}</span></>;
  return href ? <a href={href} className={cls} style={style}>{inner}</a> : <button onClick={onClick} className={cls} style={style}>{inner}</button>;
}
