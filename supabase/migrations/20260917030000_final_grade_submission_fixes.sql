-- Two more fixes to the submitDraftFinalGrade path, found in PR review before merge (not caught
-- by the passing test suite, since these are real-schema/real-RLS issues that mocked unit tests
-- can't see).
--
-- 1. academy_gradebook_course_summaries had unique (tenant_id, enrollment_id) only. enrollment_id
--    is the STUDENT'S PROGRAM ENROLLMENT (academy_program_enrollments), which is program-scoped,
--    not course-scoped -- a student can have multiple course_section registrations under the
--    same program enrollment (confirmed in local data: 2 real program enrollments each span 2
--    course sections). submitDraftFinalGrade's insert ... on conflict (tenant_id, enrollment_id)
--    do update meant submitting a final grade for a SECOND course under the same program
--    enrollment silently overwrote the summary row already holding the FIRST course's grade --
--    both course_id and final_letter_grade would end up reflecting only the most recent
--    submission. The transcript-entries candidate query already assumes course-level scoping
--    (it joins summary on both enrollment_id AND course_id -- see
--    src/modules/transcript-entries/postgres-repository.ts's CANDIDATE_SELECT), so this widens
--    the constraint to match what the read side already expected.
--
-- 2. academy_section_registration_read (SELECT, installed in
--    20260614040000_course_section_registration_confirmation.sql) allowed only the student
--    themselves and institution_admin/dean/registrar/academic_admin/admissions -- not
--    faculty/teacher/professor. getSectionFinalGradeStatus's read model, and
--    submitDraftFinalGrade's own registration lookup, both query
--    academy_course_section_registrations as the faculty actor; under forced RLS a
--    non-admin-tier faculty member's query silently returns zero rows (not an error -- RLS
--    filters rows, it doesn't reject the query), so the whole feature would appear to work for an
--    admin-tier demo account and silently return an empty roster for a real, faculty-only
--    account. Widened to match the UPDATE policy's role set added in the previous migration.

alter table public.academy_gradebook_course_summaries
  drop constraint if exists academy_gradebook_course_summaries_tenant_id_enrollment_id_key;

alter table public.academy_gradebook_course_summaries
  add constraint academy_gradebook_course_summaries_tenant_id_enrollment_course_key
  unique (tenant_id, enrollment_id, course_id);

drop policy if exists "academy_section_registration_read" on public.academy_course_section_registrations;
create policy "academy_section_registration_read" on public.academy_course_section_registrations
  for select
  using (
    tenant_id = any (academy_private.academy_current_tenant_ids())
    and (
      academy_private.academy_can_read_student(tenant_id, student_person_id)
      or academy_private.academy_has_active_role(tenant_id, array[
        'institution_admin', 'dean', 'registrar', 'academic_admin', 'admissions',
        'faculty', 'teacher', 'professor'
      ])
    )
  );
