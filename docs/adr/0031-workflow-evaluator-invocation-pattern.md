# ADR-0031 — Workflow Evaluator Invocation Pattern

**Date:** 2026-06-18
**Status:** Accepted
**Deciders:** @ricardojjulia

---

## Context

`src/modules/scheduled-jobs/evaluate-academic-workflows.ts` exports `runAcademicWorkflowEvaluationJob()`. It is currently called synchronously inside `/app/admin/workflows/page.tsx` (a server component) and `/app/faculty/shepherd/page.tsx` on every page render.

This violates two rules:
1. **Thin route rule** — API routes and server components must stay thin; business orchestration belongs in modules.
2. **Performance** — the evaluator runs a full signal scan and suggestion generation on every page load, blocking the response until it completes. With real student data this will be slow.

The evaluator already has a POST endpoint at `/api/academy/shepherd-ai/evaluate`, but it is not used by the pages.

---

## Decision

**The workflow evaluator must never run synchronously on page render.**

Allowed invocation paths:
1. **Explicit user-triggered POST** — a "Re-evaluate" action button on the admin workflows page calls `POST /api/academy/shepherd-ai/evaluate`. The page shows a loading indicator and refreshes the suggestion list after the response.
2. **Scheduled background job** — a cron or Vercel cron function calls the same endpoint on a configured interval (Phase 10 implementation).

**Forbidden:** any import of `runAcademicWorkflowEvaluationJob` in a `page.tsx` or `layout.tsx` file.

Pages read suggestions only from the `ai_suggestions` DB table via `ShepherdAiPostgresRepository` — they do not trigger evaluation.

---

## Consequences

**Positive:**
- Workflows and shepherd pages render instantly (DB read only, no evaluator cost).
- Evaluation is explicit and auditable — the admin or faculty member triggers it on demand.
- Path is open for background scheduling in Phase 10.

**Negative:**
- Suggestions shown on page load may be stale until the user triggers a re-evaluation.
- Requires a "Re-evaluate" button + optimistic UI to handle the async response.

---

## Implementation notes

- The `scheduled-jobs` module needs `types.ts` and `__tests__` before Phase 10 background scheduling.
- The existing `/api/academy/shepherd-ai/evaluate` route already exists and can be used directly.
- The `academic-workflows` module also needs `types.ts` and `__tests__` — these are prerequisites for the Phase 10 ShepherdAI work.

---

## References

- Council Review V Agent 1 — SIS State Audit (top gap #5)
- Council Review V Agent 3 — UX Audit
- CLAUDE.md §Architecture rules: _"API routes stay thin — resolve actor, call module, map errors."_
- ADR-0028 — Gradebook API route contract (pattern reference)
