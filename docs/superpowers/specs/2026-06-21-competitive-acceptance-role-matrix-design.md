# Competitive Acceptance Role Matrix Design

Date: 2026-06-21  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`  
Factory: `docs/software-factory.md`

## Factory Intake

ADR-0038 requires role-matrix acceptance evidence before ChurchCore Academy can be treated as a controlled-pilot release candidate. This slice covers admin, registrar, faculty, student, guardian, finance, admissions, and platform admin.

## Problem

The application has broad SIS workflow coverage, but acceptance evidence was not yet normalized around user roles. Without a durable role matrix, the project can regress into screen-by-screen checks and miss cross-role denial, tenant scope, or provider-boundary expectations.

## Decision

Create a repository-owned acceptance checklist plus an executable TypeScript inventory under `src/modules/acceptance/role-matrix.ts`.

The matrix must capture:

- required role profiles;
- page and API route families;
- unauthenticated redirect or API rejection expectation;
- allowed roles;
- denied roles;
- data-boundary language;
- evidence command for manual or automated smoke.

## Role Model

The acceptance roles map to existing Academy and platform roles:

| Acceptance role | Runtime role mapping | Notes |
| --- | --- | --- |
| Admin | `institution_admin` | Tenant administration, reporting, settings, records. |
| Registrar | `registrar` | Registration, enrollment records, transcripts. |
| Faculty | `faculty` | Attendance and grade-entry surfaces. |
| Student | `student` | Student PWA and self-service records. |
| Guardian | `guardian` | Relationship-scoped guardian portal. |
| Finance | `finance` | Student accounts and institutional aid. |
| Admissions | `admissions` | Application review and decisions. |
| Platform admin | `platform_admin` | Cross-tenant platform control only. |

`finance` is added as an Academy role because ADR-0038 names finance as a separate acceptance actor and billing/aid are distinct competitive SIS workflows.

## Acceptance Surface Boundary

This slice does not claim full browser completion. It establishes the role inventory, route/API smoke targets, and policy-backed finance access. Full browser walkthroughs and live-tenant evidence remain in later ADR-0038 slices.

## Risks

- Some pages still rely on shared admin shells and service-level checks instead of a central route policy. The matrix makes this visible but does not replace all page-level authorization in this slice.
- Platform admins intentionally do not receive tenant data access unless they also have a tenant role assignment.
- HTTP smoke without authenticated test sessions can only prove protected-route redirection and API rejection, not role-specific positive access.

## Verification

- `node --import tsx --test src/modules/acceptance/__tests__/role-matrix.test.ts`
- finance access assertions in billing and financial-aid service tests
- `npm test`
- `npm run lint`
- `npm run build`
- protected-route HTTP smoke on the documented checklist targets
