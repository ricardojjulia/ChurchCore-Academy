-- Extended demo seed rows that depend on ADR-0032 text-column fixes.

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

-- Transcript issuance — Naomi Price (issued by registrar)
insert into public.academy_transcript_issuances (
  tenant_id, student_person_id, status, delivery_method,
  recipient_name, recipient_email, note,
  issued_by_person_id, idempotency_key
)
values (
  'cca-main', 'person-naomi-price', 'issued', 'digital_download',
  'Naomi Price', 'naomi.price@churchcoreacademy.edu',
  'Unofficial transcript - Fall 2026 academic review.',
  'person-regina-holt',
  'seed-transcript-naomi-price-fa26'
)
on conflict (tenant_id, idempotency_key) do nothing;
