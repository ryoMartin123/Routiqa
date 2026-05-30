// ─── Customer domain types + mock data ───────────────────
// Maps to future DB tables:
//   accounts, contacts, properties, equipment,
//   jobs (summary view), leads, customer_notes

// ─── Types ────────────────────────────────────────────────
export type AccountType    = "residential" | "commercial" | "property_management" | "multi_site" | "other";
export type CustomerType   = "Residential" | "Commercial";   // display label, derived from accountType
export type CustomerStatus = "Customer" | "Lead";
export type PropertyType   = "Residential" | "Commercial" | "Industrial" | "Multi-Family";
export type JobStatus      = "Scheduled" | "In Progress" | "Completed" | "Canceled";
export type LeadStatus     = "New" | "Contacted" | "Quoted" | "Won" | "Lost";
export type NoteType       = "note" | "call" | "email" | "visit";
export type EquipmentStatus = "operational" | "needs_service" | "retired";

export interface Customer {
  id: string;
  name: string;
  initials: string;
  accountType: AccountType;
  type: CustomerType;         // Residential | Commercial (display)
  status: CustomerStatus;
  parentAccountId?: string;   // for sub-accounts under property management parents
  // Hierarchy
  companyId: string;
  locationId: string;
  serviceAreaId?: string;
  locationName: string;
  // Contact
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email?: string;
  since: string;
  tags: string[];
  notes: string;
}

export interface Contact {
  id: string;
  customerId: string;
  name: string;
  role?: string;             // e.g. "Homeowner", "Property Manager", "Owner"
  phone?: string;
  email?: string;
  preferredContact?: "phone" | "email" | "text";
  isPrimary: boolean;
  notes?: string;
}

export interface Property {
  id: string;
  customerId: string;
  label?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: PropertyType;
  sqft?: number;
  yearBuilt?: number;
  accessNotes?: string;
  serviceAreaId?: string;
  status?: "active" | "inactive";
  isPrimary: boolean;
}

export interface Equipment {
  id: string;
  customerId: string;
  propertyId?: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  installDate?: string;
  lastServiceDate?: string;
  status: EquipmentStatus;
  notes?: string;
}

export interface CustomerJob {
  id: string;
  customerId: string;
  title: string;
  type: string;
  status: JobStatus;
  date: string;
  tech: string;
  amount?: string;
}

export interface CustomerLead {
  id: string;
  customerId: string;
  title: string;
  status: LeadStatus;
  date: string;
  value?: string;
  source?: string;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  date: string;
  user: string;
  userInitials: string;
  text: string;
  type: NoteType;
}

// ─── Customer list ────────────────────────────────────────
export const ALL_CUSTOMERS: Customer[] = [
  { id: "1",  name: "Sarah Mitchell",         initials: "SM", accountType: "residential",        type: "Residential", status: "Customer", companyId: "co_hvac",    locationId: "loc_augusta",  serviceAreaId: "sa_augusta",   locationName: "Augusta Branch",  address: "412 Oak St",             city: "Augusta",   state: "GA", zip: "30909", phone: "(706) 555-0142", email: "sarah.m@email.com",        since: "Jan 2022", tags: ["HVAC Agreement", "VIP"],   notes: "Prefers morning appointments. Carrier 3-ton unit installed 2021. Very responsive via text." },
  { id: "2",  name: "Hammond LLC",            initials: "HL", accountType: "commercial",         type: "Commercial",  status: "Customer", companyId: "co_hvac",    locationId: "loc_augusta",  serviceAreaId: "sa_augusta",   locationName: "Augusta Branch",  address: "1200 Industrial Way",    city: "Augusta",   state: "GA", zip: "30901", phone: "(706) 442-8800", email: "office@hammondllc.com",    since: "Mar 2021", tags: ["Commercial", "Net-30"],    notes: "Large commercial account. Coordinate with property manager D. Webb. Invoice on the 1st." },
  { id: "3",  name: "K. Brennan",             initials: "KB", accountType: "residential",        type: "Residential", status: "Customer", companyId: "co_hvac",    locationId: "loc_augusta",  serviceAreaId: "sa_augusta",   locationName: "Augusta Branch",  address: "27 Maple Ct",            city: "Augusta",   state: "GA", zip: "30907", phone: "(706) 555-0888", email: "kbrennan@gmail.com",       since: "Aug 2023", tags: [],                          notes: "" },
  { id: "4",  name: "Lakeside Apartments",    initials: "LA", accountType: "property_management",type: "Commercial",  status: "Customer", companyId: "co_hvac",    locationId: "loc_evans",    serviceAreaId: "sa_evans",     locationName: "Evans Branch",    address: "88 Lakeside Dr",         city: "Evans",     state: "GA", zip: "30809", phone: "(706) 555-2200", email: "management@lakeside.com",  since: "Feb 2020", tags: ["Plumbing Membership"],     notes: "24-unit complex. Contact: Mike Torres. Emergency access required." },
  { id: "5",  name: "T. Okafor",              initials: "TO", accountType: "residential",        type: "Residential", status: "Lead",     companyId: "co_hvac",    locationId: "loc_augusta",  serviceAreaId: "sa_martinez",  locationName: "Augusta Branch",  address: "334 Pinehurst Rd",       city: "Martinez",  state: "GA", zip: "30907", phone: "(803) 391-4422", email: "tokafor@email.com",        since: "May 2026", tags: [],                          notes: "Roof damage inquiry from web form. Needs estimate." },
  { id: "6",  name: "Southeast Restoration",  initials: "SR", accountType: "commercial",         type: "Commercial",  status: "Lead",     companyId: "co_roofing", locationId: "loc_columbia", serviceAreaId: "sa_columbia",  locationName: "Columbia Branch", address: "555 Commerce Blvd",      city: "Columbia",  state: "SC", zip: "29201", phone: "(803) 229-1183", email: "info@serestoration.com",   since: "May 2026", tags: [],                          notes: "Consulting retainer inquiry. Decision maker is COO." },
  { id: "7",  name: "Alvarez Residence",      initials: "AR", accountType: "residential",        type: "Residential", status: "Customer", companyId: "co_hvac",    locationId: "loc_augusta",  serviceAreaId: "sa_augusta",   locationName: "Augusta Branch",  address: "1840 Peach Orchard Rd",  city: "Augusta",   state: "GA", zip: "30906", phone: "(706) 555-3391", email: "alvarez.fam@email.com",    since: "Jun 2021", tags: ["HVAC Agreement"],          notes: "Spring visit is overdue — customer was out of town." },
  { id: "8",  name: "ABC Property Group",     initials: "AP", accountType: "property_management",type: "Commercial",  status: "Customer", companyId: "co_hvac",    locationId: "loc_augusta",  serviceAreaId: "sa_augusta",   locationName: "Augusta Branch",  address: "890 Business Park Dr",   city: "Augusta",   state: "GA", zip: "30904", phone: "(706) 555-7890", email: "mgmt@abcproperty.com",     since: "Nov 2019", tags: ["Property Maintenance"],    notes: "Commercial property group with 3 locations. Requires monthly summary." },
  { id: "9",  name: "Jennifer Torres",        initials: "JT", accountType: "residential",        type: "Residential", status: "Customer", companyId: "co_hvac",    locationId: "loc_augusta",  serviceAreaId: "sa_augusta",   locationName: "Augusta Branch",  address: "1450 Riverwatch Pkwy",   city: "Augusta",   state: "GA", zip: "30909", phone: "(706) 555-3344", email: "jtorres@gmail.com",        since: "Mar 2023", tags: [],                          notes: "" },
  { id: "10", name: "Grovetown Storage LLC",  initials: "GS", accountType: "commercial",         type: "Commercial",  status: "Customer", companyId: "co_hvac",    locationId: "loc_augusta",  serviceAreaId: "sa_grovetown", locationName: "Augusta Branch",  address: "200 Storage Way",        city: "Grovetown", state: "GA", zip: "30813", phone: "(706) 555-6677", email: "ops@grovetownstorage.com", since: "Jul 2022", tags: [],                          notes: "Storage facility. Renewal coming up July 1." },
  { id: "11", name: "Michael Dunbar",         initials: "MD", accountType: "residential",        type: "Residential", status: "Lead",     companyId: "co_hvac",    locationId: "loc_evans",    serviceAreaId: "sa_evans",     locationName: "Evans Branch",    address: "78 Clubhouse Dr",        city: "Evans",     state: "GA", zip: "30809", phone: "(706) 555-1234", email: "m.dunbar@email.com",       since: "Apr 2026", tags: [],                          notes: "Called about new construction HVAC install." },
  { id: "12", name: "Evans Professional Park",initials: "EP", accountType: "commercial",         type: "Commercial",  status: "Customer", companyId: "co_hvac",    locationId: "loc_evans",    serviceAreaId: "sa_evans",     locationName: "Evans Branch",    address: "3000 Professional Pkwy", city: "Evans",     state: "GA", zip: "30809", phone: "(706) 555-8899", email: "admin@evanspro.com",       since: "Jan 2021", tags: ["HVAC Agreement"],          notes: "Renewal pricing discussion needed." },
  { id: "13", name: "Donna Reeves",           initials: "DR", accountType: "residential",        type: "Residential", status: "Customer", companyId: "co_hvac",    locationId: "loc_augusta",  serviceAreaId: "sa_augusta",   locationName: "Augusta Branch",  address: "50 Windsor Spring Rd",   city: "Augusta",   state: "GA", zip: "30906", phone: "(706) 555-4455", email: "dreeves@email.com",        since: "Sep 2020", tags: [],                          notes: "" },
  { id: "14", name: "Columbia Health Systems",initials: "CH", accountType: "commercial",         type: "Commercial",  status: "Lead",     companyId: "co_roofing", locationId: "loc_columbia", serviceAreaId: "sa_columbia",  locationName: "Columbia Branch", address: "1301 Taylor St",         city: "Columbia",  state: "SC", zip: "29201", phone: "(803) 555-9900", email: "facilities@colhealth.com", since: "May 2026", tags: [],                          notes: "Facilities director is the decision maker." },
  { id: "15", name: "Carlos Vega",            initials: "CV", accountType: "residential",        type: "Residential", status: "Customer", companyId: "co_roofing", locationId: "loc_columbia", serviceAreaId: "sa_aiken",     locationName: "Columbia Branch", address: "209 Bees Creek Rd",      city: "Aiken",     state: "SC", zip: "29803", phone: "(803) 555-7712", email: "cvega@gmail.com",          since: "Feb 2022", tags: ["Plumbing Membership"],     notes: "" },
];

// ─── Contacts ─────────────────────────────────────────────
export const CONTACTS: Record<string, Contact[]> = {
  "1": [
    { id: "c1-1", customerId: "1", name: "Sarah Mitchell", role: "Homeowner", phone: "(706) 555-0142", email: "sarah.m@email.com", preferredContact: "text", isPrimary: true },
  ],
  "2": [
    { id: "c2-1", customerId: "2", name: "D. Webb",      role: "Property Manager",  phone: "(706) 442-8801", email: "d.webb@hammondllc.com",   preferredContact: "phone", isPrimary: true,  notes: "Primary operational contact." },
    { id: "c2-2", customerId: "2", name: "Tom Hammond",  role: "Owner",             phone: "(706) 442-8800", email: "t.hammond@hammondllc.com", preferredContact: "email", isPrimary: false, notes: "Involved in large repair decisions only." },
    { id: "c2-3", customerId: "2", name: "Billing Dept", role: "Billing Contact",  phone: "(706) 442-8810", email: "billing@hammondllc.com",   preferredContact: "email", isPrimary: false },
  ],
  "4": [
    { id: "c4-1", customerId: "4", name: "Mike Torres",  role: "Property Manager",  phone: "(706) 555-2201", email: "mtorres@lakeside.com",     preferredContact: "phone", isPrimary: true,  notes: "Has emergency access. Available 8am–5pm." },
    { id: "c4-2", customerId: "4", name: "Owner (Corp)", role: "Primary Contact",  phone: "(800) 555-0100", email: "mgmt@lakeside-corp.com",    preferredContact: "email", isPrimary: false },
  ],
  "8": [
    { id: "c8-1", customerId: "8", name: "Robert Chen",  role: "Facility Manager", phone: "(706) 555-7891", email: "rchen@abcproperty.com",   preferredContact: "phone", isPrimary: true },
    { id: "c8-2", customerId: "8", name: "Lisa Park",    role: "Billing Contact",      phone: "(706) 555-7892", email: "billing@abcproperty.com", preferredContact: "email", isPrimary: false },
  ],
  "12": [
    { id: "c12-1", customerId: "12", name: "Admin Office", role: "Property Manager", phone: "(706) 555-8899", email: "admin@evanspro.com", preferredContact: "email", isPrimary: true },
  ],
};

// ─── Properties ───────────────────────────────────────────
export const PROPERTIES: Record<string, Property[]> = {
  "1": [
    { id: "p1-1", customerId: "1", label: "Primary Residence", address: "412 Oak St",           city: "Augusta",  state: "GA", zip: "30909", type: "Residential",  sqft: 1800,  yearBuilt: 2005, isPrimary: true },
  ],
  "2": [
    { id: "p2-1", customerId: "2", label: "Main Office",       address: "1200 Industrial Way",  city: "Augusta",  state: "GA", zip: "30901", type: "Commercial",   sqft: 12000, yearBuilt: 1998, isPrimary: true,  accessNotes: "Check in with front desk. HVAC room is in basement." },
    { id: "p2-2", customerId: "2", label: "Business Park",     address: "890 Business Park Dr", city: "Augusta",  state: "GA", zip: "30904", type: "Commercial",   sqft: 8500,  yearBuilt: 2003, isPrimary: false },
  ],
  "4": [
    { id: "p4-1", customerId: "4", label: "Lakeside Complex",  address: "88 Lakeside Dr",       city: "Evans",    state: "GA", zip: "30809", type: "Multi-Family", sqft: 28000, yearBuilt: 1995, isPrimary: true,  accessNotes: "Use key box #4. Manager on site 9am-5pm Mon-Fri." },
  ],
  "8": [
    { id: "p8-1", customerId: "8", label: "Property 1",        address: "890 Business Park Dr", city: "Augusta",  state: "GA", zip: "30904", type: "Commercial",   sqft: 8500,  yearBuilt: 2003, isPrimary: true },
    { id: "p8-2", customerId: "8", label: "Property 2",        address: "142 Commerce Circle",  city: "Augusta",  state: "GA", zip: "30907", type: "Commercial",   sqft: 5200,  yearBuilt: 2010, isPrimary: false },
    { id: "p8-3", customerId: "8", label: "Storage Annex",     address: "211 Warehouse Blvd",   city: "Augusta",  state: "GA", zip: "30904", type: "Industrial",   sqft: 3000,  yearBuilt: 2001, isPrimary: false },
  ],
};

// ─── Equipment ────────────────────────────────────────────
export const EQUIPMENT: Record<string, Equipment[]> = {
  "1": [
    { id: "e1-1", customerId: "1", propertyId: "p1-1", name: "Carrier Central AC / Heat Pump", brand: "Carrier",       model: "24ACC636A003",     serialNumber: "1821CAR4892", installDate: "Mar 2021", lastServiceDate: "Apr 3, 2026",  status: "operational",   notes: "3-ton, central AC/heat pump combo" },
    { id: "e1-2", customerId: "1", propertyId: "p1-1", name: "Bradford White Water Heater",    brand: "Bradford White", model: "RE250S6-1NCWW",    serialNumber: "BW193341",    installDate: "Aug 2019", lastServiceDate: "Apr 3, 2026",  status: "operational",   notes: "50 gallon electric" },
    { id: "e1-3", customerId: "1", propertyId: "p1-1", name: "Aprilaire Humidifier",           brand: "Aprilaire",      model: "600M",             serialNumber: "APR21-0044",  installDate: "Mar 2021",                                 status: "operational" },
  ],
  "2": [
    { id: "e2-1", customerId: "2", propertyId: "p2-1", name: "Trane Rooftop Unit 1", brand: "Trane", model: "YCD060F3H0BC", serialNumber: "18TRN001", installDate: "Jun 2018", lastServiceDate: "Mar 5, 2026", status: "operational",   notes: "5-ton, main office wing" },
    { id: "e2-2", customerId: "2", propertyId: "p2-1", name: "Trane Rooftop Unit 2", brand: "Trane", model: "YCD060F3H0BC", serialNumber: "18TRN002", installDate: "Jun 2018", lastServiceDate: "Mar 5, 2026", status: "operational",   notes: "5-ton, warehouse" },
    { id: "e2-3", customerId: "2", propertyId: "p2-1", name: "Trane Rooftop Unit 3", brand: "Trane", model: "YCD036F3H0BC", serialNumber: "18TRN003", installDate: "Jun 2018", lastServiceDate: "Mar 5, 2026", status: "needs_service", notes: "3-ton — needs capacitor check" },
    { id: "e2-4", customerId: "2", propertyId: "p2-1", name: "Trane Rooftop Unit 4", brand: "Trane", model: "YCD036F3H0BC", serialNumber: "18TRN004", installDate: "Jun 2018", lastServiceDate: "Mar 5, 2026", status: "operational" },
    { id: "e2-5", customerId: "2", propertyId: "p2-1", name: "Weil-McLain Gas Boiler", brand: "Weil-McLain", model: "CGi-6", serialNumber: "WM150042", installDate: "Oct 2015", lastServiceDate: "Dec 10, 2025", status: "operational", notes: "Gas boiler, 200k BTU" },
  ],
  "4": [
    { id: "e4-1", customerId: "4", propertyId: "p4-1", name: "Water Heater — Building A", brand: "A.O. Smith", model: "HPTU-80",  serialNumber: "AOS19A001", installDate: "Feb 2019", lastServiceDate: "May 5, 2026",  status: "operational" },
    { id: "e4-2", customerId: "4", propertyId: "p4-1", name: "Water Heater — Building B", brand: "A.O. Smith", model: "HPTU-80",  serialNumber: "AOS19B001", installDate: "Feb 2019", lastServiceDate: "May 5, 2026",  status: "needs_service", notes: "Unit 8 showing age — recommend replacement" },
    { id: "e4-3", customerId: "4", propertyId: "p4-1", name: "Plumbing Manifold System",  brand: "Watts",      model: "LF25AUB",  serialNumber: "WTT95001",  installDate: "Jan 1995",                                  status: "operational" },
  ],
  "7": [
    { id: "e7-1", customerId: "7", name: "Rheem Central AC", brand: "Rheem", model: "RA16AZ036", serialNumber: "RHM21-8874", installDate: "May 2021", lastServiceDate: "Sep 18, 2025", status: "operational", notes: "3-ton, R-410A" },
  ],
  "9": [
    { id: "e9-1", customerId: "9", name: "Carrier Heat Pump", brand: "Carrier", model: "25HBB336A003", serialNumber: "CAR23-0912", installDate: "Apr 2023", lastServiceDate: "Jun 12, 2026", status: "operational", notes: "3-ton, installed during home purchase" },
  ],
  "12": [
    { id: "e12-1", customerId: "12", name: "Carrier RTU — Unit A", brand: "Carrier", model: "48HCDA12A3A5", serialNumber: "CAR21A001", installDate: "Jan 2021", lastServiceDate: "Mar 15, 2026", status: "operational", notes: "10-ton, east wing" },
    { id: "e12-2", customerId: "12", name: "Carrier RTU — Unit B", brand: "Carrier", model: "48HCDA12A3A5", serialNumber: "CAR21B001", installDate: "Jan 2021", lastServiceDate: "Mar 15, 2026", status: "operational", notes: "10-ton, west wing" },
  ],
};

// ─── Jobs ─────────────────────────────────────────────────
export const JOBS: Record<string, CustomerJob[]> = {
  "1": [
    { id: "j1-1", customerId: "1", title: "HVAC Tune-up (Spring)",    type: "Maintenance",  status: "Completed", date: "Apr 3, 2026",  tech: "J. Patel",  amount: "$0 (Agreement)" },
    { id: "j1-2", customerId: "1", title: "Filter Replacement",       type: "Maintenance",  status: "Completed", date: "Oct 12, 2025", tech: "J. Patel",  amount: "$0 (Agreement)" },
    { id: "j1-3", customerId: "1", title: "Water Heater Install",     type: "Installation", status: "Scheduled", date: "Jun 15, 2026", tech: "J. Patel",  amount: "$1,200" },
    { id: "j1-4", customerId: "1", title: "HVAC Tune-up (Fall 2024)", type: "Maintenance",  status: "Completed", date: "Oct 8, 2024",  tech: "J. Patel",  amount: "$0 (Agreement)" },
  ],
  "2": [
    { id: "j2-1", customerId: "2", title: "Roof Inspection",          type: "Inspection",  status: "Completed", date: "May 28, 2026", tech: "D. Nguyen", amount: "$0 (Agreement)" },
    { id: "j2-2", customerId: "2", title: "HVAC Emergency Call",      type: "Repair",      status: "Completed", date: "Mar 10, 2026", tech: "M. Cole",   amount: "$840" },
    { id: "j2-3", customerId: "2", title: "Commercial HVAC Q1",       type: "Maintenance", status: "Completed", date: "Mar 5, 2026",  tech: "M. Cole",   amount: "$0 (Agreement)" },
    { id: "j2-4", customerId: "2", title: "Commercial HVAC Q4",       type: "Maintenance", status: "Completed", date: "Dec 10, 2025", tech: "M. Cole",   amount: "$0 (Agreement)" },
  ],
  "4": [
    { id: "j4-1", customerId: "4", title: "Plumbing Q2 Inspection",   type: "Inspection",  status: "Completed", date: "May 5, 2026",  tech: "M. Cole",   amount: "$0 (Agreement)" },
    { id: "j4-2", customerId: "4", title: "Drain Cleaning — Unit 14", type: "Repair",      status: "Completed", date: "Apr 12, 2026", tech: "M. Cole",   amount: "$185" },
    { id: "j4-3", customerId: "4", title: "Plumbing Q3 Inspection",   type: "Inspection",  status: "Scheduled", date: "Aug 1, 2026",  tech: "M. Cole",   amount: "$0 (Agreement)" },
  ],
  "7": [
    { id: "j7-1", customerId: "7", title: "HVAC Tune-up (Spring)",    type: "Maintenance", status: "Scheduled", date: "Jun 5, 2026",  tech: "J. Patel",  amount: "$0 (Agreement)" },
    { id: "j7-2", customerId: "7", title: "HVAC Tune-up (Fall 2025)", type: "Maintenance", status: "Completed", date: "Sep 18, 2025", tech: "J. Patel",  amount: "$0 (Agreement)" },
  ],
};

// ─── Leads ────────────────────────────────────────────────
export const LEADS: Record<string, CustomerLead[]> = {
  "1":  [
    { id: "l1-1", customerId: "1",  title: "Water Heater Replacement", status: "Quoted",    date: "May 20, 2026", value: "$1,200",   source: "Phone" },
    { id: "l1-2", customerId: "1",  title: "Air Quality Testing",      status: "Contacted", date: "Apr 5, 2026",  value: "TBD",      source: "Tech Recommendation" },
  ],
  "2":  [
    { id: "l2-1", customerId: "2",  title: "Full Roof Replacement",    status: "Quoted",    date: "Mar 20, 2026", value: "$48,000",  source: "Inspection Result" },
    { id: "l2-2", customerId: "2",  title: "Building 2 HVAC Upgrade",  status: "New",       date: "May 15, 2026", value: "TBD",      source: "Customer Request" },
  ],
  "5":  [{ id: "l5-1",  customerId: "5",  title: "Roof Damage Assessment",   status: "New",       date: "May 28, 2026", value: "TBD",      source: "Web Form" }],
  "6":  [{ id: "l6-1",  customerId: "6",  title: "Consulting Retainer",      status: "Quoted",    date: "May 10, 2026", value: "$3,000/mo",source: "Referral" }],
  "11": [{ id: "l11-1", customerId: "11", title: "New Construction HVAC",    status: "Contacted", date: "Apr 22, 2026", value: "TBD",      source: "Phone" }],
  "14": [{ id: "l14-1", customerId: "14", title: "Roofing Inspection Plan",  status: "Contacted", date: "May 20, 2026", value: "$599/yr",  source: "Cold Call" }],
};

// ─── Notes ────────────────────────────────────────────────
export const NOTES: Record<string, CustomerNote[]> = {
  "1": [
    { id: "n1-1", customerId: "1", date: "Apr 3, 2026",  user: "J. Patel",   userInitials: "JP", type: "visit", text: "Completed spring tune-up. Carrier unit running well. Recommended air quality testing next visit." },
    { id: "n1-2", customerId: "1", date: "Mar 12, 2026", user: "Sara (CSR)", userInitials: "SC", type: "call",  text: "Customer called to schedule spring appointment. Booked for April 3 at 8am." },
    { id: "n1-3", customerId: "1", date: "May 20, 2026", user: "J. Patel",   userInitials: "JP", type: "email", text: "Sent water heater replacement quote. $1,200 installed. Customer said she'd discuss and get back." },
  ],
  "2": [
    { id: "n2-1", customerId: "2", date: "May 28, 2026", user: "D. Nguyen",  userInitials: "DN", type: "visit", text: "Annual roof inspection completed. Found 2 areas of concern near HVAC units. Sent detailed photo report." },
    { id: "n2-2", customerId: "2", date: "Mar 10, 2026", user: "M. Cole",    userInitials: "MC", type: "visit", text: "Emergency HVAC call. Capacitor failed on unit 3. Replaced on-site. System back online. Invoice $840." },
    { id: "n2-3", customerId: "2", date: "Mar 1, 2026",  user: "Sara (CSR)", userInitials: "SC", type: "call",  text: "D. Webb confirmed billing change to Net-30. Updated account terms." },
  ],
  "4": [
    { id: "n4-1", customerId: "4", date: "May 5, 2026",  user: "M. Cole",    userInitials: "MC", type: "visit", text: "Q2 plumbing inspection done. Unit 14 slow drain cleared. Unit 8 water heater showing age — recommend replacement." },
    { id: "n4-2", customerId: "4", date: "Apr 12, 2026", user: "Sara (CSR)", userInitials: "SC", type: "note",  text: "Mike Torres reported drain issue in unit 14. Dispatched M. Cole same day." },
  ],
};

// ─── Runtime store (pre-Supabase) ────────────────────────
// Newly created customers are pushed here so getCustomer() and
// the detail page can find them without a full page reload.
// CustomerProvider also mirrors this into React state for the list page.
let _extra: Customer[] = [];

export function _addToStore(customer: Customer): void {
  _extra = [..._extra, customer];
}

export function _loadFromStorage(): void {
  try {
    const raw = localStorage.getItem("crm-extra-customers");
    if (raw) _extra = JSON.parse(raw) as Customer[];
  } catch { /* ignore */ }
}

// ─── Lookup helpers ───────────────────────────────────────
export function getCustomer(id: string): Customer | undefined {
  return ALL_CUSTOMERS.find((c) => c.id === id) ?? _extra.find((c) => c.id === id);
}

export function getAllCustomers(): Customer[] {
  return [...ALL_CUSTOMERS, ..._extra];
}

export function getContacts(customerId: string): Contact[] {
  return CONTACTS[customerId] ?? [{
    id: `c${customerId}-auto`,
    customerId,
    name: getCustomer(customerId)?.name ?? "Primary Contact",
    role: getCustomer(customerId)?.type === "Commercial" ? "Primary Contact" : "Homeowner",
    phone: getCustomer(customerId)?.phone,
    email: getCustomer(customerId)?.email,
    isPrimary: true,
  }];
}

export function getProperties(customerId: string): Property[] {
  if (PROPERTIES[customerId]) return PROPERTIES[customerId];
  const c = getCustomer(customerId);
  if (!c) return [];
  return [{
    id: `p${customerId}-auto`,
    customerId,
    label: "Primary Address",
    address: c.address, city: c.city, state: c.state, zip: c.zip,
    type: c.type === "Commercial" ? "Commercial" : "Residential",
    isPrimary: true,
  }];
}

export function getEquipment(customerId: string): Equipment[] {
  return EQUIPMENT[customerId] ?? [];
}

export function getJobs(customerId: string): CustomerJob[] {
  return JOBS[customerId] ?? [];
}

export function getLeads(customerId: string): CustomerLead[] {
  return LEADS[customerId] ?? [];
}

export function getNotes(customerId: string): CustomerNote[] {
  return NOTES[customerId] ?? [];
}
