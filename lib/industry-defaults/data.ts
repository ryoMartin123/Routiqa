// Industry Defaults — global starter template packs.
// One core CRM engine; each industry provides default settings that get COPIED
// into the company's own settings. After copying, the company edits its own
// data — the global template is never mutated.
//
// Apply writes into the existing settings stores (pipelines, job types/statuses,
// photo categories). Other previewed sections (work orders, custom fields,
// agreements) are display-only for now.

import {
  getStages, saveStages, slugify as pipeSlug,
  type PipelineStage, type StageCategory,
} from "@/lib/pipelines/data";
import {
  getJobTypes, saveJobTypes, getJobStatuses, saveJobStatuses, jcSlug,
  type JobTypeDef, type JobTypeCategory, type JobStatusDef, type JobStatusCategory,
} from "@/lib/job-config/data";
import {
  getPhotoCategories, savePhotoCategories, pcSlug,
  type PhotoCategory, type AppliesTo,
} from "@/lib/photo-categories/data";

export type TemplateStatus = "available" | "coming_soon";
export type ApplyMode = "missing" | "replace";

// Structured starter data for an industry (only what Apply writes).
interface TemplateData {
  pipelineStages:  { name: string; color: string; category: StageCategory }[];
  jobTypes:        { name: string; category: JobTypeCategory; duration: number }[];
  jobStatuses:     { name: string; color: string; category: JobStatusCategory }[];
  photoCategories: { name: string; color: string; appliesTo: AppliesTo[] }[];
}

export interface IndustryTemplate {
  key:         string;
  name:        string;
  description: string;
  status:      TemplateStatus;
  includes:    string[];     // summary chips shown on the card
  // Preview content — names only, for the preview panel
  preview: {
    pipelineStages:     string[];
    jobTypes:           string[];
    jobStatuses:        string[];
    photoCategories:    string[];
    workOrderTemplates: string[];
    customFields:       string[];
    agreementTemplates: string[];
  };
  data?: TemplateData;        // present only for "available" templates that copy
}

// ─── General Service ──────────────────────────────────────
const GENERAL_DATA: TemplateData = {
  pipelineStages: [
    { name: "New Lead", color: "#239c8d", category: "open" },
    { name: "Contacted", color: "#f59e0b", category: "open" },
    { name: "Estimate Sent", color: "#8b5cf6", category: "open" },
    { name: "Follow-Up", color: "#0891b2", category: "open" },
    { name: "Won", color: "#10b981", category: "won" },
    { name: "Lost", color: "#ef4444", category: "lost" },
  ],
  jobTypes: [
    { name: "Service Call", category: "service", duration: 60 },
    { name: "Estimate", category: "sales", duration: 45 },
    { name: "Installation", category: "install", duration: 240 },
    { name: "Callback", category: "service", duration: 60 },
  ],
  jobStatuses: [
    { name: "New", color: "#6b7280", category: "open" },
    { name: "Scheduled", color: "#239c8d", category: "scheduled" },
    { name: "In Progress", color: "#0891b2", category: "active" },
    { name: "Completed", color: "#10b981", category: "completed" },
    { name: "Invoiced", color: "#8b5cf6", category: "completed" },
    { name: "Canceled", color: "#ef4444", category: "canceled" },
  ],
  photoCategories: [
    { name: "Before", color: "#239c8d", appliesTo: ["Job"] },
    { name: "After", color: "#10b981", appliesTo: ["Job"] },
    { name: "Completion", color: "#10b981", appliesTo: ["Job"] },
  ],
};

// ─── HVAC ─────────────────────────────────────────────────
const HVAC_DATA: TemplateData = {
  pipelineStages: [
    { name: "New Lead", color: "#239c8d", category: "open" },
    { name: "Contacted", color: "#f59e0b", category: "open" },
    { name: "Appointment Scheduled", color: "#3b82f6", category: "open" },
    { name: "Estimate Sent", color: "#8b5cf6", category: "open" },
    { name: "Follow-Up", color: "#0891b2", category: "open" },
    { name: "Won", color: "#10b981", category: "won" },
    { name: "Lost", color: "#ef4444", category: "lost" },
  ],
  jobTypes: [
    { name: "Maintenance Visit", category: "maintenance", duration: 90 },
    { name: "Service Call", category: "service", duration: 60 },
    { name: "Installation", category: "install", duration: 300 },
    { name: "Inspection", category: "service", duration: 60 },
    { name: "Emergency", category: "emergency", duration: 120 },
    { name: "Commercial PM", category: "maintenance", duration: 180 },
    { name: "Warranty", category: "warranty", duration: 90 },
  ],
  jobStatuses: [
    { name: "New", color: "#6b7280", category: "open" },
    { name: "Scheduled", color: "#239c8d", category: "scheduled" },
    { name: "Dispatched", color: "#3b82f6", category: "scheduled" },
    { name: "In Progress", color: "#0891b2", category: "active" },
    { name: "Waiting on Parts", color: "#f59e0b", category: "waiting" },
    { name: "Completed", color: "#10b981", category: "completed" },
    { name: "Invoiced", color: "#8b5cf6", category: "completed" },
    { name: "Canceled", color: "#ef4444", category: "canceled" },
  ],
  photoCategories: [
    { name: "Outdoor Unit", color: "#3b82f6", appliesTo: ["Equipment", "Job"] },
    { name: "Indoor Unit", color: "#239c8d", appliesTo: ["Equipment", "Job"] },
    { name: "Data Plate", color: "#0891b2", appliesTo: ["Equipment"] },
    { name: "Thermostat", color: "#8b5cf6", appliesTo: ["Job"] },
    { name: "Ductwork", color: "#f59e0b", appliesTo: ["Job"] },
    { name: "Filter", color: "#10b981", appliesTo: ["Job"] },
    { name: "Electrical", color: "#ef4444", appliesTo: ["Job"] },
  ],
};

// ─── Templates ────────────────────────────────────────────
export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    key: "general", name: "General Service", status: "available",
    description: "Sensible defaults for any service business. A clean starting point.",
    includes: ["Pipeline", "Job Types", "Job Statuses", "Photo Categories"],
    preview: {
      pipelineStages: GENERAL_DATA.pipelineStages.map(s => s.name),
      jobTypes: GENERAL_DATA.jobTypes.map(j => j.name),
      jobStatuses: GENERAL_DATA.jobStatuses.map(s => s.name),
      photoCategories: GENERAL_DATA.photoCategories.map(p => p.name),
      workOrderTemplates: ["General Service Call", "Installation", "Estimate"],
      customFields: ["Referred By", "Preferred Contact Time"],
      agreementTemplates: ["Basic Service Plan"],
    },
    data: GENERAL_DATA,
  },
  {
    key: "hvac", name: "HVAC", status: "available",
    description: "Heating & cooling defaults — maintenance-heavy with equipment photo rules.",
    includes: ["Pipeline", "Job Types", "Job Statuses", "Photo Categories", "Work Orders"],
    preview: {
      pipelineStages: HVAC_DATA.pipelineStages.map(s => s.name),
      jobTypes: HVAC_DATA.jobTypes.map(j => j.name),
      jobStatuses: HVAC_DATA.jobStatuses.map(s => s.name),
      photoCategories: HVAC_DATA.photoCategories.map(p => p.name),
      workOrderTemplates: ["Maintenance Checklist", "Install Startup Checklist", "Service Diagnostic", "Commercial PM Checklist"],
      customFields: ["System Type", "Tonnage", "Refrigerant", "Filter Size"],
      agreementTemplates: ["Residential Maintenance Plan", "Commercial PM Contract"],
    },
    data: HVAC_DATA,
  },
  {
    key: "roofing", name: "Roofing", status: "coming_soon",
    description: "Inspection-heavy with insurance and storm-damage workflows.",
    includes: ["Pipeline", "Job Types", "Photo Categories"],
    preview: {
      pipelineStages: ["New Lead", "Inspection Scheduled", "Estimate Sent", "Insurance Review", "Won", "Lost"],
      jobTypes: ["Roof Inspection", "Repair", "Full Replacement", "Storm Damage"],
      jobStatuses: ["New", "Scheduled", "In Progress", "Insurance Pending", "Completed", "Invoiced"],
      photoCategories: ["Roof Overview", "Damage", "Shingles", "Flashing", "Gutters", "Valleys", "Chimney", "Insurance Photos"],
      workOrderTemplates: ["Roof Inspection Checklist", "Storm Damage Checklist", "Final Completion Checklist"],
      customFields: ["Roof Type", "Square Footage", "Insurance Claim #"],
      agreementTemplates: ["Roof Inspection Plan"],
    },
  },
  {
    key: "plumbing", name: "Plumbing", status: "coming_soon",
    description: "Emergency dispatch and membership-plan focused.",
    includes: ["Pipeline", "Job Types", "Photo Categories"],
    preview: {
      pipelineStages: ["New Lead", "Dispatched", "Estimate Sent", "Won", "Lost"],
      jobTypes: ["Service Call", "Drain Cleaning", "Water Heater", "Leak Repair", "Emergency"],
      jobStatuses: ["New", "Dispatched", "In Progress", "Waiting on Parts", "Completed"],
      photoCategories: ["Before", "Issue Found", "After", "Fixture", "Water Heater"],
      workOrderTemplates: ["Water Heater Replacement", "Leak Repair", "Drain Cleaning"],
      customFields: ["Fixture Type", "Pipe Material"],
      agreementTemplates: ["Plumbing Membership"],
    },
  },
  {
    key: "electrical", name: "Electrical", status: "coming_soon",
    description: "Code-compliance and permit-tracking focused.",
    includes: ["Pipeline", "Job Types", "Photo Categories"],
    preview: {
      pipelineStages: ["New Lead", "Site Visit", "Estimate Sent", "Permit Pending", "Won", "Lost"],
      jobTypes: ["Service Call", "Panel Upgrade", "Wiring", "Inspection", "Emergency"],
      jobStatuses: ["New", "Scheduled", "In Progress", "Permit Pending", "Completed"],
      photoCategories: ["Panel", "Wiring", "Before", "After", "Permit"],
      workOrderTemplates: ["Panel Upgrade Checklist", "Wiring Inspection"],
      customFields: ["Panel Amperage", "Permit #"],
      agreementTemplates: ["Electrical Safety Plan"],
    },
  },
  {
    key: "restoration", name: "Restoration", status: "coming_soon",
    description: "Insurance-claim driven with phases and milestones.",
    includes: ["Pipeline", "Job Types", "Photo Categories"],
    preview: {
      pipelineStages: ["New Lead", "Assessment", "Insurance Claim", "Mitigation", "Won", "Lost"],
      jobTypes: ["Water Damage", "Fire Damage", "Mold Remediation", "Reconstruction"],
      jobStatuses: ["New", "Assessing", "Mitigation", "Drying", "Reconstruction", "Completed"],
      photoCategories: ["Damage", "Moisture Reading", "Equipment Placed", "Progress", "After"],
      workOrderTemplates: ["Water Mitigation", "Mold Remediation", "Reconstruction"],
      customFields: ["Claim #", "Adjuster", "Loss Date"],
      agreementTemplates: ["Restoration Service Agreement"],
    },
  },
  {
    key: "property_maintenance", name: "Property Maintenance", status: "coming_soon",
    description: "Multi-property, recurring visits, and owner approvals.",
    includes: ["Pipeline", "Job Types", "Photo Categories"],
    preview: {
      pipelineStages: ["New Request", "Scheduled", "Estimate Sent", "Approved", "Won", "Lost"],
      jobTypes: ["Tenant Repair", "Turnover", "Recurring Visit", "Inspection"],
      jobStatuses: ["New", "Scheduled", "In Progress", "Owner Approval", "Completed"],
      photoCategories: ["Before", "After", "Damage", "Turnover", "Owner Approval"],
      workOrderTemplates: ["Tenant Repair Checklist", "Turnover Checklist", "Owner Approval Checklist"],
      customFields: ["Unit #", "Property Manager", "Owner Contact"],
      agreementTemplates: ["Property Maintenance Contract"],
    },
  },
  {
    key: "consulting", name: "B2B Consulting", status: "coming_soon",
    description: "Retainers and deliverables — no equipment or field work.",
    includes: ["Pipeline", "Job Types"],
    preview: {
      pipelineStages: ["New Lead", "Discovery", "Proposal Sent", "Negotiation", "Won", "Lost"],
      jobTypes: ["Discovery Call", "Engagement", "Deliverable", "Review"],
      jobStatuses: ["New", "Active", "In Review", "Delivered", "Closed"],
      photoCategories: ["Documents"],
      workOrderTemplates: ["Engagement Kickoff", "Deliverable Review"],
      customFields: ["Retainer Amount", "Engagement Length"],
      agreementTemplates: ["Consulting Retainer"],
    },
  },
  {
    key: "custom", name: "Custom", status: "available",
    description: "Start from a blank slate and build everything yourself.",
    includes: ["Blank slate"],
    preview: {
      pipelineStages: [], jobTypes: [], jobStatuses: [], photoCategories: [],
      workOrderTemplates: [], customFields: [], agreementTemplates: [],
    },
  },
];

// ─── Apply ────────────────────────────────────────────────
export interface ApplyResult { added: number; replaced: boolean; }

export function applyTemplate(key: string, mode: ApplyMode): ApplyResult {
  const tpl = INDUSTRY_TEMPLATES.find(t => t.key === key);
  if (!tpl || !tpl.data) return { added: 0, replaced: false };
  const d = tpl.data;
  let added = 0;

  // Pipeline stages
  {
    const existing = getStages();
    const existingKeys = new Set(existing.map(s => s.key));
    const built: PipelineStage[] = d.pipelineStages.map((s, i) => ({
      id: `ps-tpl-${key}-${i}`, name: s.name, key: pipeSlug(s.name),
      color: s.color, category: s.category, active: true, order: i + 1,
    }));
    if (mode === "replace") {
      saveStages(built); added += built.length;
    } else {
      const toAdd = built.filter(b => !existingKeys.has(b.key));
      added += toAdd.length;
      if (toAdd.length) saveStages([...existing, ...toAdd.map((b, i) => ({ ...b, order: existing.length + i + 1 }))]);
    }
  }

  // Job types
  {
    // Default color per category (editable afterward in Settings → Job Types).
    const TYPE_CAT_COLOR: Record<JobTypeCategory, string> = {
      service: "#ef4444", maintenance: "#239c8d", install: "#10b981", sales: "#8b5cf6",
      warranty: "#f59e0b", emergency: "#dc2626", project: "#0891b2",
    };
    const existing = getJobTypes();
    const existingKeys = new Set(existing.map(s => s.key));
    const built: JobTypeDef[] = d.jobTypes.map((t, i) => ({
      id: `jt-tpl-${key}-${i}`, name: t.name, key: jcSlug(t.name),
      description: "", duration: t.duration, category: t.category,
      color: TYPE_CAT_COLOR[t.category] ?? "#6b7280", active: true, order: i + 1,
    }));
    if (mode === "replace") {
      saveJobTypes(built); added += built.length;
    } else {
      const toAdd = built.filter(b => !existingKeys.has(b.key));
      added += toAdd.length;
      if (toAdd.length) saveJobTypes([...existing, ...toAdd.map((b, i) => ({ ...b, order: existing.length + i + 1 }))]);
    }
  }

  // Job statuses
  {
    const existing = getJobStatuses();
    const existingKeys = new Set(existing.map(s => s.key));
    const built: JobStatusDef[] = d.jobStatuses.map((s, i) => ({
      id: `js-tpl-${key}-${i}`, name: s.name, key: jcSlug(s.name),
      color: s.color, category: s.category, active: true, order: i + 1,
    }));
    if (mode === "replace") {
      saveJobStatuses(built); added += built.length;
    } else {
      const toAdd = built.filter(b => !existingKeys.has(b.key));
      added += toAdd.length;
      if (toAdd.length) saveJobStatuses([...existing, ...toAdd.map((b, i) => ({ ...b, order: existing.length + i + 1 }))]);
    }
  }

  // Photo categories
  {
    const existing = getPhotoCategories();
    const existingKeys = new Set(existing.map(s => s.key));
    const built: PhotoCategory[] = d.photoCategories.map((p, i) => ({
      id: `pc-tpl-${key}-${i}`, name: p.name, key: pcSlug(p.name),
      description: "", color: p.color, appliesTo: p.appliesTo,
      requiredByDefault: false, active: true, order: i + 1,
    }));
    if (mode === "replace") {
      savePhotoCategories(built); added += built.length;
    } else {
      const toAdd = built.filter(b => !existingKeys.has(b.key));
      added += toAdd.length;
      if (toAdd.length) savePhotoCategories([...existing, ...toAdd.map((b, i) => ({ ...b, order: existing.length + i + 1 }))]);
    }
  }

  return { added, replaced: mode === "replace" };
}

const ACTIVE_KEY = "crm-active-industry";
export function getActiveTemplate(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}
export function setActiveTemplate(key: string): void {
  try { localStorage.setItem(ACTIVE_KEY, key); } catch { /* ignore */ }
}
