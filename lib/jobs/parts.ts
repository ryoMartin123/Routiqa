// ─── Part orders — what "Waiting on Parts" is waiting FOR ──────────────────
// A lightweight record per ordered part on a job: what was ordered, from whom,
// when it's expected, and whether it has arrived. When every part on a job is
// received, the job is "ready to reschedule" — the dispatch queue surfaces it
// automatically (see lib/calendar getUnscheduledItems).

import { notifyDataChanged, invalidateOnStorage } from "@/lib/sync/liveData";

export interface PartOrder {
  id: string;
  jobId: string;
  workOrderId?: string;      // the return work order the part is for, when known
  description: string;
  supplier?: string;
  eta?: string;              // expected arrival, freeform display date
  note?: string;
  status: "ordered" | "received";
  orderedAt: string;         // ISO
  receivedAt?: string;       // ISO
}

const KEY = "crm-part-orders";
let _parts: PartOrder[] | null = null;

function store(): PartOrder[] {
  if (_parts) return _parts;
  if (typeof window === "undefined") return [];
  try { _parts = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { _parts = []; }
  return _parts!;
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(_parts ?? [])); } catch { /* ignore */ } }
invalidateOnStorage([KEY], () => { _parts = null; });

export function getPartOrders(jobId: string): PartOrder[] {
  return store().filter(p => p.jobId === jobId);
}
export function getAllPartOrders(): PartOrder[] { return [...store()]; }

// True when the job has part orders and every one has arrived — the signal that
// the return visit can be scheduled.
export function jobPartsReady(jobId: string): boolean {
  const parts = getPartOrders(jobId);
  return parts.length > 0 && parts.every(p => p.status === "received");
}

export function createPartOrder(input: {
  jobId: string; workOrderId?: string; description: string;
  supplier?: string; eta?: string; note?: string;
}): PartOrder {
  const part: PartOrder = {
    id: `po-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    status: "ordered", orderedAt: new Date().toISOString(), ...input,
  };
  _parts = [...store(), part];
  persist(); notifyDataChanged();
  return part;
}

export function markPartReceived(id: string): PartOrder | undefined {
  _parts = store().map(p => p.id === id ? { ...p, status: "received" as const, receivedAt: new Date().toISOString() } : p);
  persist(); notifyDataChanged();
  return store().find(p => p.id === id);
}

export function deletePartOrder(id: string): void {
  _parts = store().filter(p => p.id !== id);
  persist(); notifyDataChanged();
}
