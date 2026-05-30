# CRM Hierarchy — where everything lives

The CRM is a layered, multi-tenant model. Every operational record is anchored
to a point in this hierarchy so the product can filter and report at **every
level**.

```
Organization        (top-level owner account / tenant)
└── Company          (business unit / brand / division)
    └── Location     (branch / operating unit — most day-to-day data lives here)
        └── Service Area  (territory / market)
```

## What lives at each level

### Organization — `organization_id`
The top-level owner account. One per customer tenant.

- Billing & subscription
- Global users & global permissions
- The set of companies it owns
- Global settings
- **Cross-company reporting** (roll-ups across every company)

### Company — `company_id`
A brand/division under the organization. Holds company-specific configuration.

- Branding (logo, colors)
- Service types
- Pipelines, job stages
- Agreement templates, proposal templates, marketing templates
- Forms, custom fields
- Company-level reports

### Location — `location_id`
A branch/operating unit. **This is where most CRM records live.**

- Customers, leads, deals
- Jobs, projects, tasks, notes
- Photos / files, schedules
- Local employees
- Local reports

> Records here still carry `organization_id` and `company_id` so they roll up.

### Service Area — `service_area_id`
A territory/market under a location. Used for *routing and targeting*, not as a
primary data container.

- Lead routing
- Zip / city / county coverage
- Marketing targeting & service availability
- Travel / service rules
- Territory reporting

## The operational-record column pattern

Every operational table (customers, leads, deals, jobs, projects, tasks, notes,
photos, agreements, campaigns, …) carries:

| Column            | Required | Purpose                                   |
| ----------------- | -------- | ----------------------------------------- |
| `organization_id` | yes      | tenant roll-up                            |
| `company_id`      | yes      | brand/division roll-up                    |
| `location_id`     | yes\*    | branch — where day-to-day records live    |
| `service_area_id` | when applicable | territory routing/reporting        |
| `created_by`      | yes      | audit                                     |
| `assigned_to`     | when applicable | ownership / dispatch               |
| `status`          | yes      | active/inactive lifecycle (no hard delete on key records) |
| `created_at`      | yes      | audit                                     |
| `updated_at`      | yes      | audit (auto via trigger)                  |

\* A few org/company-scoped config records (templates, custom fields) legitimately
have no location. Operational/customer-facing records always do.

See `supabase/migrations/0002_operational_base.sql` for `customers` and `leads`
as canonical examples.

## Authorization — who sees what

Access is granted via `memberships` (role at a scope) and resolves **downward**:

| Role               | Sees                                                        |
| ------------------ | ----------------------------------------------------------- |
| `org_admin`        | all companies, locations, and service areas in the org      |
| `company_admin`    | their company + all its locations & service areas           |
| `location_manager` | their location(s) + their service areas (+ the parent company) |
| `employee`         | same shape as location manager, fewer write rights          |

The same four `*_id` columns are what future Row Level Security will key on.

## UI — hierarchy selectors

The top bar exposes **Company → Location → Service Area** selectors:

- A selector only renders when the user is authorized for more than one option
  at that level (an `org_admin` sees all three; a single-location tech sees none).
- Choosing a Company narrows the Location options; choosing a Location narrows
  the Service Area options.
- An **"All"** option is available where the user is authorized for the whole level.
- The selection **persists across navigation** within the session and is the
  default filter applied to lists and reports.

Implementation: `components/providers/HierarchyProvider.tsx` (state + auth
resolution) and `components/layout/HierarchySelector.tsx` (the dropdowns).
