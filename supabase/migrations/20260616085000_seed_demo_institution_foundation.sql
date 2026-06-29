-- ==========================================================
-- SEED: ChurchCore Academy Demo Institution Foundation
-- Tenant: cca-main
-- Purpose: Populates all real normalized tables with demo data.
--   IDs are aligned to mock-data.ts so Prompt-3 DB migration
--   can switch screens to real queries with no ID churn.
--
-- Run order: must run BEFORE 20260616093000 (persona accounts)
--   so people and institution profile exist for FK resolution.
-- ==========================================================

-- ==========================================================
-- 1. INSTITUTION PROFILE
-- ==========================================================
insert into public.academy_institution_profiles (
  tenant_id, institution_name, legal_name, primary_mode,
  supported_modes, operating_rules, capabilities, lms_preference,
  created_at, updated_at
)
values (
  'cca-main',
  'ChurchCore Academy',
  'ChurchCore Academy',
  'bible_school',
  '["bible_school","childrens_school","seminary","college","university"]'::jsonb,
  '{
    "academicYearLabel": "Academic Year",
    "defaultCalendarSystem": "academic_year",
    "defaultTermStructure": "semester",
    "usesGradeLevels": true,
    "usesPrograms": true,
    "usesCohorts": true,
    "usesCredits": true,
    "usesClockHours": true,
    "usesGpa": true,
    "usesTranscripts": true,
    "usesGuardians": true,
    "allowsMinors": true,
    "defaultInstructionalRoleLabel": "professor",
    "officialRecordName": "transcript"
  }'::jsonb,
  '{
    "studentPwa": true,
    "guardianPortal": true,
    "facultyPortal": true,
    "registrarWorkflows": true,
    "admissionsWorkflows": true,
    "transcriptWorkflows": true,
    "graduationWorkflows": true,
    "lmsLaunch": false,
    "lmsRosterSync": false,
    "lmsGradeReturn": false,
    "shepherdAiRecommendations": true
  }'::jsonb,
  '{"provider": "none", "selectionStatus": "not_needed"}'::jsonb,
  '2026-04-23 09:00:00+00',
  '2026-04-23 09:00:00+00'
)
on conflict (tenant_id) do update
  set institution_name = excluded.institution_name,
      legal_name       = excluded.legal_name,
      primary_mode     = excluded.primary_mode,
      supported_modes  = excluded.supported_modes,
      operating_rules  = excluded.operating_rules,
      capabilities     = excluded.capabilities,
      lms_preference   = excluded.lms_preference,
      updated_at       = now();

-- ==========================================================
-- 2. CALENDAR PROFILE
-- ==========================================================
insert into public.academy_calendar_profiles (
  tenant_id, calendar_system, default_term_structure, timezone,
  week_starts_on, uses_instructional_days, uses_enrollment_windows,
  uses_grading_windows, uses_transcript_periods, created_at, updated_at
)
values (
  'cca-main', 'academic_year', 'semester', 'America/New_York',
  'monday', true, true, true, true,
  '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'
)
on conflict (tenant_id) do update
  set calendar_system           = excluded.calendar_system,
      default_term_structure    = excluded.default_term_structure,
      uses_transcript_periods   = excluded.uses_transcript_periods,
      updated_at                = now();

-- ==========================================================
-- 3. COURSE CATALOG PROFILE
-- ==========================================================
insert into public.academy_course_catalog_profiles (
  tenant_id, default_course_record_type, default_duration_unit,
  supports_credits, supports_clock_hours, supports_competencies,
  supports_narrative_evaluation, supports_grade_levels, supports_lms_mapping,
  created_at, updated_at
)
values (
  'cca-main', 'transcript', 'credit_hour',
  true, true, true,
  true, true, false,
  '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'
)
on conflict (tenant_id) do update
  set default_course_record_type    = excluded.default_course_record_type,
      supports_credits              = excluded.supports_credits,
      supports_clock_hours          = excluded.supports_clock_hours,
      supports_competencies         = excluded.supports_competencies,
      supports_narrative_evaluation = excluded.supports_narrative_evaluation,
      supports_grade_levels         = excluded.supports_grade_levels,
      updated_at                    = now();

-- ==========================================================
-- 4. GRADING PROFILE
-- ==========================================================
insert into public.academy_grading_profiles (
  tenant_id, default_evaluation_type, default_official_record_type,
  supports_gpa, supports_credits, supports_clock_hours,
  supports_competencies, supports_narrative_evaluation,
  supports_promotion, supports_graduation_audit,
  grade_release_policy, guardian_visibility_policy,
  created_at, updated_at
)
values (
  'cca-main', 'letter_grade', 'transcript',
  true, true, true,
  true, true,
  true, true,
  'registrar_release', 'guardian_restricted',
  '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'
)
on conflict (tenant_id) do update
  set default_evaluation_type    = excluded.default_evaluation_type,
      supports_gpa               = excluded.supports_gpa,
      grade_release_policy       = excluded.grade_release_policy,
      updated_at                 = now();

-- ==========================================================
-- 5. INSTITUTION SUBDIVISIONS
-- ==========================================================
insert into public.academy_institution_subdivisions (
  id, tenant_id, parent_subdivision_id, name, code,
  subdivision_type, institution_mode, status, created_at, updated_at
)
values
  ('branch-bible-school',     'cca-main', null, 'Bible School',        'BIBLE',   'school', 'bible_school',     'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('branch-childrens-school', 'cca-main', null, 'Children''s School',  'CHILD',   'school', 'childrens_school', 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('branch-seminary',         'cca-main', null, 'Seminary',            'SEM',     'school', 'seminary',         'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('branch-college',          'cca-main', null, 'College of Arts & Theology', 'COL', 'school', 'college',       'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('branch-university',       'cca-main', null, 'University',          'UNI',     'school', 'university',       'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

insert into public.academy_institution_subdivisions (
  id, tenant_id, parent_subdivision_id, name, code,
  subdivision_type, institution_mode, status, created_at, updated_at
)
values
  ('grade-band-k5',        'cca-main', 'branch-childrens-school', 'K-5',                   'K5',     'grade_band', 'childrens_school', 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('cohort-ministry-2026', 'cca-main', 'branch-bible-school',     'Ministry Training 2026', 'MIN2026','cohort',     'bible_school',     'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

-- ==========================================================
-- 6. ACADEMIC YEARS
-- ==========================================================
insert into public.academy_academic_years (
  id, tenant_id, name, code, starts_on, ends_on,
  status, calendar_system, subdivision_id, created_at, updated_at
)
values
  ('year-ministry-2026',     'cca-main', '2026 Ministry Training Year', 'MIN2026', '2026-01-01', '2026-12-31', 'active', 'rolling_enrollment', 'branch-bible-school',     '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('year-childrens-2026',    'cca-main', '2026-2027 School Year',       'SY2026',  '2026-08-15', '2027-05-31', 'active', 'school_year',        'branch-childrens-school', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('year-college-2025-2026', 'cca-main', 'Academic Year 2025-2026',     'AY2526',  '2025-08-25', '2026-05-09', 'active', 'academic_year',      'branch-college',          '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('year-college-2026-2027', 'cca-main', 'Academic Year 2026-2027',     'AY2627',  '2026-08-24', '2027-05-08', 'active', 'academic_year',      'branch-college',          '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

-- ==========================================================
-- 7. ACADEMIC PERIODS
-- ==========================================================
insert into public.academy_academic_periods (
  id, tenant_id, academic_year_id, parent_period_id, subdivision_id,
  name, code, period_type, starts_on, ends_on, sequence, status,
  created_at, updated_at
)
values
  ('module-acts-2026',      'cca-main', 'year-ministry-2026',     null, 'branch-bible-school',     'Acts Ministry Module',  'ACTS', 'module',   '2026-04-01', '2026-05-15', 1, 'active',    '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('trimester-fall-2026',   'cca-main', 'year-childrens-2026',    null, 'branch-childrens-school', 'Fall Trimester',        'FALL', 'term',     '2026-08-15', '2026-11-20', 1, 'active',    '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('semester-spring-2026',  'cca-main', 'year-college-2025-2026', null, 'branch-college',          'Spring 2026',           'SP26', 'semester', '2026-01-15', '2026-05-09', 2, 'completed', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('semester-fall-2026',    'cca-main', 'year-college-2026-2027', null, 'branch-college',          'Fall 2026',             'FA26', 'semester', '2026-08-24', '2026-12-19', 1, 'active',    '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('semester-spring-2027',  'cca-main', 'year-college-2026-2027', null, 'branch-college',          'Spring 2027',           'SP27', 'semester', '2027-01-13', '2027-05-08', 2, 'active',    '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

-- ==========================================================
-- 8. ENROLLMENT WINDOWS
-- ==========================================================
insert into public.academy_enrollment_windows (
  id, tenant_id, academic_period_id, window_type, opens_at, closes_at,
  applies_to_subdivision_id, created_at, updated_at
)
values
  ('ew-acts-2026-app',    'cca-main', 'module-acts-2026',    'application', '2026-03-01 00:00:00+00', null, null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('ew-college-fall-reg', 'cca-main', 'semester-fall-2026',  'registration','2026-04-01 00:00:00+00', '2026-09-06 23:59:59+00', 'branch-college', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

-- ==========================================================
-- 9. GRADING WINDOWS
-- ==========================================================
insert into public.academy_grading_windows (
  id, tenant_id, academic_period_id, opens_at, closes_at,
  grade_posting_policy, created_at, updated_at
)
values
  ('gw-acts-2026',        'cca-main', 'module-acts-2026',    '2026-05-16 00:00:00+00', '2026-05-31 23:59:59+00', 'registrar_posting', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('gw-spring-2026',      'cca-main', 'semester-spring-2026','2026-05-11 00:00:00+00', '2026-05-25 23:59:59+00', 'faculty_posting',   '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('gw-fall-2026',        'cca-main', 'semester-fall-2026',  '2026-12-20 00:00:00+00', '2027-01-05 23:59:59+00', 'faculty_posting',   '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

-- ==========================================================
-- 10. TRANSCRIPT PERIODS
-- ==========================================================
insert into public.academy_transcript_periods (
  id, tenant_id, academic_period_id, record_type,
  posting_opens_at, posting_closes_at, created_at, updated_at
)
values
  ('tp-spring-2026', 'cca-main', 'semester-spring-2026', 'transcript', '2026-06-01 00:00:00+00', '2026-06-15 23:59:59+00', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('tp-fall-2026',   'cca-main', 'semester-fall-2026',   'transcript', '2027-01-06 00:00:00+00', '2027-01-20 23:59:59+00', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

-- ==========================================================
-- 11. OLD STUB PROGRAMS (academy_programs — used by admission FK chain)
-- ==========================================================
insert into public.academy_programs (id, tenant_id, name, credential, required_credits, cohort_label)
values
  ('prog-biblical-studies',   'cca-main', 'B.A. Biblical Studies',       'bachelor',   120, 'Spring 2026 Degree Cohort'),
  ('prog-ministry-leadership', 'cca-main', 'A.A. Ministry Leadership',    'associate',   60, 'Fall 2026 Cohort')
on conflict (id) do nothing;

-- ==========================================================
-- 12. COURSES
-- ==========================================================
insert into public.academy_courses (
  id, tenant_id, code, title, description, course_type, course_level,
  record_type, default_duration, default_credits, default_clock_hours,
  owning_subdivision_id, grade_band_subdivision_id, status, created_at, updated_at
)
values
  ('course-acts-ministry', 'cca-main', 'ACTS-MIN', 'Acts Ministry Module',
   'Ministry formation module focused on Acts and local church mission.',
   'bible_course', 'certificate', 'completion_record',
   '{"durationUnit":"clock_hour","durationValue":24,"clockHours":24}'::jsonb,
   null, 24, 'branch-bible-school', null, 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),

  ('course-reading-k5', 'cca-main', 'READ-K5', 'Reading Foundations',
   'Children''s school reading class with progress-record evaluation.',
   'children_class', 'children', 'progress_record',
   '{"durationUnit":"week","durationValue":16}'::jsonb,
   null, null, null, 'grade-band-k5', 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),

  ('course-ministry-practicum', 'cca-main', 'MIN-390', 'Supervised Ministry Practicum',
   'Field practicum for supervised ministry service and reflection.',
   'ministry_practicum', 'certificate', 'completion_record',
   '{"durationUnit":"clock_hour","durationValue":45,"clockHours":45}'::jsonb,
   null, 45, 'branch-bible-school', null, 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),

  ('course-chapel', 'cca-main', 'CHAPEL', 'Chapel',
   'Institution-wide chapel attendance record.',
   'chapel', 'mixed', 'attendance_only',
   '{"durationUnit":"week","durationValue":16}'::jsonb,
   null, null, null, null, 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),

  ('course-nt401', 'cca-main', 'NT-401', 'Pauline Epistles',
   'Advanced study of the Pauline letters with exegetical and theological focus.',
   'academic_course', 'undergraduate', 'transcript',
   '{"durationUnit":"credit_hour","durationValue":3}'::jsonb,
   3, null, 'branch-college', null, 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),

  ('course-ml205', 'cca-main', 'ML-205', 'Pastoral Administration',
   'Principles of administration, stewardship, and leadership in pastoral ministry.',
   'academic_course', 'undergraduate', 'transcript',
   '{"durationUnit":"credit_hour","durationValue":3}'::jsonb,
   3, null, 'branch-college', null, 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),

  ('course-cap490', 'cca-main', 'CAP-490', 'Capstone Seminar',
   'Senior integrative seminar synthesizing theology, ministry, and vocation.',
   'academic_course', 'undergraduate', 'transcript',
   '{"durationUnit":"credit_hour","durationValue":3}'::jsonb,
   3, null, 'branch-college', null, 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

-- ==========================================================
-- 13. PEOPLE
-- ==========================================================
insert into public.academy_people (
  id, tenant_id, display_name, given_name, family_name, preferred_name,
  email, phone, date_of_birth, person_status, created_at, updated_at
)
values
  ('person-lena-rivera',   'cca-main', 'Lena Rivera',     'Lena',     'Rivera',   null, 'lena.rivera@churchcoreacademy.edu',   null,         '2017-04-10', 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('person-marisol-rivera','cca-main', 'Marisol Rivera',  'Marisol',  'Rivera',   null, 'marisol.rivera@example.com',          '555-0101',   null,         'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('person-sophia-marsh',  'cca-main', 'Sophia Marsh',    'Sophia',   'Marsh',    null, 'sophia.marsh@churchcoreacademy.edu',  null,         null,         'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('person-regina-holt',   'cca-main', 'Regina Holt',     'Regina',   'Holt',     null, 'regina.holt@churchcoreacademy.edu',   null,         null,         'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('person-julian-pace',   'cca-main', 'Julian Pace',     'Julian',   'Pace',     null, 'julian.pace@churchcoreacademy.edu',   null,         null,         'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('person-miriam-stone',  'cca-main', 'Miriam Stone',    'Miriam',   'Stone',    null, 'miriam.stone@churchcoreacademy.edu',  null,         null,         'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('person-samuel-reed',   'cca-main', 'Samuel Reed',     'Samuel',   'Reed',     null, 'samuel.reed@churchcoreacademy.edu',   null,         null,         'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('person-naomi-price',   'cca-main', 'Naomi Price',     'Naomi',    'Price',    null, 'naomi.price@churchcoreacademy.edu',   null,         '1999-06-15', 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('person-daniel-hart',   'cca-main', 'Daniel Hart',     'Daniel',   'Hart',     null, 'daniel.hart@churchcoreacademy.edu',   null,         '2001-03-22', 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('person-leah-brooks',   'cca-main', 'Leah Brooks',     'Leah',     'Brooks',   null, 'leah.brooks@churchcoreacademy.edu',   null,         '2000-09-08', 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('person-maya-bennett',  'cca-main', 'Maya Bennett',    'Maya',     'Bennett',  null, 'maya.bennett@churchcoreacademy.edu',  null,         '2002-11-30', 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('person-ezra-coleman',  'cca-main', 'Ezra Coleman',    'Ezra',     'Coleman',  null, 'ezra.coleman@churchcoreacademy.edu',  null,         '2003-07-18', 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

-- ==========================================================
-- 14. PERSON ROLE ASSIGNMENTS
-- ==========================================================
insert into public.academy_person_role_assignments (
  id, tenant_id, person_id, role, scope_type, scope_id,
  status, starts_on, ends_on, created_at, updated_at
)
values
  ('role-lena-student',          'cca-main', 'person-lena-rivera',    'student',    'tenant', null,                'active', '2026-08-15', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('role-marisol-guardian-lena', 'cca-main', 'person-marisol-rivera', 'guardian',   'student','person-lena-rivera','active', '2026-08-15', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('role-sophia-teacher',        'cca-main', 'person-sophia-marsh',   'teacher',    'tenant', null,                'active', '2026-08-15', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('role-regina-registrar',      'cca-main', 'person-regina-holt',    'registrar',  'tenant', null,                'active', '2026-08-15', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('role-julian-advisor',        'cca-main', 'person-julian-pace',    'advisor',    'tenant', null,                'active', '2026-08-15', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('role-miriam-professor',      'cca-main', 'person-miriam-stone',   'teacher',    'tenant', null,                'active', '2026-08-15', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('role-samuel-teacher',        'cca-main', 'person-samuel-reed',    'teacher',    'tenant', null,                'active', '2026-08-15', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('role-naomi-student',         'cca-main', 'person-naomi-price',    'student',    'tenant', null,                'active', '2022-08-19', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('role-daniel-student',        'cca-main', 'person-daniel-hart',    'student',    'tenant', null,                'active', '2024-01-11', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('role-leah-student',          'cca-main', 'person-leah-brooks',    'student',    'tenant', null,                'active', '2023-08-15', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('role-maya-applicant',        'cca-main', 'person-maya-bennett',   'applicant',  'tenant', null,                'active', '2026-03-28', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('role-ezra-student',          'cca-main', 'person-ezra-coleman',   'student',    'tenant', null,                'active', '2026-04-02', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict do nothing;

-- ==========================================================
-- 15. STUDENT PROFILES
-- ==========================================================
insert into public.academy_student_profiles (
  id, tenant_id, person_id, student_number, student_type, enrollment_status,
  primary_subdivision_id, grade_band_subdivision_id, program_id,
  advisor_person_id, guardian_required, created_at, updated_at
)
values
  ('student-profile-lena',   'cca-main', 'person-lena-rivera',  'CHILD-1001', 'child',       'active',   'branch-childrens-school', 'grade-band-k5', null,                    'person-julian-pace', true,  '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('student-profile-naomi',  'cca-main', 'person-naomi-price',  'COL-2022001','undergraduate','active',   'branch-college',          null,            'prog-biblical-studies', 'person-julian-pace', false, '2022-08-19 10:00:00+00', '2026-04-23 09:00:00+00'),
  ('student-profile-daniel', 'cca-main', 'person-daniel-hart',  'COL-2024001','undergraduate','active',   'branch-college',          null,            'prog-biblical-studies', 'person-julian-pace', false, '2024-01-11 10:00:00+00', '2026-04-23 09:00:00+00'),
  ('student-profile-leah',   'cca-main', 'person-leah-brooks',  'COL-2023001','undergraduate','active',   'branch-college',          null,            'prog-ministry-leadership','person-julian-pace',false,'2023-08-15 10:00:00+00', '2026-04-23 09:00:00+00'),
  ('student-profile-maya',   'cca-main', 'person-maya-bennett', 'COL-2026001','undergraduate','pending',  'branch-college',          null,            null,                    null,                 false, '2026-03-28 12:00:00+00', '2026-04-23 09:00:00+00'),
  ('student-profile-ezra',   'cca-main', 'person-ezra-coleman', 'COL-2026002','undergraduate','admitted', 'branch-college',          null,            'prog-ministry-leadership','person-julian-pace',false,'2026-04-02 14:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

-- ==========================================================
-- 16. STAFF PROFILES
-- ==========================================================
insert into public.academy_staff_profiles (
  id, tenant_id, person_id, staff_number, title, primary_role,
  primary_subdivision_id, employment_status, load_policy, created_at, updated_at
)
values
  ('staff-profile-sophia',  'cca-main', 'person-sophia-marsh',  'STAFF-1001', 'Lead Teacher',           'teacher',    'branch-childrens-school', 'active', 'children_school_daily_roster', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('staff-profile-regina',  'cca-main', 'person-regina-holt',   'STAFF-1002', 'Registrar',              'registrar',  null,                      'active', null,                          '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('staff-profile-julian',  'cca-main', 'person-julian-pace',   'STAFF-1003', 'Academic Advisor',       'advisor',    null,                      'active', null,                          '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('staff-profile-miriam',  'cca-main', 'person-miriam-stone',  'STAFF-2001', 'Professor of Biblical Studies', 'teacher', 'branch-college',       'active', null,                          '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('staff-profile-samuel',  'cca-main', 'person-samuel-reed',   'STAFF-2002', 'Adjunct Faculty',        'teacher',    'branch-college',          'active', null,                          '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

-- ==========================================================
-- 17. STUDENT RELATIONSHIPS
-- ==========================================================
insert into public.academy_student_relationships (
  id, tenant_id, student_person_id, related_person_id,
  relationship_type, authority, visibility, status,
  starts_on, ends_on, created_at, updated_at
)
values
  ('relationship-lena-marisol', 'cca-main', 'person-lena-rivera', 'person-marisol-rivera', 'guardian', 'academic_decision', 'full_guardian', 'active', '2026-08-15', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('relationship-lena-sophia',  'cca-main', 'person-lena-rivera', 'person-sophia-marsh',   'mentor',   'none',             'progress',     'active', '2026-08-15', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('relationship-lena-julian',  'cca-main', 'person-lena-rivera', 'person-julian-pace',    'advisor',  'registration_decision','progress', 'active', '2026-08-15', null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

-- ==========================================================
-- 18. COURSE SECTIONS
-- ==========================================================
insert into public.academy_course_sections (
  id, tenant_id, course_id, academic_year_id, academic_period_id,
  subdivision_id, section_code, title_override, delivery_mode,
  schedule_pattern, capacity, status, primary_instructor_role,
  primary_instructor_id, assistant_instructor_ids, lms_mapping_id,
  created_at, updated_at
)
values
  ('section-acts-ministry',    'cca-main', 'course-acts-ministry',      'year-ministry-2026',     'module-acts-2026',      'cohort-ministry-2026',    'ACTS-MIN-1', null, 'hybrid',         'Tuesday 6:30 PM',          24, 'open',      'instructor', 'person-miriam-stone', '[]'::jsonb, null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('section-reading-k5',       'cca-main', 'course-reading-k5',         'year-childrens-2026',    'trimester-fall-2026',   'grade-band-k5',           'READ-K5-A',  null, 'in_person',      'Daily reading block',      18, 'scheduled', 'teacher',    'person-sophia-marsh', '[]'::jsonb, null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('section-ministry-practicum','cca-main', 'course-ministry-practicum', 'year-ministry-2026',     'module-acts-2026',      'branch-bible-school',     'MIN-390-A',  null, 'field_practicum','Supervised field placement',12, 'scheduled', 'instructor', 'person-miriam-stone', '[]'::jsonb, null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('sec-nt401',                'cca-main', 'course-nt401',              'year-college-2026-2027', 'semester-fall-2026',    'branch-college',          'NT-401-FA26',null, 'in_person',      'MWF 9:00 AM',              24, 'open',      'professor',  'person-miriam-stone', '[]'::jsonb, null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('sec-ml205',                'cca-main', 'course-ml205',              'year-college-2026-2027', 'semester-fall-2026',    'branch-college',          'ML-205-FA26',null, 'in_person',      'TTh 11:00 AM',             20, 'open',      'professor',  'person-samuel-reed',  '[]'::jsonb, null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('sec-cap490',               'cca-main', 'course-cap490',             'year-college-2026-2027', 'semester-fall-2026',    'branch-college',          'CAP-490-FA26',null,'in_person',      'TTh 2:00 PM',              18, 'scheduled', 'professor',  null,                  '[]'::jsonb, null, '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

-- ==========================================================
-- 19. EVALUATION SCALES (old grading system)
-- ==========================================================
insert into public.academy_evaluation_scales (
  id, tenant_id, name, scale_type, applies_to_record_type,
  narrative_required, status, created_at, updated_at
)
values
  ('scale-ministry-pass-fail', 'cca-main', 'Ministry Completion Pass/Fail', 'pass_fail',    'completion_record', false, 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('scale-college-letter',     'cca-main', 'Standard College Letter Grade', 'letter_grade', 'transcript',        false, 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

insert into public.academy_evaluation_scale_bands (
  id, tenant_id, scale_id, label, minimum_value, maximum_value,
  grade_points, is_passing, is_completion, official_record_value, sequence
)
values
  ('band-ministry-pass',       'cca-main', 'scale-ministry-pass-fail', 'Pass',       null, null, null, true,  true,  'P', 1),
  ('band-ministry-incomplete', 'cca-main', 'scale-ministry-pass-fail', 'Incomplete', null, null, null, false, false, 'I', 2),
  ('band-college-a',           'cca-main', 'scale-college-letter',     'A',          93,   100,  4.0,  true,  true,  'A', 1),
  ('band-college-a-minus',     'cca-main', 'scale-college-letter',     'A-',         90,   92,   3.7,  true,  true,  'A-',2),
  ('band-college-b-plus',      'cca-main', 'scale-college-letter',     'B+',         87,   89,   3.3,  true,  true,  'B+',3),
  ('band-college-b',           'cca-main', 'scale-college-letter',     'B',          83,   86,   3.0,  true,  true,  'B', 4),
  ('band-college-b-minus',     'cca-main', 'scale-college-letter',     'B-',         80,   82,   2.7,  true,  true,  'B-',5),
  ('band-college-c-plus',      'cca-main', 'scale-college-letter',     'C+',         77,   79,   2.3,  true,  true,  'C+',6),
  ('band-college-c',           'cca-main', 'scale-college-letter',     'C',          73,   76,   2.0,  true,  true,  'C', 7),
  ('band-college-d',           'cca-main', 'scale-college-letter',     'D',          60,   69,   1.0,  true,  true,  'D', 8),
  ('band-college-f',           'cca-main', 'scale-college-letter',     'F',          0,    59,   0.0,  false, false, 'F', 9)
on conflict (id) do nothing;

-- ==========================================================
-- 20. EVALUATION RULE SETS (old grading system)
-- ==========================================================
insert into public.academy_evaluation_rule_sets (
  id, tenant_id, course_id, section_id,
  evaluation_type, scale_id, record_type,
  gpa_policy, credit_policy, clock_hour_policy,
  competency_policy, narrative_policy, posting_policy,
  lms_grade_return_policy, status, created_at, updated_at
)
values
  ('ruleset-acts-completion', 'cca-main', 'course-acts-ministry', 'section-acts-ministry',
   'pass_fail', 'scale-ministry-pass-fail', 'completion_record',
   'not_applicable', 'not_applicable', 'attempted_and_earned',
   'not_applicable', 'optional', 'registrar_posting',
   'manual_entry_only', 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('ruleset-nt401-transcript', 'cca-main', 'course-nt401', 'sec-nt401',
   'letter_grade', 'scale-college-letter', 'transcript',
   'counted', 'counted', 'not_applicable',
   'not_applicable', 'not_applicable', 'faculty_posting',
   'manual_entry_only', 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('ruleset-ml205-transcript', 'cca-main', 'course-ml205', 'sec-ml205',
   'letter_grade', 'scale-college-letter', 'transcript',
   'counted', 'counted', 'not_applicable',
   'not_applicable', 'not_applicable', 'faculty_posting',
   'manual_entry_only', 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00'),
  ('ruleset-cap490-transcript', 'cca-main', 'course-cap490', 'sec-cap490',
   'letter_grade', 'scale-college-letter', 'transcript',
   'counted', 'counted', 'not_applicable',
   'not_applicable', 'required', 'faculty_posting',
   'manual_entry_only', 'active', '2026-04-23 09:00:00+00', '2026-04-23 09:00:00+00')
on conflict (id) do nothing;

-- ==========================================================
-- 21. NEW GRADEBOOK SCALES + ENTRIES
-- ==========================================================
insert into public.academy_gradebook_scales (
  id, tenant_id, name, scale_type, is_default, created_by_person_id
)
values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'cca-main', 'Standard Letter Grade', 'letter', true, 'person-regina-holt'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'cca-main', 'Pass / Fail',           'pass_fail', false, 'person-regina-holt')
on conflict do nothing;

insert into public.academy_gradebook_scale_entries (
  id, tenant_id, scale_id, letter_grade, min_percentage, max_percentage, gpa_points, label
)
values
  ('a0000001-0001-0000-0000-000000000001'::uuid,'cca-main','a0000000-0000-0000-0000-000000000001'::uuid,'A',  93.00,100.00,4.00,'Excellent'),
  ('a0000001-0001-0000-0000-000000000002'::uuid,'cca-main','a0000000-0000-0000-0000-000000000001'::uuid,'A-', 90.00, 92.99,3.70,'Excellent'),
  ('a0000001-0001-0000-0000-000000000003'::uuid,'cca-main','a0000000-0000-0000-0000-000000000001'::uuid,'B+', 87.00, 89.99,3.30,'Above Average'),
  ('a0000001-0001-0000-0000-000000000004'::uuid,'cca-main','a0000000-0000-0000-0000-000000000001'::uuid,'B',  83.00, 86.99,3.00,'Above Average'),
  ('a0000001-0001-0000-0000-000000000005'::uuid,'cca-main','a0000000-0000-0000-0000-000000000001'::uuid,'B-', 80.00, 82.99,2.70,'Average'),
  ('a0000001-0001-0000-0000-000000000006'::uuid,'cca-main','a0000000-0000-0000-0000-000000000001'::uuid,'C+', 77.00, 79.99,2.30,'Average'),
  ('a0000001-0001-0000-0000-000000000007'::uuid,'cca-main','a0000000-0000-0000-0000-000000000001'::uuid,'C',  73.00, 76.99,2.00,'Satisfactory'),
  ('a0000001-0001-0000-0000-000000000008'::uuid,'cca-main','a0000000-0000-0000-0000-000000000001'::uuid,'D',  60.00, 72.99,1.00,'Passing'),
  ('a0000001-0001-0000-0000-000000000009'::uuid,'cca-main','a0000000-0000-0000-0000-000000000001'::uuid,'F',   0.00, 59.99,0.00,'Failing'),
  ('a0000001-0002-0000-0000-000000000001'::uuid,'cca-main','a0000000-0000-0000-0000-000000000002'::uuid, null,  75.00,100.00,null,'Pass'),
  ('a0000001-0002-0000-0000-000000000002'::uuid,'cca-main','a0000000-0000-0000-0000-000000000002'::uuid, null,   0.00, 74.99,null,'Fail')
on conflict (id) do nothing;

-- ==========================================================
-- 22. GRADEBOOK ASSIGNMENTS
-- ==========================================================
insert into public.academy_gradebook_assignments (
  id, tenant_id, course_id, section_id, created_by_person_id,
  title, assignment_type, max_points, weight, due_date,
  is_published, grading_scale_id, sensitivity_tier
)
values
  ('b0000001-0001-0000-0000-000000000001'::uuid,'cca-main','course-nt401','sec-nt401','person-miriam-stone',
   'Pauline Theology Essay', 'essay', 100.00, 0.30,
   '2026-10-15 23:59:00+00', true,
   'a0000000-0000-0000-0000-000000000001'::uuid, 'standard'),

  ('b0000001-0001-0000-0000-000000000002'::uuid,'cca-main','course-nt401','sec-nt401','person-miriam-stone',
   'Midterm Examination', 'quiz', 100.00, 0.35,
   '2026-10-22 14:00:00+00', true,
   'a0000000-0000-0000-0000-000000000001'::uuid, 'standard'),

  ('b0000001-0001-0000-0000-000000000003'::uuid,'cca-main','course-nt401','sec-nt401','person-miriam-stone',
   'Final Examination', 'quiz', 100.00, 0.35,
   '2026-12-10 14:00:00+00', true,
   'a0000000-0000-0000-0000-000000000001'::uuid, 'standard'),

  ('b0000001-0002-0000-0000-000000000001'::uuid,'cca-main','course-ml205','sec-ml205','person-samuel-reed',
   'Leadership Case Study', 'project', 100.00, 0.40,
   '2026-10-20 23:59:00+00', true,
   'a0000000-0000-0000-0000-000000000001'::uuid, 'standard'),

  ('b0000001-0002-0000-0000-000000000002'::uuid,'cca-main','course-ml205','sec-ml205','person-samuel-reed',
   'Final Presentation', 'project', 100.00, 0.60,
   '2026-12-08 14:00:00+00', false,
   'a0000000-0000-0000-0000-000000000001'::uuid, 'standard')
on conflict (id) do nothing;

-- ==========================================================
-- 23. STUDENT NUMBER SEQUENCES
-- ==========================================================
insert into public.academy_student_number_sequences (tenant_id, next_value, updated_at)
values ('cca-main', 2026003, now())
on conflict (tenant_id) do update
  set next_value = greatest(academy_student_number_sequences.next_value, excluded.next_value),
      updated_at = now();

-- ==========================================================
-- 24. POPULATE TENANT REGISTRY (from platform control plane)
-- ==========================================================
insert into public.academy_tenant_registry (
  tenant_id,
  display_name,
  tenant_kind,
  lifecycle_status,
  is_demo,
  provisioning_status
)
select
  profile.tenant_id,
  profile.institution_name,
  profile.primary_mode,
  case when profile.tenant_id = 'cca-main' then 'demo' else 'development' end,
  profile.tenant_id = 'cca-main',
  'ready'
from public.academy_institution_profiles profile
on conflict (tenant_id) do nothing;
