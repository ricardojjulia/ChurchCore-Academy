# Council Review XII — Full Moodle And Canvas Integration MVP Closeout

**Date:** 2026-06-26  
**Scope:** Close out the full Moodle and Canvas integration MVP implementation against ADR-0059  
**Requested by:** Ricardo Julia  
**Reported to:** ChurchCore Academy Software Factory  
**Decision output:** Implementation complete for Academy-owned LMS integration surfaces; production activation remains evidence-gated

## Executive Verdict

The Academy-owned full LMS integration implementation is complete for MVP closeout under ADR-0059.

The repository now contains the core Moodle and Canvas integration surfaces required for a controlled-pilot readiness claim:

- tenant-scoped provider configuration and secret-reference storage;
- live Moodle Web Services HTTP client behavior;
- live Canvas REST/OAuth and SIS import client behavior;
- durable LMS operation job queue with idempotency, retry, circuit blocking, audit, and operational-event handling;
- Student PWA launch boundaries for Moodle and Canvas;
- reviewed grade/progress return boundaries that do not auto-post official records;
- reconciliation parity for Moodle and Canvas;
- institution-admin LMS readiness surface at `/admin/settings/lms`;
- provider activation and LMS worker runbooks;
- release evidence note with required external sandbox evidence.

Production activation is not complete. Moodle and Canvas must still attach real sandbox or tenant test-instance evidence before the product can claim production-ready LMS activation. The correct status is therefore:

| Area | Decision |
| --- | --- |
| Academy-owned implementation | Complete for MVP closeout |
| Controlled-pilot readiness | Eligible with providers disabled or sandbox-gated |
| Moodle production activation | Deferred until sandbox evidence is attached |
| Canvas production activation | Deferred until sandbox evidence is attached |
| General availability LMS claim | Not approved |

## Implementation Evidence

### Provider Configuration And Secret Boundary

Implemented:

- `src/modules/lms-contract/provider-activation.ts`
- `supabase/migrations/20260626020000_lms_provider_activation.sql`
- `src/modules/lms-contract/__tests__/provider-activation.test.ts`

Coverage:

- Moodle and Canvas non-secret provider config shape;
- provider config validation rejecting token, secret, password, key, signature, authorization, credential, and raw-payload fields;
- activation requiring active status, passed validation evidence, and required secret references;
- cross-tenant provider config read/write rejection;
- migration coverage for `lms_provider_configs`, `lms_provider_secret_refs`, RLS, and tenant policies.

### Live Provider Transport

Implemented:

- `src/modules/lms-contract/moodle-http-client.ts`
- `src/modules/lms-contract/canvas-http-client.ts`
- `src/modules/lms-contract/canvas-sis-import.ts`
- `src/modules/lms-contract/__tests__/moodle-http-client.test.ts`
- `src/modules/lms-contract/__tests__/canvas-http-client.test.ts`
- `src/modules/lms-contract/__tests__/canvas-sis-import.test.ts`

Coverage:

- Moodle REST Web Services request construction;
- Moodle exception-in-200 handling;
- retryable and permanent provider failure classification;
- Canvas bearer-token REST request handling;
- Canvas OAuth/token refresh boundary coverage;
- Canvas SIS import safety checks and batch-mode guardrails;
- redaction of provider secrets and raw payloads from safe outputs.

### Durable Worker And Idempotency

Implemented:

- `src/modules/lms-contract/lms-execution-worker.ts`
- `supabase/migrations/20260626030000_lms_operation_jobs.sql`
- `src/modules/lms-contract/__tests__/lms-execution-worker.test.ts`
- `docs/runbooks/lms-execution-workers.md`

Coverage:

- queued durable LMS jobs;
- unique tenant/provider/operation-family/idempotency-key replay suppression;
- retryable failure handling and exhaustion;
- circuit-open blocking before provider calls;
- circuit reset after success;
- admin notification and operational event emission;
- cross-tenant job execution rejection;
- secret-safe persisted payloads, audit metadata, and operational events.

### Launch, Reviewed Imports, And Reconciliation

Implemented:

- `src/modules/lms-contract/moodle-launch.ts`
- `src/modules/lms-contract/canvas-launch.ts`
- `src/modules/lms-contract/moodle-grade-progress-return.ts`
- `src/modules/lms-contract/canvas-grade-progress-return.ts`
- `src/modules/lms-contract/moodle-reconciliation.ts`
- `src/modules/lms-contract/canvas-reconciliation.ts`
- corresponding Moodle and Canvas tests under `src/modules/lms-contract/__tests__/`

Coverage:

- Student and scoped guardian launch response safety;
- Moodle and Canvas grade/progress return reviewed-import status;
- no automatic promotion into official Academy records;
- course shell, roster, grade return, progress return, mapping, capability, and credential-health reconciliation;
- provider-secret and raw-provider-payload exclusion.

### Admin Activation Surface

Implemented:

- `src/modules/lms-contract/provider-readiness.ts`
- `src/app/admin/settings/lms/page.tsx`
- `src/app/api/academy/lms/readiness/route.ts`
- `src/modules/lms-contract/__tests__/provider-readiness.test.ts`
- `src/app/api/academy/lms/readiness/route.test.ts`

Coverage:

- role-gated provider readiness model;
- Moodle and Canvas readiness cards;
- activation status, validation status, circuit state, last sync, last failure, sandbox evidence, pause, and resume states;
- production-ready status only when both Moodle and Canvas evidence is recorded.

### Documentation And Release Evidence

Implemented:

- `docs/releases/2026-06-26-full-lms-integration-readiness.md`
- `docs/runbooks/provider-activation.md`
- `docs/runbooks/lms-execution-workers.md`
- `docs/integrations/moodle-provider-configuration.md`
- `docs/integrations/canvas-provider-configuration.md`
- `docs/product/factory-roadmap.md`

Coverage:

- external sandbox evidence checklist;
- Moodle and Canvas activation prerequisites;
- rollback procedure;
- provider pause/resume operating rule;
- production activation deferral until tenant owner approval and sandbox evidence exist.

## Council Agent Findings

### Agent 1 — Architecture

Pass. The provider-neutral contract remains the correct boundary. Moodle and Canvas operations now flow through shared operation families, worker execution, reviewed imports, and reconciliation. UI and API routes expose status and enqueue/status boundaries rather than provider transport details.

### Agent 2 — Security And Privacy

Pass for implementation. Provider secrets are excluded from provider config records, browser responses, Student PWA models, guardian models, audit metadata, worker payloads, and operational events. Tests cover secret-shaped config rejection, recursive redaction, cross-tenant rejection, and secret-safe worker failure handling.

Production activation still requires external evidence that real tenant secrets are configured only in the approved secret layer.

### Agent 3 — Product And UX

Pass for MVP closeout. Institution administrators have a focused LMS settings surface showing provider status, credential validation posture, last sync/failure status, circuit state, activation checklist evidence, and safe pause/resume affordances.

The page intentionally avoids a broad integration dashboard. It is an operator readiness surface, not a provider control center that silently mutates production state.

### Agent 4 — Competitive Readiness

Pass for controlled-pilot implementation. Academy can truthfully claim Moodle and Canvas integration implementation exists behind a provider-neutral SIS boundary.

Do not claim production-ready Moodle or Canvas activation until the release evidence file contains real sandbox or tenant test-instance proof for launch, course shell sync, roster sync, grade/progress return, reconciliation, failure recovery, rollback, and secret redaction.

### Wildcard — Failure Mode Review

Pass with activation gate retained. The main failure mode was mock-only confidence. The implementation keeps production readiness blocked until sandbox evidence is attached in `docs/releases/2026-06-26-full-lms-integration-readiness.md`.

## External Activation Gate

The following work is intentionally outside the code closeout and must be completed with real provider environments:

1. Attach Moodle sandbox evidence proving credential validation, course shell sync, roster sync, Student PWA launch, reviewed grade/progress return, reconciliation, rollback, and secret redaction.
2. Attach Canvas sandbox evidence proving OAuth/token refresh, course shell sync, roster sync, Student PWA launch, reviewed grade/progress return, SIS import guardrails, reconciliation, rollback, and secret redaction.
3. Record tenant owner approval and provider owner signoff before production activation.
4. Keep general availability claims blocked until both provider evidence sets are recorded.

## Factory Decision

Close Council Review XII as implemented for the Academy-owned full LMS integration MVP.

Production activation remains deferred. The roadmap and release note must continue to distinguish code-complete LMS integration from live provider activation until Moodle and Canvas sandbox evidence is attached.
