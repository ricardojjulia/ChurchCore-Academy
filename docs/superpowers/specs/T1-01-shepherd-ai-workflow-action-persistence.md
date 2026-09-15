# Story: ShepherdAI Workflow Action Persistence

**ID:** T1-01
**Tier:** 1 — Unblock Basic Operations
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story

As a registrar or academic advisor, I want my workflow actions — promote, dismiss, snooze, and
resolve — to persist between page loads so I can use the ShepherdAI queue as a real work-tracking
tool rather than a read-only display that resets every time I reload the page.

So that: staff can work through the suggestion queue across sessions, items they have acted on stay
acted on, and the queue reflects the institution's actual workflow state rather than a re-generated
snapshot.

## Background

ShepherdAI already detects signals and generates suggestions persisted in `ai_suggestions` and
surfaces them on `/admin/workflows`. The `workflow_actions` table exists in Postgres with an
`insertWorkflowAction` method in `ShepherdAiPostgresRepository`. However, the UI actions
(promote/dismiss/snooze) are currently client-side only — they are lost on page reload. The
`SuggestionStatus` type already includes `"promoted_to_workflow" | "deferred" | "dismissed" |
"resolved"` and `WorkflowActionType` includes `"assign" | "defer" | "dismiss" | "complete" |
"promote" | "note"`, so the types are correct and the persistence path is already stubbed. This
story wires the UI through to the database and enforces the status lifecycle from the server.

## Acceptance Criteria

1. When a registrar or admin takes a promote, dismiss, snooze, or resolve action on a suggestion
   card, the action is written to `workflow_actions` in Postgres before the UI confirms success.
2. On page reload, each suggestion card reflects the last-applied action state: promoted items show
   as promoted, dismissed items do not appear in the active queue, snoozed items are hidden until
   snooze expiry, resolved items are archived and do not appear in the default queue view.
3. Dismissed suggestions have `status = 'dismissed'` on `ai_suggestions`; they do not re-appear in
   any queue view unless the staff member explicitly views the "dismissed" filter.
4. Snoozed suggestions store a `snooze_until` timestamp on the workflow action payload. The queue
   fetch query excludes snoozed items where `now() < snooze_until`. Snoozed items re-appear
   automatically after the expiry timestamp without any staff action.
5. Resolved suggestions have `status = 'resolved'` on `ai_suggestions` and are archived to a
   separate "resolved" view. They do not appear in the active queue.
6. Promoted suggestions create a corresponding `workflows` record with `status = 'open'` and link
   back to the originating suggestion via `suggestion_id`.
7. All action API endpoints enforce tenant isolation: an actor from tenant A cannot act on a
   suggestion belonging to tenant B.
8. The action API returns the updated suggestion/workflow record so the UI can update optimistically
   without a full page reload.

## Edge Cases

- Two staff members act on the same suggestion concurrently: the second write must not silently
  corrupt the first. Use the existing `on conflict (id) do nothing` pattern on `workflow_actions`
  and re-fetch the suggestion status before confirming the UI state.
- Snooze expiry at midnight on the server: the queue fetch query compares `snooze_until` against
  `now()` server-side; no cron job or client-side timer is required for the initial implementation.
- The underlying student condition resolves (e.g., the student completes enrollment) before a
  snoozed action expires: the re-evaluation endpoint already overwrites suggestion status via
  `updateSuggestionStatus`. If the signal is no longer detected on re-evaluation, the suggestion
  status is set to `resolved` regardless of the pending snooze.
- A staff member attempts to dismiss an already-resolved suggestion: the API should return the
  current suggestion state (resolved) rather than an error, allowing the UI to sync gracefully.
- Faculty role trying to take an action on a suggestion outside their sections: return 403.

## Out of Scope

- AI-generated actions or auto-dismiss logic (Phase 2).
- Bulk promote/dismiss/snooze across multiple items (Phase 2).
- Email notifications to assigned staff when a workflow is promoted (covered by T1-02).
- Workflow assignment to a specific staff member from the action UI (assignment is a secondary
  action on the promoted workflow; the initial promote creates an `open` workflow only).
- Snooze duration picker beyond the default snooze durations defined in the domain constants.

## Role Matrix

| Role | Promote | Dismiss | Snooze | Resolve | View active queue | View dismissed | View resolved |
|------|:-------:|:-------:|:------:|:-------:|:-----------------:|:--------------:|:-------------:|
| institution_admin | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| registrar | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| academic_admin | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| dean | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| admissions | No | No | No | No | Yes (admissions suggestions only) | No | No |
| faculty | No | No | No | No | Yes (own sections only) | No | No |
| student | No | No | No | No | No | No | No |
| guardian | No | No | No | No | No | No | No |

## Technical Notes

- Key files to read before implementation:
  - `src/modules/shepherd-ai/postgres-repository.ts` — `insertWorkflowAction`, `upsertWorkflow`,
    `updateSuggestionStatus`, `fetchWorkflowActions`
  - `src/modules/shepherd-ai/types.ts` — `SuggestionStatus`, `WorkflowActionType`,
    `WorkflowActionRecord`, `WorkflowRecord`
  - `src/app/admin/workflows/page.tsx` — current page structure using `WorkflowQueueBoard`
  - `src/modules/academic-workflows/repository.ts` — `InMemoryAcademicWorkflowRepository` and
    `getQueue` filter logic
  - `src/components/academy-workflow-queue.tsx` — client component receiving `initialItems`
- The `workflow_actions` table already exists (created in an earlier migration). Verify the column
  `action_payload_json` can store `{ snooze_until: ISO8601 }` as jsonb — it already accepts jsonb.
- A new `snooze_until` column may need to be added to `ai_suggestions` or derived from the latest
  `workflow_actions` row for that suggestion. Prefer deriving from actions to avoid schema churn;
  document the decision in ADR-0039.
- The action API route must live at `POST /api/academy/shepherd-ai/suggestions/[id]/action` and
  accept `{ actionType, payload }` in the body. Route must use `withAcademyDatabaseContext`.
- Do not call ShepherdAI signal evaluation from the action route. The re-evaluation endpoint
  (`/api/academy/shepherd-ai/evaluate`) is separate.
- The `fetchSuggestions` query in the repository should be extended with optional status filters so
  the page can fetch `status != 'dismissed'` for the default view.

## Tests Required

- `src/modules/shepherd-ai/__tests__/action-persistence.test.ts`:
  - Success: promote action writes a `workflow_actions` row and sets suggestion status to
    `promoted_to_workflow`.
  - Success: dismiss action sets suggestion status to `dismissed`.
  - Success: snooze action writes `workflow_actions` row with `snooze_until` in payload.
  - Success: resolve action sets suggestion status to `resolved`.
  - Cross-tenant rejection: action on a suggestion belonging to a different tenant returns an
    authorization error.
  - Idempotency: calling promote twice on the same suggestion with the same action id does not
    create a duplicate `workflow_actions` row (on conflict do nothing).
  - Faculty role rejection: faculty actor attempting dismiss returns authorization error.
- `src/modules/shepherd-ai/__tests__/fetch-with-filters.test.ts`:
  - Dismissed suggestions are excluded from the default queue result.
  - Snoozed suggestions where `snooze_until > now()` are excluded.
  - Snoozed suggestions where `snooze_until <= now()` are included.
  - Resolved suggestions are excluded from the default queue result.
