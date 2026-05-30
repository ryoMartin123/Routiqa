-- ============================================================================
-- seed.sql — sample hierarchy that matches the prototype UI mock data
-- (lib/hierarchy/data.ts). Safe to run on an empty dev database.
-- ============================================================================

-- Organization -------------------------------------------------------------
insert into organizations (id, name, slug, billing_email, plan)
values ('00000000-0000-0000-0000-0000000000a1', 'Northstar Holdings', 'northstar',
        'billing@northstar.example', 'growth')
on conflict (id) do nothing;

-- Companies ----------------------------------------------------------------
insert into companies (id, organization_id, name, slug, industry, primary_color) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Northstar HVAC',    'northstar-hvac',    'hvac',    '#4f46e5'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'Northstar Roofing', 'northstar-roofing', 'roofing', '#0891b2')
on conflict (id) do nothing;

-- Locations ----------------------------------------------------------------
insert into locations (id, organization_id, company_id, name, city, state, timezone) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Boulder Branch',      'Boulder',      'CO', 'America/Denver'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Denver Branch',       'Denver',       'CO', 'America/Denver'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'Fort Collins Branch', 'Fort Collins', 'CO', 'America/Denver')
on conflict (id) do nothing;

-- Service Areas ------------------------------------------------------------
insert into service_areas (id, organization_id, company_id, location_id, name, city, state, postal_codes) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'Boulder, CO',      'Boulder',      'CO', '{80301,80302,80304}'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'Louisville, CO',   'Louisville',   'CO', '{80027}'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c2', 'Denver, CO',       'Denver',       'CO', '{80202,80203,80205}'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c2', 'Aurora, CO',       'Aurora',       'CO', '{80010,80011}'),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c3', 'Fort Collins, CO', 'Fort Collins', 'CO', '{80521,80525}')
on conflict (id) do nothing;
