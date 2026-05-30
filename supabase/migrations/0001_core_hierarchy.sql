-- ============================================================================
-- 0001_core_hierarchy.sql
-- Core multi-tenant hierarchy: Organization -> Company -> Location -> Service Area
-- plus the user-access (membership) model that drives authorization.
--
-- This migration is ADDITIVE. It creates new tables only. No data is dropped.
-- RLS is scaffolded in comments but NOT enabled here (see CLAUDE.md: ask before
-- changing RLS policies).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Shared updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Level 1: ORGANIZATION  (top-level tenant / owner account)
--   Holds billing, global users, global settings, and owns all companies.
-- ----------------------------------------------------------------------------
create table if not exists organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique,
  billing_email   text,
  plan            text not null default 'starter',
  status          text not null default 'active' check (status in ('active', 'inactive')),
  settings        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_organizations_updated_at
  before update on organizations
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Level 2: COMPANY  (internal business / brand / division under an org)
--   Holds company-specific configuration: branding, service types, pipelines,
--   job stages, templates, forms, custom fields, company-level reports.
-- ----------------------------------------------------------------------------
create table if not exists companies (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  slug             text,
  industry         text,                       -- hvac | roofing | plumbing | electrical | restoration | property | b2b
  logo_url         text,
  primary_color    text,
  config           jsonb not null default '{}'::jsonb,  -- pipelines, job stages, service types, etc.
  status           text not null default 'active' check (status in ('active', 'inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists idx_companies_org on companies(organization_id);

create trigger trg_companies_updated_at
  before update on companies
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Level 3: LOCATION  (physical / operating branch under a company)
--   Where most day-to-day operational records live (carrying company + org ids).
-- ----------------------------------------------------------------------------
create table if not exists locations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  company_id       uuid not null references companies(id) on delete cascade,
  name             text not null,
  address_line1    text,
  address_line2    text,
  city             text,
  state            text,
  postal_code      text,
  phone            text,
  timezone         text not null default 'America/New_York',
  status           text not null default 'active' check (status in ('active', 'inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_locations_org on locations(organization_id);
create index if not exists idx_locations_company on locations(company_id);

create trigger trg_locations_updated_at
  before update on locations
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Level 4: SERVICE AREA  (territory / market under a location)
--   Drives lead routing, coverage, marketing targeting, service availability,
--   travel/service rules, and territory reporting.
-- ----------------------------------------------------------------------------
create table if not exists service_areas (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  company_id       uuid not null references companies(id) on delete cascade,
  location_id      uuid not null references locations(id) on delete cascade,
  name             text not null,                       -- e.g. "Augusta, GA"
  city             text,
  county           text,
  state            text,
  postal_codes     text[] not null default '{}',        -- zip coverage
  rules            jsonb not null default '{}'::jsonb,   -- travel/service rules
  status           text not null default 'active' check (status in ('active', 'inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_service_areas_location on service_areas(location_id);
create index if not exists idx_service_areas_company on service_areas(company_id);

create trigger trg_service_areas_updated_at
  before update on service_areas
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- USERS & ACCESS
--   `profiles` mirrors auth.users (Supabase). `memberships` grants a role at a
--   scope level. Authorization resolves DOWN the hierarchy from the scope:
--     org_admin        -> every company/location/service_area in the org
--     company_admin    -> the granted company + all its locations/areas
--     location_manager -> the granted location + its areas (+ its company)
--     employee         -> same shape as location_manager, fewer write rights
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id               uuid primary key,                    -- = auth.users.id
  organization_id  uuid not null references organizations(id) on delete cascade,
  full_name        text,
  email            text,
  avatar_url       text,
  status           text not null default 'active' check (status in ('active', 'inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_profiles_org on profiles(organization_id);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create table if not exists memberships (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  user_id          uuid not null references profiles(id) on delete cascade,
  role             text not null check (role in ('org_admin', 'company_admin', 'location_manager', 'employee')),
  -- Scope: which slice of the hierarchy this grant applies to.
  --   org_admin        -> company_id & location_id NULL
  --   company_admin    -> company_id set, location_id NULL
  --   location_manager -> company_id + location_id set
  --   employee         -> company_id + location_id set
  company_id       uuid references companies(id) on delete cascade,
  location_id      uuid references locations(id) on delete cascade,
  status           text not null default 'active' check (status in ('active', 'inactive')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_memberships_user on memberships(user_id);
create index if not exists idx_memberships_org on memberships(organization_id);

create trigger trg_memberships_updated_at
  before update on memberships
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Future RLS scaffolding (NOT enabled — documented for the security phase).
-- The four *_id columns on every operational table are what RLS will key on:
--
--   alter table customers enable row level security;
--   create policy customers_read on customers for select using (
--     organization_id in (select organization_id from memberships where user_id = auth.uid())
--     and ( /* company/location scope checks via a SECURITY DEFINER helper */ )
--   );
-- ----------------------------------------------------------------------------
