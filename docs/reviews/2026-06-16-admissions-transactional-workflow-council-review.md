# Council Review: Admissions Transactional Workflow Completion

Date: 2026-06-16
Status: positive decision
Slice: admissions application processing into student/program enrollment

## Feature Intake

Complete one core MVP workflow end-to-end: admissions staff should be able to review an accepted application, execute the existing transactional conversion command, and see the created student/enrollment result without leaving the protected Academy workflow.

This review also includes the build-warning remediation for the existing Edge runtime static-generation warning.

## Executive Summary

The repo already contains the high-risk parts of the workflow: admissions application persistence, decision records, conversion service, tenant-scoped transaction wrapper, enrollment conversion tables, RLS migration, idempotency handling, and API tests.

The remaining MVP gap is operational visibility. The staff surface should show the converted student record as a concrete outcome and link to the student profile that was created by the transaction. The Edge warning is caused by the `/api/ai` route explicitly opting into Edge runtime; the current MVP does not require that route to be Edge-only.

## Recommendation

Proceed with a narrow implementation slice:

- remove the explicit Edge runtime from `/api/ai`;
- add a regression test proving the route no longer exports `runtime = "edge"`;
- expose `studentProfileId` in the admissions review item after conversion;
- render converted admissions with a link to `/students/:studentProfileId`;
- keep conversion mutation behavior on the existing `POST /api/academy/admissions/applications/:id/convert` API;
- update status docs and keep the existing database transaction/RLS design unchanged.

## Architecture Impact

No new architecture is required. The slice uses:

- Next.js App Router page and client action components;
- existing `loadAdmissionsPageState`;
- existing `EnrollmentConversionService`;
- existing `withAcademyDatabaseContext` transaction boundary;
- existing enrollment conversion schema and policies.

The AI proxy route should use the default Node runtime to avoid the build warning.

## Data Model Impact

No migration is needed. The existing conversion metadata fields on `academy_admission_applications` already include:

- `student_profile_id`;
- `program_enrollment_id`;
- `period_registration_id`;
- `converted_at`;
- `converted_by_person_id`.

The UI projection should include only safe conversion outcome fields.

## Security And RLS Risks

Risk is moderate because admissions and student records are sensitive. Mitigations:

- keep actor resolution on verified Academy session context;
- keep conversion authorization in `EnrollmentConversionService`;
- do not trust caller-provided tenant, person, status, student number, or conversion metadata;
- do not expose audit internals, idempotency keys, events, or database errors in the UI model;
- link only to the same protected student detail route.

## QA Acceptance Criteria

- `npm run build` no longer emits `Using edge runtime on a page currently disables static generation for that page`.
- `/api/ai` still returns the neutral unavailable response when no Anthropic key is configured.
- Admissions review model includes `studentProfileId` only for converted applications.
- Converted applications render a `View student record` link to `/students/:studentProfileId`.
- Unconverted accepted applications still render the existing conversion action.
- Full lint, test, build, and whitespace verification pass.

## UX Concerns

The workflow should communicate completion plainly. Staff should see:

- `Converted`;
- the assigned student number;
- a direct student record link.

The page should not imply billing, course-section registration, LMS provisioning, or financial aid has happened.

## Implementation Phases

1. Add regression tests for the Edge runtime warning and converted admissions link.
2. Remove the Edge runtime opt-in from `/api/ai`.
3. Add `studentProfileId` to the admissions review projection.
4. Render the student record link for converted applications.
5. Update docs and verify.

## Decision Record Draft

Accepted. Complete the admissions-to-enrollment MVP workflow by improving operational visibility around the already-transactional conversion path. Do not add a second conversion service, a new migration, or automatic conversion on acceptance.

## AI Implementation Prompt

> In `/Users/rjulia/ChurchCore Academy`, implement the admissions transactional workflow completion slice.
>
> Requirements:
> - Remove the explicit Edge runtime from `src/app/api/ai/route.ts` so `npm run build` no longer prints the Edge runtime static-generation warning.
> - Add a regression test that fails if `/api/ai` exports `runtime = "edge"`.
> - Preserve existing `/api/ai` unavailable and upstream error behavior.
> - Update the admissions review model so converted applications include the safe `studentProfileId` projection alongside `studentNumber`.
> - Update the admissions application list so converted applications show `Converted`, the student number, and a `View student record` link to `/students/{studentProfileId}`.
> - Do not expose audit events, idempotency keys, decision notes, or persistence internals.
> - Do not add migrations or duplicate the existing conversion service.
> - Use TDD: write failing tests first, implement the smallest change, then run lint, tests, build, and `git diff --check`.
