# ChurchCore Academy Development Guide

Date: 2026-09-26
Status: Canonical

This is the single operating guide for ChurchCore Academy development. It combines the product objective, MVP and competitive status, Council process, Testing Council, software factory, implementation backlog, verification gates, and release discipline into one source of truth.

Older documents may contain useful history, but this guide controls day-to-day development. If another document disagrees with this guide, verify the current code and update the stale document instead of following both.

## Objective

Build ChurchCore Academy into a controlled-pilot-ready, competitive faith-based SIS and education-management product without drifting into tangents.

The product objective is:

1. Keep the Core Academic Loop fully working and enforced by CI.
2. Close the highest-value competitive gaps from the latest MVP evaluation.
3. Preserve Academy as the academic system of record.
4. Keep LMS behavior behind provider-neutral contracts.
5. Keep ShepherdAI deterministic, explainable, consent-aware, and human-reviewed.
6. Keep every substantial change auditable through Council, Testing Council, documentation, PR review, and verification evidence.

Deployment to Vercel and creation of hosted Supabase resources are explicitly deferred until the owner asks for deployment work. Do not create Vercel projects, hosted Supabase projects, billable cloud resources, or production-like live environments as part of ordinary development.

## Current Product Status

Academy is a controlled-pilot candidate, not a GA production system.

The latest MVP and competitive evaluation is `docs/reports/mvp-and-competitive-status-2026-09-25.md`. Its bottom line is:

- The MVP is functionally built.
- The Core Academic Loop works end to end against a real migration-built database.
- Steps 1-8 and 10 are automated in CI.
- Steps 9 and 11 are built and manually verified, but still need automated journey coverage.
- Academy is not live.
- No Vercel project or hosted Academy Supabase project should be created until deployment is approved.
- The first-customer blockers are trusted institution resolution for the public portal, complete automated core-loop coverage, and a product decision about which customer profile drives the next competitive gap work.

## First Target Customer Profile

The next development objective targets faith-based Bible schools, seminaries, ministry institutes, and similar small institutions that do not require U.S. Title IV federal aid automation on day one.

Rationale:

- The academic core, admissions, portals, formation records, denomination/ordination, competency/narrative grading configuration, guardian portal, LMS contracts, and ShepherdAI signals are already strong for this segment.
- Title IV institutions require FAFSA/ISIR import and COD transmission before Academy can credibly compete as a production replacement.
- Deployment is deferred, so the next work should strengthen the repo and pilot-readiness without creating cloud resources.

## Implementation Backlog

This is the active plan until a newer MVP and competitive evaluation replaces it.

### P0: MVP Confidence

1. Automate Core Academic Loop step 9: progress against requirements.
   - Add journey coverage to `e2e/journeys/core-academic-loop.spec.ts`.
   - Prove the progress view reflects program requirements and completed work.
   - Include role/tenant denial evidence where applicable.

2. Automate Core Academic Loop step 11: transcript entry.
   - Extend the journey from grade entry through final grade posting and registrar transcript entry.
   - Prove immutable transcript entry behavior from the browser/API path.
   - Keep held, draft, or unreleased records out of student-facing surfaces.

3. Resolve public portal trusted institution selection before live use.
   - Track as GitHub issue `#162`.
   - The portal must not depend on ambiguous `?tenant=` or environment-default behavior for real applicants.
   - This can be built before deployment, but live activation remains deferred.

### P1: Competitive Wedge For First Customer

4. Custom report builder.
   - Replace fixed-report-only posture with an institution-safe, role-gated report builder.
   - Protect tenant isolation, PII, grades, billing, and financial-aid fields.
   - Start with saved report definitions and CSV export, then expand only with evidence.

5. Bulk communications.
   - Keep existing email drip sequences.
   - Add ad-hoc bulk email first.
   - Add SMS only after provider, consent, opt-out, audit, and rate-limit rules are approved.

6. Donor and alumni expansion.
   - Existing alumni records and giving are foundations.
   - Add donor campaign management.
   - Add opt-in alumni directory with privacy controls.

7. Advising and faculty-load intelligence.
   - Add advising workflow intelligence and caseload support.
   - Add faculty load intelligence.
   - Keep outputs explainable and human-reviewed.

8. Multilingual UI.
   - Add an i18n layer only when there is a selected pilot/customer language need.
   - Start with navigational and high-frequency workflow text.

9. OneRoster deletion reconciliation.
   - Track as GitHub issue `#164`.
   - Preserve Academy as the academic record source of truth.
   - Do not change the LMS boundary.

### P2: Title IV And Mature-Market Parity

10. FAFSA/ISIR import.
    - Requires separate compliance review and data-handling approval.

11. COD push-sync.
    - Requires separate compliance review, provider evidence, rollback, and audit plan.

12. ATS-native and certified compliance reporting expansion.
    - Current reports are review-required snapshots, not certified filings.

### Deliberate Non-Goals

- Built-in LMS runtime.
- Moodle runtime code, Moodle plugins, Moodle themes, or Canvas runtime internals.
- Bookstore.
- Housing.
- Autonomous academic or pastoral interventions.
- Freeform ShepherdAI chatbot UI.

## Council

Run Council before every non-trivial merge. Non-trivial means product behavior, schema, auth/privacy, LMS contract, ShepherdAI, LLIS, UI workflow, migration, release/deployment, or accumulated multi-file work.

Council uses read-only audit voices and one synthesis/documentation close-out:

| Voice | Focus |
| --- | --- |
| Product And SIS Council | Product fit, academic workflow correctness, institution modes, customer value |
| Architecture And Data Council | Module boundaries, schema, RLS, migrations, integration contracts |
| UX And Accessibility Council | Navigation, browser workflow, loading/error states, mobile, accessibility |
| Security And Privacy Council | Tenant isolation, roles, student/guardian records, grades, billing, auditability |
| Competitive Council | MVP score, Populi/parity gaps, first-customer risk, market positioning |
| Testing Council | Test surface, CI enforcement, e2e journeys, known-issue discipline, verification proof |
| Documenter | Changelog, guide/status updates, ADRs, run records, residual risks |

Council findings do not replace tests. Agent success, static inspection, dry runs, and council approval are not verification evidence.

## Testing Council

The Testing Council owns the question: "Would this have failed before a customer found it?"

For every meaningful change, Testing Council checks:

- New pages and API methods are registered in `e2e/surfaces/manifest.ts`.
- New workflows have a journey in `e2e/journeys/` or a documented exception.
- New roles have personas in `e2e/personas.ts`.
- Fixed bugs are removed from `e2e/surfaces/known-issues.ts`.
- Sensitive workflows include denied-role or cross-tenant evidence.
- Tests create prerequisite data through real module paths, not schema shortcuts.
- Unit tests include success, validation/rejection, and cross-tenant cases where relevant.
- `npm run test:full` is required for auth, routing, user-facing workflow, new-surface, role, or production-build risk.

Known issues pinned in the e2e suite should trend to zero. A known issue is a temporary exception, not a backlog hiding place.

## Software Factory

Every substantial feature uses this pipeline:

1. Intake: capture product area, users, institution modes, data touched, LMS impact, PWA impact, ShepherdAI/LLIS impact, auth/privacy risk.
2. Discovery: inspect docs, ADRs, code, tests, migrations, and similar features.
3. Story: write testable acceptance criteria and explicit non-goals.
4. Technical brief: name files, data flow, auth/tenant boundary, tests, e2e surfaces, ADR triggers.
5. Approval: substantial stories and briefs need owner approval before build.
6. Build: make scoped changes using existing patterns.
7. Verify: run focused checks first, then required gates.
8. Council and PR review: run Council when required and `pr-review` for every PR.
9. Document: update this guide, changelog, ADRs, run records, and status docs when the change affects product direction or operations.
10. Deliver: PR through protected main. Deployment only happens through a separately approved deployment runbook.

Feature candidates come from:

- MVP and competitive evaluations.
- Council findings.
- Pilot feedback and error triage.
- CI or production-build failures.
- Customer-specific adoption blockers.

Evidence creates priority; it does not authorize scope creep.

## Verification Gates

| Scope | Minimum Evidence |
| --- | --- |
| Any PR | `npm run verify:governance`, `git diff --check`, `pr-review` |
| Code behavior | Targeted tests plus `npm run verify` |
| User-facing page/API/route | e2e manifest entry and journey or documented exception |
| Auth, routing, role, or new surface | `npm run test:full` when feasible |
| Migration/schema/RLS | migration rehearsal, RLS/authz evidence, rollback or forward-repair note |
| UI/PWA | browser or screenshot evidence, loading/empty/error state check, accessibility pass |
| Release/deployment | CI green on merged commit, deployment record, smoke checks, rollback target, owner approval |

Standard commands:

```bash
npm run verify:governance
npm test
npm run lint
npm run build
npm run verify
npm run test:full
git diff --check
```

Report pass, fail, or unverified exactly. Do not imply a check ran when it did not.

## Release And Deployment Rules

Current deployment posture:

- Deployment is deferred.
- Do not create Vercel projects.
- Do not create hosted Supabase projects.
- Do not create billable resources.
- Do not activate live providers.

External gates that remain before production or broad pilot:

- Trusted institution selection for public portal.
- Moodle sandbox or tenant evidence.
- Canvas sandbox or tenant evidence.
- Tenant owner and provider owner signoff.
- Live payment checkout and settlement approval.
- Live email/SMS delivery approval.
- Deployment-specific logs, dashboards, alerts, and smoke checks.
- Per-tenant authenticated browser walkthrough evidence.
- Regulated/federal financial-aid compliance validation.
- Separate Council approval for model-generated learner predictions or autonomous academic/pastoral interventions.

## Status Hygiene

Stale docs waste time. When a doc conflicts with verified code:

1. Treat code and current CI evidence as the tiebreaker.
2. Correct or retire the stale doc in the same change.
3. Preserve history, but make the current operating state obvious.

Known stale item corrected by this consolidation:

- `COUNCIL-APPROVED-IMPLEMENT.md` described Graduation Clearance as open/not started. It is now marked completed/superseded because the latest MVP evaluation records Graduation audit + clearance workflow as working as of PR #155.

## PR Discipline

- Work on a feature or fix branch.
- Do not push directly to `main`.
- Keep changes scoped.
- Preserve unrelated dirty worktree changes.
- Update docs in the same PR when product direction, architecture, operations, or governance changes.
- PR descriptions must include summary, boundaries, Council/Factory status, tests, and residual risks.
- Critical or Important review findings block merge until resolved, explained as false positives, or explicitly deferred with owner and issue.

## Authoritative References

Use these as supporting evidence, not competing operating guides:

- `CLAUDE.md`: stack, architecture rules, and agent reference.
- `AGENTS.md`: short cross-agent entrypoint.
- `docs/reports/mvp-and-competitive-status-2026-09-25.md`: latest MVP/competitive evaluation.
- `docs/project-status.md`: current product status snapshot.
- `docs/testing/e2e-suite.md`: e2e suite details.
- `docs/adr/`: durable architecture decisions.
- `docs/runbooks/deployment-operations.md`: deployment evidence template and release operations.
- `docs/templates/factory-run-record.md`: substantial-run audit template.
- `docs/templates/deployment-record.md`: deployment audit template.
