// ─── Sample data loader ───────────────────────────────────
// Populates the runtime stores (the same localStorage-backed stores the app
// writes to) with one customer per account type, each with a real job, plus an
// agreement and a quote on the first account — so the wired-up customer profile
// (Overview, Jobs, Agreements, Billing, Timeline) has data to render.
//
// Everything goes through the normal create paths and is built to be
// indistinguishable from accounts entered by hand: the same id format the New
// Customer wizard uses, no "test"/"seeded" tags or notes. Records are fully
// editable and deletable like any other. Idempotent: re-running skips accounts
// whose name already exists.

import {
  getAllCustomers, saveProperties, getProperties, type Customer, type AccountType, type CustomerStatus, type CustomerType, type Property,
} from "@/lib/customers/data";
import { getAllLocations } from "@/lib/hierarchy/data";
import { createJob, type JobType } from "@/lib/jobs/data";
import { createAgreement } from "@/lib/agreements/data";
import { createQuote } from "@/lib/quotes/data";

const COMMERCIAL_TYPES: AccountType[] = ["commercial", "property_management", "multi_site"];

function initials(name: string): string {
  const w = name.trim().split(/\s+/);
  return (w.length >= 2 ? w[0][0] + w[w.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

interface Spec {
  name: string;
  accountType: AccountType;
  status: CustomerStatus;
  phone: string;
  email: string;
  address: string; city: string; state: string; zip: string;
  job: { title: string; type: JobType; tech: string; amount?: string; scheduledDate?: string; scheduledTime?: string };
}

const SPECS: Spec[] = [
  {
    name: "Ryo Martin", accountType: "residential", status: "Customer",
    phone: "(706) 555-0142", email: "ryo.martin@example.com",
    address: "418 Telfair St", city: "Augusta", state: "GA", zip: "30901",
    job: { title: "AC Tune-Up", type: "maintenance", tech: "Marcus Reyes", amount: "$189.00", scheduledDate: "Jun 12, 2026", scheduledTime: "9:00 AM" },
  },
  {
    name: "Brecht Holdings LLC", accountType: "commercial", status: "Customer",
    phone: "(706) 555-0188", email: "facilities@brechtholdings.com",
    address: "2201 Central Ave", city: "Augusta", state: "GA", zip: "30904",
    job: { title: "Rooftop Unit Replacement", type: "replacement", tech: "Marcus Reyes", amount: "$12,400.00", scheduledDate: "Jun 18, 2026", scheduledTime: "8:00 AM" },
  },
  {
    name: "Giesbrecht Property Group", accountType: "property_management", status: "Customer",
    phone: "(706) 555-0211", email: "ops@giesbrechtpg.com",
    address: "150 Greene St", city: "Augusta", state: "GA", zip: "30901",
    job: { title: "Quarterly HVAC Inspection", type: "inspection", tech: "Marcus Reyes", scheduledDate: "Jun 20, 2026", scheduledTime: "10:30 AM" },
  },
  {
    name: "Southern Rentals Network", accountType: "multi_site", status: "Prospect",
    phone: "(803) 555-0177", email: "maintenance@southernrentals.com",
    address: "905 Georgia Ave", city: "North Augusta", state: "SC", zip: "29841",
    job: { title: "Unit 4B Furnace Repair", type: "repair", tech: "Marcus Reyes", amount: "$420.00", scheduledDate: "Jun 22, 2026", scheduledTime: "1:00 PM" },
  },
  {
    name: "Augusta Community Center", accountType: "other", status: "Prospect",
    phone: "(706) 555-0133", email: "info@augustacc.org",
    address: "3014 Wrightsboro Rd", city: "Augusta", state: "GA", zip: "30909",
    job: { title: "Walkthrough & Estimate", type: "estimate", tech: "Marcus Reyes" },
  },
];

// Returns the number of accounts created (0 if all already present).
export function seedTestData(addCustomer: (c: Customer) => void): number {
  const existing = new Set(getAllCustomers().map(c => c.name));

  // Resolve a real branch from the configured hierarchy (fall back to seed ids).
  const loc = getAllLocations().find(l => l.id === "loc_augusta")
    ?? getAllLocations().find(l => l.status === "active")
    ?? getAllLocations()[0];
  const companyId    = loc?.companyId ?? "co_hvac";
  const locationId   = loc?.id ?? "loc_augusta";
  const locationName = loc?.name ?? "Augusta Branch";

  let created = 0;

  SPECS.forEach((spec, idx) => {
    if (existing.has(spec.name)) return;

    const type: CustomerType = COMMERCIAL_TYPES.includes(spec.accountType) ? "Commercial" : "Residential";
    const ini = initials(spec.name);
    const customer: Customer = {
      // Same id shape the New Customer wizard produces (buildCustomer), so seeded
      // accounts are indistinguishable from hand-entered ones.
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${idx}`,
      name: spec.name,
      initials: ini,
      accountType: spec.accountType,
      type,
      status: spec.status,
      companyId, locationId, locationName,
      serviceAreaId: undefined,
      address: spec.address, city: spec.city, state: spec.state, zip: spec.zip,
      phone: spec.phone, email: spec.email,
      since: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      tags: [],
      notes: "",
    };
    addCustomer(customer);
    created++;

    // A real job on the account (this is what surfaces on the profile).
    createJob({
      companyId, locationId,
      accountId: customer.id,
      customerName: customer.name, customerInitials: ini, locationName,
      propertyAddress: `${spec.address}, ${spec.city}, ${spec.state} ${spec.zip}`,
      title: spec.job.title, type: spec.job.type, priority: "normal",
      estimatedAmount: spec.job.amount,
      assignedTo: spec.job.tech, assignedToInitials: initials(spec.job.tech),
      scheduledDate: spec.job.scheduledDate, scheduledTime: spec.job.scheduledTime,
    });

    // The multi-site account holds several properties, so the job wizard's
    // "which property?" picker has something real to choose from.
    if (idx === 3) {
      const sites: Property[] = [
        { id: `p-${Date.now()}-${idx}-a`, customerId: customer.id, label: "Building A — Riverside", address: spec.address, city: spec.city, state: spec.state, zip: spec.zip, type: "Multi-Family", status: "active", isPrimary: true },
        { id: `p-${Date.now()}-${idx}-b`, customerId: customer.id, label: "Building B — Hillcrest", address: "212 Hillcrest Dr", city: "North Augusta", state: "SC", zip: "29841", type: "Multi-Family", status: "active", isPrimary: false },
        { id: `p-${Date.now()}-${idx}-c`, customerId: customer.id, label: "Maple Court Duplexes", address: "47 Maple Ct", city: "Aiken", state: "SC", zip: "29801", type: "Multi-Family", status: "active", isPrimary: false },
      ];
      saveProperties(customer.id, sites);
    }

    // Give the first account an agreement + a quote so Billing / Agreements /
    // Timeline all have something to show.
    if (idx === 0) {
      const agProps = getProperties(customer.id);
      const agProperty = agProps.find(p => p.isPrimary) ?? agProps[0];
      createAgreement({
        customerId: customer.id,
        customer: customer.name, customerInitials: ini,
        propertyId: agProperty.id,
        propertyLabel: `${agProperty.label ? agProperty.label + " — " : ""}${agProperty.address}, ${agProperty.city}`,
        location: locationName, assignedTo: spec.job.tech,
        type: "HVAC Residential Maintenance Plan", industry: "HVAC",
        templateId: "t1",
        startDate: "Jun 1, 2026", renewalDate: "Jun 1, 2027",
        services: ["2 tune-ups / year", "Priority scheduling", "15% repair discount"],
        visitFrequency: "2x per year", billingFrequency: "Annual",
        annualValue: 318,
        status: "active",
      });

      createQuote({
        customerId: customer.id,
        customerName: customer.name, customerInitials: ini, locationName,
        companyId, locationId,
        title: "Furnace Replacement Estimate",
        lineItems: [
          { id: `li-test-${Date.now()}-1`, description: "High-efficiency furnace (80k BTU)", quantity: 1, unitPrice: 3200, total: 3200 },
          { id: `li-test-${Date.now()}-2`, description: "Installation & haul-away", quantity: 1, unitPrice: 950, total: 950 },
        ],
      });
    }
  });

  return created;
}
