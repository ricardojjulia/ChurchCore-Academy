# LMS Contract Design

## Factory Intake

Feature: Phase 7, Sprint 1 LMS Contract Design Package.

Product area: LMS Provider Contract, No-LMS Mode, Tenant Provider Selection, Student PWA Launch Boundary, Course Shell Mapping, Roster Sync, Enrollment Sync, Grade Return, Progress Return, Webhooks, Audit, and Reconciliation.

Primary users:

- institution administrators selecting Moodle, Canvas, or no-LMS operation
- registrars managing Academy-owned courses, sections, rosters, enrollments, and official records
- teachers, professors, faculty, and advisors whose instructional data may sync to an LMS
- students and guardians using the Student PWA without receiving provider secrets or unreleased academic records
- implementation consultants configuring provider connections
- future adapter developers implementing Moodle, Canvas, and no-LMS providers

Institution modes affected:

- Bible school
- children's school
- seminary
- college
- university
- mixed institution

Data touched in this sprint: documentation only.

Runtime impact: none. This sprint does not add TypeScript interfaces, migrations, provider adapters, API routes, sync queues, webhook endpoints, credential storage, LMS launch execution, or UI changes.

Security/privacy impact: defines future boundaries for provider credentials, access tokens, webhook payloads, launch secrets, student records, guardian-visible records, grade return, provider events, and audit logs.

## Current Context

ChurchCore Academy is the faith-based education management system and SIS. It owns institution configuration, calendars, subdivisions, course catalog records, sections, people, role assignments, guardian relationships, student profiles, grading rules, official-record release decisions, and Student PWA read models.

The LMS is external. Moodle, Canvas, and no-LMS operation must sit behind one provider-neutral Academy contract. Course and section records may reference provider-neutral `CourseLmsMapping` records, but provider credentials, API URLs, tokens, webhook payloads, provider errors, retries, and external runtime state belong in the future LMS integration layer.

Phase 6 added a Student PWA with provider-neutral LMS launch placeholders. Phase 7 must define the contract before runtime launch, sync, grade return, or provider adapters exist.

## Problem

Moodle and Canvas differ in identity handoff, courses, sections, roles, enrollment states, grading, progress, webhook semantics, retry behavior, and operational hosting. No-LMS institutions need Academy to remain useful without any external course-delivery system.

If ChurchCore Academy embeds Moodle or Canvas semantics directly into Academy domain workflows, the SIS boundary weakens and no-LMS mode becomes a second-class path. If each adapter invents its own behavior, Student PWA launch, roster sync, grade return, reconciliation, and audit become inconsistent and difficult to test.

## Design Goals

1. Define one provider-neutral LMS contract before implementing adapters.
2. Support Moodle, Canvas, and no-LMS as tenant-selectable providers.
3. Preserve Academy as the SIS and official-record authority.
4. Keep provider runtime state, credentials, launch secrets, and webhook payloads out of Academy course, people, grading, and Student PWA read models.
5. Make no-LMS mode a real provider implementation, not an error state.
6. Define contract conformance tests before adapter code.
7. Require idempotent operations for provisioning, roster sync, enrollment sync, grade return, progress return, webhooks, and reconciliation.
8. Audit every provider operation that changes or imports Academy-visible state.
9. Support capability discovery so tenants can enable only provider-supported features.
10. Keep Student PWA LMS launch responses display-safe and short lived.

## Non-Goals

- Do not implement Moodle, Canvas, LTI, OAuth, OIDC, SAML, or provider API calls in this sprint.
- Do not add credential storage, token encryption, webhook endpoints, background jobs, queues, migrations, or provider settings UI in this sprint.
- Do not sync LMS activity metrics into ShepherdAI or Student PWA read models.
- Do not make Moodle or Canvas the source of truth for Academy course catalog, enrollment, grading rules, official records, transcript release, guardian access, or tenant configuration.
- Do not cache LMS launch secrets, provider tokens, grade payloads, progress payloads, or webhook payloads in the Student PWA.
- Do not require every institution to use an LMS.

## Options Considered

### Option A: Moodle-First Contract

Define the contract around Moodle External Services first and adapt Canvas later.

Pros:

- fast first-provider path
- Moodle aligns well with self-hosted faith-based institutions
- easier to document the first concrete adapter

Cons:

- risks leaking Moodle role, course, and grading assumptions into Academy
- makes Canvas parity harder
- weakens no-LMS mode

Decision: rejected.

### Option B: Canvas-First Contract

Define the contract around Canvas REST APIs and adapt Moodle later.

Pros:

- strong REST API baseline
- familiar enterprise LMS model
- useful for institutions already on Canvas

Cons:

- risks overfitting to enterprise Canvas concepts
- weaker fit for smaller schools and Bible institutes
- still does not solve no-LMS as a first-class mode

Decision: rejected.

### Option C: Adapter-Specific Branches

Create separate Moodle, Canvas, and no-LMS implementation branches in Academy logic.

Pros:

- each provider can express its native behavior
- quick adapter-specific experimentation

Cons:

- duplicates sync, audit, launch, and retry logic
- makes testing inconsistent
- couples Academy workflows to provider details
- increases risk of provider-secret leakage

Decision: rejected.

### Option D: Provider-Neutral Contract With Capability Matrix

Define a contract that every provider implements. Provider adapters expose capabilities and return normalized outcomes, errors, and audit metadata. No-LMS implements the same contract with safe non-sync behavior.

Pros:

- preserves Academy SIS boundary
- supports Moodle, Canvas, and no-LMS mode
- makes conformance tests possible
- keeps Student PWA launch provider-neutral
- supports future providers without rewriting Academy domains

Cons:

- requires upfront contract design
- some provider-specific features must be represented as optional capabilities
- adapters need reconciliation rather than direct writes into Academy records

Decision: accepted.

## Accepted Design

ChurchCore Academy will define one LMS provider contract. Moodle, Canvas, and no-LMS providers must implement it.

The contract will expose these provider families:

- identity launch and logout
- course shell provisioning
- course and section mapping review
- roster sync
- enrollment sync
- grade return
- progress return
- webhook event normalization
- audit logging
- reconciliation
- capability discovery

No-LMS mode is a provider that returns clear unsupported-capability outcomes for external launch and sync operations while allowing Academy-owned schedule, course, grading, document, and Student PWA workflows to continue.

Provider adapters must not mutate Academy official records directly. They return normalized proposed changes or imported results. Academy services decide whether those results become reviewed grades, progress records, standing changes, or official records.

## Contract Shape

The future TypeScript contract should live under `src/modules/lms-contract/` and start with pure types plus contract tests.

Recommended types:

- `LmsProviderId`: `none | moodle | canvas`
- `LmsCapability`: `identity_launch | single_logout | course_shell_provisioning | section_mapping | roster_sync | enrollment_sync | grade_return | progress_return | webhooks | reconciliation`
- `LmsProviderDescriptor`: provider id, display name, capabilities, configuration status, and operational warnings
- `LmsTenantContext`: tenant id, institution mode, supported modes, provider selection, and correlation id
- `LmsActorContext`: Academy person id, role, student context when applicable, and audit actor id
- `LmsCourseShellRequest`: Academy course, section, term, subdivision, instructors, and mapping intent
- `LmsRosterSyncRequest`: section, instructors, students, enrollment states, and relationship-safe display names
- `LmsGradeReturnBatch`: provider results mapped to Academy course/section/student identifiers and review state
- `LmsProgressReturnBatch`: provider progress summaries mapped to Academy course/section/student identifiers and review state
- `LmsLaunchRequest`: actor, target student when applicable, course/section mapping, redirect context, and nonce
- `LmsLaunchResponse`: display-safe launch status, short-lived redirect URL or unavailable reason, and audit reference
- `LmsWebhookEnvelope`: provider id, event id, tenant reference, received timestamp, signature status, and normalized event type
- `LmsOperationResult`: success, unsupported, retryable failure, permanent failure, conflict, or needs review
- `LmsAuditEvent`: tenant, provider, operation, actor, target references, correlation id, result, and redacted metadata
- `LmsReconciliationReport`: missing mappings, stale mappings, duplicate provider objects, enrollment drift, grade-return drift, and required actions

## Capability Matrix

Required baseline capabilities:

| Capability | No-LMS | Moodle | Canvas |
| --- | --- | --- | --- |
| Academy schedule/course display | yes | yes | yes |
| Student PWA launch status | unavailable | supported when configured | supported when configured |
| Course shell provisioning | unsupported | optional | optional |
| Section mapping | not required | supported | supported |
| Roster sync | unsupported | optional | optional |
| Enrollment sync | unsupported | optional | optional |
| Grade return | unsupported | optional reviewed import | optional reviewed import |
| Progress return | unsupported | optional reviewed import | optional reviewed import |
| Webhooks | unsupported | optional | optional |
| Reconciliation | no-op report | supported | supported |

Provider-specific capabilities may exceed the common baseline, but Academy workflows must branch on declared capabilities rather than provider names.

## Student PWA Boundary

The Student PWA may request LMS launch state only through a future Academy read model or server action that uses the provider contract.

Student PWA responses must not include:

- provider access tokens
- refresh tokens
- shared secrets
- webhook signatures
- raw provider payloads
- provider API URLs that are not intended for launch
- unreleased grades
- transcript hold reasons
- cross-student guardian data

Launch responses may include:

- display label
- availability state
- short-lived launch URL when authorized
- safe unavailable reason
- audit reference

The service worker must not cache launch responses.

## Sync And Review Boundary

Academy remains authoritative for:

- tenant configuration
- people and roles
- guardian relationships
- course catalog and sections
- enrollment records
- grading rules
- official records
- release decisions
- transcript holds

Provider returns are inputs to Academy review workflows. Grade return and progress return must enter a reviewed state before Student PWA or official-record surfaces display them.

## Audit And Reconciliation Boundary

Every provider operation must carry a correlation id and produce an audit event. Audit events must be redacted and tenant-scoped.

Reconciliation must detect:

- missing course or section mappings
- stale provider mappings
- duplicate provider shells
- roster drift
- enrollment drift
- grade return drift
- progress return drift
- provider capability mismatch
- webhook replay or duplicate event ids

Reconciliation reports should recommend Academy-owned actions but should not silently rewrite official records.

## Security And Privacy Rules

- Store provider secrets only in the future LMS integration configuration layer.
- Never store provider secrets in course catalog, people, grading, official-record, Student PWA, or ShepherdAI data.
- Webhook signature verification must happen before normalization.
- Idempotency keys are required for provider-mutating operations.
- Provider event ids must be deduplicated per tenant and provider.
- Launch responses must be short lived and actor scoped.
- Guardian launch access must depend on active relationship scope and target-student visibility.
- Staff preview must be audited separately from student self-access.
- Provider errors shown to students must be safe summaries, not raw provider messages.

## Sprint Decomposition

Phase 7 should proceed as:

1. LMS contract design package.
2. Provider-neutral interfaces and contract tests.
3. No-LMS provider implementation.
4. Tenant provider selection.
5. Sync audit and reconciliation model.

Later phases can add Moodle and Canvas adapters after the contract suite is stable.

## Review Checklist

- The contract is provider-neutral and does not encode Moodle or Canvas as the source of truth.
- No-LMS mode is explicitly supported.
- Student PWA launch remains display-safe and non-cacheable.
- Grade and progress return are reviewed before official display.
- Provider secrets and raw webhook payloads stay outside Academy domain records.
- Capability checks use declared capabilities, not provider-name branching.
- Contract tests are required before adapter implementation.
