# Industry Template System — Architecture Plan

## Core concept

```
Core CRM Engine
  └── Industry Template (global, read-only defaults)
        └── Company Settings (copied on setup, fully editable)
```

When a company onboards or changes their industry, the system copies the
template defaults into `company_settings`. After that, the company's copy
is independent — edits never touch the global template, and template
updates don't overwrite company customizations.

---

## Supported industries (phased)

| Phase | Industry               | Key distinction                          |
|-------|------------------------|------------------------------------------|
| 1     | General Service        | Fallback defaults for any service biz   |
| 1     | HVAC                   | Equipment-heavy, maintenance agreements |
| 2     | Roofing                | Inspection-heavy, insurance jobs        |
| 2     | Plumbing               | Emergency dispatch, membership plans    |
| 2     | Electrical             | Code compliance, permit tracking        |
| 3     | Restoration            | Insurance claims, phases/milestones     |
| 3     | Property Maintenance   | Multi-property, recurring visits        |
| 3     | B2B Consulting         | Retainers, deliverables, no equipment   |
| -     | Custom                 | Blank slate, manual setup               |

---

## Database schema

### `industry_templates`
Global read-only definitions. Seeded by the application, not editable by users.

```sql
industry_templates
  id          text PRIMARY KEY   -- "hvac" | "roofing" | "general" | ...
  name        text NOT NULL      -- "HVAC"
  description text
  status      text DEFAULT 'active'
  sort_order  integer
```

### `industry_template_defaults`
One row per category per template. `config` holds the full default array/object.

```sql
industry_template_defaults
  id           uuid PRIMARY KEY
  template_id  text REFERENCES industry_templates(id)
  category     text NOT NULL    -- see Category Registry below
  config       jsonb NOT NULL
  UNIQUE (template_id, category)
```

### `company_settings`
One row per category per company. Copied from template on setup, then editable.

```sql
company_settings
  id                   uuid PRIMARY KEY
  organization_id      uuid NOT NULL
  company_id           uuid NOT NULL
  industry_template_id text REFERENCES industry_templates(id)
  category             text NOT NULL
  config               jsonb NOT NULL
  customized_at        timestamptz
  UNIQUE (company_id, category)
```

---

## Category registry

Every template and company_settings row belongs to one category.
Categories map 1:1 to what they configure in the UI.

| Category key             | Controls                              | UI location                  |
|--------------------------|---------------------------------------|------------------------------|
| `account_types`          | Account type labels + subtypes        | New Customer wizard          |
| `contact_roles`          | Contact role options                  | Contacts tab                 |
| `pipeline_stages`        | Lead pipeline column names/order      | Leads / Pipeline             |
| `job_types`              | Job type options                      | New Job form                 |
| `job_statuses`           | Job status labels + colors            | Jobs list + dispatch         |
| `photo_categories`       | Photo/file category labels            | Photos & Files               |
| `equipment_fields`       | Equipment type labels + fields        | Equipment tab                |
| `agreement_templates`    | Default agreement plan structures     | Agreements → Templates       |
| `task_types`             | Task/follow-up type labels            | Tasks                        |
| `campaign_templates`     | Marketing campaign starting points    | Marketing                    |
| `checklists`             | Job/inspection form templates         | Job detail → Forms           |
| `dashboard_widgets`      | Default dashboard card layout         | Dashboard                    |
| `terminology`            | Label overrides (Job→Work Order, etc) | Global throughout CRM        |

---

## HVAC template defaults

### `account_types`
```json
{
  "types": [
    { "key": "residential",          "label": "Residential",           "subtypes": ["homeowner", "renter", "landlord"] },
    { "key": "commercial",           "label": "Commercial",            "subtypes": ["office", "retail", "industrial", "restaurant"] },
    { "key": "property_management",  "label": "Property Management",   "subtypes": ["multi_family", "hoa", "commercial_park"] },
    { "key": "multi_site",           "label": "Multi-Site Account",    "subtypes": [] },
    { "key": "other",                "label": "Other",                 "subtypes": [] }
  ]
}
```

### `contact_roles`
```json
{
  "roles": ["Homeowner", "Property Manager", "Tenant", "Maintenance Coordinator",
            "Owner", "Billing Contact", "Decision Maker", "Other"]
}
```

### `pipeline_stages`
```json
{
  "stages": [
    { "key": "new",          "label": "New Lead",        "color": "#6366f1", "order": 1 },
    { "key": "contacted",    "label": "Contacted",       "color": "#f59e0b", "order": 2 },
    { "key": "estimate_sent","label": "Estimate Sent",   "color": "#3b82f6", "order": 3 },
    { "key": "follow_up",    "label": "Follow-up",       "color": "#8b5cf6", "order": 4 },
    { "key": "won",          "label": "Won",             "color": "#10b981", "order": 5 },
    { "key": "lost",         "label": "Lost",            "color": "#ef4444", "order": 6 }
  ]
}
```

### `job_types`
```json
{
  "types": ["Maintenance", "Repair", "Installation", "Replacement",
            "Inspection", "Emergency Call", "Warranty", "Estimate", "Other"]
}
```

### `job_statuses`
```json
{
  "statuses": [
    { "key": "scheduled",   "label": "Scheduled",   "color": "#6366f1" },
    { "key": "en_route",    "label": "En Route",    "color": "#f59e0b" },
    { "key": "in_progress", "label": "In Progress", "color": "#3b82f6" },
    { "key": "completed",   "label": "Completed",   "color": "#10b981" },
    { "key": "canceled",    "label": "Canceled",    "color": "#6b7280" },
    { "key": "no_show",     "label": "No Show",     "color": "#ef4444" }
  ]
}
```

### `photo_categories`
```json
{
  "categories": ["Before", "After", "During", "Equipment", "Nameplate",
                 "Damage", "Installation", "Invoice", "Permit", "Other"]
}
```

### `equipment_fields`
```json
{
  "types": [
    { "key": "hvac_system",    "label": "HVAC System",    "fields": ["brand", "model", "serial", "tonnage", "seer", "fuel_type", "install_date", "filter_size"] },
    { "key": "water_heater",   "label": "Water Heater",   "fields": ["brand", "model", "serial", "capacity_gallons", "fuel_type", "install_date"] },
    { "key": "thermostat",     "label": "Thermostat",     "fields": ["brand", "model", "serial", "type"] },
    { "key": "air_handler",    "label": "Air Handler",    "fields": ["brand", "model", "serial", "install_date"] },
    { "key": "heat_pump",      "label": "Heat Pump",      "fields": ["brand", "model", "serial", "tonnage", "install_date"] },
    { "key": "other",          "label": "Other",          "fields": ["brand", "model", "serial", "notes"] }
  ]
}
```

### `agreement_templates`
```json
{
  "templates": [
    {
      "key": "hvac_residential_basic",
      "name": "HVAC Residential Maintenance Plan",
      "billing_frequency": "annual",
      "visit_frequency": "2x per year",
      "default_price": 349,
      "services": ["Spring tune-up", "Fall tune-up", "Filter replacement", "Priority dispatch", "10% repair discount"]
    },
    {
      "key": "hvac_commercial_quarterly",
      "name": "Commercial HVAC Quarterly Plan",
      "billing_frequency": "quarterly",
      "visit_frequency": "quarterly",
      "default_price": 300,
      "services": ["Quarterly inspection", "Filter changes", "Coil cleaning", "Priority scheduling"]
    }
  ]
}
```

### `task_types`
```json
{
  "types": ["Follow-up call", "Send estimate", "Schedule job", "Send agreement",
            "Renewal outreach", "Review request", "Check in", "Invoice follow-up", "Other"]
}
```

### `terminology`
```json
{
  "job":        "Job",
  "jobs":       "Jobs",
  "estimate":   "Estimate",
  "agreement":  "Maintenance Agreement",
  "equipment":  "Equipment",
  "property":   "Property",
  "technician": "Technician",
  "dispatch":   "Dispatch"
}
```

---

## General Service Business template defaults

Minimal defaults that work for any service business.

### `account_types`
```json
{
  "types": [
    { "key": "residential", "label": "Residential", "subtypes": [] },
    { "key": "commercial",  "label": "Commercial",  "subtypes": [] },
    { "key": "other",       "label": "Other",       "subtypes": [] }
  ]
}
```

### `pipeline_stages`  Same as HVAC.

### `job_types`
```json
{ "types": ["Service Call", "Estimate", "Installation", "Repair", "Inspection", "Other"] }
```

### `job_statuses`  Same as HVAC.

### `photo_categories`
```json
{ "categories": ["Before", "After", "During", "Documentation", "Other"] }
```

### `equipment_fields`
```json
{
  "types": [
    { "key": "general_equipment", "label": "Equipment", "fields": ["brand", "model", "serial", "install_date", "notes"] }
  ]
}
```

### `terminology`
```json
{
  "job":        "Job",
  "estimate":   "Estimate",
  "agreement":  "Service Agreement",
  "equipment":  "Equipment",
  "technician": "Technician"
}
```

---

## Company customization flow

1. **Onboarding** — admin picks an industry template.
2. **Copy** — system inserts one `company_settings` row per category using the template's `config` as starting values.
3. **Customize** — company edits their `company_settings`. Template is never touched.
4. **Runtime** — UI reads `company_settings` for the active `company_id`. Never reads the global template directly (except during setup copy).
5. **Re-seed** — if the company wants to reset to template defaults, copy again (confirm prompt, overwrites customizations).

---

## UI access points

| Settings page section         | Category keys written               |
|-------------------------------|-------------------------------------|
| Business → Account Types      | `account_types`, `contact_roles`    |
| Business → Pipeline           | `pipeline_stages`                   |
| Business → Job Settings       | `job_types`, `job_statuses`         |
| Business → Equipment          | `equipment_fields`                  |
| Business → Photos             | `photo_categories`                  |
| Business → Agreements         | `agreement_templates`               |
| Business → Tasks              | `task_types`                        |
| Business → Terminology        | `terminology`                       |
| Business → Campaigns          | `campaign_templates`                |

All of these live under `Settings → [Company] → Business Settings`.
Organization-level admins can also set org-wide defaults that cascade down
to new companies.

---

## TypeScript shape (lib/industry/types.ts — to create)

```typescript
export type IndustryId =
  | "general" | "hvac" | "roofing" | "plumbing"
  | "electrical" | "restoration" | "property_maintenance"
  | "consulting" | "custom";

export type SettingsCategory =
  | "account_types" | "contact_roles" | "pipeline_stages"
  | "job_types" | "job_statuses" | "photo_categories"
  | "equipment_fields" | "agreement_templates" | "task_types"
  | "campaign_templates" | "checklists" | "dashboard_widgets"
  | "terminology";

export interface IndustryTemplate {
  id: IndustryId;
  name: string;
  description: string;
  defaults: Partial<Record<SettingsCategory, unknown>>;
}

export interface CompanySettings {
  companyId: string;
  industryTemplateId: IndustryId;
  category: SettingsCategory;
  config: unknown;        // typed narrowly per-category in practice
  customizedAt?: string;
}
```

---

## Build order (Phase 1 scope)

1. Create `lib/industry/templates.ts` — seed data for `general` + `hvac` templates
2. Create `lib/industry/types.ts` — TypeScript types
3. Add `industry_template_id` to company settings (stored in HierarchyProvider for now, Supabase later)
4. Use `company_settings.terminology` to drive label overrides across the UI
5. Use `company_settings.job_statuses` + `job_types` when building the Jobs module
6. Use `company_settings.pipeline_stages` when building the Leads/Pipeline module
7. Build Settings → Business Settings UI after the core modules are working

Do not build the settings customization UI before the modules that consume the settings exist.

---

## What this is NOT

- Not separate Next.js apps per industry
- Not hard-coded HVAC fields in the base Customer/Job schema
- Not a per-field permission system (that's custom fields, Phase 2+)
- Not a white-label multi-tenant product (single org per deployment for now)
