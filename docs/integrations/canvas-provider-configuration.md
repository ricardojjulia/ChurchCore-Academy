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
7. Canvas OAuth/developer-key setup must provide the scopes needed by the enabled operation families. Access tokens are bearer tokens and refreshed only through the provider secret boundary.

If these are not true, launch responses remain `unavailable` with safe reasons.

## Security boundaries

- Never return provider secrets in launch responses.
- Keep provider credentials and raw payloads in secret storage only.
- Keep `lms_provider_configs` limited to non-secret values such as base URL, launch mode, enabled operations, root account/context identifiers, provider status, and validation evidence.
- Reject token, credential, password, private key, signature, authorization header, API key, or raw provider payload fields from non-secret Canvas config.
- Refresh expired Canvas access tokens through the server-side token refresher only; never persist refreshed token values in ordinary Academy domain tables.
- Use audit-safe references in launch responses.
- Enforce tenant matching across resolved provider, request tenant, and launch configuration tenant.

## OAuth And REST Transport

Canvas REST calls use HTTPS and `Authorization: Bearer <token>` headers. The live client retries a request once after a 401 only when a server-side token refresher is configured. If refresh is unavailable or the refreshed request still fails, the error remains non-retryable and safe for audit/log surfaces.

Required REST scopes depend on the enabled operation families:

- course shell sync: account/course read and course update/create scopes;
- roster sync: enrollment read and enrollment update/create scopes;
- grade/progress return: submission, grade, outcome, or progress read scopes selected for the tenant's Canvas model;
- reconciliation: read scopes for courses, sections, enrollments, assignments/submissions, and account capability checks.

## SIS Import Guardrails

Canvas SIS Import is optional and high risk. Academy disables SIS import by default and treats it separately from normal REST operations.

- `sisImportEnabled` must be explicitly true before any SIS import request is built.
- Batch mode is disabled by default because Canvas batch imports can remove courses, sections, and enrollments.
- Batch mode requires both `batchModeEnabled: true` and a `batchModeChangeThreshold` that is greater than or equal to the proposed change count.
- SIS import audit metadata may include CSV kind, batch flag, change count, threshold, and idempotency key, but not CSV row contents.
- Non-batch REST operations remain the preferred path for routine course and roster updates.

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

## Readiness Surface

Administrators review Canvas activation status at `/admin/settings/lms`. Production activation remains deferred until the Canvas sandbox evidence section in `docs/releases/2026-06-26-full-lms-integration-readiness.md` is complete.

## Next increments (Phase 9)

1. Replace bootstrap header-based actor simulation with authenticated student/guardian identity from production auth context.
