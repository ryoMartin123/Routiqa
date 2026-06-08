// ─── Sample data — manifest store ────────────────────────
// Remembers the ids of every record the sample-data loader created, so they can
// be located and removed later. The records themselves carry no marker (they
// mimic hand-entered data); this manifest is the only thing that knows they're
// sample data. Persists to localStorage, mirroring the other module stores.

import type { SampleEntry, SampleType } from "./types";

const KEY = "crm-sample-manifest";
let _cache: SampleEntry[] | null = null;

function all(): SampleEntry[] {
  if (_cache) return _cache;
  if (typeof window === "undefined") return [];
  try { const r = localStorage.getItem(KEY); _cache = r ? (JSON.parse(r) as SampleEntry[]) : []; }
  catch { _cache = []; }
  return _cache!;
}

function persist(): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(_cache ?? [])); } catch { /* ignore */ }
}

export function getManifest(): SampleEntry[] { return [...all()]; }

export function addEntries(entries: SampleEntry[]): void {
  _cache = [...all(), ...entries];
  persist();
}

export function removeByKeys(keys: Set<string>): void {
  _cache = all().filter(e => !keys.has(e.key));
  persist();
}

export function clearManifest(): void {
  _cache = [];
  persist();
}

export function countsByType(): Record<SampleType, number> {
  const counts = {} as Record<SampleType, number>;
  for (const e of all()) counts[e.type] = (counts[e.type] ?? 0) + 1;
  return counts;
}

export function totalCount(): number { return all().length; }

let _seq = 0;
export function manifestKey(): string {
  return `sm-${Date.now().toString(36)}-${(_seq++).toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}
