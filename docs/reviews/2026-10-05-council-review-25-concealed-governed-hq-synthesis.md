# Council Review 25 - Concealed And Governed Academy Project HQ

Date: 2026-10-05
Branch: `feature/concealed-governed-hq`
Scope: current diff. In scope: HQ route concealment and authorization, HQ table RLS, advisory-governance prompts and UI language, navigation, the E2E surface manifest and journeys, ADR amendments, changelog, and factory run record.
Decision requested: ship / revise / defer / split / reject

## Executive Verdict

Decision: **revise -> fixed locally -> ready for PR approval**
Release status: not committed, pushed, merged, deployed, or externally validated.

The final diff makes HQ stronger at every relevant boundary. Ordinary Academy navigation no longer advertises it. Both page routes authorize persisted platform roles before rendering and fail closed with a non-disclosing 404. The AI APIs keep independent platform authorization. A new migration replaces legacy `admin`/`manager`/`teacher` HQ policies with active persisted `platform_staff`/`platform_admin` checks and real RLS verification. The 13 specialists are now explicitly advisory and use Academy's canonical Council lenses and evidence-aware outcomes instead of synthetic ratification.

## Council Findings

### Product And SIS

Verdict: ready.

- The change strengthens an existing internal platform tool without displacing the active Academy customer backlog.
- Academy is now consistently described as the academic system of record. The prompt explicitly keeps LMS runtime outside this repository.
- No learner-facing AI, student-data AI, deployment, provider activation, or hosted resource was introduced.
- Owner approval remains explicit and cannot be replaced by an HQ recommendation.

### Architecture And Data

Verdict: revise -> fixed locally.

- The route boundary reuses `resolvePlatformRoles` and `canAccessPlatformStaffWorkspace`; no parallel role model was introduced.
- Advisory-governance policy lives in a pure `src/modules/hq/` module rather than remaining embedded in the page.
- Existing ADRs 0023 and 0078 were amended instead of creating a redundant architecture decision.
- **Finding discovered during review:** the original HQ tables still relied on legacy tenant/JWT role policies and lacked usable authenticated table grants. Page concealment alone would not have established the requested security boundary, while authorized users could not reliably use persisted HQ records.
- **Fixed:** migration `20261004120000_hq_platform_role_rls.sql` now uses security-definer helpers over active persisted platform-role assignments, forced RLS, explicit authenticated table privileges governed by those policies, owner-scoped sessions, platform-staff maintenance, and platform-admin-only deletes. The helper search path is pinned to `pg_catalog` and all referenced non-catalog objects are schema-qualified.
- Migration reset and direct Supabase-client RLS verification passed.

### UX And Accessibility

Verdict: ready.

- HQ is absent from ordinary navigation. Authorized operators use the known direct route; no inaccessible logo-click, hidden hotkey, multi-click, or secret-search interaction was added.
- Unauthorized authenticated users receive the same non-disclosing not-found behavior at `/hq` and `/internal/hq`.
- Visible wording now calls the agents advisory specialists and states that owner approval and repository gates remain authoritative.
- Existing HQ interactions, model-routing visibility, alerts, labels, and loading behavior remain intact.

### Security And Privacy

Verdict: revise -> fixed locally.

- Page hiding is expressly documented as concealment, not authorization.
- Server-rendered page authorization, AI API authorization, and table RLS are independent controls.
- Roles are resolved from the verified Supabase user and persisted platform assignments. Tenant-local registrar, teacher, manager-style, or institution roles do not grant HQ access.
- RLS dates and active status are enforced. Session history remains limited to its authenticated owner.
- An ordinary registrar receives 404 at both routes, 403 from the AI APIs, zero rows from a direct HQ table read, and SQLSTATE `42501` from a direct write.
- No new customer, student, guardian, grade, transcript, billing, ShepherdAI, or LLIS data path was added.

### Competitive Readiness

Verdict: ready.

- This is internal governance hardening, not a customer-facing competitive claim.
- Removing synthetic unanimous voting improves the credibility of Academy's delivery records.
- The work does not change the controlled-pilot posture or authorize deployment. The next external evidence gate remains unchanged.

### Testing Council

Verdict: revise -> fixed locally -> ready.

Coverage now proves:

- platform admin access to both HQ routes and existing model-evaluation/chat workflows;
- ordinary navigation has no HQ link;
- an authenticated registrar receives 404 before HQ renders at both routes;
- direct AI model-report, evaluation, and chat calls are rejected;
- direct HQ-table RLS admits an active platform admin and denies a tenant-local registrar read and write access;
- the migration contains forced RLS, persisted platform-role helpers, owner-scoped sessions, and authenticated grants governed by RLS;
- the advisory contract includes all six canonical lenses, the four permitted outcomes, evidence separation, and no synthetic voting;
- the complete page/API surface sweep passes.

The first complete E2E run found an unrelated strict-locator defect in the advising journey: `E2E Learner` correctly appeared in two page regions. Both advising assertions were scoped to the caseload table. A reset focused rerun passed 8/8 advising and HQ cases, and the subsequent complete suite passed 416 with 332 intentional probe skips.

## Verification

- Focused Node tests: passed, 10/10.
- Focused reset-database advising + HQ browser journeys: passed, 8/8.
- `npm run verify:governance`: passed.
- `npm run verify`: passed with 2,160 tests, lint, production build, and TypeScript.
- `npm run test:full -- --reset-db --skip-build`: passed with 416 passed and 332 intentionally skipped.
- Fresh migration application through `20261004120000_hq_platform_role_rls.sql`: passed.
- `git diff --check`: passed before Council closeout; rerun required on the final documentation diff.
- Hosted CI: unverified because no PR has been opened.

## Residual Risk

- Concealment reduces ordinary discovery but cannot prevent someone from guessing the route. Security continues to depend on the verified server, API, and RLS controls that were tested here.
- The E2E persona named `institutionAdmin` also holds the persisted `platform_admin` assignment. The manifest uses that persona because the E2E registry does not have a separate platform-only persona; the denied registrar case proves tenant roles alone are insufficient.
- Production migration execution, protected-branch CI, PR review services, and deployment remain unverified until their separately authorized stages.

## Decision

Council decision is **revise -> fixed locally -> ready for PR approval**. No Council voice reports a remaining Critical or Important finding. This decision does not authorize deployment, hosted resources, customer-facing AI, student-data AI, or a merge without the separate `pr-review` and owner PR approval.
