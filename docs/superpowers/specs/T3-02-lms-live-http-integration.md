# Story: LMS Live HTTP Integration

**ID:** T3-02
**Tier:** 3 — Achieve Competitive Differentiation
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story

As a student, I want to click "Launch Course" in my student portal and actually land in my Moodle
course with single sign-on, without being asked to log in again, so I can move from Academy to my
learning environment in one click.

As an institution admin, I want enrollment changes I make in ChurchCore Academy to automatically
sync to Moodle so faculty do not need to manage two separate roster systems, and the student
experience is seamless from day one of a new term.

So that: ChurchCore Academy functions as a genuine SIS-plus-LMS integration hub rather than a
stub, and "Tier 2" schools (those already running Moodle) can adopt Academy without disrupting
their learning environment.

## Background

The LMS adapter architecture is complete (ADR-0014, ADR-0015, ADR-0016). The
`src/modules/lms-contract/` module defines the full `LmsCapability` set and both Moodle and
Canvas adapter files exist. However, every adapter file (`moodle-launch.ts`,
`moodle-course-roster-sync.ts`, `moodle-grade-progress-return.ts`) contains only type stubs or
placeholder returns — zero real `fetch()` calls exist anywhere in the LMS adapter code. Students
clicking "Launch Course" in the PWA receive a no-op response. This story wires Moodle first,
which is the primary LMS for Bible colleges and seminaries (the first buyer segment).

## Acceptance Criteria

1. When a student clicks "Launch Course" in the student PWA and the tenant's LMS provider is
   `moodle`, the launch orchestration calls the Moodle Web Services REST API to obtain or verify
   the student's Moodle user account, then returns an LTI 1.3 launch URL that opens the Moodle
   course in a new browser context — no separate Moodle login required.
2. When an enrollment record changes state to `active` in ChurchCore Academy, the LMS execution
   worker enqueues a roster sync operation. The worker calls the Moodle enrollment API to enroll
   the student in the mapped Moodle course. The sync must complete within 60 seconds of the
   enrollment event under normal Moodle availability.
3. When Moodle returns a grade or progress event (via webhook or polling), the grade return
   handler creates a `pending_review` import record in Academy. The import is NOT automatically
   posted to the official gradebook — an admin or faculty member must review and accept it.
4. Every Moodle Web Services API call produces an `LmsAuditEvent` in the audit log with
   `tenantId`, `providerId: "moodle"`, `operation`, `resultStatus`, and `redactedMetadata`.
   Provider credentials, access tokens, and raw payloads must not appear in audit event metadata.
5. If Moodle returns a transient HTTP error (5xx, timeout, connection refused), the adapter
   retries with exponential backoff: 2s, 4s, 8s, max 3 retries. After exhausting retries, the
   operation result status is `retryable_failure` and the job is re-queued for the next worker
   cycle.
6. If Moodle has been unreachable for more than 5 consecutive minutes (circuit breaker threshold),
   the adapter returns `permanent_failure` with `safeMessage: "LMS temporarily unavailable"` and
   does not attempt further API calls until the circuit resets. The circuit resets on the next
   successful probe.
7. When a student attempts to launch a course while the Moodle circuit breaker is open, the PWA
   shows a user-facing message: "Your course is temporarily unavailable. Please try again shortly."
   The student is not shown any Moodle-internal error, credential detail, or stack trace.
8. When a student is enrolled in Academy but not yet synced to Moodle (e.g., within the first
   sync window), a launch attempt triggers an on-demand sync before generating the launch URL.
   If the sync completes within 10 seconds, the launch proceeds. If it times out, the student sees
   the "temporarily unavailable" message and the sync is queued for background completion.
9. When a Moodle course is deleted on the Moodle side, the next reconciliation run detects the
   missing mapping, writes an audit event, sends an admin notification, and marks the Academy
   section's LMS mapping status as `"lms_sync_failed"`. Faculty and admin see the failed mapping
   badge on the section record.
10. All Moodle API operations enforce tenant isolation: Moodle credentials for tenant A are never
    used for operations initiated by or affecting tenant B.
11. No Moodle credential (access token, service token, username/password, shared secret) appears
    in any Academy domain record, student-facing read model, API response, or log output.

## Edge Cases

- Moodle is down at student launch time: circuit breaker triggers; student sees safe message;
  audit event written; no crash, no error page.
- Student enrolled in Academy but Moodle user account does not exist: adapter creates the Moodle
  user via Web Services before enrolling; if creation fails, the launch fails gracefully with
  the "temporarily unavailable" message.
- Moodle course deleted between Academy section creation and student launch: reconciliation marks
  the section as `lms_sync_failed`; student sees "Course not available in LMS" message; admin
  notified.
- Admin disables Moodle integration mid-term (switches provider to `none`): all pending sync
  jobs are cancelled; existing launch URLs are invalidated; students see "No LMS configured"
  message.
- Moodle Web Services API version mismatch (older Moodle instance): adapter detects unsupported
  function call response and returns `permanent_failure` with a descriptive safe message to admin;
  no retry.
- Grade passback value outside Academy grading scale: import record is created as
  `pending_review`; the review UI flags the out-of-range value before any admin can accept it.
- Two concurrent sync workers attempt to enroll the same student in the same Moodle course:
  Moodle enrollment API is idempotent; second call is a no-op; both produce audit events.

## Out of Scope

- Canvas live HTTP integration (T4-05).
- LTI 1.1 support (LTI 1.3 only for new integrations).
- Moodle plugin development or Moodle theme changes (belong in the LMS repository, per Rule 1).
- Automatic grade posting from Moodle to Academy official gradebook without admin review.
- Student progress analytics from Moodle (progress return is Tier 4 / future).

## Role Matrix

| Action | `student` | `guardian` | `faculty` | `admin` |
|---|---|---|---|---|
| Trigger course launch | Yes (own courses) | No | Yes (section preview) | Yes |
| View LMS sync status (section) | No | No | Yes (own sections) | Yes |
| Review and accept grade passback | No | No | Yes | Yes |
| Reject grade passback import | No | No | Yes | Yes |
| View LMS audit events | No | No | No | Yes |
| Configure Moodle credentials | No | No | No | Yes (institution admin) |
| Trigger manual roster sync | No | No | No | Yes |
| View circuit breaker status | No | No | No | Yes |

## Technical Notes

- Implementation target: `src/modules/lms-contract/moodle-launch.ts`,
  `src/modules/lms-contract/moodle-course-roster-sync.ts`,
  `src/modules/lms-contract/moodle-grade-progress-return.ts`.
- Moodle credentials are stored per ADR-0016 in an encrypted Supabase column; resolved at the
  route/worker layer and passed into adapter functions — never resolved inside module domain
  functions (per CLAUDE.md "Don't do" rule).
- Circuit breaker state can be stored in a Supabase table `lms_circuit_breaker_state` with
  `(tenant_id, provider_id)` primary key, or in Redis if available. Initial implementation uses
  DB-backed state (no new infrastructure required).
- LTI 1.3 launch URL generation requires the Moodle site's LTI tool URL and the registered
  `client_id`. These are part of the Moodle credential configuration (ADR-0016).
- `LmsAuditEvent` type is already defined in `src/modules/lms-contract/contract.ts`. Audit writes
  go through `src/modules/audit/`.
- `LmsOperationResult` with `status: "retryable_failure"` signals the worker to re-queue.
  `status: "permanent_failure"` signals admin notification via the existing communications module.
- ADR-0046 (LMS HTTP client implementation and retry strategy) must be written and accepted
  before implementation begins.
- The `sync-audit-reconciliation.ts` file in `src/modules/lms-contract/` is the entry point for
  reconciliation runs; the Moodle reconciliation adapter lives in `moodle-reconciliation.ts`.

## Tests Required

Per CLAUDE.md conventions, `src/modules/lms-contract/__tests__/` must include:

- **Success:** Moodle launch adapter returns `status: "available"` with a `launchUrl` when
  Moodle Web Services returns a valid LTI URL (mock HTTP response).
- **Success:** roster sync adapter returns `status: "success"` when Moodle enrollment API
  returns HTTP 200 (mock).
- **Success:** grade return handler creates a `pending_review` import record; no automatic
  grade post occurs.
- **Validation:** launch request with missing `nonce` throws or returns `permanent_failure`.
- **Retry:** adapter retries on 503 response up to 3 times; after 3 failures returns
  `retryable_failure`.
- **Circuit breaker open:** when circuit state is `open`, adapter returns `permanent_failure`
  with safe message without calling the Moodle API.
- **Cross-tenant rejection:** actor from tenant A cannot use tenant B's Moodle credentials.
- **Secret exclusion:** `validateLmsLaunchResponseSafety` returns no leaked field names in the
  launch response (assert with `doesNotMatch` on all `lmsSensitiveLaunchFieldNames`).
- **Moodle course missing:** reconciliation report marks mapping as stale and returns required
  action entry.
