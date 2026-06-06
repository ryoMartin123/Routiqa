// Company deletion cascade — orchestrates removal of a company together with
// every record that belongs to it: its branches, service areas, and the domain
// data scoped to it (customers, jobs, quotes, invoices, projects, agreements).
//
// Kept separate from lib/hierarchy/data.ts so the hierarchy store stays free of
// cross-domain imports. Agreements have no companyId, so they're matched through
// the company's customers (customerId).

import {
  getAllLocations, getAllServiceAreas, deleteCompany as deleteCompanyRecord,
} from "./data";
import { getCustomersByCompany, deleteCustomersByCompany } from "@/lib/customers/data";
import { getAllJobs, deleteJobsByCompany } from "@/lib/jobs/data";
import {
  getAllQuotes, getArchivedQuotes, getAllInvoices,
  deleteQuotesByCompany, deleteInvoicesByCompany,
} from "@/lib/quotes/data";
import { getAllProjects, deleteProjectsByCompany } from "@/lib/projects/data";
import { getAllAgreements, deleteAgreementsForCustomers } from "@/lib/agreements/data";
import { getAllLeads } from "@/lib/leads/data";

export interface CompanyImpact {
  locations: number;
  serviceAreas: number;
  customers: number;
  jobs: number;
  quotes: number;
  invoices: number;
  projects: number;
  agreements: number;
  leads: number;
  /** Total dependent records (everything except the company itself). */
  total: number;
}

// What deleting this company would remove. Used to power the warning dialog.
export function getCompanyImpact(companyId: string): CompanyImpact {
  const customerIds = new Set(getCustomersByCompany(companyId).map(c => c.id));

  const impact: Omit<CompanyImpact, "total"> = {
    locations:    getAllLocations().filter(l => l.companyId === companyId).length,
    serviceAreas: getAllServiceAreas().filter(s => s.companyId === companyId).length,
    customers:    customerIds.size,
    jobs:         getAllJobs().filter(j => j.companyId === companyId).length,
    quotes:       [...getAllQuotes(), ...getArchivedQuotes()].filter(q => q.companyId === companyId).length,
    invoices:     getAllInvoices().filter(i => i.companyId === companyId).length,
    projects:     getAllProjects().filter(p => p.companyId === companyId).length,
    agreements:   getAllAgreements().filter(a => a.customerId != null && customerIds.has(a.customerId)).length,
    leads:        getAllLeads().filter(l => l.companyId === companyId).length,
  };

  const total = Object.values(impact).reduce((sum, n) => sum + n, 0);
  return { ...impact, total };
}

// Permanently delete the company and everything scoped to it.
export function deleteCompanyCascade(companyId: string): void {
  // Capture customer ids before they're removed (needed for agreements).
  const customerIds = getCustomersByCompany(companyId).map(c => c.id);

  // Domain data first…
  deleteAgreementsForCustomers(customerIds);
  deleteCustomersByCompany(companyId);
  deleteJobsByCompany(companyId);
  deleteQuotesByCompany(companyId);
  deleteInvoicesByCompany(companyId);
  deleteProjectsByCompany(companyId);

  // …then the hierarchy records (company → branches → service areas).
  deleteCompanyRecord(companyId);
}
