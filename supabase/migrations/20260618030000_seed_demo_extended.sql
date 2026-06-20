-- Extended demo seed: guardian person for Naomi Price,
-- attendance records, and a sample transcript issuance.
-- Type mismatch resolved in 20260620010000 and 20260620020000 (ADR-0032).

-- ==========================================================
-- 1. GUARDIAN PERSON — Richard Price (guardian of Naomi Price)
-- ==========================================================
insert into public.academy_people (
  id, tenant_id, full_name, first_name, last_name,
  preferred_name, email, phone, date_of_birth, status,
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

-- ==========================================================
-- 4. ATTENDANCE RECORDS — Fall 2026 sample sessions
--    Requires 20260620010000 (uuid→text column fix)
-- ==========================================================

-- sec-nt401 (NT Studies) — Naomi Price
insert into public.academy_attendance_records (
  tenant_id, course_section_id, student_person_id,
  session_date, status, recorded_by_person_id
)
values
  ('cca-main', 'sec-nt401', 'person-naomi-price', '2026-09-03', 'present', 'person-miriam-stone'),
  ('cca-main', 'sec-nt401', 'person-naomi-price', '2026-09-10', 'present', 'person-miriam-stone'),
  ('cca-main', 'sec-nt401', 'person-naomi-price', '2026-09-17', 'absent',  'person-miriam-stone')
on conflict (tenant_id, course_section_id, student_person_id, session_date) do nothing;

-- sec-nt401 — Daniel Hart
insert into public.academy_attendance_records (
  tenant_id, course_section_id, student_person_id,
  session_date, status, recorded_by_person_id
)
values
  ('cca-main', 'sec-nt401', 'person-daniel-hart', '2026-09-03', 'absent',  'person-miriam-stone'),
  ('cca-main', 'sec-nt401', 'person-daniel-hart', '2026-09-10', 'present', 'person-miriam-stone'),
  ('cca-main', 'sec-nt401', 'person-daniel-hart', '2026-09-17', 'late',    'person-miriam-stone')
on conflict (tenant_id, course_section_id, student_person_id, session_date) do nothing;

-- sec-cap490 (Capstone) — Naomi Price
insert into public.academy_attendance_records (
  tenant_id, course_section_id, student_person_id,
  session_date, status, recorded_by_person_id
)
values
  ('cca-main', 'sec-cap490', 'person-naomi-price', '2026-09-04', 'present', 'person-miriam-stone'),
  ('cca-main', 'sec-cap490', 'person-naomi-price', '2026-09-11', 'late',    'person-miriam-stone')
on conflict (tenant_id, course_section_id, student_person_id, session_date) do nothing;

-- ==========================================================
-- 5. TRANSCRIPT ISSUANCE — Naomi Price (issued by registrar)
--    Requires 20260620020000 (uuid→text column fix)
-- ==========================================================
insert into public.academy_transcript_issuances (
  tenant_id, student_person_id, status, delivery_method,
  recipient_name, recipient_email, note,
  issued_by_person_id, idempotency_key
)
values (
  'cca-main', 'person-naomi-price', 'issued', 'digital_download',
  'Naomi Price', 'naomi.price@churchcoreacademy.edu',
  'Unofficial transcript — Fall 2026 academic review.',
  'person-regina-holt',
  'seed-transcript-naomi-price-fa26'
)
on conflict (tenant_id, idempotency_key) do nothing;
