-- ============================================================================
-- 0002_operational_base.sql
-- Example operational tables demonstrating the standard hierarchy + audit
-- column pattern that EVERY operational record should follow.
--
-- Pattern (copy onto leads, deals, jobs, projects, tasks, notes, photos, etc.):
--   organization_id  not null   -- always
--   company_id       not null   -- always
--   location_id      not null   -- most day-to-day records live at a location
--   service_area_id  nullable   -- set when the record maps to a territory
--   created_by / assigned_to / created_at / updated_at / status
--
-- This lets the CRM filter and report at EVERY level of the hierarchy.
-- ADDITIVE migration. customers + leads shown as the canonical examples.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CUSTOMERS  (lives at the location level)
-- ----------------------------------------------------------------------------
create table if not exists customers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id)  on delete cascade,
  company_id       uuid not null references companies(id)      on delete cascade,
  location_id      uuid not null references locations(id)      on delete cascade,
  service_area_id  uuid references service_areas(id)           on delete set null,

  name             text not null,
  type             text not null default 'residential' check (type in ('residential', 'commercial')),
  email            text,
  phone            text,
  address_line1    text,
  city             text,
  state            text,
  postal_code      text,

  created_by       uuid references profiles(id),
  assigned_to      uuid references profiles(id),
  status           text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Indexes per level so every hierarchy filter/report stays fast.
create index if not exists idx_customers_org           on customers(organization_id);
create index if not exists idx_customers_company       on customers(company_id);
create index if not exists idx_customers_location      on customers(location_id);
create index if not exists idx_customers_service_area  on customers(service_area_id);
create index if not exists idx_customers_assigned_to   on customers(assigned_to);

create trigger trg_customers_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- LEADS  (lives at the location level; service_area_id drives routing)
-- ----------------------------------------------------------------------------
create table if not exists leads (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id)  on delete cascade,
  company_id       uuid not null references companies(id)      on delete cascade,
  location_id      uuid not null references locations(id)      on delete cascade,
  service_area_id  uuid references service_areas(id)           on delete set null,
  customer_id      uuid references customers(id)               on delete set null,

  name             text not null,
  source           text,                                       -- google_lsa | website | referral | ...
  service_type     text,
  est_value        numeric(12,2),

  created_by       uuid references profiles(id),
  assigned_to      uuid references profiles(id),
  status           text not null default 'new'
                     check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_leads_org           on leads(organization_id);
create index if not exists idx_leads_company       on leads(company_id);
create index if not exists idx_leads_location      on leads(location_id);
create index if not exists idx_leads_service_area  on leads(service_area_id);
create index if not exists idx_leads_assigned_to   on leads(assigned_to);

create trigger trg_leads_updated_at
  before update on leads
  for each row execute function set_updated_at();
