-- T3-07: Student self-service contact info fields on academy_people
-- Adds mailing address and emergency contact so students can update their own records

alter table public.academy_people
  add column if not exists mailing_address text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;
