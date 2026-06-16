# Council Review: Working MVP Surface Pass

Date: 2026-06-16

## Feature

Make the staff/admin MVP surfaces feel usable instead of placeholder-like by adding real index views, dashboard navigation, and smoke coverage for Admissions, Students, Programs, Faculty/Admin, and Workflows.

## Executive Summary

The council recommends proceeding with a narrow implementation slice. The previous slice made authentication, demo personas, gradebook, and Student PWA surfaces demonstrable. The next product risk is that staff users land on redirects or sparse screens instead of obvious operational workspaces. The slice should not expand domain workflows; it should make existing seeded/persistent data easier to navigate and verify.

## Recommendation

Decision: **Positive, proceed with conditions**.

Conditions:

- Preserve existing authentication and tenant-scoped dataset loading.
- Do not introduce new business workflows, migrations, or autonomous AI behavior.
- Use existing Academy data and ShepherdAI evaluation outputs.
- Add tests that fail if `/students` and `/programs` regress to redirect-only pages.
- Update docs/status so the MVP surface pass is visible in the software factory record.

## Architecture Impact

This is an application-surface slice. It should add lightweight page models or inline server component mapping only where the page is currently redirect-only. Existing detail pages and `AcademyShell` remain the primary layout pattern.

## Data Model Impact

No schema change is approved. Use:

- `loadProtectedAcademyDataset` for tenant-scoped runtime data.
- `runAcademicWorkflowEvaluationJob` for workflow counts and suggestions.
- Existing admissions repository/page state for admissions.

## Security/RLS Risks

Risk is moderate because student and admissions records are sensitive. Mitigations:

- Use existing protected dataset and admissions page-state loaders.
- Do not import mock data into app routes.
- Keep AI suggestions staff-facing and human-reviewed.
- Do not expose provider secrets, raw auth subjects, or cross-tenant records.

## QA Acceptance Criteria

- `/students` renders a student index with seeded student names and links instead of redirecting.
- `/programs` renders a program index with seeded program names and links instead of redirecting.
- Root dashboard includes direct links/cards for Admissions, Students, Programs, Faculty/Admin, Workflows, Admin Gradebook, Faculty Gradebook, and Student PWA.
- Placeholder copy for the targeted staff/admin screens is not introduced.
- `npm run lint`, `npm test`, and `npm run build` pass.

## UX Concerns

The MVP should favor clear navigation and useful counts over new visual complexity. Index pages should show enough information to make the product feel alive: status badges, counts, and next-action links. Avoid over-designing a CRM or transcript module in this slice.

## Implementation Phases

1. Add tests that assert Students and Programs indexes render meaningful records rather than calling `redirect`.
2. Replace `/students` and `/programs` redirect-only routes with real index pages.
3. Add root dashboard quick-action cards to the most important working screens.
4. Update status/runbook docs.
5. Verify with lint, tests, build, and a local route smoke check if the dev server is available.

## Decision Record Draft

Status: Accepted for implementation.

ChurchCore Academy will treat working navigation and index surfaces as MVP readiness work. The implementation will improve visibility of existing persisted and seeded workflows without expanding the data model or bypassing tenant-aware auth. Future slices may add deeper transactions, but this slice is only the staff/admin usability pass.

## AI Implementation Prompt

Follow this prompt exactly:

> Implement the Working MVP Surface Pass in `/Users/rjulia/ChurchCore Academy`.
>
> Scope:
> - Replace `/students` and `/programs` redirect-only pages with authenticated index pages using `loadProtectedAcademyDataset`.
> - Add actionable dashboard navigation cards on `/` for Admissions, Students, Programs, Faculty/Admin, Workflows, Admin Gradebook, Faculty Gradebook, and Student PWA.
> - Keep all data tenant-scoped through existing protected loaders. Do not import mock data into app routes.
> - Do not add migrations or new business workflows.
> - Add tests that fail if `/students` or `/programs` use `redirect()` instead of rendering records.
> - Update docs/status to reflect the working surface pass.
>
> Verification:
> - `npm run lint`
> - `npm test`
> - `npm run build`
> - Note the existing Edge runtime static-generation warning if it appears, but do not treat it as a failure when build exits successfully.
