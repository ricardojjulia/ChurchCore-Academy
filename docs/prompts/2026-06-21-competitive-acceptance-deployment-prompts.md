# AI Coding Prompts — Competitive Acceptance And Deployment Readiness

Date: 2026-06-21  
Governing ADR: `docs/adr/0038-competitive-acceptance-and-deployment-readiness.md`  
Council review: `docs/reviews/2026-06-21-council-review-8-post-slice-9-mvp-competitiveness.md`

## Prompt 1 — Acceptance Checklist And Role Matrix

You are implementing the first ADR-0038 acceptance slice.

Goal: create and run a role-matrix acceptance checklist for admin, registrar, faculty, student, guardian, finance, admissions, and platform admin.

Factory requirements:

- Use `docs/software-factory.md`.
- Create `docs/superpowers/specs/YYYY-MM-DD-competitive-acceptance-role-matrix-design.md`.
- Create `docs/superpowers/plans/YYYY-MM-DD-competitive-acceptance-role-matrix.md`.
- Add `docs/acceptance/role-matrix-checklist.md`.
- Add route/API smoke scripts or tests where practical.

Scope:

- Verify sign-in/redirect behavior.
- Verify each role can access its required surfaces.
- Verify each role is denied from forbidden surfaces.
- Include admin, registrar, faculty, student, guardian, finance, admissions, and platform admin.
- Capture route, expected status, data boundary, and evidence command.

Verification:

- focused acceptance tests or scripts;
- `npm test`;
- `npm run lint`;
- `npm run build`;
- protected-route HTTP smoke.

## Prompt 2 — Migration, Seed, And Live-Tenant Rehearsal

You are implementing the second ADR-0038 acceptance slice.

Goal: prove the database can be created, migrated, seeded, and rehearsed for a pilot tenant.

Factory requirements:

- Create `docs/superpowers/specs/YYYY-MM-DD-migration-seed-rehearsal-design.md`.
- Create `docs/superpowers/plans/YYYY-MM-DD-migration-seed-rehearsal.md`.
- Add `docs/runbooks/migration-seed-rehearsal.md`.

Scope:

- Run local migration replay.
- Verify applied migration tracking.
- Verify deterministic demo/pilot tenant seed data.
- Verify no runtime route imports deprecated seeded datasets.
- Document recovery for failed migration.

Verification:

- `npm run db:migrate:local`;
- migration tests;
- runtime source-boundary tests;
- `npm test`, `npm run lint`, `npm run build`.

## Prompt 3 — Deployment Operations Runbook

You are implementing the third ADR-0038 acceptance slice.

Goal: create deployment and operations runbooks for controlled pilot readiness.

Factory requirements:

- Create `docs/superpowers/specs/YYYY-MM-DD-deployment-operations-readiness-design.md`.
- Create `docs/superpowers/plans/YYYY-MM-DD-deployment-operations-readiness.md`.
- Add `docs/runbooks/deployment-operations.md`.
- Add `docs/runbooks/incident-response.md`.
- Add `docs/runbooks/backup-restore.md`.

Scope:

- environment variable inventory;
- Supabase migration procedure;
- Vercel/build/deployment procedure;
- backup/restore procedure;
- monitoring/logging checklist;
- incident response and rollback;
- secrets management policy.

Verification:

- docs lint by review;
- no secrets in repo;
- build command documented and verified;
- `npm test`, `npm run lint`, `npm run build`.

## Prompt 4 — Provider Activation Checklists

You are implementing the fourth ADR-0038 acceptance slice.

Goal: create activation checklists for live payment, email/SMS, Moodle, Canvas, and regulated aid providers.

Factory requirements:

- Create `docs/superpowers/specs/YYYY-MM-DD-provider-activation-readiness-design.md`.
- Create `docs/superpowers/plans/YYYY-MM-DD-provider-activation-readiness.md`.
- Add `docs/runbooks/provider-activation.md`.

Scope:

- Payment checkout and settlement activation.
- Email/SMS provider worker activation.
- Moodle live HTTP client activation.
- Canvas live HTTP client activation.
- Regulated/federal aid activation gate.
- Required secrets, test accounts, sandbox evidence, production evidence, rollback.

Verification:

- provider-safe payload tests;
- no raw provider secrets in returned payloads;
- `npm test`, `npm run lint`, `npm run build`.

## Prompt 5 — Final Council Closeout And Release Package

You are implementing the final ADR-0038 acceptance slice.

Goal: produce the final release package and council decision.

Factory requirements:

- Create `docs/reviews/YYYY-MM-DD-council-review-9-release-closeout.md`.
- Create `docs/releases/YYYY-MM-DD-controlled-pilot-release-notes.md`.
- Update README, project status, factory roadmap, ADR index, and all related runbooks.

Scope:

- summarize completed work;
- summarize verification evidence;
- list open risks;
- decide one of: `ship controlled pilot`, `defer`, or `split`;
- create next-step prompts for any deferred remediation.

Verification:

- all acceptance artifacts present;
- `npm test`;
- `npm run lint`;
- `npm run build`;
- `git diff --check`.
