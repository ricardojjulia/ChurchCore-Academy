# Factory Run: Uncoached Pilot Session Readiness

Date: 2026-10-05
Branch: `feature/pilot-session-readiness`
Commit: `2df6138980dac77847d0ab040590deb6bd788f30`
Operator: Codex with owner approval

## Intent

Problem or opportunity: Academy's repository-owned MVP and approved first-customer slices have shipped, but the next evidence gate requires an uncoached authenticated pilot session. The existing role walkthrough proves route access; it does not define neutral participant tasks, observer conduct, stop criteria, or evidence-to-story conversion.

Product area: Controlled-pilot acceptance and product evidence.

Primary users: Pilot/design-partner participants, observers, and local environment operators.

## Scope And Boundaries

In scope: reconcile merged faculty-load and HQ status; define a local-only uncoached session protocol; reuse the existing authenticated role walkthrough; add a fail-closed local/private connectivity preflight; specify privacy-safe evidence, severity, and stop rules.

Out of scope: hosted deployment, cloud resources, live providers, product behavior, schema, migrations, authentication changes, production records, new backlog features, or automated participant scoring.

Academy/LMS boundary: no LMS runtime or provider activation work.

Data boundary: local seeded or deliberately disposable records only; no real student, guardian, applicant, pastoral, payment, or credential data in repository evidence.

## Factory Record

- Intake: controlled-pilot evidence readiness after PRs `#217` and `#220`.
- Discovery: reviewed the canonical development guide, product context, role walkthrough generator, acceptance evidence, auth runbook, README, current main, and existing pilot-readiness guidance.
- Story: an operator can prepare a local session and an observer can run neutral tasks, stop safely, and produce sanitized evidence without inventing backlog work.
- Technical brief: protocol under `docs/acceptance/`; a small acceptance helper and CLI preflight that checks endpoint classification, Supabase Auth, Postgres, and the Academy login surface without printing secrets; status, index, and changelog updates.
- ADR: not required; no architecture or behavior changes.
- Council: complete in `docs/reviews/2026-10-05-council-review-26-pilot-session-readiness-synthesis.md`; approved for protected PR delivery.
- Testing Council: review documentation claims, reuse of the existing harness, security stop rules, and exact verification evidence.

## Acceptance Criteria

- The canonical guide records faculty-load delivery as merged and makes the uncoached session the active evidence gate.
- The session protocol separates participants, observers, and operators and prohibits coaching.
- Tasks cover representative admin, admissions/registrar, faculty, student/guardian, and authorization-boundary workflows.
- Evidence rules exclude credentials and sensitive records and distinguish product, environment, and fixture failures.
- S0-S3 severity and stop criteria govern follow-up story creation.
- VM-to-local networking guidance avoids assuming that the VM's `localhost` reaches the host stack.
- The readiness command rejects public endpoint topology, classifies accepted endpoints, and proves Auth, database, and app connectivity from the machine where it runs.
- No deployment or hosted-resource authorization is implied.

## Verification

| Command or Check | Result | Notes |
| --- | --- | --- |
| `npm run verify:governance` | passed | Governance documentation wiring |
| `npm run verify:role-walkthrough` | passed | Regenerated 49 role-matrix steps |
| `npm run verify:pilot-readiness` | passed | Local Auth, Postgres, and Academy login reachable; sanitized loopback classification |
| Focused readiness tests | passed | 4 endpoint safety and topology cases |
| `npm test` | passed | 2,164 tests |
| `npm run lint` | passed | No lint errors |
| `npm run build` | passed | Next.js production build and TypeScript |
| `git diff --check` | passed | Patch hygiene |

## Delivery

PR: `#221`, merged 2026-10-06.

Merge status: protected-main delivery complete.

Deployment: not requested or authorized.

## Review And Residual Risk

Council: Review 26 approved for protected PR delivery.

Testing Council: full browser E2E not required because no application page, route, role, auth policy, schema, or user-facing behavior changed.

`pr-review`: 0 Critical, 0 Important, 0 Minor findings after correcting an initially over-strict mixed VM/host topology rule.

Residual risk: command success proves reachability from the machine where it runs, not from the participant browser. The operator must complete the VM browser login/auth check before the session. A real uncoached participant session remains unverified and was deferred to a future task by owner decision on 2026-10-07; write-path integrity is the active MVP gate.
