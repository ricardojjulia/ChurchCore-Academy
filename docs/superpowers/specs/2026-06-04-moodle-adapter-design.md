# Moodle Adapter Design

## Factory Intake

Feature: Phase 8, Sprint 1 Moodle adapter design package.

Product area: Moodle adapter, LMS provider contract conformance, identity launch, course shell provisioning, roster sync, enrollment sync, grade/progress return, reconciliation, provider documentation, and credential boundary.

Primary users:

- institution administrators choosing Moodle as the tenant LMS
- registrars and academic administrators managing Academy-owned courses, sections, rosters, enrollments, grades, and official records
- teachers, professors, and instructors whose course sections may be provisioned or synced to Moodle
- students and guardians launching learning from the Student PWA
- implementation consultants configuring Moodle Web Services and identity integration
- future adapter developers implementing Moodle runtime behavior

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched in this sprint: documentation only.

Runtime impact: none. This sprint does not add Moodle API calls, credential storage, migrations, webhooks, background jobs, API routes, UI, or provider adapter code.

Security/privacy impact: defines future boundaries for Moodle tokens, endpoint URLs, OIDC/LTI configuration, raw Moodle payloads, grade/progress imports, audit events, reconciliation reports, and Student PWA launch responses.

## Current Context

ChurchCore Academy now has a provider-neutral LMS contract, a no-LMS provider, tenant provider selection, and storage-free sync audit/reconciliation foundations.

Moodle is the first external provider because it is open source, self-hostable, customizable, and operationally realistic for many faith-based schools and Bible institutes. Moodle must remain an external delivery runtime. Academy remains the SIS authority for institution configuration, people, roles, guardian relationships, course catalog, sections, enrollment records, grading rules, official-record release, transcript holds, and Student PWA display.

Official Moodle documentation confirms that Moodle exposes a Web Service framework and External API for external systems. Moodle Web Services require explicit setup: enabling web services, enabling protocols, creating services, adding functions, assigning capabilities, and creating tokens. Moodle also supports LTI Advantage publication flows and OIDC authentication patterns, but those are separate setup surfaces and must not be conflated with REST Web Service tokens.

## Problem

The Moodle adapter must translate Academy's provider-neutral LMS contract into Moodle-specific operations without letting Moodle concepts leak into Academy domain records.

The adapter must answer:

- how Academy identities map to Moodle users and launch flows
- how Academy courses and sections map to Moodle courses, groups, cohorts, enrolments, or other Moodle structures
- how roster and enrollment sync remain idempotent
- how grade/progress return enters Academy review workflows
- how Moodle errors, retries, raw payloads, and token failures become safe contract results
- how reconciliation detects drift without silently rewriting official records
- how implementation teams configure Moodle securely

## Design Goals

1. Implement Moodle through the existing provider-neutral contract, not through Academy domain branching.
2. Keep Moodle tokens, endpoint URLs, raw payloads, and provider errors outside Academy domain records and Student PWA read models.
3. Require Moodle Web Service function allowlists and least-privilege capabilities.
4. Treat Moodle identity launch separately from Moodle Web Service sync credentials.
5. Support no-LMS and future Canvas parity by mapping only through common contract operations.
6. Keep grade and progress returns as reviewed imports before official display.
7. Require idempotency keys for provider-mutating and import operations.
8. Require redacted audit events and reconciliation summaries for every sync family.
9. Define Moodle adapter conformance tests before runtime implementation.
10. Document required Moodle configuration and trademark/deployment notes.

## Non-Goals

- Do not implement Moodle Web Service calls in this sprint.
- Do not store Moodle access tokens, OIDC secrets, LTI keys, endpoint URLs, or webhook secrets in this sprint.
- Do not add Moodle migrations, API routes, background jobs, webhooks, UI, Docker profiles, or environment variables in this sprint.
- Do not implement Canvas behavior.
- Do not make Moodle the source of truth for Academy courses, enrollments, grades, official records, guardian visibility, or Student PWA display.
- Do not read Moodle activity/engagement metrics into ShepherdAI.
- Do not cache Moodle launch responses or tokens in the Student PWA.

## Options Considered

### Option A: Moodle REST Adapter Only

Use Moodle Web Services for provisioning, roster sync, enrollment sync, grade/progress return, and launch URLs.

Pros:

- one integration mechanism
- aligns with Moodle Web Service setup
- straightforward for server-to-server operations

Cons:

- Web Service tokens are not the right abstraction for student browser launch
- risks exposing provider tokens if launch is treated as an API response
- does not solve SSO/OIDC/LTI launch requirements

Decision: rejected as the whole adapter model, but accepted for server-to-server sync families.

### Option B: LTI-First Moodle Adapter

Use LTI Advantage as the primary Moodle integration model.

Pros:

- strong launch and learning-tool semantics
- supports OIDC-based LTI 1.3 security model
- can carry grade and roster service concepts

Cons:

- Moodle's LTI documentation primarily describes Moodle as an LTI tool/provider for published content, while Academy needs Moodle as an external LMS provider
- overfits launch before course/roster sync requirements are stable
- may add operational complexity for smaller schools

Decision: rejected as the whole adapter model, but retained as a future launch option to evaluate where Moodle deployment supports it.

### Option C: OIDC Launch Plus Web Services Sync

Use OIDC or a configured launch mechanism for identity handoff, and Moodle Web Services for server-to-server provisioning, roster, enrollment, grade/progress import, audit, and reconciliation.

Pros:

- separates browser launch from server-to-server sync credentials
- keeps Moodle tokens out of the Student PWA
- maps cleanly to the provider-neutral contract
- supports least-privilege Web Service function allowlists
- preserves future Canvas parity

Cons:

- requires two setup surfaces
- needs clear implementation documentation
- OIDC availability depends on Moodle plugin/configuration posture

Decision: accepted as the design direction.

### Option D: Moodle-As-Source-Of-Truth

Mirror Moodle courses, users, enrollments, grades, and progress directly into Academy records.

Pros:

- simpler for Moodle-heavy institutions
- reduces early reconciliation decisions

Cons:

- violates Academy's SIS boundary
- weakens no-LMS and Canvas parity
- risks exposing draft/provider data in official records and Student PWA surfaces
- makes provider migration difficult

Decision: rejected.

## Accepted Design

The Moodle adapter will be implemented as an external provider adapter behind the provider-neutral LMS contract.

Future runtime code should live under a dedicated Moodle adapter module, for example:

```text
src/modules/lms-contract/
  moodle-adapter.ts
  moodle-adapter.types.ts
  __tests__/moodle-adapter-contract.test.ts
```

The adapter must depend on `LmsTenantContext`, `LmsActorContext`, `LmsCourseShellRequest`, `LmsRosterSyncRequest`, `LmsGradeReturnBatch`, `LmsProgressReturnBatch`, `LmsLaunchRequest`, `LmsOperationResult`, `LmsAuditEvent`, and `LmsReconciliationReport`.

The adapter may translate those contract objects into Moodle-specific function calls internally, but Moodle-specific fields must not be returned to Academy domain models or Student PWA read models.

## Contract Mapping

### Identity Launch And Logout

Moodle launch is not a Web Service token response.

The Moodle adapter should support a display-safe launch result:

- `available` only when tenant provider selection is active and launch configuration exists
- short-lived launch URL or redirect action when authorized
- safe unavailable reason when not configured
- audit reference

The Student PWA must never receive Moodle Web Service tokens, OIDC secrets, LTI keys, raw Moodle user identifiers, or raw provider payloads.

OIDC and LTI launch options should be treated as deploy-time Moodle configuration choices. The adapter contract should expose the normalized launch response, not the underlying OIDC/LTI internals.

### Course Shell Provisioning

Academy courses and sections remain the source of truth. Moodle course shells are external runtime objects.

The adapter should map:

- Academy course and section identifiers to Moodle course/group/cohort identifiers
- `CourseLmsMapping.mappingStatus` to provisioning outcomes
- `CourseLmsSyncPolicy` to supported sync capabilities
- idempotency keys to prevent duplicate Moodle course shell creation

Moodle external identifiers belong in provider mapping/audit records, not in the core Academy course or section records.

### Roster And Enrollment Sync

Roster and enrollment sync must be idempotent and tenant scoped.

The adapter should normalize:

- Academy person ids to Moodle user references
- Academy staff/student roles to Moodle-compatible roles
- Academy section membership to Moodle enrollment or group membership
- paused/withdrawn/completed states to safe Moodle outcomes

Guardian relationships must not create Moodle access unless a future explicit business rule allows it.

### Grade And Progress Return

Moodle grade/progress values are imports, not official records.

The adapter should return proposed grade/progress batches in `pending_review` or another reviewed-import state. Academy review workflows decide whether results become visible in Student PWA, transcripts, progress records, completion records, standing, promotion, or graduation readiness.

Raw Moodle gradebook payloads must not be stored in official records or Student PWA read models.

### Webhooks, Audit, And Reconciliation

Moodle may not provide identical webhook semantics across deployments. The adapter should start with reconciliation-first behavior and support webhook/event normalization only when deployment capabilities are confirmed.

Every Moodle operation must produce:

- correlation id
- idempotency key where required
- redacted audit event
- safe operation result
- reconciliation input when applicable

Reconciliation must detect:

- missing Moodle mappings
- stale Moodle mappings
- duplicate Moodle course shells
- roster drift
- enrollment drift
- grade return drift
- progress return drift
- capability mismatch
- duplicate provider event ids

Reconciliation reports should recommend Academy-owned actions; they should not silently rewrite official records.

## Configuration Requirements

Future Moodle setup documentation must include:

- Moodle base URL
- Moodle version/support baseline
- Web Services enabled only when used
- REST protocol enabled when REST sync is used
- custom External Service with only required functions
- required capabilities for each selected Web Service function
- service user or authorized users
- token creation with IP restriction and expiration where feasible
- OIDC or launch configuration when launch is enabled
- LTI configuration only if chosen for launch or content workflow
- deployment notes for HTTPS and frame/embed behavior where relevant

## Security And Privacy Rules

- Store Moodle credentials only in the future provider configuration/secret layer.
- Never return Moodle tokens, OIDC secrets, LTI keys, raw payloads, or internal Moodle errors to Student PWA.
- Redact provider metadata in audit events.
- Use idempotency keys for mutating operations.
- Deduplicate provider event ids per tenant and provider.
- Treat Moodle grade/progress returns as reviewed imports.
- Keep Moodle activity/engagement metrics out of ShepherdAI until a separate privacy review explicitly approves them.
- Use least-privilege Moodle Web Service functions and capabilities.

## Contract Test Strategy

Future implementation must add mocked Moodle contract tests for:

- provider descriptor and capability matrix
- tenant provider selection active/planned/paused behavior
- safe launch unavailable and available responses
- provider-secret exclusion from launch results and audit events
- course shell provisioning idempotency
- roster/enrollment sync idempotency
- grade/progress return reviewed-import status
- Moodle error normalization into safe `LmsOperationResult`
- webhook duplicate detection where webhook support exists
- reconciliation report drift summaries

## Credential And Endpoint Boundary

Future runtime work must create a tenant-scoped provider configuration and secret layer before any live Moodle network call is added.

Allowed non-secret configuration includes:

- tenant id
- provider id
- Moodle base URL
- selected launch mode
- enabled sync families
- capability summary
- provider status
- credential rotation timestamp

Secret material must be stored only through the future secret mechanism:

- Moodle Web Service tokens
- OIDC client secrets
- LTI private keys or shared secrets
- webhook secrets
- refresh tokens
- private signing keys

Provider selection, audit events, reconciliation summaries, Student PWA read models, ShepherdAI inputs, Academy course records, Academy person records, grading records, and transcript records must never include provider secrets or raw Moodle payloads.

## Source Notes

- Moodle Web Services setup requires enabling web services and protocols, creating services, adding functions, assigning capabilities, and creating tokens: https://docs.moodle.org/en/Using_web_services
- Moodle's External Services documentation describes the Web Service framework and live-site API documentation location: https://moodledev.io/docs/5.0/apis/subsystems/external
- Moodle LTI Advantage documentation describes LTI 1.3/OIDC security, registration, launch URLs, and related services: https://docs.moodle.org/en/Publish_as_LTI_tool
- Moodle OIDC documentation describes redirect-based authentication configuration and user restrictions: https://docs.moodle.org/en/auth_oidc

## Review Checklist

- Moodle remains an external provider, not the Academy source of truth.
- Moodle runtime details do not enter Academy domain records.
- Moodle secrets are isolated to a future secret/configuration layer.
- Student PWA launch is display-safe and non-cacheable.
- Grade/progress return requires Academy review.
- Contract conformance tests precede runtime implementation.
- Required Moodle administrator setup is documented before pilot use.
