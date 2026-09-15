-- Extended demo seed: guardian person for Naomi Price.
-- Attendance and transcript issuance seed rows moved to
-- 20260620030000 after ADR-0032 text-column fixes.

-- ==========================================================
-- 1. GUARDIAN PERSON — Richard Price (guardian of Naomi Price)
-- ==========================================================
insert into public.academy_people (
  id, tenant_id, display_name, given_name, family_name,
  preferred_name, email, phone, date_of_birth, person_status,
  created_at, updated_at
)
values (
  'person-guardian-richard-price', 'cca-main',
  'Richard Price', 'Richard', 'Price',
  null, 'richard.price@example.com', '555-0202',
  null, 'active',
  '2026-06-18 09:00:00+00', '2026-06-18 09:00:00+00'
)
on conflict (id) do nothing;

-- ==========================================================
-- 2. ROLE ASSIGNMENT — Richard Price as guardian
-- ==========================================================
insert into public.academy_person_role_assignments (
  id, tenant_id, person_id, role, scope_type, scope_id,
  status, starts_on, ends_on, created_at, updated_at
)
values (
  'role-richard-guardian-naomi', 'cca-main',
  'person-guardian-richard-price', 'guardian',
  'student', 'person-naomi-price',
  'active', '2026-08-15', null,
  '2026-06-18 09:00:00+00', '2026-06-18 09:00:00+00'
)
on conflict (id) do nothing;

-- ==========================================================
-- 3. STUDENT RELATIONSHIP — Richard Price ↔ Naomi Price
-- ==========================================================
insert into public.academy_student_relationships (
  id, tenant_id, student_person_id, related_person_id,
  relationship_type, authority, visibility,
  status, starts_on, ends_on, created_at, updated_at
)
values (
  'relationship-naomi-richard', 'cca-main',
  'person-naomi-price', 'person-guardian-richard-price',
  'guardian', 'academic_decision', 'full_guardian',
  'active', '2026-08-15', null,
  '2026-06-18 09:00:00+00', '2026-06-18 09:00:00+00'
)
on conflict (id) do nothing;
