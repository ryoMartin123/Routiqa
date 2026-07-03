// ─── Dispatch: suggest the best technician ────────────────
// Ranks the board's technicians for a given job by proximity (drive-time from the
// tech's live/base location), availability at the requested slot, on-duty status,
// and a soft skill match. Reuses the map layer's geocode + haversine/drive-time.
// Deterministic (mock geocodes) so suggestions are stable across renders; swap
// geocode()/tech.current for real data later without touching callers.

import { geocode, getMapTechnicians, haversineMiles, driveMinutes } from "@/lib/dispatch-map/data";

export interface TechSuggestion {
  name: string;
  driveMin: number;      // ETA from the tech's current position to the job
  miles: number;
  available: boolean;    // free at the requested slot (no overlap)
  onDuty: boolean;
  skillMatch: boolean;
  score: number;         // lower is better
  reason: string;        // short "why" for the chip
}

export function suggestTechsForJob(opts: {
  seed: string;                       // stable geocode seed (job/source id)
  serviceAreaId?: string;
  companyId?: string;
  locationId?: string;
  keywords?: string;                  // job title/type — soft skill match
  techNames: string[];                // candidates (the board roster)
  isAvailable?: (name: string) => boolean;
}): TechSuggestion[] {
  const jobLoc = geocode(opts.seed, opts.serviceAreaId);
  const techs = getMapTechnicians(opts.companyId, opts.locationId);
  const byName = new Map(techs.map(t => [t.name, t]));
  const kw = (opts.keywords ?? "").toLowerCase();
  const firstWord = kw.split(/\s+/)[0] ?? "";

  const rows = opts.techNames.map((name): TechSuggestion => {
    const t = byName.get(name);
    const from = t?.current ?? t?.base ?? null;
    const miles = from ? Math.round(haversineMiles(from, jobLoc) * 10) / 10 : Infinity;
    const driveMin = from ? driveMinutes(from, jobLoc) : Infinity;
    const onDuty = !!t && t.status !== "off_duty";
    const available = opts.isAvailable ? opts.isAvailable(name) : true;
    const skillMatch = !!t && !!kw && t.skills.some(s => {
      const sl = s.toLowerCase();
      return kw.includes(sl) || (firstWord.length > 2 && sl.includes(firstWord));
    });

    let score = Number.isFinite(driveMin) ? driveMin : 9999;
    if (!available) score += 1000;   // busy techs sink to the bottom
    if (!onDuty) score += 500;        // off-duty below available
    if (skillMatch) score -= 8;       // nudge a skilled tech up (~8 min of drive)

    const reason = !onDuty ? "Off duty"
      : !available ? "Busy then"
      : Number.isFinite(driveMin) ? `${miles} mi · ~${driveMin} min out${skillMatch ? " · skill" : ""}`
      : "No location";

    return { name, driveMin, miles, available, onDuty, skillMatch, score, reason };
  });

  return rows.sort((a, b) => a.score - b.score);
}
