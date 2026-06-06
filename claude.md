# CLAUDE.md

This file contains project instructions for Claude Code.

## Product Vision

We are building an all-in-one CRM for service-industry businesses.

Target industries:

- HVAC
- Roofing
- Plumbing
- Electrical
- Restoration
- Property maintenance
- B2B service and consulting businesses

The product should combine:

- CRM
- Leads and sales pipeline
- Jobs/projects
- Photos/files like CompanyCam
- Tasks/follow-ups
- Agreements/maintenance plans
- Marketing campaigns
- Communications
- Reports
- Multi-location management
- Customization settings

The main product idea:

A service-business CRM that works out of the box with strong defaults, but can be deeply customized as a company grows.

## Tech Stack

Use this stack unless I specifically say otherwise:

- React / Next.js
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Postgres database
- Supabase Storage for photos/files
- Vercel for hosting

If this project is currently plain HTML/CSS/JS, help improve the prototype, but recommend clean migration paths to Next.js + TypeScript when appropriate.

## Core Business Hierarchy

The CRM should use this hierarchy:

Organization
-> Company / Brand / Business Unit
-> Location / Branch
-> Service Area / Territory

### Organization

Organization is the top-level account that owns the CRM environment.

Examples:

- Brecht Holdings
- Giesbrecht Business Group
- Parent ownership group

The organization controls:

- billing
- global users
- global permissions
- all companies
- global settings
- global reporting

### Company

Company means an internal business, brand, or division under the organization.

Examples:

- Giesbrecht HVAC
- LEAD Management
- R.L. Hayes Roofing
- LEAD BuildCo
- Southern Rentals

A company may have its own:

- customers
- leads
- jobs/projects
- agreements
- marketing templates
- service types
- pipelines
- reports
- settings

### Location

Location means a physical or operating branch under a company.

Examples:

- Augusta Branch
- Louisville Branch
- Columbia Branch

A location may have its own:

- employees
- schedule
- jobs
- leads
- inventory
- phone number
- service areas
- reports

### Service Area

Service Area means a city, county, zip code, territory, or market served by a location.

Examples:

- Augusta, GA
- Evans, GA
- Martinez, GA
- Grovetown, GA
- North Augusta, SC
- Aiken, SC

Service areas are used for:

- lead routing
- dispatch
- marketing campaigns
- service availability
- reporting
- territory management

## Database Hierarchy Rules

Use:

- organization_id for the top-level tenant/owner account
- company_id for the internal business/brand/division
- location_id for the operating branch
- service_area_id for the territory/market when applicable

Most operational records should support:

- organization_id
- company_id
- location_id
- service_area_id where applicable
- created_by
- assigned_to
- created_at
- updated_at
- status

Do not hard-code companies, locations, or service areas permanently. They should be creatable by authorized admin users.

Use active/inactive status instead of hard deleting companies, locations, or service areas.

## Hierarchy Selector UI Rules

The UI should include selectors that allow authorized users to filter by:

- Company (visible when user has access to multiple companies)
- Location (visible when user has access to multiple locations)
- Service Area (optional, for territory-level filtering)

Rules:
- Users only see the companies, locations, and service areas they are authorized to access.
- An organization admin sees all companies and locations.
- A company admin sees their company and all its locations.
- A location manager sees only their assigned location(s).
- Selectors should support an "All" option where authorized.
- These selectors should appear in the top bar or sidebar header area.
- They should persist the selection across navigation within the session.

## Main Modules

Build the CRM modularly.

Primary navigation:

- Dashboard
- Customers
- Companies
- Contacts
- Leads
- Deals / Pipeline
- Jobs / Projects
- Tasks / Follow-ups
- Photos & Files
- Agreements
- Marketing
- Communications
- Calendar / Dispatch
- Reports
- Settings

## Build Phases

Build in this order unless I specifically say otherwise:

### Phase 1 — Foundation

- Authentication
- Organization setup
- Company setup (internal brands/divisions)
- Locations (branches under a company)
- Service Areas (territories under a location)
- Users and roles
- Hierarchy selectors in UI (org → company → location → service area)
- Dashboard
- Customers
- Contacts
- Leads
- Tasks
- Notes/activity timeline

### Phase 2 — Jobs / Projects

- Jobs
- Projects
- Job stages
- Assigned users
- Project timeline
- Basic job detail pages

### Phase 3 — Photos & Files

- Supabase Storage integration
- Project/job photo galleries
- Photo categories
- Tags
- Notes
- Uploaded by
- Timestamp
- Customer/project/job association
- Customer-facing photo report later

### Phase 4 — Agreements

- Agreement templates
- Customer agreements
- Maintenance plans
- Renewal dates
- Visit frequency
- Billing frequency
- Included services
- Agreement tasks/reminders

### Phase 5 — Marketing

- Email templates
- SMS templates
- Campaign builder
- Audience filters
- Follow-up sequences
- Lead source tracking
- Open estimate follow-up
- Maintenance renewal campaigns
- Review request campaigns

### Phase 6 — Integrations

- Email provider
- SMS provider
- Phone system
- Google Ads
- Google LSA
- Google Business Profile
- Website forms
- Zapier/Make

### Phase 7 — AI Features

- AI proposal/scope drafting
- AI photo tagging
- AI follow-up drafts
- AI missed opportunity detection
- AI owner reports
- AI campaign suggestions

## Customization Philosophy

The CRM should support both:

1. Simple defaults for contractors who want to start quickly.
2. Advanced customization for companies that want control.

Default examples:

- Default lead pipeline
- Default job stages
- Default task types
- Default photo categories
- Default agreement templates
- Default email/SMS templates
- Default reports

Advanced customization should eventually include:

- Custom fields
- Custom pipelines
- Custom job stages
- Custom forms
- Custom agreement templates
- Custom photo categories
- Custom campaign sequences
- Custom dashboards
- Custom user roles
- Custom reports
- Custom automation rules

Do not overbuild customization before the base workflow works.

## Photos & Files Module

This module should be inspired by CompanyCam.

Supabase Storage stores actual files.
Postgres stores metadata.

Photo/file metadata should include:

- id
- organization_id
- company_id
- location_id
- service_area_id if applicable
- customer_id
- job_id or project_id
- uploaded_by
- storage_path
- file_name
- file_type
- category
- tags
- notes
- created_at

Use private buckets by default.

Do not store actual image binary data in Postgres.

Photos should be viewable by:

- project
- job
- customer
- category
- timeline
- uploader
- location

Future features:

- before/during/after reports
- AI tagging
- equipment plate detection
- customer-facing PDF reports
- required photo checklist

## Marketing Module

Marketing should use CRM data.

Campaigns should be able to target audiences like:

- open estimates
- lost leads
- customers without agreements
- expired agreements
- customers by location
- customers by service type
- customers by last service date
- customers by equipment age
- commercial customers
- residential customers

Campaign types:

- email
- SMS
- task/call reminder
- review request
- estimate follow-up
- maintenance renewal
- seasonal campaign

Do not hardcode one marketing workflow. Build templates and reusable campaign structures.

## Agreements Module

Agreements should be flexible enough for multiple industries.

Examples:

- HVAC maintenance agreement
- Plumbing membership
- Roofing inspection plan
- Property maintenance contract
- Commercial service contract
- Consulting retainer

Agreement templates should support:

- name
- description
- billing frequency
- visit frequency
- included services
- checklist
- renewal rules
- assigned property/equipment
- pricing
- terms
- reminders
- status

## UI Design Direction

Style:

- modern
- minimalistic
- clean B2B SaaS
- professional service-business feel
- desktop-first
- mobile-friendly where practical

Preferred layout:

- left sidebar navigation
- top search/action bar
- hierarchy selector (company → location → service area) visible to authorized users
- global create button
- dashboard cards
- clean tables
- filters
- detail pages with tabs
- timeline/activity feed
- slide-over drawers or modals for quick actions

Avoid:

- clutter
- excessive colors
- overly corporate design
- hard-to-scan pages
- giant forms without sections

## Component Rules

Keep components modular and reusable.

Use clear component names, such as:

- DashboardPage
- CustomerList
- CustomerDetail
- LeadPipeline
- JobDetail
- PhotoGallery
- AgreementBuilder
- CampaignBuilder
- LocationSelector
- SidebarNav
- TopBar

Do not put large amounts of unrelated logic in one file.

## Supabase Rules

Use Supabase for:

- auth
- Postgres database
- file storage
- future row-level security

Environment variables only.

Frontend-safe variables:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Never expose:

- SUPABASE_SERVICE_ROLE_KEY
- database passwords
- private API keys
- production secrets

## Database Safety Rules

Ask before:

- dropping tables
- deleting columns
- wiping data
- running destructive migrations
- changing RLS policies
- deleting storage buckets
- modifying production credentials

Prefer additive changes:

- create new table
- add new column
- add new policy
- preserve existing data

Use active/inactive status instead of hard deleting important business records.

## Security Rules

Do not expose data across organizations.

Every user should only access records they are authorized to see based on their role:

- Organization owner/admin: all companies, locations, and service areas
- Company admin: their assigned company and its locations
- Location manager: their assigned location(s)
- Employee/tech/sales/CSR: assigned locations, jobs, leads, or tasks

Design with future Row Level Security in mind using organization_id, company_id, location_id, and service_area_id.

Sensitive actions should require proper role checks:

- creating or deactivating companies
- creating or deactivating locations
- creating or deactivating service areas
- editing users or roles
- deleting/deactivating records
- changing billing
- viewing cross-company or cross-location reports

## Development Behavior

Before major changes:

1. Inspect the current file structure.
2. Summarize the current setup.
3. Propose a short plan.
4. Make the smallest clean change needed.
5. Avoid rewriting unrelated working code.

Do not change backend/database/security logic unless the task requires it.

Do not add unnecessary packages without asking.

Do not commit or push unless I explicitly ask.

## Git Rules

Before committing:

- run git status
- summarize changed files
- use a clear commit message

Do not push to GitHub unless I ask.

## Commands

Ask before running commands that:

- install packages
- delete files
- run migrations
- change git history
- affect Supabase
- deploy to production

Safe commands:

- list files
- read files
- search code
- run local tests/builds after asking if needed

## Communication Style

Explain structural changes in plain English.

When something is complex, break it into steps.

If there are multiple options, recommend the best practical option for a real service-business CRM.

Do not overbuild. Prioritize a working, scalable foundation.