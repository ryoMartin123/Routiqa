// ─── Field materials log ──────────────────────────────────
// Materials/parts a technician logs against a job from the phone. localStorage-
// backed like the app's other non-jobs stores, and broadcast through the same
// liveData channel so desktop views can react. Additive: nothing else depends
// on this store yet — it feeds job costing/invoicing later.

import { notifyDataChanged, invalidateOnStorage } from "@/lib/sync/liveData";

export interface JobMaterial {
  id: string;
  name: string;
  qty: number;
  addedBy: string;
  at: string;         // ISO timestamp
}

const KEY = "routiqa-job-materials";
type Store = Record<string, JobMaterial[]>;

let _cache: Store | null = null;
invalidateOnStorage([KEY], () => { _cache = null; });

function read(): Store {
  if (_cache) return _cache;
  if (typeof window === "undefined") return {};
  try { _cache = JSON.parse(localStorage.getItem(KEY) || "{}") as Store; }
  catch { _cache = {}; }
  return _cache!;
}
function write(s: Store): void {
  _cache = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
  notifyDataChanged();
}

export function getJobMaterials(jobId: string): JobMaterial[] {
  return read()[jobId] ?? [];
}

export function addJobMaterial(jobId: string, name: string, qty: number, addedBy: string): JobMaterial {
  const m: JobMaterial = {
    id: `mat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(), qty: Math.max(1, Math.round(qty)), addedBy, at: new Date().toISOString(),
  };
  const s = { ...read() };
  s[jobId] = [...(s[jobId] ?? []), m];
  write(s);
  return m;
}

export function removeJobMaterial(jobId: string, id: string): void {
  const s = { ...read() };
  s[jobId] = (s[jobId] ?? []).filter(m => m.id !== id);
  write(s);
}
