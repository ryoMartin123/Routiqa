// Project "lenses" — cross-cutting ways to slice the project list, independent
// of the workflow stage (Kanban columns). Each lens defines its filter tabs and
// a classifier that buckets a project. Used by the Projects page tab row across
// the List, Pipeline, and Calendar views.

import { getInvoicesForProject } from "@/lib/quotes/data";
import { mapProgress } from "./map";
import type { ProjectStage } from "./settings";
import type { Project } from "./data";

export type LensKey = "status" | "billing" | "health";
export interface LensTab { key: string; label: string }

export const PROJECT_LENSES: { key: LensKey; label: string; tabs: LensTab[] }[] = [
  { key: "status", label: "Status", tabs: [
    { key: "all", label: "All" }, { key: "active", label: "Active" },
    { key: "completed", label: "Completed" }, { key: "canceled", label: "Canceled" },
  ] },
  { key: "billing", label: "Billing", tabs: [
    { key: "all", label: "All" }, { key: "unbilled", label: "Unbilled" },
    { key: "invoiced", label: "Invoiced" }, { key: "partially_paid", label: "Partially Paid" },
    { key: "paid", label: "Paid" },
  ] },
  { key: "health", label: "Health", tabs: [
    { key: "all", label: "All" }, { key: "on_track", label: "On Track" },
    { key: "at_risk", label: "At Risk" }, { key: "overdue", label: "Overdue" },
  ] },
];

// Status = the category of the project's current pipeline stage (stage is the
// single source of truth; the legacy `status` field is no longer surfaced).
export function statusBucket(project: Project, stagesByKey: Map<string, ProjectStage>): "active" | "completed" | "canceled" {
  const cat = stagesByKey.get(project.stage ?? "")?.category;
  if (cat === "done") return "completed";
  if (cat === "canceled") return "canceled";
  return "active";
}

// Billing = rolled up from the project's invoices.
export function billingBucket(projectId: string): "unbilled" | "invoiced" | "partially_paid" | "paid" {
  const invoices = getInvoicesForProject(projectId);
  if (invoices.length === 0) return "unbilled";
  const balance = invoices.reduce((sum, i) => sum + (i.balanceDue ?? 0), 0);
  if (balance <= 0) return "paid";
  const anyPaid = invoices.some(i => i.status === "paid" || i.status === "partially_paid" || !!i.paidAt);
  return anyPaid ? "partially_paid" : "invoiced";
}

// Health = map progress vs. the target date.
export function healthBucket(project: Project): "on_track" | "at_risk" | "overdue" {
  const { pct } = mapProgress(project.id);
  if (!project.targetDate) return "on_track";
  const target = new Date(project.targetDate);
  if (isNaN(target.getTime())) return "on_track";
  const daysLeft = Math.floor((target.getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0 && pct < 100) return "overdue";
  if (daysLeft <= 7 && pct < 75) return "at_risk";
  return "on_track";
}

// ─── Project health (richer set used by Cards / Overview) ──
// Built on healthBucket, plus "completed" (stage done) and "blocked" (a blocked
// map node — passed in so this stays decoupled from the map module).
export type ProjectHealth = "on_track" | "at_risk" | "overdue" | "blocked" | "completed";
export const HEALTH_META: Record<ProjectHealth, { label: string; bg: string; color: string }> = {
  on_track:  { label: "On Track",  bg: "#d1fae5", color: "#065f46" },
  at_risk:   { label: "At Risk",   bg: "#fef3c7", color: "#92400e" },
  overdue:   { label: "Overdue",   bg: "#fee2e2", color: "#991b1b" },
  blocked:   { label: "Blocked",   bg: "#fee2e2", color: "#991b1b" },
  completed: { label: "Completed", bg: "#d3ebe6", color: "#0a5c53" },
};
export function projectHealth(project: Project, opts: { done?: boolean; blocked?: boolean } = {}): ProjectHealth {
  if (opts.done) return "completed";
  if (opts.blocked) return "blocked";
  return healthBucket(project);
}

export function bucketOf(lens: LensKey, project: Project, stagesByKey: Map<string, ProjectStage>): string {
  if (lens === "status")  return statusBucket(project, stagesByKey);
  if (lens === "billing") return billingBucket(project.id);
  return healthBucket(project);
}

// Display styling for billing / health buckets (status uses the stage's own color).
export const BUCKET_STYLE: Record<string, { bg: string; color: string }> = {
  unbilled:       { bg: "var(--bg-input)", color: "var(--text-muted)" },
  invoiced:       { bg: "#fef3c7",         color: "#92400e" },
  partially_paid: { bg: "#dbeafe",         color: "#1e40af" },
  paid:           { bg: "#d1fae5",         color: "#065f46" },
  on_track:       { bg: "#d1fae5",         color: "#065f46" },
  at_risk:        { bg: "#fef3c7",         color: "#92400e" },
  overdue:        { bg: "#fee2e2",         color: "#991b1b" },
};
