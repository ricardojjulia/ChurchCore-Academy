# Factory Run: Concealed And Governed Academy Project HQ

Date: 2026-10-04
Branch: `feature/concealed-governed-hq`
Commit: pending
Operator: Codex with owner approvals

## Intent

Problem or opportunity: HQ was visible from ordinary navigation and its page rendered for any signed-in user even though the AI APIs were platform-staff-only. Its prompts also described synthetic agent consensus without clearly subordinating recommendations to Academy's canonical governance and verification gates.
Product area: Internal platform governance and AI operations.
Primary users: ChurchCore `platform_staff` and `platform_admin`.
Institution modes affected: None; HQ is above tenant-local institution workflows.

## Scope

In scope: conceal HQ from ordinary navigation; enforce platform-role access before either HQ route renders; preserve independent API authorization; replace legacy HQ table policies with persisted platform-role RLS; strengthen the advisory prompt and visible operating model; update focused unit/E2E coverage and governance documentation.
Out of scope: new providers or models, learner-facing AI, student-data AI, schema changes, deployment, hosted resources, LMS runtime, easter-egg discovery mechanisms.
Files or modules expected to change: HQ routes/UI, platform navigation, `src/modules/hq/`, AI routing E2E journey and surface manifest, ADRs, development guide, changelog, Council record.

## Boundaries

Academy/LMS boundary: Academy remains the academic system of record; the governance context explicitly keeps LMS runtime outside this repository.
Tenant and role boundary: only `platform_staff` and `platform_admin` may render HQ; all other authenticated roles fail closed with not-found; unauthenticated requests remain handled by the global login proxy.
Student/guardian/grade/transcript/billing/LMS/ShepherdAI/LLIS data risk: no new data path. Existing HQ and AI APIs retain RLS/data-path enforcement and zero-retention routing. Future student-data AI remains separately gated.
ADR needed: existing ADRs 0023 and 0078 amended because this strengthens their accepted platform-control, RLS, and AI-access decisions without introducing a new architecture.

## Council And Planning

Council required: yes; auth, routing, internal AI governance, and user-visible HQ behavior changed.
Council artifacts: `docs/reviews/2026-10-05-council-review-25-concealed-governed-hq-synthesis.md`.
Story/brief/plan artifacts: approved in the 2026-10-04 owner session before implementation.
Human approvals: story approved; technical brief approved; PR approval pending after validation.

## Implementation Summary

What changed: removed ordinary HQ navigation; added fail-closed server authorization to both HQ routes; centralized an advisory-only Academy governance contract; corrected stale LMS language; replaced legacy HQ table policies with active persisted platform-role RLS; added route, prompt, migration, browser, API, and direct-RLS coverage; stabilized an unrelated advising assertion exposed by the complete suite.
Patterns reused: `resolvePlatformRoles`, `canAccessPlatformStaffWorkspace`, server `notFound()`, persisted platform-role assignments, forced RLS, existing protected AI APIs, existing AI-model-routing browser journey.
Docs updated: development guide, ADRs 0023 and 0078, changelog, this run record; Council synthesis pending.

## Verification

| Command or Check | Result | Notes |
| --- | --- | --- |
| `npm run verify:governance` | passed | Governance documentation wiring |
| `npm test` | passed | 2,160 tests |
| `npm run lint` | passed | 0 warnings |
| `npm run build` | passed | Next.js production build and TypeScript |
| `npm run test:full -- --reset-db --skip-build` | passed | 416 passed, 332 intentional probe skips; build was already passed separately |
| Focused checks | passed | 10 policy, migration, and working-surface tests |
| Browser/API/data verification | passed | 8 reset-database HQ and advising cases; HQ route/API/RLS journey 6/6; complete surface sweep passed |

## Review

Documenter status: complete; development guide, ADRs 0023/0078, changelog, Council synthesis, and this record updated.
PR review status: passed on final diff; 0 Critical, 0 Important, 0 Minor findings.
Unresolved findings: none.

## Delivery

PR: pending owner approval.
Merge status: not opened or merged.
Deployment needed: no.
Deployment record: not applicable.
Rollback target: revert the route layouts, navigation change, governance module, tests, and documentation as one scoped change.

## Residual Risk And Follow-Up

Risks: route authorization depends on the existing persisted platform-role resolver; failures intentionally deny access. Concealment reduces discovery but is not relied on for security. Hosted migration and CI remain unverified until a PR is authorized.
Follow-up issues: none identified yet.
What remains unverified: hosted CI, PR, merge, and deployment (not needed or authorized).
