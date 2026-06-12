# Phase 9 Sprint 1-6: Canvas Adapter + Student LMS Orchestration

## Goal

Start Phase 9 by adding Canvas launch, sync planning, reviewed return-import planning, reconciliation implementations, Student PWA bridge support, and runtime Student LMS orchestration under the provider-neutral LMS contract.

## Delivered

1. Canvas launch module with tenant checks and safe launch responses.
2. Canvas course shell provisioning and roster sync planning module with tenant and idempotency safeguards.
3. Canvas grade and progress return reviewed-import planning with review-only guardrails.
4. Canvas reconciliation reporting and provider checklist parity.
5. Student PWA Canvas launch bridge support with authorization and redaction tests.
6. Student LMS runtime launch orchestration with provider routing and access-policy enforcement.
7. Contract-focused tests covering:
- active and configured launch availability,
- unavailable behavior for missing/incomplete config,
- provider status gating (`planned`, `paused`, `migration_required`),
- cross-tenant rejection,
- response secret-safety posture,
- course shell and roster sync planning behavior.
- reviewed grade/progress import behavior,
- reconciliation drift and docs checklist behavior,
- student and guardian Canvas launch bridge behavior,
- no-LMS/Moodle/Canvas routing in launch orchestration.
- reviewed grade/progress import behavior.
3. Canvas provider configuration guidance doc.

## Files

- `src/modules/lms-contract/canvas-launch.ts`
- `src/modules/lms-contract/canvas-course-roster-sync.ts`
- `src/modules/lms-contract/canvas-grade-progress-return.ts`
- `src/modules/lms-contract/canvas-reconciliation.ts`
- `src/modules/student-pwa/canvas-launch.ts`
- `src/modules/student-pwa/lms-launch-orchestration.ts`
- `src/app/api/academy/student/lms/launch/route.ts`
- `src/components/student-lms-launch-panel.tsx`
- `src/app/student/lms/page.tsx`
- `src/modules/student-pwa/__tests__/lms-launch-orchestration.test.ts`
- `src/modules/lms-contract/__tests__/canvas-launch.test.ts`
- `src/modules/lms-contract/__tests__/canvas-course-roster-sync.test.ts`
- `src/modules/lms-contract/__tests__/canvas-grade-progress-return.test.ts`
- `src/modules/lms-contract/__tests__/canvas-reconciliation.test.ts`
- `docs/integrations/canvas-provider-configuration.md`

## Follow-up

- Replace bootstrap actor headers with authenticated student/guardian identity context in Student LMS launch API.

## Verification

- Run focused tests:
  - `npm test -- --test-name-pattern='canvas-launch|tenant-provider-selection|lms-contract'`
- Run standard gates:
  - `npm test`
  - `npm run lint`
  - `npm run build`

## Follow-up

- Sprint 5: Student PWA launch bridge support for Canvas.
