# Council Review IX — ADR-0038 Release Closeout

Date: 2026-06-21  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`  
Decision: **split**

## Council Decision

Council unanimously approves a split release decision:

- **Ship controlled pilot** for the core Academy SIS workflows under manual/provider-disabled operating mode.
- **Defer live provider activation** for payment checkout/settlement, email/SMS delivery workers, Moodle live HTTP clients, Canvas live HTTP clients, and regulated/federal aid until provider-specific activation evidence is complete.
- **Do not claim general availability** or production official-record readiness beyond approved controlled-pilot tenants.

## Updated Readiness Scores

| Area | Score | Notes |
| --- | ---: | --- |
| Controlled-pilot MVP readiness | 86/100 | Core SIS workflows, acceptance artifacts, migration rehearsal, and operations runbooks are in place. |
| Competitive readiness | 78/100 | Competitive workflows exist, but live provider activation and production observability still separate this from mature SIS parity. |
| Production/GA readiness | 62/100 | Not approved for broad production official-record use. |

## Completed ADR-0038 Work

| Prompt | Status | Evidence |
| --- | --- | --- |
| 1. Acceptance checklist and role matrix | Complete | `docs/acceptance/role-matrix-checklist.md`, `src/modules/acceptance/role-matrix.ts`, PR #52 |
| 2. Migration, seed, and live-tenant rehearsal | Complete | `docs/runbooks/migration-seed-rehearsal.md`, `scripts/verify-migration-seed-rehearsal.ts`, PR #53 |
| 3. Deployment operations runbook | Complete | `docs/runbooks/deployment-operations.md`, `docs/runbooks/incident-response.md`, `docs/runbooks/backup-restore.md`, PR #54 |
| 4. Provider activation checklists | Complete | `docs/runbooks/provider-activation.md`, PR #55 |
| 5. Final closeout and release package | Complete in this slice | This review and `docs/releases/2026-06-21-controlled-pilot-release-notes.md` |

## Verification Evidence

Recent verified gates across ADR-0038:

- `node --import tsx --test src/modules/acceptance/__tests__/role-matrix.test.ts`
- protected-route HTTP smoke for admin, faculty, student, guardian, platform, billing, aid, and platform APIs
- `npm run db:migrate:local`
- `npm run db:seed:local`
- `npm run verify:migration-seed-rehearsal`
- focused provider-safe tests for billing, communications, Moodle, Canvas, and no-LMS boundaries
- `npm test`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Council Role Opinions

| Council role | Vote | Rationale |
| --- | --- | --- |
| Product Manager | Split | Core workflows support a controlled pilot; provider activation should not block non-provider SIS validation. |
| Domain Architect | Split | Academy remains the SIS source of truth; provider boundaries are documented and gated. |
| Data Modeler | Split | Migrations, seed rehearsal, RLS, and tenant checks are sufficient for pilot rehearsal, not broad production. |
| Backend Builder | Split | Transactional workflows exist; live provider workers still need activation evidence. |
| Frontend/PWA Builder | Split | Navigable role surfaces exist; authenticated browser role walkthroughs should continue during pilot onboarding. |
| Security And Privacy Reviewer | Split | Verified-session/RLS foundation is strong; production observability and provider secrets remain controlled risks. |
| Release Validator | Split | Release package is complete for controlled pilot with explicit exclusions. |

## Open Risks

- Live payment checkout and settlement are not activated.
- Live email/SMS provider delivery workers are not activated.
- Moodle and Canvas live HTTP clients are not activated for tenant credentials.
- Regulated/federal aid remains an external compliance gate.
- Production observability instrumentation is documented but not fully automated.
- Authenticated browser role-matrix walkthroughs should be repeated for each pilot tenant.

## Release Conditions

Controlled pilot may proceed only when:

1. tenant scope is documented;
2. provider activation remains disabled unless separately approved;
3. `docs/runbooks/deployment-operations.md`, `docs/runbooks/incident-response.md`, and `docs/runbooks/backup-restore.md` have named owners;
4. pilot tenant database has passed migration/seed rehearsal;
5. role-matrix checklist is executed for pilot test accounts;
6. rollback target and deployment record are documented.

## Deferred AI Coding Prompts

### Prompt A — Authenticated Browser Role Walkthrough

Use the software factory to add an authenticated browser walkthrough harness for admin, registrar, faculty, student, guardian, finance, admissions, and platform admin. Use `docs/acceptance/role-matrix-checklist.md` as the source of truth. Produce a spec, plan, test harness or script, and evidence report. Verify with `npm test`, `npm run lint`, `npm run build`, and browser smoke.

### Prompt B — Production Observability Instrumentation

Use the software factory to implement production observability hooks for authentication failures, authorization failures, migration errors, provider worker failures, and workflow exceptions. Add a design spec, plan, runbook update, tests for structured log payloads without secrets, and deployment documentation.

### Prompt C — Provider Implementation Activation

Use the software factory to implement one live provider family at a time from `docs/runbooks/provider-activation.md`, starting with payment checkout or email delivery. Each provider must have sandbox evidence, secret handling, rollback, provider-safe payload tests, and final activation approval before production use.

## Final Statement

ChurchCore Academy is now a controlled-pilot candidate for core SIS workflows. It is not generally available and should not be marketed as a fully production-complete SIS until live provider activation, production observability, and pilot evidence close.

## Post-Closeout Addendum

Authenticated role walkthrough harness status: implemented after closeout as `docs/acceptance/authenticated-role-walkthrough-evidence.md`, `scripts/generate-authenticated-role-walkthrough.ts`, and `supabase/migrations/20260621193000_seed_acceptance_role_walkthrough_accounts.sql`.

External pilot evidence gate: run the generated browser commands against each pilot tenant, capture screenshots and console-error output, and attach observed pass/fail results to the tenant onboarding record before expanding beyond controlled pilot. No additional repository implementation task is open for the walkthrough harness.

Production observability foundation status: implemented after closeout as `src/modules/observability/operational-events.ts` and `docs/runbooks/observability.md`.

External observability gate: connect deployment-specific log drains, dashboards, and alert routing to the structured event boundary before expanding beyond controlled pilot. No additional repository implementation task is open for the observability foundation.
