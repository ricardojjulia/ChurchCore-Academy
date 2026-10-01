# Council Review 21 - Advisor Caseload Intelligence

Date: 2026-09-30
Branch: `feat/advising-workflow`
Scope: Current diff only - advising read model, workspace page, navigation, E2E data and journeys, ADR, and delivery documentation.
Decision requested: ship / revise / defer / split / reject

## Executive Verdict

Decision: **revise -> fixed locally**
Release status: not merged, deployed, or externally validated.
Confidence: high for local assignment and tenant boundaries after full database/browser verification.

The slice creates an explainable advising queue from existing Academy records without granting advisors institution-wide student access or adding an autonomous recommendation system. Advisors are bound to their verified person ID; oversight roles may select only active, advisor-capable people in the same tenant.

## Evidence Reviewed

- `src/modules/people/advising.ts` and focused authorization tests
- `/admin/advising` and shared navigation capability wiring
- existing advisor-note, hold, risk, signal, and student-record boundaries
- E2E persona seeding, surface manifest, and advising journey
- ADR-0076 and factory run record

## Council Findings

### SIS, Privacy, And Authorization

The module authorizes before caseload access and binds every query to the verified actor tenant. A pure advisor cannot select another advisor; an oversight selection must resolve from active same-tenant advisor-capable assignments. The summary excludes note text, hold text, financial details, guardian data, and signal payloads.

### Product And Workflow

The page prioritizes current risk, holds, and open signals while preserving human interpretation. Advisors move into their existing assignment-scoped signal workflow; oversight staff may open the existing protected student record. Empty and no-selection states are explicit.

### Architecture And Data

The workspace composes existing system-of-record tables and adds no schema. Latest risk is selected deterministically, counts use tenant-correlated lateral queries, and absent risk is represented as no current evidence rather than low risk. ADR-0062 remains proposed and is not implicitly accepted.

### UX And Accessibility

Labels, semantic table headings, screen-reader action heading, native advisor select, and stable metric layouts are present. The first pass exposed the Advising nav link to roles rejected by the destination page. Fixed by adding `canReadAdvising` to the existing role-derived navigation capability context with regression coverage.

### Testing Council

Focused tests prove self-scope, cross-advisor rejection, same-tenant oversight selection, unknown/cross-tenant rejection, unrelated-role rejection, and navigation gating. E2E proves a seeded advisor sees the assigned learner without an advisor selector and a registrar can select that advisor and open the student record.

## Verification

- Focused advising and navigation suite - passed, 6 tests.
- TypeScript `--noEmit` and focused ESLint - passed.
- `npm run verify` on the final code - passed, 2,064 tests, lint, and build.
- `npm run test:full -- --reset-db` - passed, 406 passed and 330 skipped in 7.8 minutes; advising journeys and page sweep passed.
- `npm run verify:governance` and `git diff --check` must pass before PR delivery.
- Local `pr-review` - passed with 0 critical and 0 important findings after the navigation fix.

## Residual Risk

- Summary freshness depends on existing risk and signal evaluation jobs.
- Current assignment is shown without assignment history.
- Appointment scheduling, advisor messaging, bulk reassignment, and faculty teaching-load intelligence remain separate slices.

## Decision

Council decision is **revise -> fixed locally**. Proceed through final verification and PR delivery; no deployment or autonomous advising behavior is authorized.
