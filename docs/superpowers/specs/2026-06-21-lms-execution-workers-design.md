# LMS Execution Workers Design

Date: 2026-06-21
Factory slice: Full SIS Competitive MVP Task 9

## Goal

Move LMS integrations from provider-operation planning to executable worker boundaries while preserving Academy as the SIS and official-record authority.

## Scope

- Moodle and Canvas active tenants must produce executable course-shell and roster operations from the API contract route.
- Moodle and Canvas grade/progress returns must remain reviewed imports, not official records.
- Worker execution must be idempotent, retry-aware, tenant-scoped, and safe to log.
- Provider secrets, raw payloads, tokens, and raw provider errors must not be returned to UI/API callers or stored in worker summaries.

## Decisions

1. Provider calls execute through a `LmsProviderOperationExecutor` boundary.
   The boundary accepts normalized provider operations and returns safe execution statuses. Concrete Moodle/Canvas HTTP clients can plug into this interface later without changing Academy workflow semantics.

2. Idempotency is enforced by tenant, provider, capability, and operation idempotency key.
   Duplicate operations are suppressed before the executor is called.

3. Retry behavior is explicit.
   A provider execution may return `retryable_failure`, `permanent_failure`, or `conflict`; only retryable failures are marked retryable in the operation result.

4. Returned grades and progress stay in `pending_review`.
   LMS workers do not post official gradebook records, transcript records, standing, progress, or Student PWA release state.

## Acceptance Criteria

- Active Moodle API planning paths no longer return "contract stub is not implemented."
- Canvas and Moodle operation plans can be handed to the worker executor.
- Worker execution is sequential, idempotent, retry-aware, and safe-message only.
- Tests cover success, duplicate replay suppression, retryable provider failure, Moodle planner routing, and reviewed-import boundaries.
