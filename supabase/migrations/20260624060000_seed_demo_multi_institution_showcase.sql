-- ==========================================================
-- SEED: Multi-Institution Type Demo Showcase
-- Tenant: cca-main
-- Purpose: Extends the demo tenant to demonstrate support for
--   Bible school, seminary, and K-12 configurations simultaneously,
--   showcasing ChurchCore Academy's multi-institution-type capability.
--
-- Adds:
--   - Updated institution profile with all three modes enabled
--   - Demo programs for each institution type
--   - Demo students representing each institution type
--   - Demo sections and enrollments across institution types
--
-- Dependencies:
--   - 20260616085000 (institution foundation)
--   - 20260616220000 (academic programs schema)
--   - 20260616230000 (enrollment data)
-- ==========================================================

-- ==========================================================
-- 1. UPDATE INSTITUTION PROFILE — Multi-Institution Showcase
-- ==========================================================
update public.academy_institution_profiles
   set institution_name = 'ChurchCore Academy Demo — Faith, School & Seminary',
       supported_modes  = '["bible_school", "seminary", "childrens_school"]'::jsonb,
       capabilities     = capabilities || '{"multiInstitutionDemo": true, "showBibleSchool": true, "showSeminary": true, "showK12": true}'::jsonb,
       updated_at       = now()
 where tenant_id = 'cca-main';

-- ==========================================================
-- 2. ADD DEMO ACADEMIC PROGRAMS (one per institution type)
-- ==========================================================
insert into public.academy_academic_programs (
  tenant_id, program_code, title, short_title, description,
  institution_mode, credential_type, grade_band, subdivision_id,
  required_credits, required_clock_hours, required_competencies,
  typical_duration_periods, status, effective_from,
  created_by_person_id
)
values
  -- Bible school program
  ('cca-main', 'DEMO-BIBLE', 'Bachelor of Biblical Studies', 'B.B.S.',
   'Four-year Bible school program focused on biblical languages, theology, and ministry formation.',
   'bible_school', 'bachelor', 'adult', 'branch-bible-school',
   120, 0, 0, 8, 'active', '2026-01-01', null),

  -- Seminary program
  ('cca-main', 'DEMO-MDIV', 'Master of Divinity', 'M.Div.',
   'Professional graduate degree for pastoral ministry and advanced theological study.',
   'seminary', 'master', 'graduate', 'branch-seminary',
   90, 0, 0, 6, 'active', '2022-08-01', null),

  -- K-12 program (grade band)
  ('cca-main', 'DEMO-K12-UPP', 'Christian Education — Upper School', 'Upper School',
   'Grades 7-12 Christian academy program with college preparatory curriculum.',
   'childrens_school', 'diploma', 'high_school', 'branch-childrens-school',
   0, 0, 0, 6, 'active', '2026-08-15', null)
on conflict (tenant_id, program_code) do nothing;

-- ==========================================================
-- 3. ADD DEMO SUBDIVISIONS (institution-type specific)
-- ==========================================================
insert into public.academy_institution_subdivisions (
  id, tenant_id, parent_subdivision_id, name, code,
  subdivision_type, institution_mode, status, created_at, updated_at
)
values
  ('demo-multi-sub-bible-languages', 'cca-main', 'branch-bible-school',
   'School of Biblical Languages', 'LANG', 'department', 'bible_school',
   'active', now(), now()),

  ('demo-multi-sub-seminary-grad', 'cca-main', 'branch-seminary',
   'Graduate School of Ministry', 'GSMIN', 'department', 'seminary',
   'active', now(), now()),

  ('demo-multi-sub-k12-upper', 'cca-main', 'branch-childrens-school',
   'Christian Academy Upper School', 'UPPR', 'school', 'childrens_school',
   'active', now(), now())
on conflict (id) do nothing;

-- ==========================================================
-- 4. ADD ACTIVE ACADEMIC PERIODS FOR SEMINARY
--    (Bible school and K-12 already have active periods)
-- ==========================================================
insert into public.academy_academic_years (
  id, tenant_id, name, code, starts_on, ends_on,
  status, calendar_system, subdivision_id, created_at, updated_at
)
values
  ('demo-multi-year-seminary-2026', 'cca-main',
   'Academic Year 2026-2027 (Seminary)', 'SEM2627',
   '2026-08-24', '2027-05-15',
   'active', 'academic_year', 'branch-seminary',
   now(), now())
on conflict (id) do nothing;

insert into public.academy_academic_periods (
  id, tenant_id, academic_year_id, parent_period_id, subdivision_id,
  name, code, period_type, starts_on, ends_on, sequence, status,
  created_at, updated_at
)
values
  ('demo-multi-period-sem-fall-2026', 'cca-main',
   'demo-multi-year-seminary-2026', null, 'branch-seminary',
   'Fall 2026 (Seminary)', 'SEMF26', 'semester',
   '2026-08-24', '2026-12-19', 1, 'active',
   now(), now())
on conflict (id) do nothing;

-- ==========================================================
-- 5. ADD DEMO STUDENTS (one per institution type)
-- ==========================================================
insert into public.academy_people (
  id, tenant_id, display_name, given_name, family_name, preferred_name,
  email, phone, date_of_birth, person_status, created_at, updated_at
)
values
  -- Bible school student
  ('demo-multi-student-bible', 'cca-main',
   'Joshua Keller', 'Joshua', 'Keller', null,
   'joshua.keller@churchcoreacademy.edu', null, '2001-02-14',
   'active', now(), now()),

  -- Seminary student
  ('demo-multi-student-seminary', 'cca-main',
   'Rachel Thompson', 'Rachel', 'Thompson', null,
   'rachel.thompson@churchcoreacademy.edu', null, '1997-09-22',
   'active', now(), now()),

  -- K-12 student (high school)
  ('demo-multi-student-k12', 'cca-main',
   'Marcus Chen', 'Marcus', 'Chen', null,
   'marcus.chen@churchcoreacademy.edu', null, '2011-05-30',
   'active', now(), now())
on conflict (id) do nothing;

-- ==========================================================
-- 6. ADD PERSON ROLE ASSIGNMENTS
-- ==========================================================
insert into public.academy_person_role_assignments (
  id, tenant_id, person_id, role, scope_type, scope_id,
  status, starts_on, ends_on, created_at, updated_at
)
values
  ('demo-multi-role-joshua-student', 'cca-main', 'demo-multi-student-bible',
   'student', 'tenant', null, 'active', '2026-08-24', null, now(), now()),

  ('demo-multi-role-rachel-student', 'cca-main', 'demo-multi-student-seminary',
   'student', 'tenant', null, 'active', '2026-08-24', null, now(), now()),

  ('demo-multi-role-marcus-student', 'cca-main', 'demo-multi-student-k12',
   'student', 'tenant', null, 'active', '2026-08-15', null, now(), now())
on conflict (id) do nothing;

-- ==========================================================
-- 7. ADD STUDENT PROFILES
-- ==========================================================
insert into public.academy_student_profiles (
  id, tenant_id, person_id, student_number, student_type, enrollment_status,
  primary_subdivision_id, grade_band_subdivision_id, program_id,
  advisor_person_id, guardian_required, created_at, updated_at
)
values
  -- Bible school student
  ('demo-multi-profile-joshua', 'cca-main', 'demo-multi-student-bible',
   'BIBLE-2026001', 'adult', 'active',
   'branch-bible-school', null, null,
   'person-julian-pace', false, now(), now()),

  -- Seminary student
  ('demo-multi-profile-rachel', 'cca-main', 'demo-multi-student-seminary',
   'SEM-2026001', 'graduate', 'active',
   'branch-seminary', null, null,
   'person-julian-pace', false, now(), now()),

  -- K-12 student (high school, requires guardian)
  ('demo-multi-profile-marcus', 'cca-main', 'demo-multi-student-k12',
   'K12-2026001', 'child', 'active',
   'branch-childrens-school', 'demo-multi-sub-k12-upper', null,
   'person-julian-pace', true, now(), now())
on conflict (id) do nothing;

-- ==========================================================
-- 8. ADD DEMO COURSES FOR EACH INSTITUTION TYPE
-- ==========================================================
insert into public.academy_courses (
  id, tenant_id, code, title, description, course_type, course_level,
  record_type, default_duration, default_credits, default_clock_hours,
  owning_subdivision_id, grade_band_subdivision_id, status, created_at, updated_at
)
values
  -- Bible school course
  ('demo-multi-course-hebrew', 'cca-main', 'HEB-101', 'Biblical Hebrew I',
   'Introduction to biblical Hebrew grammar and translation.',
   'bible_course', 'certificate', 'transcript',
   '{"durationUnit":"credit_hour","durationValue":4}'::jsonb,
   4, null, 'demo-multi-sub-bible-languages', null, 'active', now(), now()),

  -- Seminary course
  ('demo-multi-course-systematic', 'cca-main', 'THEO-601', 'Systematic Theology I',
   'Graduate-level systematic theology covering theology proper and Christology.',
   'academic_course', 'graduate', 'transcript',
   '{"durationUnit":"credit_hour","durationValue":3}'::jsonb,
   3, null, 'demo-multi-sub-seminary-grad', null, 'active', now(), now()),

  -- K-12 course
  ('demo-multi-course-algebra', 'cca-main', 'MATH-201', 'Algebra II',
   'High school algebra with integration of Christian worldview in mathematics.',
   'children_class', 'children', 'progress_record',
   '{"durationUnit":"week","durationValue":36}'::jsonb,
   null, null, null, 'demo-multi-sub-k12-upper', 'active', now(), now())
on conflict (id) do nothing;

-- ==========================================================
-- 9. ADD DEMO COURSE SECTIONS
-- ==========================================================
insert into public.academy_course_sections (
  id, tenant_id, course_id, academic_year_id, academic_period_id,
  subdivision_id, section_code, title_override, delivery_mode,
  schedule_pattern, capacity, status, primary_instructor_role,
  primary_instructor_id, assistant_instructor_ids, lms_mapping_id,
  created_at, updated_at
)
values
  -- Bible school section (using existing bible school period)
  ('demo-multi-section-hebrew', 'cca-main', 'demo-multi-course-hebrew',
   'year-ministry-2026', 'module-acts-2026',
   'demo-multi-sub-bible-languages', 'HEB-101-1', null, 'in_person',
   'MWF 10:00 AM', 20, 'open', 'instructor',
   'person-miriam-stone', '[]'::jsonb, null, now(), now()),

  -- Seminary section (using new seminary period)
  ('demo-multi-section-systematic', 'cca-main', 'demo-multi-course-systematic',
   'demo-multi-year-seminary-2026', 'demo-multi-period-sem-fall-2026',
   'demo-multi-sub-seminary-grad', 'THEO-601-FA26', null, 'in_person',
   'TTh 1:00 PM', 18, 'open', 'professor',
   'person-miriam-stone', '[]'::jsonb, null, now(), now()),

  -- K-12 section (using existing children's school period)
  ('demo-multi-section-algebra', 'cca-main', 'demo-multi-course-algebra',
   'year-childrens-2026', 'trimester-fall-2026',
   'demo-multi-sub-k12-upper', 'MATH-201-A', null, 'in_person',
   'Daily 9:00 AM', 24, 'scheduled', 'teacher',
   'person-sophia-marsh', '[]'::jsonb, null, now(), now())
on conflict (id) do nothing;

-- ==========================================================
-- 10. ADD PROGRAM ENROLLMENTS FOR DEMO STUDENTS
-- ==========================================================
do $$
declare
  v_prog_bible uuid;
  v_prog_seminary uuid;
  v_prog_k12 uuid;
  v_enr_joshua uuid;
  v_enr_rachel uuid;
  v_period_reg_joshua uuid;
  v_period_reg_rachel uuid;
begin
  -- Lookup program IDs
  select id into v_prog_bible
    from public.academy_academic_programs
   where tenant_id = 'cca-main' and program_code = 'DEMO-BIBLE';

  select id into v_prog_seminary
    from public.academy_academic_programs
   where tenant_id = 'cca-main' and program_code = 'DEMO-MDIV';

  select id into v_prog_k12
    from public.academy_academic_programs
   where tenant_id = 'cca-main' and program_code = 'DEMO-K12-UPP';

  -- Create program enrollments (if programs exist and not already enrolled)
  if v_prog_bible is not null and not exists (
    select 1 from public.academy_program_enrollments
    where tenant_id = 'cca-main'
      and student_person_id = 'demo-multi-student-bible'
      and academic_program_id = v_prog_bible
  ) then
    insert into public.academy_program_enrollments (
      tenant_id, student_profile_id, student_person_id,
      academic_program_id, program_id, status, started_on
    ) values (
      'cca-main', 'demo-multi-profile-joshua', 'demo-multi-student-bible',
      v_prog_bible, null, 'active', '2026-08-24'
    ) returning id into v_enr_joshua;

    -- Period registration for Bible school student
    insert into public.academy_period_registrations (
      tenant_id, student_profile_id, student_person_id,
      academic_period_id, program_enrollment_id, status
    ) values (
      'cca-main', 'demo-multi-profile-joshua', 'demo-multi-student-bible',
      'module-acts-2026', v_enr_joshua, 'registered'
    ) returning id into v_period_reg_joshua;

    -- Section registration for Bible school student
    insert into public.academy_course_section_registrations (
      tenant_id, student_profile_id, student_person_id,
      program_enrollment_id, period_registration_id,
      course_section_id, status, registered_at, confirmed_at,
      idempotency_key
    ) values (
      'cca-main', 'demo-multi-profile-joshua', 'demo-multi-student-bible',
      v_enr_joshua, v_period_reg_joshua, 'demo-multi-section-hebrew',
      'registered', now(), now(), 'demo-multi-reg-joshua-hebrew'
    );
  end if;

  if v_prog_seminary is not null and not exists (
    select 1 from public.academy_program_enrollments
    where tenant_id = 'cca-main'
      and student_person_id = 'demo-multi-student-seminary'
      and academic_program_id = v_prog_seminary
  ) then
    insert into public.academy_program_enrollments (
      tenant_id, student_profile_id, student_person_id,
      academic_program_id, program_id, status, started_on
    ) values (
      'cca-main', 'demo-multi-profile-rachel', 'demo-multi-student-seminary',
      v_prog_seminary, null, 'active', '2026-08-24'
    ) returning id into v_enr_rachel;

    -- Period registration for Seminary student
    insert into public.academy_period_registrations (
      tenant_id, student_profile_id, student_person_id,
      academic_period_id, program_enrollment_id, status
    ) values (
      'cca-main', 'demo-multi-profile-rachel', 'demo-multi-student-seminary',
      'demo-multi-period-sem-fall-2026', v_enr_rachel, 'registered'
    ) returning id into v_period_reg_rachel;

    -- Section registration for Seminary student
    insert into public.academy_course_section_registrations (
      tenant_id, student_profile_id, student_person_id,
      program_enrollment_id, period_registration_id,
      course_section_id, status, registered_at, confirmed_at,
      idempotency_key
    ) values (
      'cca-main', 'demo-multi-profile-rachel', 'demo-multi-student-seminary',
      v_enr_rachel, v_period_reg_rachel, 'demo-multi-section-systematic',
      'registered', now(), now(), 'demo-multi-reg-rachel-systematic'
    );
  end if;

  -- K-12 student enrollment (no program enrollment needed for K-12 grade bands)
  -- Just register in the section directly via period registration
  if not exists (
    select 1 from public.academy_period_registrations
    where tenant_id = 'cca-main'
      and student_person_id = 'demo-multi-student-k12'
      and academic_period_id = 'trimester-fall-2026'
  ) then
    insert into public.academy_period_registrations (
      tenant_id, student_profile_id, student_person_id,
      academic_period_id, program_enrollment_id, status
    ) values (
      'cca-main', 'demo-multi-profile-marcus', 'demo-multi-student-k12',
      'trimester-fall-2026', null, 'registered'
    ) returning id into v_period_reg_rachel; -- reuse var

    insert into public.academy_course_section_registrations (
      tenant_id, student_profile_id, student_person_id,
      program_enrollment_id, period_registration_id,
      course_section_id, status, registered_at, confirmed_at,
      idempotency_key
    ) values (
      'cca-main', 'demo-multi-profile-marcus', 'demo-multi-student-k12',
      null, v_period_reg_rachel, 'demo-multi-section-algebra',
      'registered', now(), now(), 'demo-multi-reg-marcus-algebra'
    );
  end if;
end;
$$;

-- ==========================================================
-- 11. UPDATE STUDENT NUMBER SEQUENCE
-- ==========================================================
insert into public.academy_student_number_sequences (tenant_id, next_value, updated_at)
values ('cca-main', 2026004, now())
on conflict (tenant_id) do update
  set next_value = greatest(academy_student_number_sequences.next_value, excluded.next_value),
      updated_at = now();
