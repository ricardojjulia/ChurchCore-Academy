# Canvas Provider Configuration (Phase 9 Sprint 1)

This document defines the initial Canvas adapter configuration posture for ChurchCore Academy.

## Scope

Current scope includes:

- launch mapping (identity launch capability),
- course shell provisioning plan generation,
- roster sync plan generation,
- reviewed import planning for grade and progress return.

Implemented modules:

- `src/modules/lms-contract/canvas-launch.ts`
- `src/modules/lms-contract/canvas-course-roster-sync.ts`
- `src/modules/lms-contract/canvas-grade-progress-return.ts`
- `src/modules/lms-contract/canvas-reconciliation.ts`
- `src/modules/student-pwa/canvas-launch.ts`
- `src/modules/student-pwa/lms-launch-orchestration.ts`
- `src/app/api/academy/student/lms/launch/route.ts`

## Tenant prerequisites

1. Tenant `lmsPreference.provider` must be `canvas`.
2. Tenant `lmsPreference.selectionStatus` must be `active`.
3. Canvas launch base URL must be configured.
4. Non-secret Canvas activation settings must be stored in `lms_provider_configs` with provider `canvas`, launch mode, enabled operation families, root account/context identifiers, and validation evidence.
5. Canvas secret values must stay outside Academy domain tables. `lms_provider_secret_refs` stores references only.
6. `assertProviderCanActivate` must pass before activation. Canvas activation requires passed validation evidence and required Canvas secret references, including access-token and refresh-token references for live REST calls.

If these are not true, launch responses remain `unavailable` with safe reasons.

## Security boundaries

- Never return provider secrets in launch responses.
- Keep provider credentials and raw payloads in secret storage only.
- Keep `lms_provider_configs` limited to non-secret values such as base URL, launch mode, enabled operations, root account/context identifiers, provider status, and validation evidence.
- Reject token, credential, password, private key, signature, authorization header, API key, or raw provider payload fields from non-secret Canvas config.
- Use audit-safe references in launch responses.
- Enforce tenant matching across resolved provider, request tenant, and launch configuration tenant.

## Fields used by the launch mapper

- `tenantId`
- `launchMode` (`oauth2` or `lti`)
- `launchBaseUrl`
- `displayLabel` (optional)
- `expiresInMinutes` (optional)

Secret fields may exist in configuration objects but must not be emitted.

## Grade and progress return posture

- Canvas return payloads are mapped to Academy reviewed-import records only.
- Import records are forced to `pending_review` state regardless of provider payload state.
- No Canvas return payload can directly post official grades, progress release, or transcript records.
- Idempotency keys are required for all return import plans.

## Reconciliation and checklist posture

- Reconciliation reports compare expected Academy mappings against observed Canvas state for course shells, roster memberships, reviewed-import IDs, and required capabilities.
- Provider status gating keeps reconciliation non-runnable for non-active tenants and returns explicit next actions.
- Reconciliation summaries and provider checklists must remain secret-safe.

Operational checklist themes:

- tenant-scoped API and developer-key setup,
- least-privilege scope assignment,
- HTTPS and sandbox separation,
- secret rotation and audit-safe redaction,
- interoperability-only trademark usage.

## Student PWA launch bridge posture

- Student and scoped guardian actors can generate Canvas launch responses only through Academy access-policy validation.
- Bridge logic reuses provider-neutral tenant resolution and launch shaping; no direct provider secrets are exposed.
- Cross-tenant actors and unrelated students are rejected before launch response generation.

Runtime orchestration:

- `/api/academy/student/lms/launch` resolves the acting user, loads tenant people configuration, applies student access policy, then routes launch generation to Moodle, Canvas, or no-LMS behavior.
- Launch responses remain contract-safe and return only availability fields, launch URL/expiry when available, and safe unavailable reasons otherwise.

## Next increments (Phase 9)

1. Replace bootstrap header-based actor simulation with authenticated student/guardian identity from production auth context.
