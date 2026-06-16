# Admissions Transactional Workflow Completion Design

Date: 2026-06-16
Status: approved by council review

## Goal

Make the admissions-to-enrollment workflow visibly end-to-end for MVP staff users while preserving the existing transactional conversion service.

## Scope

This slice completes the staff-facing workflow after an application is accepted:

- accepted applications continue to use the existing conversion API;
- converted applications show the resulting student number;
- converted applications link to the protected student record created by conversion;
- the `/api/ai` route no longer opts into Edge runtime so the build warning disappears.

This slice does not create course-section registration, billing, payments, financial aid, LMS provisioning, or new database tables.

## Architecture

The conversion command remains in `EnrollmentConversionService` and `PostgresEnrollmentConversionRepository`. The staff page uses `loadAdmissionsPageState` and `buildAdmissionReviewModel` to project safe display data. The client action continues to post to the existing conversion route with an idempotency key and refresh the page.

The converted-result link is a presentation concern. The review model includes `studentProfileId` only when conversion metadata is complete; the component renders a link to `/students/:studentProfileId`.

The AI route uses the default Next.js runtime. No Edge-specific API is required for its current request/response behavior.

## Security

The UI projection must not expose admission events, audit metadata, idempotency keys, decision notes, or database details. Conversion authorization remains server-side and tenant-scoped. The student detail page remains protected by the existing app authentication and Academy data loaders.

## Data Flow

1. Staff opens `/admissions`.
2. Server resolves the Academy actor and loads same-tenant applications.
3. Review model marks accepted, unconverted applications as convertible for authorized roles.
4. Staff clicks `Convert to student`.
5. Client posts to `/api/academy/admissions/applications/:id/convert` with an idempotency key.
6. Existing server transaction creates the student role, student profile, program enrollment, period registration, conversion event, and audit event.
7. Page refresh shows `Converted`, the student number, and a protected student record link.

## Acceptance Criteria

- Build output no longer includes the Edge runtime static-generation warning.
- Existing `/api/ai` behavior remains covered.
- Converted admissions include a student record link.
- Non-converted applications do not receive a student profile link.
- Existing conversion API and repository behavior remain unchanged.
- Full verification passes.
