# ChurchCore Academy SDLC

Date: 2026-09-26
Status: Active

## Purpose

This document is the set operating plan for ChurchCore Academy software work. It ties the Council, software factory, testing gates, deployment runbook, feedback/triage loop, and PR discipline into one auditable SDLC.

## Source Hierarchy

1. `AGENTS.md` and `CLAUDE.md` define repository-wide agent rules and product boundaries.
2. `docs/product/product-context.md` defines what ChurchCore Academy is and what "done" means.
3. `docs/software-factory.md` defines the idea-to-delivery workflow.
4. `IMPROVE-SOFTWARE.md` defines Council review and change-management discipline.
5. `docs/runbooks/deployment-operations.md` defines deployment and release evidence.
6. ADRs under `docs/adr/` define durable architecture decisions.

If two documents disagree, verify the live code and update the stale document in the same change that relies on the correction.

## Change Classes

| Class | Examples | Required Process |
| --- | --- | --- |
| Trivial | typo, comment, narrow docs correction | PR review, governance check, focused verification if applicable |
| Small fix | one bounded bug fix, test-only correction, small UI repair | discovery, scoped implementation, targeted tests, `npm run verify`, PR review |
| Non-trivial feature | user workflow, API behavior, UI surface, integration, multi-file branch | Council or approved feature-factory story/brief, implementation, targeted tests, `npm run verify`, e2e if user-facing, Documenter, PR review |
| High-risk change | auth, tenant isolation, RLS, migrations, student/guardian/grade/transcript/billing/LMS/ShepherdAI/LLIS data | Council, ADR when durable, full dependency tests, RLS/authz or migration rehearsal, `npm run test:full`, Documenter, PR review |
| Release/deployment | controlled pilot, Vercel/Supabase deployment, environment changes | release gate in deployment runbook, deployment record, smoke checks, rollback target |

## Idea To Feature Pipeline

1. Intake: capture product area, primary users, institution modes, data touched, LMS impact, PWA impact, ShepherdAI/LLIS impact, auth/privacy risk.
2. Discovery: inspect existing docs, ADRs, code, tests, migrations, and similar features before designing.
3. Story: write testable acceptance criteria and explicit non-goals.
4. Technical brief: name files, data flow, auth/tenant boundary, tests, e2e surfaces, and ADR triggers.
5. Approval: substantial stories and briefs need human approval before build.
6. Build: keep changes scoped and preserve existing patterns.
7. Verify: run focused tests first, then required gates.
8. Review: run Council when non-trivial and `pr-review` for every PR.
9. Document: update changelog, docs, ADRs, and factory run records.
10. Deliver: PR through protected main, then deployment only through the runbook.

## Update And Feature Generation

New updates and features come from four evidence sources:

- Council findings and competitive/product audits.
- Pilot feedback/error triage patterns and user-observed blockers.
- Roadmap/product-context priorities.
- Production or CI failures.

Each candidate must become a bounded story before implementation. Feedback clusters and incidents can start the story, but they are not themselves approval to widen scope.

## Verification Matrix

| Scope | Minimum Evidence |
| --- | --- |
| Any PR | `npm run verify:governance`, `git diff --check`, PR review |
| Code behavior | Targeted tests plus `npm run verify` |
| User-facing page/API/route | e2e surface manifest entry, journey or documented exception, `npm run test:full` when feasible |
| Migration/schema/RLS | migration rehearsal, relevant `verify:*` script, RLS/authz evidence, rollback or forward-repair note |
| UI/PWA | browser or screenshot evidence, loading/empty/error state check, accessibility pass |
| Deployment | CI green on merged commit, environment review, smoke checks, deployment record |

## Audit Artifacts

Use these durable locations:

- `docs/reviews/` for Council and review outputs.
- `docs/adr/` for durable decisions.
- `docs/superpowers/stories/`, `docs/superpowers/specs/`, and `docs/superpowers/plans/` for feature factory artifacts.
- `docs/reports/` for walkthroughs and verification reports.
- `docs/releases/` for release notes.
- `docs/templates/factory-run-record.md` for substantial run records.
- `docs/templates/deployment-record.md` for controlled-pilot deployment evidence.

## Stop Conditions

Stop and report instead of shipping when:

- verification is red or unavailable for an unbounded reason;
- tenant isolation, role access, or RLS evidence is missing for sensitive data;
- a required e2e surface or journey is missing for a new user-facing workflow;
- a Council or review finding is Critical or Important and unresolved;
- deployment target, commit SHA, environment, rollback target, or migration state is unclear.
