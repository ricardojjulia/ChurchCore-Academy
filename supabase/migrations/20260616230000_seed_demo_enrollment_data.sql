-- ==========================================================
-- SEED: ChurchCore Academy Demo Enrollment Data
-- Tenant: cca-main
-- Depends on:
--   20260616085000 — institution foundation (people, courses, sections)
--   20260616220000 — academy_academic_programs table
--   20260613142628 — admission applications schema
--   20260613154955 — program/period registration schema
--   20260614040000 — course section registration schema
--   20260616002351 — gradebook schema
--
-- Creates: normalized programs, full admission → enrollment chains
--   for active students, and sample gradebook submissions + records.
-- ==========================================================

-- ==========================================================
-- 1. NORMALIZED ACADEMIC PROGRAMS (new UUID table)
-- ==========================================================
insert into public.academy_academic_programs (
  tenant_id, program_code, title, short_title, description,
  institution_mode, credential_type, grade_band, subdivision_id,
  required_credits, required_clock_hours, required_competencies,
  typical_duration_periods, status, effective_from,
  created_by_person_id
)
values
  ('cca-main', 'BC-MIN', 'Bible Certificate in Ministry', 'Bible Cert',
   'Foundation certificate in biblical studies and local church ministry.',
   'bible_school', 'certificate', 'adult', 'branch-bible-school',
   0, 120, 0, 4, 'active', '2026-01-01', 'person-regina-holt'),

  ('cca-main', 'AA-ML', 'Associate of Arts in Ministry Leadership', 'A.A. Ministry Leadership',
   'Two-year undergraduate program in pastoral leadership and Christian ministry.',
   'college', 'associate', 'undergraduate', 'branch-college',
   60, 0, 0, 4, 'active', '2025-08-01', 'person-regina-holt'),

  ('cca-main', 'BTH', 'Bachelor of Theology', 'B.Th.',
   'Four-year undergraduate degree in biblical theology and ministerial studies.',
   'college', 'bachelor', 'undergraduate', 'branch-college',
   120, 0, 0, 8, 'active', '2022-08-01', 'person-regina-holt'),

  ('cca-main', 'MDIV', 'Master of Divinity', 'M.Div.',
   'Professional graduate degree for pastoral ministry and advanced theological study.',
   'seminary', 'master', 'graduate', 'branch-seminary',
   90, 0, 0, 6, 'active', '2022-08-01', 'person-regina-holt')
on conflict (tenant_id, program_code) do nothing;

-- ==========================================================
-- 2. ENROLLMENT CHAINS
--
--    State machine: draft → submitted → under_review → accepted
--    Then: program_enrollment → period_registration → section_registrations
--
--    Active students enrolled in Fall 2026 college semester:
--      Naomi Price   (BTH, year 5, near graduation)
--      Daniel Hart   (BTH, year 3, academic probation)
--      Leah Brooks   (AA-ML, year 4, near completion)
--
--    Partially-enrolled:
--      Ezra Coleman  (AA-ML, newly admitted, Fall 2026)
--
--    Children's school:
--      Lena Rivera   (grade-band K-5, Fall 2026 trimester)
-- ==========================================================

do $$
declare
  v_app_naomi     uuid;
  v_app_daniel    uuid;
  v_app_leah      uuid;
  v_app_ezra      uuid;
  v_app_lena      uuid;
  v_enr_naomi     uuid;
  v_enr_daniel    uuid;
  v_enr_leah      uuid;
  v_enr_ezra      uuid;
  v_reg_naomi     uuid;
  v_reg_daniel    uuid;
  v_reg_leah      uuid;
  v_reg_ezra      uuid;
begin

  -- --------------------------------------------------------
  -- NAOMI PRICE — BTH, active, near graduation
  -- --------------------------------------------------------
  if not exists (
    select 1 from public.academy_admission_applications
    where tenant_id = 'cca-main'
      and applicant_person_id = 'person-naomi-price'
      and status = 'accepted'
      and program_id = 'prog-biblical-studies'
  ) then
    insert into public.academy_admission_applications (
      tenant_id, applicant_person_id, program_id, application_term_id,
      legal_name, preferred_name, email, phone, status,
      submitted_at, idempotency_key
    ) values (
      'cca-main', 'person-naomi-price', 'prog-biblical-studies', 'semester-fall-2026',
      'Naomi Price', 'Naomi', 'naomi.price@churchcoreacademy.edu', null, 'draft',
      null, 'seed-app-naomi-price-bth-2022'
    ) returning id into v_app_naomi;

    update public.academy_admission_applications
      set status = 'submitted', submitted_at = '2022-07-01 10:00:00+00'
      where id = v_app_naomi;

    update public.academy_admission_applications
      set status = 'under_review'
      where id = v_app_naomi;

    update public.academy_admission_applications
      set status = 'accepted',
          decided_at = '2022-08-01 09:00:00+00',
          decided_by_person_id = 'person-regina-holt',
          decision_reason = 'Accepted — strong academic background.'
      where id = v_app_naomi;

    insert into public.academy_program_enrollments (
      tenant_id, student_profile_id, student_person_id,
      program_id, source_application_id, status, started_on
    ) values (
      'cca-main', 'student-profile-naomi', 'person-naomi-price',
      'prog-biblical-studies', v_app_naomi, 'active', '2022-08-19'
    ) returning id into v_enr_naomi;

    insert into public.academy_period_registrations (
      tenant_id, student_profile_id, student_person_id,
      academic_period_id, program_enrollment_id, source_application_id, status
    ) values (
      'cca-main', 'student-profile-naomi', 'person-naomi-price',
      'semester-fall-2026', v_enr_naomi, v_app_naomi, 'registered'
    ) returning id into v_reg_naomi;

    insert into public.academy_course_section_registrations (
      tenant_id, student_profile_id, student_person_id,
      program_enrollment_id, period_registration_id,
      course_section_id, source_application_id,
      status, registered_at, confirmed_at, idempotency_key
    ) values
      ('cca-main','student-profile-naomi','person-naomi-price',
       v_enr_naomi, v_reg_naomi, 'sec-nt401', v_app_naomi,
       'registered', now(), now(), 'seed-reg-naomi-nt401-fa26'),
      ('cca-main','student-profile-naomi','person-naomi-price',
       v_enr_naomi, v_reg_naomi, 'sec-cap490', v_app_naomi,
       'registered', now(), now(), 'seed-reg-naomi-cap490-fa26');
  end if;

  -- --------------------------------------------------------
  -- DANIEL HART — BTH, active, academic probation
  -- --------------------------------------------------------
  if not exists (
    select 1 from public.academy_admission_applications
    where tenant_id = 'cca-main'
      and applicant_person_id = 'person-daniel-hart'
      and status = 'accepted'
  ) then
    insert into public.academy_admission_applications (
      tenant_id, applicant_person_id, program_id, application_term_id,
      legal_name, preferred_name, email, phone, status,
      submitted_at, idempotency_key
    ) values (
      'cca-main', 'person-daniel-hart', 'prog-biblical-studies', 'semester-fall-2026',
      'Daniel Hart', 'Daniel', 'daniel.hart@churchcoreacademy.edu', null, 'draft',
      null, 'seed-app-daniel-hart-bth-2024'
    ) returning id into v_app_daniel;

    update public.academy_admission_applications
      set status = 'submitted', submitted_at = '2023-12-01 10:00:00+00'
      where id = v_app_daniel;

    update public.academy_admission_applications
      set status = 'under_review'
      where id = v_app_daniel;

    update public.academy_admission_applications
      set status = 'accepted',
          decided_at = '2024-01-05 09:00:00+00',
          decided_by_person_id = 'person-regina-holt',
          decision_reason = 'Accepted with academic support plan.'
      where id = v_app_daniel;

    insert into public.academy_program_enrollments (
      tenant_id, student_profile_id, student_person_id,
      program_id, source_application_id, status, started_on
    ) values (
      'cca-main', 'student-profile-daniel', 'person-daniel-hart',
      'prog-biblical-studies', v_app_daniel, 'active', '2024-01-11'
    ) returning id into v_enr_daniel;

    insert into public.academy_period_registrations (
      tenant_id, student_profile_id, student_person_id,
      academic_period_id, program_enrollment_id, source_application_id, status
    ) values (
      'cca-main', 'student-profile-daniel', 'person-daniel-hart',
      'semester-fall-2026', v_enr_daniel, v_app_daniel, 'registered'
    ) returning id into v_reg_daniel;

    insert into public.academy_course_section_registrations (
      tenant_id, student_profile_id, student_person_id,
      program_enrollment_id, period_registration_id,
      course_section_id, source_application_id,
      status, registered_at, confirmed_at, idempotency_key
    ) values
      ('cca-main','student-profile-daniel','person-daniel-hart',
       v_enr_daniel, v_reg_daniel, 'sec-nt401', v_app_daniel,
       'registered', now(), now(), 'seed-reg-daniel-nt401-fa26'),
      ('cca-main','student-profile-daniel','person-daniel-hart',
       v_enr_daniel, v_reg_daniel, 'sec-ml205', v_app_daniel,
       'registered', now(), now(), 'seed-reg-daniel-ml205-fa26');
  end if;

  -- --------------------------------------------------------
  -- LEAH BROOKS — AA-ML, active, near completion
  -- --------------------------------------------------------
  if not exists (
    select 1 from public.academy_admission_applications
    where tenant_id = 'cca-main'
      and applicant_person_id = 'person-leah-brooks'
      and status = 'accepted'
  ) then
    insert into public.academy_admission_applications (
      tenant_id, applicant_person_id, program_id, application_term_id,
      legal_name, preferred_name, email, phone, status,
      submitted_at, idempotency_key
    ) values (
      'cca-main', 'person-leah-brooks', 'prog-ministry-leadership', 'semester-fall-2026',
      'Leah Brooks', 'Leah', 'leah.brooks@churchcoreacademy.edu', null, 'draft',
      null, 'seed-app-leah-brooks-aaml-2023'
    ) returning id into v_app_leah;

    update public.academy_admission_applications
      set status = 'submitted', submitted_at = '2023-07-10 10:00:00+00'
      where id = v_app_leah;

    update public.academy_admission_applications
      set status = 'under_review'
      where id = v_app_leah;

    update public.academy_admission_applications
      set status = 'accepted',
          decided_at = '2023-08-05 09:00:00+00',
          decided_by_person_id = 'person-regina-holt',
          decision_reason = 'Accepted — ministry leadership track.'
      where id = v_app_leah;

    insert into public.academy_program_enrollments (
      tenant_id, student_profile_id, student_person_id,
      program_id, source_application_id, status, started_on
    ) values (
      'cca-main', 'student-profile-leah', 'person-leah-brooks',
      'prog-ministry-leadership', v_app_leah, 'active', '2023-08-15'
    ) returning id into v_enr_leah;

    insert into public.academy_period_registrations (
      tenant_id, student_profile_id, student_person_id,
      academic_period_id, program_enrollment_id, source_application_id, status
    ) values (
      'cca-main', 'student-profile-leah', 'person-leah-brooks',
      'semester-fall-2026', v_enr_leah, v_app_leah, 'registered'
    ) returning id into v_reg_leah;

    insert into public.academy_course_section_registrations (
      tenant_id, student_profile_id, student_person_id,
      program_enrollment_id, period_registration_id,
      course_section_id, source_application_id,
      status, registered_at, confirmed_at, idempotency_key
    ) values
      ('cca-main','student-profile-leah','person-leah-brooks',
       v_enr_leah, v_reg_leah, 'sec-ml205', v_app_leah,
       'registered', now(), now(), 'seed-reg-leah-ml205-fa26');
  end if;

  -- --------------------------------------------------------
  -- EZRA COLEMAN — AA-ML, newly admitted, Fall 2026
  -- --------------------------------------------------------
  if not exists (
    select 1 from public.academy_admission_applications
    where tenant_id = 'cca-main'
      and applicant_person_id = 'person-ezra-coleman'
      and status = 'accepted'
  ) then
    insert into public.academy_admission_applications (
      tenant_id, applicant_person_id, program_id, application_term_id,
      legal_name, preferred_name, email, phone, status,
      submitted_at, idempotency_key
    ) values (
      'cca-main', 'person-ezra-coleman', 'prog-ministry-leadership', 'semester-fall-2026',
      'Ezra Coleman', 'Ezra', 'ezra.coleman@churchcoreacademy.edu', null, 'draft',
      null, 'seed-app-ezra-coleman-aaml-2026'
    ) returning id into v_app_ezra;

    update public.academy_admission_applications
      set status = 'submitted', submitted_at = '2026-03-15 10:00:00+00'
      where id = v_app_ezra;

    update public.academy_admission_applications
      set status = 'under_review'
      where id = v_app_ezra;

    update public.academy_admission_applications
      set status = 'accepted',
          decided_at = '2026-04-02 09:00:00+00',
          decided_by_person_id = 'person-regina-holt',
          decision_reason = 'Accepted — strong ministry background.'
      where id = v_app_ezra;

    insert into public.academy_program_enrollments (
      tenant_id, student_profile_id, student_person_id,
      program_id, source_application_id, status, started_on
    ) values (
      'cca-main', 'student-profile-ezra', 'person-ezra-coleman',
      'prog-ministry-leadership', v_app_ezra, 'active', '2026-08-24'
    ) returning id into v_enr_ezra;
    -- No period registration yet (recently admitted, not yet registered for courses)
  end if;

  -- --------------------------------------------------------
  -- MAYA BENNETT — pending applicant (no accepted application)
  -- --------------------------------------------------------
  if not exists (
    select 1 from public.academy_admission_applications
    where tenant_id = 'cca-main'
      and applicant_person_id = 'person-maya-bennett'
  ) then
    insert into public.academy_admission_applications (
      tenant_id, applicant_person_id, program_id, application_term_id,
      legal_name, preferred_name, email, phone, status,
      submitted_at, idempotency_key
    ) values (
      'cca-main', 'person-maya-bennett', 'prog-biblical-studies', 'semester-fall-2026',
      'Maya Bennett', 'Maya', 'maya.bennett@churchcoreacademy.edu', null, 'draft',
      null, 'seed-app-maya-bennett-bth-2026'
    );
    -- Left in 'draft' — under review per mock data context
  end if;

end;
$$;

-- ==========================================================
-- 3. SAMPLE GRADEBOOK SUBMISSIONS + RECORDS
--    (Pauline Theology Essay for Naomi and Daniel — already submitted)
-- ==========================================================
do $$
declare
  v_assign_essay uuid := 'b0000001-0001-0000-0000-000000000001'::uuid;
  v_assign_mid   uuid := 'b0000001-0001-0000-0000-000000000002'::uuid;
  v_sub_naomi_essay uuid;
  v_sub_daniel_essay uuid;
  v_sub_naomi_mid uuid;
begin

  -- Naomi's essay submission
  if not exists (
    select 1 from public.academy_gradebook_submissions
    where tenant_id = 'cca-main'
      and assignment_id = v_assign_essay
      and learner_person_id = 'person-naomi-price'
  ) then
    insert into public.academy_gradebook_submissions (
      tenant_id, assignment_id, learner_person_id, submitted_at, content
    ) values (
      'cca-main', v_assign_essay, 'person-naomi-price',
      '2026-10-14 22:00:00+00',
      'Submitted via faculty portal.'
    ) returning id into v_sub_naomi_essay;

    insert into public.academy_gradebook_records (
      tenant_id, submission_id, assignment_id, learner_person_id,
      graded_by_person_id, points_earned, max_points, letter_grade,
      is_passing, instructor_feedback, sensitivity_tier
    ) values (
      'cca-main', v_sub_naomi_essay, v_assign_essay, 'person-naomi-price',
      'person-miriam-stone', 94.00, 100.00, 'A',
      true, 'Excellent exegetical work. Strong theological synthesis.',
      'standard'
    );
  end if;

  -- Daniel's essay submission
  if not exists (
    select 1 from public.academy_gradebook_submissions
    where tenant_id = 'cca-main'
      and assignment_id = v_assign_essay
      and learner_person_id = 'person-daniel-hart'
  ) then
    insert into public.academy_gradebook_submissions (
      tenant_id, assignment_id, learner_person_id, submitted_at, content
    ) values (
      'cca-main', v_assign_essay, 'person-daniel-hart',
      '2026-10-15 19:30:00+00',
      'Submitted via faculty portal.'
    ) returning id into v_sub_daniel_essay;

    insert into public.academy_gradebook_records (
      tenant_id, submission_id, assignment_id, learner_person_id,
      graded_by_person_id, points_earned, max_points, letter_grade,
      is_passing, instructor_feedback, sensitivity_tier
    ) values (
      'cca-main', v_sub_daniel_essay, v_assign_essay, 'person-daniel-hart',
      'person-miriam-stone', 61.00, 100.00, 'D',
      true, 'Needs stronger engagement with primary sources. See office hours.',
      'elevated'
    );
  end if;

  -- Naomi's midterm submission
  if not exists (
    select 1 from public.academy_gradebook_submissions
    where tenant_id = 'cca-main'
      and assignment_id = v_assign_mid
      and learner_person_id = 'person-naomi-price'
  ) then
    insert into public.academy_gradebook_submissions (
      tenant_id, assignment_id, learner_person_id, submitted_at, content
    ) values (
      'cca-main', v_assign_mid, 'person-naomi-price',
      '2026-10-22 13:55:00+00',
      'Completed in-class examination.'
    ) returning id into v_sub_naomi_mid;

    insert into public.academy_gradebook_records (
      tenant_id, submission_id, assignment_id, learner_person_id,
      graded_by_person_id, points_earned, max_points, letter_grade,
      is_passing, instructor_feedback, sensitivity_tier
    ) values (
      'cca-main', v_sub_naomi_mid, v_assign_mid, 'person-naomi-price',
      'person-miriam-stone', 91.00, 100.00, 'A-',
      true, 'Strong performance. Minor gap in chapter 4 analysis.',
      'standard'
    );
  end if;

end;
$$;
