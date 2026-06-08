// ─── Sample data — manager ───────────────────────────────
// Orchestrates loading and removing sample data. Generation distributes child
// records across parent records (auto-creating parents when none exist) so every
// record is realistically linked. Removal is dependency-aware: it walks the
// manifest's parent links to find every dependent and deletes them children-first,
// so a cascade never leaves an impossible state (a work order without its job, an
// invoice pointing at a deleted job, etc.).

import { getAllLocations } from "@/lib/hierarchy/data";
import { getCustomer, deleteCustomer, type Customer } from "@/lib/customers/data";
import { getJob, deleteJob, deleteWorkOrder, type Job } from "@/lib/jobs/data";
import { getProject, deleteProject } from "@/lib/projects/data";
import { deleteQuote, deleteInvoice } from "@/lib/quotes/data";
import { deleteLead } from "@/lib/leads/data";
import { deleteTask } from "@/lib/tasks/data";
import { deleteAgreement } from "@/lib/agreements/data";
import {
  getManifest, addEntries, removeByKeys, clearManifest, countsByType, totalCount,
} from "./manifest";
import {
  genCustomer, genLead, genProject, genJob, genWorkOrder, genQuote, genInvoice, genAgreement, genTask,
  type GenCtx,
} from "./generate";
import { metaFor, type SampleType, type SampleEntry } from "./types";

// ─── Context resolution ───────────────────────────────────
// Resolve the company/location to stamp on generated records. Prefers the active
// scope passed from the UI; falls back to the first active branch.
export function resolveCtx(companyId?: string, locationId?: string): GenCtx {
  const locs = getAllLocations();
  const loc =
    (locationId && locs.find(l => l.id === locationId)) ||
    (companyId && locs.find(l => l.companyId === companyId && l.status === "active")) ||
    locs.find(l => l.status === "active") ||
    locs[0];
  return {
    companyId:    companyId || loc?.companyId || "co_hvac",
    locationId:   loc?.id ?? locationId ?? "loc_augusta",
    locationName: loc?.name ?? "Augusta Branch",
  };
}

// ─── Parent pools (resolve manifest entries back to live records) ──
function sampleRecordsOf<T>(type: SampleType, getter: (id: string) => T | undefined): T[] {
  return getManifest().filter(e => e.type === type).map(e => getter(e.id)).filter(Boolean) as T[];
}

function ensureCustomers(want: number, ctx: GenCtx): Customer[] {
  let pool = sampleRecordsOf<Customer>("customer", getCustomer);
  if (pool.length === 0) {
    const n = Math.min(Math.max(want, 1), 4);   // a small spread to attach children to
    const created: Customer[] = [];
    for (let i = 0; i < n; i++) { const { record, entry } = genCustomer(ctx); addEntries([entry]); created.push(record); }
    pool = created;
  }
  return pool;
}

// ─── Load ─────────────────────────────────────────────────
export function loadSamples(type: SampleType, count: number, ctx: GenCtx): number {
  const n = Math.max(0, Math.min(count, 200));
  if (n === 0) return 0;
  const entries: SampleEntry[] = [];

  switch (type) {
    case "customer":
      for (let i = 0; i < n; i++) entries.push(genCustomer(ctx).entry);
      break;
    case "lead":
      for (let i = 0; i < n; i++) entries.push(genLead(ctx).entry);
      break;
    case "project": {
      const customers = ensureCustomers(n, ctx);
      for (let i = 0; i < n; i++) entries.push(genProject(ctx, customers[i % customers.length]).entry);
      break;
    }
    case "job": {
      const customers = ensureCustomers(n, ctx);
      const projects = sampleRecordsOf("project", getProject);
      for (let i = 0; i < n; i++) {
        // Tie ~half of jobs to a sample project when projects exist.
        const proj = projects.length && Math.random() < 0.5 ? projects[i % projects.length] : undefined;
        entries.push(genJob(ctx, customers[i % customers.length], proj).entry);
      }
      break;
    }
    case "workorder": {
      // One work order per job (the store is keyed by jobId), so each needs a job
      // that doesn't already have a sample work order — create more jobs if short.
      const taken = new Set(getManifest().filter(e => e.type === "workorder").map(e => e.ref));
      const avail: Job[] = sampleRecordsOf<Job>("job", getJob).filter(j => !taken.has(j.id));
      const customers = ensureCustomers(n, ctx);
      let made = 0;
      while (avail.length < n) {
        const { record, entry } = genJob(ctx, customers[avail.length % customers.length]);
        addEntries([entry]); avail.push(record); made++;
        if (made > 400) break;   // safety
      }
      for (let i = 0; i < n; i++) entries.push(genWorkOrder(avail[i]).entry);
      break;
    }
    case "quote": {
      const customers = ensureCustomers(n, ctx);
      for (let i = 0; i < n; i++) entries.push(genQuote(ctx, customers[i % customers.length]).entry);
      break;
    }
    case "invoice": {
      const customers = ensureCustomers(n, ctx);
      const jobs = sampleRecordsOf<Job>("job", getJob);
      for (let i = 0; i < n; i++) {
        const job = jobs.length && Math.random() < 0.5 ? jobs[i % jobs.length] : undefined;
        entries.push(genInvoice(ctx, customers[i % customers.length], job).entry);
      }
      break;
    }
    case "agreement": {
      const customers = ensureCustomers(n, ctx);
      for (let i = 0; i < n; i++) entries.push(genAgreement(ctx, customers[i % customers.length]).entry);
      break;
    }
    case "task": {
      const customers = ensureCustomers(n, ctx);
      for (let i = 0; i < n; i++) entries.push(genTask(ctx, customers[i % customers.length]).entry);
      break;
    }
  }

  addEntries(entries);
  return entries.length;
}

// ─── Cascade resolution ───────────────────────────────────
// Given seed entity ids, grow the set to include every sample record that depends
// on something already in the set (transitively).
function closure(seedIds: Set<string>, manifest: SampleEntry[]): Set<string> {
  const ids = new Set(seedIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of manifest) {
      if (!ids.has(e.id) && e.parentIds.some(p => ids.has(p))) { ids.add(e.id); changed = true; }
    }
  }
  return ids;
}

// What would be deleted if `type` is removed now — counts grouped by type, so the
// UI can warn before a cascade ("removing these also removes 3 invoices").
export function removalImpact(type: SampleType): Record<SampleType, number> {
  const manifest = getManifest();
  const seed = new Set(manifest.filter(e => e.type === type).map(e => e.id));
  const ids = closure(seed, manifest);
  const counts = {} as Record<SampleType, number>;
  for (const e of manifest) if (ids.has(e.id)) counts[e.type] = (counts[e.type] ?? 0) + 1;
  return counts;
}

function deleteEntity(e: SampleEntry): void {
  switch (e.type) {
    case "invoice":   deleteInvoice(e.id); break;
    case "workorder": deleteWorkOrder(e.ref ?? e.id); break;
    case "task":      deleteTask(e.id); break;
    case "quote":     deleteQuote(e.id); break;
    case "agreement": deleteAgreement(e.id); break;
    case "job":       deleteJob(e.id); break;
    case "lead":      deleteLead(e.id); break;
    case "project":   deleteProject(e.id); break;
    case "customer":  deleteCustomer(e.id); break;
  }
}

function deleteEntries(entries: SampleEntry[]): void {
  // Children first (lower rank) so we never orphan a dependent mid-delete.
  [...entries].sort((a, b) => metaFor(a.type).rank - metaFor(b.type).rank).forEach(deleteEntity);
}

// ─── Remove ───────────────────────────────────────────────
export function removeSamples(type: SampleType): number {
  const manifest = getManifest();
  const seed = new Set(manifest.filter(e => e.type === type).map(e => e.id));
  const ids = closure(seed, manifest);
  const toDelete = manifest.filter(e => ids.has(e.id));
  deleteEntries(toDelete);
  removeByKeys(new Set(toDelete.map(e => e.key)));
  return toDelete.length;
}

export function removeAllSamples(): number {
  const manifest = getManifest();
  deleteEntries(manifest);
  clearManifest();
  return manifest.length;
}

// ─── Summary ──────────────────────────────────────────────
export function sampleSummary(): { counts: Record<SampleType, number>; total: number } {
  return { counts: countsByType(), total: totalCount() };
}
