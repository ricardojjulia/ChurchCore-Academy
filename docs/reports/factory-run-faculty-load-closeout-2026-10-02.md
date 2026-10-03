# Factory Run: Faculty-Load Accuracy And E2E Closeout

Date: 2026-10-02
Status: ready for protected PR delivery
Issue: `#216`

## Intent

Close the three faculty-load findings that remained after PR `#206`: misleading
partial aggregates and browser coverage that did not exercise the primary path.

## Boundaries

- No schema, role, route, navigation, LMS, deployment, or faculty-decision change.
- Preserve the read-only, period-scoped, primary-instructor workspace.
- Do not add contracts/FTE, compensation, rankings, or automatic reassignment.

## Implementation

- Made aggregate credits, clock hours, and capacity nullable completeness claims.
- Suppressed partial totals/denominators when any assigned section is incomplete.
- Added explicit incomplete-value rendering while retaining known enrollment counts.
- Expanded unit coverage for mixed completeness.
- Rebuilt the faculty-load journey around real API-created academic and enrollment
  dependencies with exact aggregate assertions.
- Corrected the historical PR `#206` run and Council records.

## Verification

- Focused module tests: passed, 6 tests.
- Focused ESLint and TypeScript: passed.
- Focused `npm run test:full -- --reset-db e2e/journeys/faculty-load.spec.ts`:
  passed, 2 tests against a fresh migration-built database and production build.
- `npm run verify`: passed, 2,072 tests plus lint and production build.
- Full `npm run test:full -- --reset-db`: initially 406 passed, 330 skipped,
  and 2 failed because the faculty fixture assigned the sweep's Lena sample to
  Felix, correctly expanding faculty access to Lena's formation record.
- Corrected the journey to use seeded student Naomi, who is outside the fixed
  formation sample, and removed the unnecessary program-membership mutation.
- Reset-database integration rerun covering the faculty journey and all API/page
  access sweeps: passed, 331 tests.
- Final exact `npm run test:full -- --reset-db` on the corrected tree: passed,
  408 tests with 330 probe-only combinations intentionally skipped.
- `npm run verify:governance`: passed.
- `git diff --check`: passed.
- Council Review 24: ship through protected delivery.
- Local `pr-review`: passed with 0 critical, 0 important, and 0 minor findings.
- Hosted checks and Copilot review: pending.

## Residual Risk

Institution-defined policy and staffing concepts outside the original ADR remain
out of scope. This closeout corrects evidence accuracy; it does not evaluate faculty.
