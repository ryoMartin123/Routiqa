// ─── Agreements domain types + mock data ─────────────────
// Supports any service industry: HVAC, Roofing, Plumbing,
// Property Maintenance, Consulting, and more.
//
// Maps to future DB tables:
//   agreement_templates, customer_agreements,
//   agreement_visits, agreement_billing_events

export type AgreementStatus =
  | "active"
  | "due_soon"
  | "overdue"
  | "renewal_due"
  | "canceled";

export type BillingFrequency =
  | "Monthly"
  | "Quarterly"
  | "Semi-annual"
  | "Annual";

export type VisitFrequency =
  | "Monthly"
  | "Quarterly"
  | "2x per year"
  | "1x per year"
  | "As needed";

export type VisitStatus = "scheduled" | "completed" | "missed";

export type Industry =
  | "HVAC"
  | "Roofing"
  | "Plumbing"
  | "Property Maintenance"
  | "Consulting"
  | "General";

// ─── Visit ───────────────────────────────────────────────
export interface AgreementVisit {
  id: string;
  label: string;
  scheduled: string;
  status: VisitStatus;
  tech: string;
  completedDate?: string;
  notes?: string;
}

// ─── Customer Agreement ───────────────────────────────────
export interface CustomerAgreement {
  id: string;
  templateId: string;
  customer: string;
  customerInitials: string;
  type: string;
  industry: Industry;
  status: AgreementStatus;
  location: string;
  assignedTo: string;
  startDate: string;
  renewalDate: string;
  nextVisit: string | null;
  billingFrequency: BillingFrequency;
  visitFrequency: VisitFrequency;
  annualValue: number;
  services: string[];
  notes: string;
  visits: AgreementVisit[];
}

// ─── Agreement Template ───────────────────────────────────
export interface AgreementTemplate {
  id: string;
  name: string;
  industry: Industry;
  description: string;
  billingFrequency: BillingFrequency;
  visitFrequency: VisitFrequency;
  annualValue: number;
  priceLabel: string;
  services: string[];
  status: "active" | "draft" | "archived";
  activeCount: number;
}

// ─── Templates ────────────────────────────────────────────
export const TEMPLATES: AgreementTemplate[] = [
  {
    id: "t1", name: "HVAC Residential Maintenance Plan", industry: "HVAC",
    description: "Spring and fall tune-ups, filter replacements, and priority dispatch for residential HVAC systems.",
    billingFrequency: "Annual", visitFrequency: "2x per year",
    annualValue: 349, priceLabel: "$349/yr",
    services: ["Spring tune-up", "Fall tune-up", "Filter replacement", "Priority dispatch", "10% repair discount"],
    status: "active", activeCount: 5,
  },
  {
    id: "t2", name: "Commercial HVAC Quarterly Plan", industry: "HVAC",
    description: "Quarterly preventive maintenance for commercial HVAC systems with detailed service reports.",
    billingFrequency: "Quarterly", visitFrequency: "Quarterly",
    annualValue: 1200, priceLabel: "$300/qtr",
    services: ["Quarterly inspection", "Filter changes", "Coil cleaning", "Refrigerant check", "Priority scheduling", "Monthly reporting"],
    status: "active", activeCount: 2,
  },
  {
    id: "t3", name: "Roofing Annual Inspection Plan", industry: "Roofing",
    description: "Annual roof inspection with gutter cleaning and minor repair coverage for residential and commercial properties.",
    billingFrequency: "Annual", visitFrequency: "1x per year",
    annualValue: 599, priceLabel: "$599/yr",
    services: ["Annual inspection", "Gutter cleaning", "Photo report", "Minor repairs (1hr)", "Storm damage priority"],
    status: "active", activeCount: 1,
  },
  {
    id: "t4", name: "Plumbing Membership", industry: "Plumbing",
    description: "Quarterly plumbing inspections, drain cleaning, and water heater checks with emergency priority access.",
    billingFrequency: "Quarterly", visitFrequency: "Quarterly",
    annualValue: 299, priceLabel: "$75/qtr",
    services: ["Quarterly inspection", "Drain cleaning", "Water heater check", "Emergency priority", "15% repair discount"],
    status: "active", activeCount: 2,
  },
  {
    id: "t5", name: "Property Maintenance Contract", industry: "Property Maintenance",
    description: "Monthly property walkthroughs, minor repairs, seasonal preparation, and 24hr emergency line for commercial and multi-unit properties.",
    billingFrequency: "Monthly", visitFrequency: "Monthly",
    annualValue: 2400, priceLabel: "$200/mo",
    services: ["Monthly walkthrough", "Minor repairs included", "Seasonal prep", "24hr emergency line", "Dedicated account manager", "Quarterly property report"],
    status: "active", activeCount: 2,
  },
  {
    id: "t6", name: "Consulting Retainer", industry: "Consulting",
    description: "Monthly retainer for ongoing consulting, operations support, and strategic advisory services.",
    billingFrequency: "Monthly", visitFrequency: "As needed",
    annualValue: 36000, priceLabel: "$3,000/mo",
    services: ["Weekly check-in calls", "Strategy sessions", "Process documentation", "Team training", "Priority support"],
    status: "active", activeCount: 1,
  },
  {
    id: "t7", name: "HVAC Commercial Semi-annual Plan", industry: "HVAC",
    description: "Semi-annual HVAC maintenance for light commercial buildings.",
    billingFrequency: "Semi-annual", visitFrequency: "2x per year",
    annualValue: 799, priceLabel: "$399.50/6mo",
    services: ["Spring inspection", "Fall inspection", "Filter replacement", "Priority dispatch"],
    status: "draft", activeCount: 0,
  },
];

// ─── Customer Agreements ──────────────────────────────────
export const AGREEMENTS: CustomerAgreement[] = [
  {
    id: "1", templateId: "t1",
    customer: "Sarah Mitchell", customerInitials: "SM",
    type: "HVAC Residential Maintenance", industry: "HVAC",
    status: "active", location: "Augusta", assignedTo: "J. Patel",
    startDate: "Jan 15, 2022", renewalDate: "Jan 15, 2027",
    nextVisit: "Oct 15, 2026",
    billingFrequency: "Annual", visitFrequency: "2x per year",
    annualValue: 349,
    services: ["Spring tune-up", "Fall tune-up", "Filter replacement", "Priority dispatch", "10% repair discount"],
    notes: "Prefers morning appointments. Carrier 3-ton unit installed 2021. Always pays on time.",
    visits: [
      { id: "v1", label: "Spring Tune-up", scheduled: "Apr 3, 2026", status: "completed", tech: "J. Patel", completedDate: "Apr 3, 2026", notes: "Checked refrigerant, cleaned coils. System running well." },
      { id: "v2", label: "Fall Tune-up", scheduled: "Oct 15, 2026", status: "scheduled", tech: "J. Patel" },
    ],
  },
  {
    id: "2", templateId: "t2",
    customer: "Hammond LLC", customerInitials: "HL",
    type: "Commercial HVAC Quarterly", industry: "HVAC",
    status: "due_soon", location: "Augusta", assignedTo: "M. Cole",
    startDate: "Mar 1, 2021", renewalDate: "Mar 1, 2027",
    nextVisit: "Jun 10, 2026",
    billingFrequency: "Quarterly", visitFrequency: "Quarterly",
    annualValue: 1200,
    services: ["Quarterly inspection", "Filter changes", "Coil cleaning", "Refrigerant check", "Priority scheduling"],
    notes: "Large commercial account. Coordinate with property manager D. Webb. Net-30 invoicing.",
    visits: [
      { id: "v1", label: "Q1 Inspection", scheduled: "Mar 5, 2026", status: "completed", tech: "M. Cole", completedDate: "Mar 5, 2026", notes: "Replaced filters, checked all units." },
      { id: "v2", label: "Q2 Inspection", scheduled: "Jun 10, 2026", status: "scheduled", tech: "M. Cole" },
      { id: "v3", label: "Q3 Inspection", scheduled: "Sep 10, 2026", status: "scheduled", tech: "M. Cole" },
      { id: "v4", label: "Q4 Inspection", scheduled: "Dec 10, 2026", status: "scheduled", tech: "M. Cole" },
    ],
  },
  {
    id: "3", templateId: "t4",
    customer: "Lakeside Apartments", customerInitials: "LA",
    type: "Plumbing Membership", industry: "Plumbing",
    status: "active", location: "Evans", assignedTo: "M. Cole",
    startDate: "Feb 1, 2020", renewalDate: "Feb 1, 2027",
    nextVisit: "Aug 1, 2026",
    billingFrequency: "Quarterly", visitFrequency: "Quarterly",
    annualValue: 1200,
    services: ["Quarterly inspection", "Drain cleaning", "Water heater check", "Emergency priority", "15% repair discount"],
    notes: "24-unit apartment complex. Contact property manager Mike Torres. Emergency access required.",
    visits: [
      { id: "v1", label: "Q1 Inspection", scheduled: "Feb 3, 2026", status: "completed", tech: "M. Cole", completedDate: "Feb 3, 2026" },
      { id: "v2", label: "Q2 Inspection", scheduled: "May 5, 2026", status: "completed", tech: "M. Cole", completedDate: "May 5, 2026" },
      { id: "v3", label: "Q3 Inspection", scheduled: "Aug 1, 2026", status: "scheduled", tech: "M. Cole" },
      { id: "v4", label: "Q4 Inspection", scheduled: "Nov 3, 2026", status: "scheduled", tech: "M. Cole" },
    ],
  },
  {
    id: "4", templateId: "t5",
    customer: "ABC Property Group", customerInitials: "AP",
    type: "Property Maintenance Contract", industry: "Property Maintenance",
    status: "active", location: "Augusta", assignedTo: "D. Nguyen",
    startDate: "Nov 1, 2019", renewalDate: "Nov 1, 2026",
    nextVisit: "Jun 2, 2026",
    billingFrequency: "Monthly", visitFrequency: "Monthly",
    annualValue: 2400,
    services: ["Monthly walkthrough", "Minor repairs included", "Seasonal prep", "24hr emergency line", "Quarterly property report"],
    notes: "Commercial property group with 3 locations. Priority client. Requires monthly summary email.",
    visits: [
      { id: "v1", label: "May Walkthrough", scheduled: "May 5, 2026", status: "completed", tech: "D. Nguyen", completedDate: "May 5, 2026", notes: "Fixed 2 door hinges, reported leak in unit 4." },
      { id: "v2", label: "Jun Walkthrough", scheduled: "Jun 2, 2026", status: "scheduled", tech: "D. Nguyen" },
      { id: "v3", label: "Jul Walkthrough", scheduled: "Jul 7, 2026", status: "scheduled", tech: "D. Nguyen" },
    ],
  },
  {
    id: "5", templateId: "t6",
    customer: "Southeast Restoration", customerInitials: "SR",
    type: "Consulting Retainer", industry: "Consulting",
    status: "active", location: "Columbia", assignedTo: "Unassigned",
    startDate: "Jan 1, 2026", renewalDate: "Dec 31, 2026",
    nextVisit: null,
    billingFrequency: "Monthly", visitFrequency: "As needed",
    annualValue: 36000,
    services: ["Weekly check-in calls", "Strategy sessions", "Process documentation", "Priority support"],
    notes: "New consulting client. Focused on operations optimization. Monthly billing on the 1st.",
    visits: [],
  },
  {
    id: "6", templateId: "t3",
    customer: "Hammond LLC", customerInitials: "HL",
    type: "Roofing Annual Inspection", industry: "Roofing",
    status: "renewal_due", location: "Augusta", assignedTo: "D. Nguyen",
    startDate: "Jun 30, 2025", renewalDate: "Jun 30, 2026",
    nextVisit: null,
    billingFrequency: "Annual", visitFrequency: "1x per year",
    annualValue: 599,
    services: ["Annual inspection", "Gutter cleaning", "Photo report", "Minor repairs (1hr)", "Storm damage priority"],
    notes: "Renewal outreach sent May 15. Follow up by June 1.",
    visits: [
      { id: "v1", label: "2025 Annual Inspection", scheduled: "Jun 15, 2025", status: "completed", tech: "D. Nguyen", completedDate: "Jun 15, 2025", notes: "Replaced 3 missing shingles, cleaned gutters." },
    ],
  },
  {
    id: "7", templateId: "t1",
    customer: "Donna Reeves", customerInitials: "DR",
    type: "HVAC Residential Maintenance", industry: "HVAC",
    status: "active", location: "Augusta", assignedTo: "J. Patel",
    startDate: "Sep 1, 2020", renewalDate: "Sep 1, 2026",
    nextVisit: "Sep 10, 2026",
    billingFrequency: "Annual", visitFrequency: "2x per year",
    annualValue: 349,
    services: ["Spring tune-up", "Fall tune-up", "Filter replacement", "Priority dispatch"],
    notes: "",
    visits: [
      { id: "v1", label: "Spring Tune-up", scheduled: "Mar 20, 2026", status: "completed", tech: "J. Patel", completedDate: "Mar 20, 2026" },
      { id: "v2", label: "Fall Tune-up", scheduled: "Sep 10, 2026", status: "scheduled", tech: "J. Patel" },
    ],
  },
  {
    id: "8", templateId: "t1",
    customer: "Alvarez Residence", customerInitials: "AR",
    type: "HVAC Residential Maintenance", industry: "HVAC",
    status: "overdue", location: "Augusta", assignedTo: "J. Patel",
    startDate: "Jun 1, 2021", renewalDate: "Jun 1, 2027",
    nextVisit: "May 1, 2026",
    billingFrequency: "Annual", visitFrequency: "2x per year",
    annualValue: 349,
    services: ["Spring tune-up", "Fall tune-up", "Filter replacement", "Priority dispatch"],
    notes: "Spring visit is overdue — customer has been out of town. Reschedule ASAP.",
    visits: [
      { id: "v1", label: "Spring Tune-up", scheduled: "May 1, 2026", status: "missed", tech: "J. Patel", notes: "Customer unavailable. Needs to be rescheduled." },
      { id: "v2", label: "Fall Tune-up", scheduled: "Oct 1, 2026", status: "scheduled", tech: "J. Patel" },
    ],
  },
  {
    id: "9", templateId: "t5",
    customer: "Grovetown Storage LLC", customerInitials: "GS",
    type: "Property Maintenance Contract", industry: "Property Maintenance",
    status: "renewal_due", location: "Grovetown", assignedTo: "D. Nguyen",
    startDate: "Jul 1, 2022", renewalDate: "Jul 1, 2026",
    nextVisit: "Jun 8, 2026",
    billingFrequency: "Monthly", visitFrequency: "Monthly",
    annualValue: 2400,
    services: ["Monthly walkthrough", "Minor repairs included", "Seasonal prep", "24hr emergency line"],
    notes: "Renewal coming up July 1. Send renewal package by June 1.",
    visits: [
      { id: "v1", label: "May Walkthrough", scheduled: "May 12, 2026", status: "completed", tech: "D. Nguyen", completedDate: "May 12, 2026" },
      { id: "v2", label: "Jun Walkthrough", scheduled: "Jun 8, 2026", status: "scheduled", tech: "D. Nguyen" },
    ],
  },
  {
    id: "10", templateId: "t1",
    customer: "Jennifer Torres", customerInitials: "JT",
    type: "HVAC Residential Maintenance", industry: "HVAC",
    status: "due_soon", location: "Augusta", assignedTo: "J. Patel",
    startDate: "Mar 1, 2023", renewalDate: "Mar 1, 2027",
    nextVisit: "Jun 12, 2026",
    billingFrequency: "Annual", visitFrequency: "2x per year",
    annualValue: 349,
    services: ["Spring tune-up", "Fall tune-up", "Filter replacement", "Priority dispatch"],
    notes: "",
    visits: [
      { id: "v1", label: "Spring Tune-up", scheduled: "Jun 12, 2026", status: "scheduled", tech: "J. Patel" },
      { id: "v2", label: "Fall Tune-up", scheduled: "Nov 5, 2026", status: "scheduled", tech: "J. Patel" },
    ],
  },
  {
    id: "11", templateId: "t2",
    customer: "Evans Professional Park", customerInitials: "EP",
    type: "Commercial HVAC Quarterly", industry: "HVAC",
    status: "renewal_due", location: "Evans", assignedTo: "M. Cole",
    startDate: "Jan 1, 2021", renewalDate: "Jun 30, 2026",
    nextVisit: null,
    billingFrequency: "Quarterly", visitFrequency: "Quarterly",
    annualValue: 1200,
    services: ["Quarterly inspection", "Filter changes", "Coil cleaning", "Priority scheduling"],
    notes: "Renewal due June 30. Pricing increase discussion needed.",
    visits: [
      { id: "v1", label: "Q1 Inspection", scheduled: "Mar 15, 2026", status: "completed", tech: "M. Cole", completedDate: "Mar 15, 2026" },
    ],
  },
  {
    id: "12", templateId: "t4",
    customer: "Carlos Vega", customerInitials: "CV",
    type: "Plumbing Membership", industry: "Plumbing",
    status: "active", location: "Aiken", assignedTo: "M. Cole",
    startDate: "Feb 1, 2022", renewalDate: "Feb 1, 2027",
    nextVisit: "Aug 15, 2026",
    billingFrequency: "Quarterly", visitFrequency: "Quarterly",
    annualValue: 299,
    services: ["Quarterly inspection", "Drain cleaning", "Water heater check", "Emergency priority"],
    notes: "",
    visits: [
      { id: "v1", label: "Q1 Inspection", scheduled: "Feb 10, 2026", status: "completed", tech: "M. Cole", completedDate: "Feb 10, 2026" },
      { id: "v2", label: "Q2 Inspection", scheduled: "May 12, 2026", status: "completed", tech: "M. Cole", completedDate: "May 12, 2026" },
      { id: "v3", label: "Q3 Inspection", scheduled: "Aug 15, 2026", status: "scheduled", tech: "M. Cole" },
      { id: "v4", label: "Q4 Inspection", scheduled: "Nov 10, 2026", status: "scheduled", tech: "M. Cole" },
    ],
  },
];

// ─── Derived summary stats ────────────────────────────────
export const AGREEMENT_STATS = {
  active:          AGREEMENTS.filter((a) => a.status === "active" || a.status === "due_soon").length,
  visitsDueMonth:  AGREEMENTS.filter((a) => a.nextVisit?.includes("Jun") || a.nextVisit?.includes("May")).length,
  renewalsDueSoon: AGREEMENTS.filter((a) => a.status === "renewal_due").length,
  annualRevenue:   AGREEMENTS.filter((a) => a.status !== "canceled").reduce((sum, a) => sum + a.annualValue, 0),
};

// ─── Helpers ──────────────────────────────────────────────
export function formatValue(a: CustomerAgreement): string {
  if (a.billingFrequency === "Monthly") {
    return `$${(a.annualValue / 12).toLocaleString()}/mo`;
  }
  if (a.billingFrequency === "Quarterly") {
    return `$${(a.annualValue / 4).toLocaleString()}/qtr`;
  }
  return `$${a.annualValue.toLocaleString()}/yr`;
}
