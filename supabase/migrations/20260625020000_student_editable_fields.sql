-- ADR-0049: Student-editable contact fields and emergency contact additions
-- Adds address fields and emergency contact relationship to academy_people

alter table public.academy_people
  add column if not exists address_street text,
  add column if not exists address_city text,
  add column if not exists address_state text,
  add column if not exists address_postal_code text,
  add column if not exists address_country text,
  add column if not exists emergency_contact_relationship text;

-- Note: emergency_contact_name and emergency_contact_phone already exist from migration 20260624010000
