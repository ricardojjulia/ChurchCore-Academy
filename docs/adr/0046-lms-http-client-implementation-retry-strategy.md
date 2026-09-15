# ADR-0046 — LMS HTTP Client Implementation and Retry Strategy

**Date:** 2026-06-22
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)

---

## Context

ADR-0014 established a provider-neutral LMS contract with Moodle and Canvas adapter designs. The contract module (`src/modules/lms-contract/`) contains complete operation schemas, capability declarations, adapter skeletons, and an execution-worker boundary. All `execute()` methods in both adapters produce operation plans and audit events but contain zero real HTTP calls.

The consequence is that students cannot launch Moodle or Canvas courses from the Student PWA. Enrollment sync, grade return, and course URL generation all produce plausible-looking audit records without touching any external system. The integration is a stub behind a complete interface.

The competitive roadmap (docs/competitive-roadmap.md, T3-03) identifies LMS live HTTP integration as a Tier 3 feature. The provider-neutral contract is the correct foundation; what is missing is a real HTTP transport layer and an explicit decision about retry, circuit-breaking, and error classification.

This ADR records the implementation strategy for completing the Moodle adapter to production readiness, establishing the HTTP client pattern that the Canvas adapter will follow.

---

## Decision

### 1. MoodleHttpClient

Add `src/modules/lms-contract/moodle-adapter/moodle-http-client.ts` implementing a `MoodleHttpClient` class. This class is the sole component that issues `fetch()` calls to a Moodle instance. No other file in the adapter may call `fetch()` directly.

Responsibilities:

- Accept `baseUrl` and `wstoken` at construction time; never read them from `process.env` — the calling adapter resolves credentials from the encrypted credential store before constructing the client (ADR-0016).
- Build Moodle Web Services REST API request URLs in the format `{baseUrl}/webservice/rest/server.php?wstoken={token}&moodlewsrestformat=json&wsfunction={fn}`.
- Parse JSON responses. Detect Moodle-specific error responses where the JSON body contains an `exception` field (Moodle returns HTTP 200 even for server-side errors) and map them to `LmsProviderError` with `code`, `message`, and `httpStatus: 200`.
- Map genuine HTTP 4xx and 5xx responses to `LmsProviderError` with `retryable: false` for 4xx and `retryable: true` for 5xx.
- Map network errors (`TypeError` from `fetch`) to `LmsProviderError` with `retryable: true`.

### 2. First operations to implement

The following Moodle Web Services functions are implemented in order:

1. `enrollUser` — `enrol_manual_enrol_users` — enroll a student in a Moodle course
2. `getCourseUrl` — `core_course_get_courses_by_field` + token-based launch URL construction — return a direct launch URL for the Student PWA
3. `syncGrades` — `gradereport_user_get_grade_items` — retrieve posted grade items for a student in a course

Each operation reads its parameters from the provider-neutral operation schema, calls the HTTP client, and maps the result to the provider-neutral operation result shape declared in ADR-0014.

### 3. Retry strategy

`MoodleHttpClient` applies automatic retry only for `retryable: true` errors:

- Maximum 3 attempts (1 original + 2 retries).
- Exponential backoff: wait 1 second before retry 1, 2 seconds before retry 2.
- Jitter: add a random 0–500 ms offset to each backoff interval to reduce thundering-herd against a shared Moodle instance.
- Non-retryable conditions (4xx responses, Moodle `exception` responses, token-invalid errors) fail immediately and produce an audit event without retry.

### 4. Circuit breaker

A per-tenant circuit breaker is maintained in Postgres (`academy_lms_circuit_breaker` table with columns `tenant_id`, `provider`, `failure_count`, `tripped_at`, `resume_at`):

- After 5 consecutive failures against a tenant's Moodle instance, the circuit breaker is tripped: `tripped_at` is set, `resume_at` is set to 15 minutes from now.
- While tripped, the execution worker skips LMS operations for that tenant and produces an audit event with `result: circuit_open`.
- On trip, an entry is posted to the communications queue (ADR-0040) to notify the institution admin.
- The circuit resets automatically when `resume_at` passes and the next operation succeeds. A manual reset UI is available to institution admins.
- Consecutive failure count resets on any successful operation.

### 5. Canvas adapter

The Canvas adapter follows the identical pattern using `src/modules/lms-contract/canvas-adapter/canvas-http-client.ts`:

- Canvas REST API with OAuth2 Bearer token in the `Authorization` header.
- Canvas returns genuine HTTP error codes; there is no `exception`-in-200 pattern to detect.
- Retry, circuit breaker, and audit event behavior are identical to the Moodle pattern.
- Canvas adapter implementation is deferred to Tier 4 (T4-05); the HTTP client class is scaffolded now so the pattern is established.

### 6. Credential access

LMS credentials (base URL, tokens, OAuth2 secrets) are stored encrypted per ADR-0016 in the credential store. The execution worker resolves credentials before constructing `MoodleHttpClient` or `CanvasHttpClient`. Neither HTTP client class nor any adapter operation function reads from `process.env`, request headers, or Academy domain records.

### 7. Audit events

Every real HTTP call — success or failure — produces an immutable audit event per ADR-0019 containing:

- `tenant_id`, `actor_id` (the worker service account), `action` (e.g., `lms.enroll_user`)
- `entity_ref`: the operation's primary entity (student ID, section ID)
- `result`: `success`, `provider_error`, `network_error`, `circuit_open`, `retries_exhausted`
- `metadata`: HTTP status code, Moodle function name, attempt count — no token values, no raw response bodies

Raw provider payloads, tokens, webhook signatures, and secret-shaped fields are prohibited from audit metadata per ADR-0019.

---

## Consequences

- Students can launch Moodle courses from the Student PWA once `getCourseUrl` is wired to the launch button.
- Enrollment and grade sync move from stub to real; LMS and Academy records can diverge and be reconciled.
- The retry and circuit-breaker rules mean a Moodle outage does not cascade into Academy availability; it surfaces to admins within one circuit-break cycle.
- The execution worker must be deployed as a Vercel background function or separate worker process; HTTP calls cannot run inside SSR request handlers due to timeout constraints.
- All adapter operations must be idempotent; the retry layer may call the same Moodle function more than once.
- Moodle Web Services must be enabled on the institution's Moodle instance and a service token provisioned before any operation can succeed; the admin credential setup UI is a prerequisite.

---

## Alternatives Considered

**Direct `fetch()` calls inside adapter operation methods:**

- Rejected. Scatters retry logic, error classification, and audit instrumentation across every operation. A single HTTP client class centralizes all transport concerns.

**Third-party Moodle SDK / npm package:**

- Rejected. No well-maintained TypeScript-first Moodle SDK exists. Adding a dependency for this surface would require documenting a reason in the PR per CLAUDE.md. Native `fetch()` with a thin wrapper is sufficient and adds no bundle weight on the server path.

**Polling-based grade sync instead of explicit sync operation:**

- Rejected. Polling produces unnecessary Moodle API load and makes sync timing unpredictable. Explicit sync triggered by the Academy enrollment workflow is deterministic and auditable.

**In-memory circuit breaker (per-process):**

- Rejected. Vercel serverless functions do not share in-memory state across invocations. The circuit breaker must be durable in Postgres so all worker invocations respect the same trip state.

**MoodleHttpClient with retries and Postgres circuit breaker:**

- Accepted. Centralizes transport, retry, and circuit protection while keeping all state durable and auditable.

---

## Review Notes

- Product boundary: the HTTP client and adapter operations belong entirely inside `src/modules/lms-contract/`. No LMS transport code may appear in Academy course catalog, people, grading, official-records, or Student PWA modules.
- Security/privacy: tokens must never be logged, included in audit metadata, or passed through request context. The credential store is the only source of LMS tokens.
- Testing: unit tests must cover success mapping, Moodle `exception`-in-200 detection, 4xx non-retry, 5xx retry with backoff, retry exhaustion, circuit trip at failure threshold, circuit resume after `resume_at`, and audit event shape (using `doesNotMatch` to assert token fields are absent).
- Rollback: the `academy_lms_circuit_breaker` table and HTTP client are additive. Disabling the execution worker pauses all LMS HTTP calls without removing any Academy data.

---

## Related

- ADR-0014 — LMS provider contract and no-LMS mode (the contract this HTTP client fulfills)
- ADR-0016 — Credential store and encryption at rest (source of LMS tokens)
- ADR-0019 — Immutable audit events and outbox boundary (audit event requirement for every HTTP call)
- ADR-0040 — Email delivery provider (communications queue used for circuit-break admin notifications)
