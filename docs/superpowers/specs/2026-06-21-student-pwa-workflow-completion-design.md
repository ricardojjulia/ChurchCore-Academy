# Student PWA Workflow Completion Design

Date: 2026-06-21
Factory slice: Full SIS Competitive MVP Task 8

## Goal

Make the Student PWA behave as an operational student self-service surface instead of a placeholder shell.

## Scope

- Student registration visibility must be self-scoped for student actors.
- Student schedule and courses continue to read released registration-derived records.
- Student documents must expose a real transcript request action through the governed transcript API.
- Student billing, aid, messages, LMS launch, attendance, progress, and privacy routes must remain authenticated, dynamic, and release-safe.
- Offline behavior must keep sensitive dynamic data out of cache.

## Decisions

1. Student PWA registration visibility is read-only in this slice.
   Registrar/admin registration mutations remain staff-controlled because eligibility, capacity, holds, prerequisites, billing, and academic-period registration rules are not safe to bypass from the mobile PWA.

2. Student transcript requests use `/api/academy/transcripts` with `action: "request"` and an idempotency key.
   Registrar issuance, holds, release, and revocation remain staff workflows.

3. Student routes should use operational empty states, not sprint placeholder copy.
   Empty state text must explain what data is missing and what workflow populates it.

4. The Student PWA notification affordance should route to persisted in-app messages.

## Security And Privacy

- Student registration API reads must include `student_person_id = actor.userId` unless the actor has registration management authority.
- Student route data remains loaded through verified session identity and tenant-scoped database context.
- Offline cache may include only non-sensitive shell resources.
- Transcript requests cannot specify another student unless the actor has transcript admin authority.
- Payment actions may create provider-safe intents but must not collect or store card data.

## Acceptance Criteria

- `GET /api/academy/registrations` returns only the verified student's rows for student actors.
- Registrar/admin actors can still read tenant registration rosters.
- Student documents expose a transcript request action with an idempotency key.
- Student PWA route/component files do not contain placeholder sprint language.
- Offline policy tests confirm no sensitive student routes, RSC payloads, API responses, documents, messages, grades, or provider data are cached.
