# Factory Run Record

Date: 2026-09-29
Branch: `fix/public-apply-trusted-institution`
Commit: uncommitted local work
Operator: Codex

## Intent

Problem or opportunity: Public application routes resolved tenant context from caller-controlled input (`?tenant=`) or defaults instead of a published institution route.
Product area: Admissions public application portal.
Primary users: Signed-out applicants, admissions staff, institution administrators.
Institution modes affected: All modes using public admissions.

## Scope

In scope: Resolve public application tenant context only from trusted published host or slug routes; fail closed for unknown or unpublished routes; preserve applicant token flows; update tests and verification evidence.
Out of scope: Hosted deployment, Vercel or Supabase project provisioning, LMS runtime behavior, authenticated admissions admin workflows beyond compatibility checks.
Files or modules expected to change: Public apply API routes, applicant status page fee call, Supabase migration, public apply tests, e2e compatibility assertion.

## Boundaries

Academy/LMS boundary: Academy-only admissions/public application work; no LMS runtime or provider code changed.
Tenant and role boundary: Signed-out public routes now derive tenant from `academy_public_institution_routes` published mappings, not untrusted query parameters.
Student/guardian/grade/transcript/billing/LMS/ShepherdAI/LLIS data risk: Applicant and admissions data risk; fee payment route kept token-scoped and tenant resolved before application lookup.
ADR needed: no, reason: targeted security fix using existing public admissions patterns plus a small routing table.

## Council And Planning

Council required: yes before merge, reason: auth/privacy, routing, migration, and multi-file public workflow change.
Council artifacts: `docs/reviews/2026-09-29-council-review-19-public-apply-trusted-institution-synthesis.md`.
Story/brief/plan artifacts: GitHub issue #162 drove the fix.
Human approvals: User requested continuation of the active local implementation.

## Implementation Summary

What changed: Added a shared public institution resolver, created the published host/slug route table, rewired all public apply endpoints to use it, preserved only trusted `institution`/`school` query keys through public browser and Stripe return flows, removed tenant propagation from the status page fee request, and tightened donor campaign e2e row targeting after the full suite exposed a strict-locator collision.
Patterns reused: Existing Supabase service client access, public route `NextResponse` error handling, node test style, and Playwright e2e conventions.
Docs updated: `CHANGELOG.md`, `docs/runbooks/admissions-operations.md`, Council Review 19 synthesis, and this factory run record.

## Verification

| Command or Check | Result | Notes |
| --- | --- | --- |
| `npm run verify:governance` | Passed | Governance wiring check, rerun after Council fixes. |
| `npm test` | Passed | 2050 tests, via `npm run verify` rerun before the final lint/build split. |
| `npm run lint` | Passed | Rerun after React search-param/Suspense fix. |
| `npm run build` | Passed | Rerun after agreement route test fixture fix. |
| `npm run test:full -- --reset-db --skip-build` | Passed | 403 passed, 329 skipped; reset applied `20260929090000_public_institution_routes.sql`; `/apply`, `/apply/status`, and all public apply API sweep entries passed. |
| Focused checks | Passed | `node --import tsx --test src/app/api/public/apply/__tests__/institution-resolver.test.ts src/app/api/public/apply/fee/__tests__/pay-route.test.ts src/app/api/public/apply/agreement/__tests__/status-route.test.ts src/app/api/public/apply/agreement/__tests__/sign-route.test.ts src/app/apply/__tests__/status-page-fee.test.ts` passed 36 tests. |
| Council follow-up focused checks | Passed | `node --import tsx --test src/app/api/public/apply/__tests__/institution-resolver.test.ts src/app/api/public/apply/fee/__tests__/pay-route.test.ts src/app/api/public/apply/agreement/__tests__/status-route.test.ts src/app/api/public/apply/agreement/__tests__/sign-route.test.ts src/app/apply/__tests__/status-page-fee.test.ts src/app/apply/__tests__/apply-page-institution-query.test.ts src/app/apply/status/__tests__/enrollment-agreement-ui.test.ts` passed 53 tests. |
| Browser/API/data verification | Passed | Full e2e public apply APIs, `/apply`, `/apply/status`, and admissions journey passed after database reset. |
| `git diff --check` | Passed | No whitespace errors. |

## Review

Documenter status: Run record, changelog, admissions runbook, and Council synthesis updated.
PR review status: passed locally on 2026-09-30; reviewed final diff for tenant resolution, slug propagation, migration constraints, tests, and documentation; 0 critical, 0 important findings.
Unresolved findings: none blocking local PR readiness.

## Delivery

PR: not opened.
Merge status: not merged.
Deployment needed: no local deployment performed; hosted deployment remains deferred by repository posture.
Deployment record: none.
Rollback target: revert the feature branch changes and drop the `academy_public_institution_routes` migration before merge if needed.

## Residual Risk And Follow-Up

Risks: Production host and slug mappings must be seeded or configured before public application traffic is moved beyond demo/local routes.
Follow-up issues: none created in this pass.
What remains unverified: PR checks, production mapping inventory, merge, deployment, and external/pilot validation.
