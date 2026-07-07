"use client";

// ─── Dispatch Map / Route Board ───────────────────────────
// Field-ops command center: left = a real dispatch queue (search · quick filters
// · Jobs/Unassigned/Techs · rich rows · summary), center = the hero map with a
// slim overlay + floating layer toggles, right = a contextual inspector (overview
// → job → tech) with an integrated AI insights assistant. Powered by real CRM
// jobs + roster; assignment writes back through the jobs store. AI suggests — the
// dispatcher confirms.

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Search, MapPin, Truck, Sparkles, Phone, Navigation, ExternalLink, AlertTriangle, MessageSquare,
  X, Route as RouteIcon, ListChecks, Users, Layers, Gauge, ChevronDown, ChevronUp, Clock, CheckCircle2,
  Info, Palette, Boxes,
} from "lucide-react";
import { useHierarchy } from "@/components/providers/HierarchyProvider";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { useDataVersion } from "@/lib/sync/useDataVersion";
import { getLiveLocations, relativeTime, getTechTrail, trackStateFor, TRACK_STATE_META } from "@/lib/tech-tracking/data";
import { todayYMD } from "@/lib/utils/schedule";
import {
  getMapJobs, getMapTechnicians, buildRoute, assignJob, computeSuggestions, suggestForJob, suggestForTech, geocodeJobAddresses,
  MARKER_CONFIG, TECH_STATUS_CONFIG,
  type MapJob, type MapTech, type AiSuggestion, type JobMarkerKind,
} from "@/lib/dispatch-map/data";

const ACCENT = "#0f8578"; // CRM indigo
const AMBER = "#f59e0b";

const GoogleMapView = dynamic(() => import("@/components/map/GoogleMapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>Loading map…</div>,
});

export interface MapDateFilter { mode: "today" | "custom"; fromDate: string; toDate: string; fromTime: string; toTime: string }
type Tab = "jobs" | "unassigned" | "techs";
const KINDS = Object.keys(MARKER_CONFIG) as JobMarkerKind[];

const pad2 = (n: number) => String(n).padStart(2, "0");
const ymdOf = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const hmOf = (ts: number) => { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

export default function DispatchMap({ dateFilter }: { dateFilter: MapDateFilter }) {
  const { effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId } = useHierarchy();
  const { loaded: mapsLoaded } = useGoogleMaps();
  const [refreshKey, setRefreshKey] = useState(0);
  const dataRev = useDataVersion();
  const [tab, setTab] = useState<Tab>("jobs");
  const [search, setSearch] = useState("");
  const [selJobId, setSelJobId] = useState<string | null>(null);
  const [selTech, setSelTech] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // Map layer toggles + AI collapse.
  const [showTechs, setShowTechs] = useState(true);
  const [traffic, setTraffic] = useState(false);
  const [cluster, setCluster] = useState(true);
  const [showStatus, setShowStatus] = useState(true);   // top status bar overlay
  const [showLegend, setShowLegend] = useState(true);   // bottom legend
  const [layersOpen, setLayersOpen] = useState(false);  // layer-toggle menu
  const [aiOpen, setAiOpen] = useState(true);
  const [routeMeta, setRouteMeta] = useState<{ durationMin: number; distanceMi: number; live: boolean } | null>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  // The left rail switches between the dispatch Queue and the contextual Details
  // (inspector + AI), so the map can run full-width to the right edge.
  const [panelMode, setPanelMode] = useState<"queue" | "details">("queue");

  const scope = { companyId: effectiveCompanyId, locationId: effectiveLocationId, serviceAreaId: effectiveServiceAreaId };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const jobs = useMemo(() => getMapJobs(scope), [effectiveCompanyId, effectiveLocationId, effectiveServiceAreaId, refreshKey]);
  // Only dispatch-board members for the active scope can be assigned / suggested.
  // refreshKey re-anchors tech positions as job addresses geocode in.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Base roster positions are deterministic mocks; overlay any live GPS fixes so a
  // clocked-in tech's marker tracks their phone. dataRev bumps on every report.
  const baseTechs = useMemo(() => getMapTechnicians(effectiveCompanyId, effectiveLocationId), [effectiveCompanyId, effectiveLocationId, refreshKey]);
  const techs = useMemo(() => {
    const live = getLiveLocations();
    const now = Date.now();
    const baseNames = new Set(baseTechs.map(t => t.name));
    const merged: MapTech[] = baseTechs.map(t => {
      const l = live[t.name];
      const state = trackStateFor(l, now);
      // live/stale/lost all have a real last-known position to show; off keeps the
      // roster's mock spot (gray) so off-duty techs still list cleanly.
      if (l && state !== "off") {
        return { ...t, current: { lat: l.lat, lng: l.lng }, lastCheckIn: relativeTime(l.recordedAt, now), live: state === "live", trackState: state, heading: l.heading, gpsError: l.gpsError };
      }
      return { ...t, live: false, trackState: "off" as const };
    });
    // Surface anyone clocked in (any non-off state) who isn't on the mock board
    // roster — e.g. the org owner — so every active field user shows on the map.
    for (const l of Object.values(live)) {
      if (baseNames.has(l.techName)) continue;
      const state = trackStateFor(l, now);
      if (state === "off") continue;
      if (effectiveCompanyId && l.companyId && l.companyId !== effectiveCompanyId) continue;
      if (effectiveLocationId && l.locationId && l.locationId !== effectiveLocationId) continue;
      const initials = l.techName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
      merged.push({
        name: l.techName, initials, status: "available", skills: [], truck: "—",
        base: { lat: l.lat, lng: l.lng }, current: { lat: l.lat, lng: l.lng },
        lastCheckIn: relativeTime(l.recordedAt, now), live: state === "live", trackState: state, heading: l.heading, gpsError: l.gpsError,
      });
    }
    return merged;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dataRev captures live-location writes
  }, [baseTechs, dataRev, effectiveCompanyId, effectiveLocationId]);
  const suggestions = useMemo(() => computeSuggestions(jobs, techs), [jobs, techs]);

  useEffect(() => {
    if (mapsLoaded && jobs.length) geocodeJobAddresses(jobs, () => setRefreshKey(k => k + 1));
  }, [mapsLoaded, jobs]);

  useEffect(() => {
    if (!layersOpen) return;
    const onDown = (e: MouseEvent) => { if (layersRef.current && !layersRef.current.contains(e.target as Node)) setLayersOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [layersOpen]);

  const inDate = (j: MapJob) => {
    if (j.day == null) return false;
    if (dateFilter.mode === "today") return ymdOf(j.day) === todayYMD();
    const ymd = ymdOf(j.day), hm = hmOf(j.day);
    if (dateFilter.fromDate && ymd < dateFilter.fromDate) return false;
    if (dateFilter.toDate && ymd > dateFilter.toDate) return false;
    if (dateFilter.fromTime && hm < dateFilter.fromTime) return false;
    if (dateFilter.toTime && hm > dateFilter.toTime) return false;
    return true;
  };
  const matchesSearch = (j: MapJob) => !search || (j.customerName + j.title + j.address).toLowerCase().includes(search.toLowerCase());

  const dateJobs = jobs.filter(inDate).filter(matchesSearch);
  const visibleJobs = dateJobs;
  const unassignedJobs = jobs.filter(j => j.kind === "unassigned").filter(matchesSearch);
  const mapJobs = tab === "unassigned" ? unassignedJobs : visibleJobs;

  const selJob = selJobId ? jobs.find(j => j.id === selJobId) ?? null : null;
  const selTechObj = selTech ? techs.find(t => t.name === selTech) ?? null : null;
  const selRoute = selTechObj ? buildRoute(selTechObj, jobs) : null;
  const flyTo = selJob ? { lat: selJob.lat, lng: selJob.lng } : (selTechObj?.current ?? null);
  // Today's breadcrumb for a live, selected tech — drawn as a dashed trail.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dataRev captures new fixes
  const techTrail = useMemo(() => (selTechObj?.live ? getTechTrail(selTechObj.name).map(p => ({ lat: p.lat, lng: p.lng })) : []), [selTech, selTechObj?.live, dataRev]);

  const techJobCount = (name: string) => jobs.filter(j => j.assignedTo === name).length;
  const techNext = (name: string) => jobs.filter(j => j.assignedTo === name && j.day != null).sort((a, b) => a.day! - b.day!)[0];
  const techRouteOf = (name: string) => buildRoute(techs.find(t => t.name === name)!, jobs);
  const techAtRisk = (name: string) => { const r = techRouteOf(name); return r.totalJobMin + r.totalDriveMin > 480; };
  const techNames = techs.map(t => t.name);
  const riskTechNames = new Set(techs.filter(t => t.status === "delayed").map(t => t.name));

  // Compact status card shown above the selected tech's marker on the map.
  const selState = TRACK_STATE_META[selTechObj?.trackState ?? "off"];
  const techPopover = selTechObj?.current ? {
    lat: selTechObj.current.lat, lng: selTechObj.current.lng, name: selTechObj.name,
    stateLabel: selState.label, stateColor: selState.color, updatedAgo: selTechObj.lastCheckIn,
    subtitle: (() => { const n = techNext(selTechObj.name); return n ? `Next: ${n.customerName} · ${n.scheduledTime}` : undefined; })(),
  } : null;

  // Overview metrics.
  const stats = {
    jobs: dateJobs.length,
    unassigned: jobs.filter(j => j.kind === "unassigned").length,
    emergency: dateJobs.filter(j => j.kind === "emergency").length,
    inProgress: dateJobs.filter(j => j.kind === "in_progress").length,
    delayed: techs.filter(t => t.status === "delayed").length,
    availTechs: techs.filter(t => t.status === "available").length,
    driveMin: techs.reduce((s, t) => s + buildRoute(t, jobs).totalDriveMin, 0),
    atRiskRoutes: techs.filter(t => techAtRisk(t.name)).length,
  };

  function assign(jobId: string, techName: string) { assignJob(jobId, techName); setRefreshKey(k => k + 1); }
  function applySuggestion(s: AiSuggestion) {
    if (s.jobId && s.techName) assign(s.jobId, s.techName);
    setDismissed(d => new Set(d).add(s.id));
  }
  function pickJob(id: string) { setSelJobId(id); setSelTech(null); setPanelMode("details"); }
  function pickTech(name: string) { setSelTech(name); setSelJobId(null); setPanelMode("details"); }
  function jobRoutePos(job: MapJob): { pos: number; total: number } | null {
    if (!job.assignedTo) return null;
    const t = techs.find(x => x.name === job.assignedTo); if (!t) return null;
    const r = buildRoute(t, jobs); const idx = r.stops.findIndex(s => s.job.id === job.id);
    return idx >= 0 ? { pos: idx + 1, total: r.stops.length } : null;
  }

  // Context-aware AI: surface suggestions for the selected job/tech first, then
  // the global dispatch insights.
  const contextSug = selJob ? suggestForJob(selJob, techs) : selTechObj ? suggestForTech(selTechObj, jobs) : [];
  const liveSuggestions = [...contextSug, ...suggestions].filter(s => !dismissed.has(s.id));
  const listJobs = tab === "unassigned" ? unassignedJobs : visibleJobs;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 12.5rem)", minHeight: 520 }}>
      <div className="flex-1 flex gap-3 min-h-0">

        {/* ── Left rail: switch between Queue and Details (inspector + AI) ── */}
        <aside className="w-80 shrink-0 flex flex-col rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
          <div className="p-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {([{ k: "queue", label: "Queue", icon: ListChecks }, { k: "details", label: "Details", icon: Layers }] as const).map(p => (
                <button key={p.k} onClick={() => setPanelMode(p.k)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium transition-colors"
                  style={{ backgroundColor: panelMode === p.k ? ACCENT : "var(--bg-surface)", color: panelMode === p.k ? "#fff" : "var(--text-secondary)" }}>
                  <p.icon className="w-3.5 h-3.5" /> {p.label}
                </button>
              ))}
            </div>
          </div>

          {panelMode === "queue" ? (
            <>
              <div className="p-3 space-y-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                  <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs, customers, address…" className="bg-transparent text-sm outline-none w-full" style={{ color: "var(--text-primary)" }} />
                </div>
                <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  {([{ k: "jobs", label: "Jobs", n: visibleJobs.length }, { k: "unassigned", label: "Unassigned", n: unassignedJobs.length }, { k: "techs", label: "Techs", n: techs.length }] as const).map(t => (
                    <button key={t.k} onClick={() => setTab(t.k)} className="flex-1 px-2 py-1.5 text-xs font-medium transition-colors"
                      style={{ backgroundColor: tab === t.k ? ACCENT : "var(--bg-surface)", color: tab === t.k ? "#fff" : "var(--text-secondary)" }}>
                      {t.label}{t.n > 0 && <span className="ml-1 tabular-nums" style={{ opacity: 0.7 }}>{t.n}</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto thin-scroll-y p-2 space-y-1.5">
                {tab === "techs"
                  ? techs.map(t => <TechRow key={t.name} tech={t} jobs={techJobCount(t.name)} next={techNext(t.name)} atRisk={techAtRisk(t.name)} selected={selTech === t.name} onClick={() => pickTech(t.name)} />)
                  : listJobs.map(j => <JobRow key={j.id} job={j} atRisk={!!j.assignedTo && riskTechNames.has(j.assignedTo)} selected={selJobId === j.id} onClick={() => pickJob(j.id)} />)}
                {tab !== "techs" && listJobs.length === 0 && (
                  <div className="text-center py-10 px-4">
                    <MapPin className="w-5 h-5 mx-auto mb-1.5" style={{ color: "var(--text-muted)" }} />
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>No jobs scheduled for this view.</p>
                    {tab !== "unassigned" && unassignedJobs.length > 0 && (
                      <button onClick={() => setTab("unassigned")} className="mt-2 text-xs font-medium" style={{ color: ACCENT }}>View {unassignedJobs.length} unassigned →</button>
                    )}
                  </div>
                )}
              </div>

              <div className="px-3 py-2.5 grid grid-cols-4 gap-1 shrink-0" style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--bg-surface-2)" }}>
                <MiniStat value={stats.jobs} label="Jobs" />
                <MiniStat value={stats.unassigned} label="Unassigned" color={stats.unassigned ? "#6b7280" : undefined} />
                <MiniStat value={stats.delayed} label="Delayed" color={stats.delayed ? "#dc2626" : undefined} />
                <MiniStat value={stats.availTechs} label="Avail" color={stats.availTechs ? "#16a34a" : undefined} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto thin-scroll-y">
                {selJob
                  ? <JobInspector job={selJob} techNames={techNames} routePos={jobRoutePos(selJob)} onAssign={t => assign(selJob.id, t)} onClose={() => setSelJobId(null)} />
                  : selTechObj && selRoute
                  ? <TechInspector tech={selTechObj} route={selRoute} next={techNext(selTechObj.name)} meta={routeMeta} onClose={() => setSelTech(null)} />
                  : <OverviewInspector stats={stats} techs={techs} jobCountOf={techJobCount} onPickTech={pickTech} />}
              </div>
              <div className="p-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
                <AiInsights suggestions={liveSuggestions} open={aiOpen} onToggle={() => setAiOpen(v => !v)}
                  contextLabel={selJob ? selJob.customerName : selTechObj ? selTechObj.name : undefined}
                  onApply={applySuggestion} onDismiss={s => setDismissed(d => new Set(d).add(s.id))} onFocusJob={id => id && pickJob(id)} />
              </div>
            </div>
          )}
        </aside>

        {/* ── Map (hero) — runs full-width to the right edge ── */}
        <div className="flex-1 min-w-0 rounded-2xl overflow-hidden relative" style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <GoogleMapView jobs={mapJobs} techs={techs} route={selRoute} trail={techTrail} selectedJobId={selJobId} onSelectJob={pickJob}
            onSelectTech={pickTech} selectedTechName={selTech} techPopover={techPopover}
            flyTo={flyTo} showTechs={showTechs || tab === "techs" || !!selTech} traffic={traffic} cluster={cluster} onRouteMeta={setRouteMeta} />

          {/* Top overlay: status pill (left) + layer toggles (right) */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
            {showStatus ? (
              <div className="pointer-events-auto rounded-lg pl-3 pr-1.5 py-1.5 flex items-center gap-2 text-xs" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{dateFilter.mode === "today" ? "Today" : "Custom range"}</span>
                <span style={{ color: "var(--border)" }}>·</span>
                <span style={{ color: "var(--text-secondary)" }}>{mapJobs.length} on map</span>
                {stats.unassigned > 0 && <span className="font-medium" style={{ color: "#6b7280" }}>· {stats.unassigned} unassigned</span>}
                <button onClick={() => setShowStatus(false)} className="p-0.5 rounded hover:bg-[var(--bg-surface-2)]" title="Hide"><X className="w-3 h-3" style={{ color: "var(--text-muted)" }} /></button>
              </div>
            ) : (
              <button onClick={() => setShowStatus(true)} title="Show info" className="pointer-events-auto p-2 rounded-lg" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", color: "var(--text-secondary)" }}><Info className="w-4 h-4" /></button>
            )}
            {/* Layers — one button toggles the whole menu of map filters */}
            <div className="pointer-events-auto relative" ref={layersRef}>
              <button onClick={() => setLayersOpen(o => !o)} title="Map layers" aria-haspopup="menu" aria-expanded={layersOpen}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ backgroundColor: layersOpen ? ACCENT : "var(--bg-surface)", color: layersOpen ? "#fff" : "var(--text-secondary)", border: `1px solid ${layersOpen ? "transparent" : "var(--border-subtle)"}`, boxShadow: "var(--shadow-card)" }}>
                <Layers className="w-3.5 h-3.5" /> Layers
              </button>
              {layersOpen && (
                <div role="menu" className="absolute right-0 top-full mt-1.5 w-44 rounded-xl p-1.5 z-[500]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
                  <LayerRow icon={Users} label="Technicians" active={showTechs} onClick={() => setShowTechs(v => !v)} />
                  <LayerRow icon={Gauge} label="Traffic" active={traffic} onClick={() => setTraffic(v => !v)} />
                  <LayerRow icon={Boxes} label="Clustering" active={cluster} onClick={() => setCluster(v => !v)} />
                </div>
              )}
            </div>
          </div>

          {/* Legend (dismissible) */}
          {showLegend ? (
            <div className="absolute bottom-3 left-3 z-[400] rounded-lg pl-3 pr-2 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 max-w-[60%]" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
              {KINDS.map(k => (
                <span key={k} className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MARKER_CONFIG[k].color }} /> {MARKER_CONFIG[k].label}
                </span>
              ))}
              <button onClick={() => setShowLegend(false)} className="p-0.5 rounded hover:bg-[var(--bg-surface-2)]" title="Hide legend"><X className="w-3 h-3" style={{ color: "var(--text-muted)" }} /></button>
            </div>
          ) : (
            <button onClick={() => setShowLegend(true)} title="Show legend" className="absolute bottom-3 left-3 z-[400] p-2 rounded-lg" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", color: "var(--text-secondary)" }}><Palette className="w-4 h-4" /></button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Left rows ──
const areaOf = (address: string) => address.split(",")[1]?.trim() || "";

function JobRow({ job, atRisk, selected, onClick }: { job: MapJob; atRisk: boolean; selected: boolean; onClick: () => void }) {
  const m = MARKER_CONFIG[job.kind];
  const urgent = job.priority === "urgent" || job.priority === "high";
  const area = areaOf(job.address);
  return (
    <button onClick={onClick} className="group w-full text-left rounded-xl p-2.5 pl-3 relative overflow-hidden transition-all hover:-translate-y-px"
      style={{ border: `1px solid ${selected ? ACCENT : atRisk ? AMBER + "66" : "var(--border-subtle)"}`, backgroundColor: selected ? ACCENT + "0d" : "var(--bg-surface)", boxShadow: selected ? "var(--shadow-card)" : "none" }}>
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: m.color }} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
          {job.customerName}{atRisk && <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: AMBER }} />}
        </span>
        <span className="text-[10px] shrink-0 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
          {urgent && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: job.priority === "urgent" ? "#dc2626" : AMBER }} />}
          {job.scheduledTime || "—"}
        </span>
      </div>
      <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{job.title}{area && <span> · {area}</span>}</p>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ backgroundColor: m.color + "22", color: m.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }} />{m.label}
        </span>
        {job.assignedTo
          ? <span className="inline-flex items-center gap-1 text-[10px] truncate" style={{ color: "var(--text-secondary)" }}><Truck className="w-3 h-3 shrink-0" /> {job.assignedTo}</span>
          : <span className="text-[10px] font-medium" style={{ color: "#6b7280" }}>Unassigned</span>}
      </div>
    </button>
  );
}

function TechRow({ tech, jobs, next, atRisk, selected, onClick }: { tech: MapTech; jobs: number; next?: MapJob; atRisk: boolean; selected: boolean; onClick: () => void }) {
  const sc = TECH_STATUS_CONFIG[tech.status];
  const ts = TRACK_STATE_META[tech.trackState ?? "off"];
  const tracked = (tech.trackState ?? "off") !== "off";
  return (
    <button onClick={onClick} className="w-full text-left rounded-xl p-2.5 transition-all hover:-translate-y-px flex items-start gap-2.5"
      style={{ border: `1px solid ${selected ? ACCENT : "var(--border-subtle)"}`, backgroundColor: selected ? ACCENT + "0d" : "var(--bg-surface)", boxShadow: selected ? "var(--shadow-card)" : "none" }}>
      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold text-white" style={{ backgroundColor: sc.color, boxShadow: tracked ? `0 0 0 2px var(--bg-surface), 0 0 0 3.5px ${ts.color}` : "none" }}>{tech.initials}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{tech.name}</p>
            {tracked && <span className="inline-flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: ts.color + "22", color: ts.color }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ts.color }} />{ts.short.toUpperCase()}</span>}
          </div>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: sc.color + "22", color: sc.color }}>{sc.label}</span>
        </div>
        <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
          {jobs} job{jobs === 1 ? "" : "s"} · {tech.truck} · <span style={{ color: atRisk ? AMBER : "#16a34a" }}>{atRisk ? "Route at risk" : "Route healthy"}</span>
        </p>
        <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {next ? <>Next: {next.customerName} · {next.scheduledTime}</> : <span style={{ color: "var(--text-muted)" }}>No jobs scheduled</span>}
        </p>
      </div>
    </button>
  );
}

// ── Right inspector: overview ──
function OverviewInspector({ stats, techs, jobCountOf, onPickTech }: {
  stats: { jobs: number; unassigned: number; emergency: number; inProgress: number; delayed: number; availTechs: number; driveMin: number; atRiskRoutes: number };
  techs: MapTech[]; jobCountOf: (n: string) => number; onPickTech: (n: string) => void;
}) {
  const ranked = [...techs].map(t => ({ t, n: jobCountOf(t.name) })).sort((a, b) => b.n - a.n);
  const maxN = Math.max(1, ...ranked.map(r => r.n));
  const driveLabel = stats.driveMin >= 60 ? `${Math.round(stats.driveMin / 60 * 10) / 10}h` : `${stats.driveMin}m`;
  const healthy = stats.atRiskRoutes === 0 && stats.delayed === 0;
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Gauge className="w-4 h-4" style={{ color: ACCENT }} />
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Today&apos;s workload</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Kpi icon={MapPin} label="Jobs today" value={stats.jobs} color={ACCENT} />
        <Kpi icon={AlertTriangle} label="Unassigned" value={stats.unassigned} color={stats.unassigned ? AMBER : "#6b7280"} />
        <Kpi icon={Clock} label="In progress" value={stats.inProgress} color="#2563eb" />
        <Kpi icon={CheckCircle2} label="Available techs" value={stats.availTechs} color="#16a34a" />
      </div>

      {/* Route health summary */}
      <div className="rounded-xl p-3" style={{ backgroundColor: healthy ? "#16a34a14" : AMBER + "14", border: `1px solid ${healthy ? "#16a34a33" : AMBER + "33"}` }}>
        <div className="flex items-center gap-1.5 mb-2">
          <RouteIcon className="w-3.5 h-3.5" style={{ color: healthy ? "#16a34a" : AMBER }} />
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{healthy ? "Routes healthy" : "Routes need attention"}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: "var(--text-secondary)" }}>Total drive <b style={{ color: "var(--text-primary)" }}>{driveLabel}</b></span>
          <span style={{ color: "var(--text-secondary)" }}>At-risk <b style={{ color: stats.atRiskRoutes ? AMBER : "var(--text-primary)" }}>{stats.atRiskRoutes}</b></span>
          <span style={{ color: "var(--text-secondary)" }}>Delayed <b style={{ color: stats.delayed ? "#dc2626" : "var(--text-primary)" }}>{stats.delayed}</b></span>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Technician workload</p>
        <div className="space-y-1.5">
          {ranked.slice(0, 6).map(({ t, n }) => {
            const sc = TECH_STATUS_CONFIG[t.status];
            return (
              <button key={t.name} onClick={() => onPickTech(t.name)} className="w-full text-left">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="flex items-center gap-1.5 truncate" style={{ color: "var(--text-secondary)" }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sc.color }} />{t.name}
                  </span>
                  <span className="font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>{n}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ backgroundColor: "var(--bg-input)" }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${(n / maxN) * 100}%`, backgroundColor: sc.color }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-[11px] text-center pt-1" style={{ color: "var(--text-muted)" }}>Select a job or technician for details and quick actions.</p>
    </div>
  );
}

// ── Right inspector: job ──
function JobInspector({ job, techNames, routePos, onAssign, onClose }: {
  job: MapJob; techNames: string[]; routePos: { pos: number; total: number } | null; onAssign: (t: string) => void; onClose: () => void;
}) {
  const m = MARKER_CONFIG[job.kind];
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{job.customerName}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{job.title}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-surface-2)]" title="Close"><X className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></button>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded inline-flex items-center gap-1" style={{ backgroundColor: m.color + "22", color: m.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }} />{m.label}
        </span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded capitalize" style={{ backgroundColor: "var(--bg-input)", color: "var(--text-muted)" }}>{job.priority} priority</span>
      </div>

      <dl className="mt-3 space-y-1.5">
        <Detail label="Address" value={job.address || "—"} />
        <Detail label="Window" value={`${job.scheduledDate || "Unscheduled"}${job.scheduledTime ? ` · ${job.scheduledTime}` : ""}`} />
        <Detail label="Duration" value={`${job.durationMinutes} min`} />
        <Detail label="Technician" value={job.assignedTo || "Unassigned"} />
        {routePos && <Detail label="Route position" value={`Stop ${routePos.pos} of ${routePos.total}`} />}
      </dl>

      <div className="mt-3">
        <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{job.assignedTo ? "Reassign technician" : "Assign technician"}</label>
        <select value={job.assignedTo} onChange={e => onAssign(e.target.value)}
          className="w-full rounded-lg px-2.5 py-1.5 text-sm outline-none" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}>
          <option value="">Unassigned</option>
          {techNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-3">
        <Action icon={ExternalLink} label="Open job" href={`/jobs/${job.id}`} />
        <Action icon={MapPin} label="Customer" href={`/customers/${job.accountId}`} />
        <Action icon={Navigation} label="Directions" href={`https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`} external />
        <Action icon={Phone} label="Call" href="tel:" />
        <Action icon={MessageSquare} label="Message" href="sms:" />
        <Action icon={RouteIcon} label="Get route" href={`https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`} external />
      </div>
    </div>
  );
}

// ── Right inspector: technician ──
function TechInspector({ tech, route, next, meta, onClose }: { tech: MapTech; route: ReturnType<typeof buildRoute>; next?: MapJob; meta?: { durationMin: number; distanceMi: number; live: boolean } | null; onClose: () => void }) {
  const sc = TECH_STATUS_CONFIG[tech.status];
  const state = tech.trackState ?? "off";
  const ts = TRACK_STATE_META[state];
  const tracked = state !== "off";
  const trackingLine = state === "live" ? "Live GPS active"
    : state === "stale" ? "GPS slow — recently seen"
    : state === "lost" ? (tech.gpsError === "permission" ? "Location permission denied" : tech.gpsError === "unavailable" ? "GPS unavailable on device" : "Signal lost — no recent fix")
    : state === "clocked_in" ? "Clocked in — GPS paused"
    : "Off duty — not tracking";
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold text-white" style={{ backgroundColor: sc.color, boxShadow: tracked ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${ts.color}` : "none" }}>{tech.initials}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{tech.name}</p>
              {tracked && <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: ts.color + "22", color: ts.color }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ts.color }} />{ts.short.toUpperCase()}</span>}
            </div>
            <p className="text-xs flex items-center gap-1" style={{ color: sc.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.color }} />{sc.label} · {tech.truck}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-surface-2)]" title="Close"><X className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></button>
      </div>

      {/* Tracking status — the clearest read on clock-in + live GPS state */}
      <div className="mt-3 rounded-lg px-3 py-2 flex items-center justify-between gap-2" style={{ backgroundColor: ts.color + "14", border: `1px solid ${ts.color}3a` }}>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold min-w-0" style={{ color: ts.color }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ts.color }} />
          <span className="truncate">{trackingLine}</span>
        </span>
        <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>{tracked ? `Updated ${tech.lastCheckIn}` : tech.lastCheckIn}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <Mini label="Stops" value={String(route.stops.length)} />
        <Mini label={meta ? "Drive · live" : "Drive"} value={meta ? `${meta.durationMin}m` : `${route.totalDriveMin}m`} />
        <Mini label="On site" value={`${Math.round(route.totalJobMin / 60 * 10) / 10}h`} />
      </div>
      {meta && (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px]" style={{ color: "#16a34a" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#16a34a" }} />
          Live road route · {meta.distanceMi} mi{meta.live ? " · current traffic" : ""}
        </p>
      )}

      {tech.skills.length > 0 && <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>Skills: {tech.skills.join(", ")}</p>}
      {next && <p className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>Next up: {next.customerName} · {next.scheduledTime}</p>}

      <div className="mt-3 flex items-center gap-1.5">
        <RouteIcon className="w-3.5 h-3.5" style={{ color: ACCENT }} />
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Today&apos;s route</p>
      </div>
      {route.stops.length === 0 ? (
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>No scheduled jobs for this technician.</p>
      ) : (
        <ol className="mt-2 space-y-1.5">
          {route.stops.map((s, i) => (
            <li key={s.job.id} className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ backgroundColor: ACCENT + "14", color: ACCENT }}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.job.customerName}</p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{s.job.scheduledTime} · {s.driveMin}m drive · {s.driveMi} mi</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Integrated AI: Dispatch Assistant ──
const CONFIDENCE = { high: { label: "High confidence", color: "#16a34a" }, medium: { label: "Medium confidence", color: AMBER }, low: { label: "Low confidence", color: "#6b7280" } };

function AiInsights({ suggestions, contextLabel, open, onToggle, onApply, onDismiss, onFocusJob }: {
  suggestions: AiSuggestion[]; contextLabel?: string; open: boolean; onToggle: () => void;
  onApply: (s: AiSuggestion) => void; onDismiss: (s: AiSuggestion) => void; onFocusJob: (id?: string) => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden shrink-0" style={{ border: `1px solid ${ACCENT}33`, backgroundColor: "var(--bg-surface)", boxShadow: "var(--shadow-card)" }}>
      <button onClick={onToggle} className="w-full px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: open ? "1px solid var(--border)" : "none", backgroundColor: ACCENT + "0d" }}>
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
        <span className="min-w-0 text-left">
          <span className="block text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>Dispatch Assistant</span>
          {contextLabel && <span className="block text-[10px] truncate" style={{ color: "var(--text-muted)" }}>for {contextLabel}</span>}
        </span>
        {suggestions.length > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: ACCENT + "22", color: ACCENT }}>{suggestions.length}</span>}
        <span className="ml-auto shrink-0">{open ? <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} /> : <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}</span>
      </button>
      {open && (
        <div className="max-h-60 overflow-y-auto thin-scroll-y p-2 space-y-2">
          {suggestions.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>No route issues detected — routes look balanced.</p>
          ) : suggestions.map(s => {
            const Icon = s.kind === "risk" ? AlertTriangle : s.kind === "reorder" ? ListChecks : s.kind === "reassign" ? RouteIcon : Truck;
            const conf = s.confidence ? CONFIDENCE[s.confidence] : null;
            return (
              <div key={s.id} className="rounded-lg p-2.5" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: (s.kind === "risk" ? AMBER : ACCENT) + "1a" }}>
                    <Icon className="w-3 h-3" style={{ color: s.kind === "risk" ? AMBER : ACCENT }} />
                  </span>
                  <p className="text-xs font-semibold flex-1" style={{ color: "var(--text-primary)" }}>{s.title}</p>
                </div>
                <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{s.reason}</p>
                {(s.impact || conf) && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {s.impact && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: ACCENT + "14", color: ACCENT }}>{s.impact}</span>}
                    {conf && <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: conf.color }} />{conf.label}</span>}
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                  {(s.kind === "assign" || s.kind === "reassign") && (
                    <button onClick={() => onApply(s)} className="text-[11px] font-semibold text-white px-2.5 py-1 rounded-md" style={{ backgroundColor: ACCENT }}>Apply</button>
                  )}
                  {s.jobId && <button onClick={() => onFocusJob(s.jobId)} className="text-[11px] font-medium px-2 py-1 rounded-md" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>View</button>}
                  <button onClick={() => onDismiss(s)} className="text-[11px] font-medium px-2 py-1 rounded-md ml-auto" style={{ color: "var(--text-muted)" }}>Dismiss</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Small pieces ──
function LayerRow({ icon: Icon, label, active, onClick }: { icon: typeof Users; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors hover:bg-[var(--bg-surface-2)]">
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: active ? ACCENT : "var(--text-muted)" }} />
      <span className="flex-1 text-left" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="w-7 h-4 rounded-full relative shrink-0 transition-colors" style={{ backgroundColor: active ? ACCENT : "var(--bg-input)" }}>
        <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ left: active ? "14px" : "2px" }} />
      </span>
    </button>
  );
}
function Kpi({ icon: Icon, label, value, color }: { icon: typeof MapPin; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-surface-2)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <p className="text-xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}
function MiniStat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold" style={{ color: color ?? "var(--text-primary)" }}>{value}</p>
      <p className="text-[9px] uppercase tracking-wider truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{label}</dt>
      <dd className="text-xs text-right capitalize" style={{ color: "var(--text-secondary)" }}>{value}</dd>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg py-2" style={{ backgroundColor: "var(--bg-surface-2)" }}>
      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}
function Action({ icon: Icon, label, href, external }: { icon: typeof Phone; label: string; href: string; external?: boolean }) {
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}
      className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--bg-surface-2)]"
      style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </a>
  );
}
