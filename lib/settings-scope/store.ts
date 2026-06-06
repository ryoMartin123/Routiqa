// ─── Scoped settings store ────────────────────────────────
// One generic, layer-aware value store behind every cascading setting. Values
// are keyed by (settingKey, scopeKey). Resolution walks the chain from a layer
// up to Org; the first explicit value wins, else the caller's built-in default.
//
// scopeKey: "org" | "company:<id>" | "location:<id>" | "service_area:<id>"
// Generalizes the per-scope pattern already used by lib/calendar/settings.

import type { Layer } from "./types";

export type Source = Layer | "default";
export interface ScopeIds { companyId?: string; locationId?: string; serviceAreaId?: string }
export interface ChainNode { layer: Layer; scopeKey: string }

const STORAGE_KEY = "crm-scoped-settings";
type Store = Record<string, Record<string, unknown>>; // settingKey -> scopeKey -> value

let _store: Store | null = null;

function load(): Store {
  if (_store) return _store;
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _store = raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    _store = {};
  }
  return _store;
}

function persist(): void {
  if (!_store) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_store)); } catch { /* ignore */ }
}

// ─── Scope keys & chains ──────────────────────────────────
export function scopeKeyFor(layer: Layer, ids: ScopeIds): string {
  if (layer === "org") return "org";
  if (layer === "company") return `company:${ids.companyId ?? ""}`;
  if (layer === "location") return `location:${ids.locationId ?? ""}`;
  return `service_area:${ids.serviceAreaId ?? ""}`;
}

// All resolvable nodes for a scope, most-specific first, always ending at Org.
export function nodesFor(ids: ScopeIds): ChainNode[] {
  const out: ChainNode[] = [];
  if (ids.serviceAreaId) out.push({ layer: "service_area", scopeKey: `service_area:${ids.serviceAreaId}` });
  if (ids.locationId)    out.push({ layer: "location",     scopeKey: `location:${ids.locationId}` });
  if (ids.companyId)     out.push({ layer: "company",      scopeKey: `company:${ids.companyId}` });
  out.push({ layer: "org", scopeKey: "org" });
  return out;
}

// The chain used when editing AT a layer: from that layer up to Org (a Company
// edit ignores any Branch/Area value below it).
export function chainFrom(activeLayer: Layer, ids: ScopeIds): ChainNode[] {
  const nodes = nodesFor(ids);
  const idx = nodes.findIndex(n => n.layer === activeLayer);
  return idx >= 0 ? nodes.slice(idx) : nodes;
}

// ─── Read / write ─────────────────────────────────────────
export function readChain<T>(settingKey: string, chain: ChainNode[], fallback: T): { value: T; source: Source } {
  const store = load();
  const bucket = store[settingKey];
  if (bucket) {
    for (const node of chain) {
      if (Object.prototype.hasOwnProperty.call(bucket, node.scopeKey)) {
        return { value: bucket[node.scopeKey] as T, source: node.layer };
      }
    }
  }
  return { value: fallback, source: "default" };
}

// Consumer helper: resolve the effective value for a plain scope (most specific).
export function resolveScoped<T>(settingKey: string, ids: ScopeIds, fallback: T): T {
  return readChain<T>(settingKey, nodesFor(ids), fallback).value;
}

export function hasScoped(settingKey: string, scopeKey: string): boolean {
  const bucket = load()[settingKey];
  return !!bucket && Object.prototype.hasOwnProperty.call(bucket, scopeKey);
}

export function writeScoped<T>(settingKey: string, scopeKey: string, value: T): void {
  const store = load();
  (store[settingKey] ??= {})[scopeKey] = value;
  persist();
}

export function clearScoped(settingKey: string, scopeKey: string): void {
  const store = load();
  if (store[settingKey]) { delete store[settingKey][scopeKey]; persist(); }
}
