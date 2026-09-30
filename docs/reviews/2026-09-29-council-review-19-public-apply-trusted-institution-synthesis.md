# Council Review 19 - Public Apply Trusted Institution Resolution

Date: 2026-09-29
Branch: `fix/public-apply-trusted-institution`
Scope: Current diff only — public application tenant resolution, browser public apply/status flows, migration, tests, and delivery documentation.
Decision requested: ship / revise / defer / split / reject

## Executive Verdict

Decision: **revise -> fixed locally**
Release status: not merged, not deployed, not externally validated.
Confidence: high for local host and slug behavior after follow-up fixes; production readiness still depends on configured public mappings and PR/CI review.

The core security change is sound: public application routes no longer accept `?tenant=` or default-tenant fallbacks. Tenant context is resolved from published host or slug mappings before applicant token lookup, fee checkout, document handling, or agreement signing.

The first Council pass found one real blocker across all review voices: slug mappings existed in the resolver and migration but were not preserved by the browser pages or Stripe return URLs. That would have broken shared-host `/apply?institution=...` portals. The implementation was revised to preserve only trusted public route keys (`institution` and `school`) through apply, status, fee, agreement, document upload, and Stripe return flows while still excluding `tenant`.

## Evidence Reviewed

- `src/app/api/public/apply/institution-resolver.ts`
- all public apply API routes under `src/app/api/public/apply`
- `src/app/apply/page.tsx`
- `src/app/apply/status/page.tsx`
- `supabase/migrations/20260929090000_public_institution_routes.sql`
- public apply, fee, agreement, status-page, and admissions e2e tests
- `CHANGELOG.md`
- `docs/reports/factory-run-public-apply-trusted-institution-2026-09-29.md`
- `docs/runbooks/admissions-operations.md`

## Council Role Findings

### SIS, Data, API, And Security

Found that the API/data path correctly moved tenant resolution before public applicant data access, but flagged two risks: browser slug propagation was missing, and `x-forwarded-host` was trusted before the request host. Both were fixed. The resolver now prefers the request host/URL host before `x-forwarded-host`, and browser flows preserve trusted slug keys.

### Routes, Pages, And API Completeness

Found every public apply route had been rewired to the shared resolver, but the actual `/apply` and `/apply/status` pages dropped slug context on their fetches. Fixed across programs, submit, status, documents, fee, agreement, upload URL, confirm, sign, status link, and new-application link.

### UX, Accessibility, And Error States

Found host-based portals remained usable, but shared-host slug portals would fail with generic application-not-found states. Fixed by preserving trusted slug context end to end. Generic 404 copy remains fail-closed; it is acceptable for this security fix, with no detailed tenant existence disclosure.

### Product, Competitive, And Operations

Found the run record was honest about not being deployed or externally validated, but mapping activation was under-specified. Fixed by adding public route activation guidance to `docs/runbooks/admissions-operations.md`.

### Testing Council

Found host-based e2e and resolver tests were strong, but slug browser behavior and route-level institution-miss behavior were under-tested. Fixed with focused tests for public page slug forwarding, fee return URLs, and injected institution-miss fail-closed behavior in fee and agreement routes. Full route static coverage still relies on the e2e sweep plus shared resolver tests; no new manifest entry was required because the public apply surfaces already exist.

## Fixed Findings

1. **Slug browser flow dropped trusted institution context.** Fixed by forwarding only `institution` and `school` through public browser fetches and status links.
2. **Stripe return URLs dropped slug context.** Fixed by building success/cancel URLs with the trusted public institution query plus token and payment result.
3. **`x-forwarded-host` had higher precedence than the real host.** Fixed by preferring `host` and URL host first.
4. **Published route values could be inserted in an unmatchable shape.** Fixed with a database check constraint requiring normalized lowercase/no-port host or slug values.
5. **Mapping rollout was operationally implicit.** Fixed by adding admissions runbook steps for public route activation and disablement.
6. **Institution-miss route coverage was thin.** Improved with dependency-injected fail-closed tests for fee and agreement endpoints plus page/static coverage for slug propagation.

## Verification

Final local evidence after Council fixes:

- `node --import tsx --test src/app/api/public/apply/__tests__/institution-resolver.test.ts src/app/api/public/apply/fee/__tests__/pay-route.test.ts src/app/api/public/apply/agreement/__tests__/status-route.test.ts src/app/api/public/apply/agreement/__tests__/sign-route.test.ts src/app/apply/__tests__/status-page-fee.test.ts src/app/apply/__tests__/apply-page-institution-query.test.ts src/app/apply/status/__tests__/enrollment-agreement-ui.test.ts` — passed, 53 tests.
- `npm run verify:governance` — passed after Council fixes.
- `git diff --check` — passed after Council fixes.
- `npm test` — passed, 2050 tests, via `npm run verify` rerun before final lint/build split.
- `npm run lint` — passed after React search-param/Suspense fix.
- `npm run build` — passed after agreement route test fixture fix.
- `npm run test:full -- --reset-db --skip-build` — passed, 403 passed and 329 skipped; reset applied `20260929090000_public_institution_routes.sql`; `/apply`, `/apply/status`, and all public apply API sweep entries passed.
- Local `pr-review` — passed with 0 critical and 0 important findings.

## Required Before Merge

- Open a PR and wait for required checks before merge.
- Confirm production or pilot host/slug mappings before any public traffic cutover.

## Residual Risk

Production/pilot public route activation still requires real host or slug mappings. This diff provides the table, resolver, local/demo seeds, and runbook; it does not create hosted mappings, provision DNS, deploy, or externally validate a pilot institution.

## Decision

Council decision is **revise -> fixed locally**. The branch can proceed to final local gates and `pr-review`; it is not merge-ready until those pass and the PR review gate is recorded.
