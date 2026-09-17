-- Fixes two RLS gaps found while wiring the first real caller for submitDraftFinalGrade()
-- (src/modules/grading-records/assignment-service.ts) — the function ADR-0054 §3 describes as
-- "the existing grade-posting flow" faculty use to post a section's official final grade. Until
-- now it had zero callers anywhere in the codebase and was never exercised against real RLS.
--
-- 1. academy_gradebook_course_summaries' write policy (installed in
--    20260616002351_gradebook_phase1.sql) only allowed institution_admin/dean/registrar/
--    academic_admin — not faculty/teacher/professor. submitDraftFinalGrade's own application-
--    layer check (isInstructor() || isAdmin()) explicitly allows faculty to call it, matching
--    ADR-0054's "faculty posts the final grade" design — but any faculty call would pass that
--    check and then fail at the database layer with an opaque RLS violation. Widened to match
--    the sibling academy_gradebook_records_staff_write policy's role set exactly (same table
--    family, same "faculty own writes, admins can act on anyone's" shape — see
--    20260616002351_gradebook_phase1.sql for that policy).
--
-- 2. academy_course_section_registrations had a SELECT policy and an INSERT policy, but no
--    UPDATE policy at all (confirmed via pg_policies, not just the visible migration history —
--    forced RLS with zero UPDATE policy denies every UPDATE unconditionally). This means the
--    already-shipped PATCH /api/academy/registrations/[id] status-change endpoint
--    (src/app/api/academy/registrations/[id]/route.ts) has never actually updated a row for any
--    real (non-service-role) user — and submitDraftFinalGrade's own new step marking a
--    registration "completed" after a final grade is submitted would hit the same wall. Adding
--    an UPDATE policy scoped to the same staff role set; per-instance section-ownership is
--    already enforced at the application layer (assertSectionOwnership) the same way the
--    gradebook tables layer ownership checks on top of a role-only RLS policy.

drop policy if exists "academy_gradebook_summaries_staff_write" on public.academy_gradebook_course_summaries;
create policy "academy_gradebook_summaries_staff_write" on public.academy_gradebook_course_summaries
  using (
    academy_private.academy_has_active_role(tenant_id, array[
      'institution_admin', 'dean', 'registrar', 'academic_admin', 'faculty', 'teacher', 'professor'
    ])
  )
  with check (
    tenant_id = any (academy_private.academy_current_tenant_ids())
  );

create policy "academy_section_registration_update" on public.academy_course_section_registrations
  for update
  using (
    academy_private.academy_has_active_role(tenant_id, array[
      'institution_admin', 'dean', 'registrar', 'academic_admin', 'faculty', 'teacher', 'professor'
    ])
  )
  with check (
    academy_private.academy_has_active_role(tenant_id, array[
      'institution_admin', 'dean', 'registrar', 'academic_admin', 'faculty', 'teacher', 'professor'
    ])
  );
