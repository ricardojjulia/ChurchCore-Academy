# Student Program Membership Slice

## Scope

Create the first student-facing Core Academic Loop join between a student profile, a canonical academic program, and the catalog academic year that governs that student's requirements.

## Decisions

- Use `academy_program_enrollments` as the canonical membership table.
- Store the selected catalog year on the membership row.
- Allow exactly one active program membership per student profile.
- Keep `academy_student_profiles.program_id` synchronized to the compatible legacy `academy_programs.id` so admissions, financial aid, reporting, and existing read models keep working while the normalized loop advances.
- Do not create section enrollments, progress calculations, transcript entries, or LMS roster sync in this slice.

## Execution

1. Add migration support for nullable manual source applications, catalog academic year linkage, and one active membership per student.
2. Add a student program membership service/repository with admin-only write authorization.
3. Add a request-scoped API route for assigning or changing the active membership.
4. Add the student detail Academic Record UI panel and assignment dialog.
5. Verify with focused tests, migration rehearsal, lint, build, and browser smoke.
