# Council Review 22 - Faculty Teaching-Load Intelligence

Date: 2026-10-01
Branch: `feat/faculty-load-intelligence`
Scope: Faculty-load read model, admin workspace, role-gated navigation, browser coverage, ADR, and delivery documentation.
Decision requested: ship / revise / defer / split / reject

## Executive Verdict

Decision: **revise -> fixed locally**
Release status: not merged, deployed, or externally validated.

The slice converts existing normalized staffing and section records into a period-scoped administrative comparison surface. It deliberately avoids faculty scoring and leaves assignments in the existing section-management workflow.

## Council Findings

### Product And SIS

The workspace answers the first operational question academic leaders need: who is assigned to what in the selected period, with how many instructional credits/hours, seats, and advisees. Faculty with zero sections remain visible. Primary-instructor scope is explicit.

### Architecture And Data

One tenant-and-period-bound query reads active staff, active faculty-capable roles, normalized sections/courses, registration counts, and advisee counts. Aggregation occurs in the people-domain read model without creating a second write path or schema.

The existing ShepherdAI faculty-alert panels remain available to actors with ShepherdAI read access. The normalized workspace is additive and does not remove the established alert/workflow surface.

### PR Review Follow-Up

Copilot identified two important gaps: denied roles still saw the Faculty dashboard quick action, and active role status was evaluated without effective start/end dates. The dashboard and sidebar now share the oversight-role boundary, and the faculty eligibility query applies the same role date rules as Academy identity resolution. Focused regression coverage protects both fixes.

### Security And Privacy

Access is restricted to institution administrators, deans, and academic administrators before repository access. Query parameters bind both tenant and selected period. The page exposes staffing aggregates and section identifiers, not grades, notes, student identities, compensation, or private evaluation records.

### UX And Accessibility

The page uses semantic headings and table structure, stable metric blocks, explicit empty states, plain-language evidence labels, and a direct handoff to section assignment management. Navigation visibility matches destination authorization.

Diff review found that partial capacity configuration could produce a misleading utilization percentage and that missing credits or clock hours were silently represented as zero. The module now suppresses utilization unless every assigned section has capacity and adds explicit review flags for missing instructional configuration.

### Testing Council

Focused coverage proves aggregation, tenant/period parameters, zero-section handling, incomplete-configuration handling, no-context behavior, denied-role behavior, and navigation gating. E2E proves the production page, an authorized persona, a known faculty record, explanatory boundary copy, the assignment-management handoff, and that another tenant's administrator cannot see primary-tenant faculty. The first full run exposed that the surface manifest omitted the authorized other-tenant administrator; the manifest and negative journey were corrected before the final passing run.

## Verification

- Focused module and navigation tests - passed, 6 tests.
- TypeScript `--noEmit` and focused ESLint - passed.
- `npm run verify` - passed, 2,071 tests, lint, and build.
- `npm run test:full -- --reset-db` - passed, 408 passed and 330 skipped in 7.6 minutes on the final code.
- `npm run verify:governance` and `git diff --check` - passed.
- Local `pr-review` - passed with 0 critical and 0 important findings after the review fixes.

## Residual Risk

- Missing institution configuration can limit the comparability of credits, clock hours, capacity, and load policy.
- Assistant-instructor load, schedule collision detection, contracts/FTE, and compensation remain separate evidence-backed slices.

## Decision

Council decision is **revise -> fixed locally**. Proceed through protected PR delivery; no deployment or automated faculty decision is authorized.

## 2026-10-02 Correction

The final PR `#206` review identified that partial credit/hour and capacity totals
still appeared complete and that E2E did not exercise real aggregates. Those
findings were not fixed before merge. Issue `#216` and Council Review 24 supersede
the affected verification claim while preserving this review as historical evidence.
