# Full LMS Integration Readiness Note

Date: 2026-06-26  
Governing ADR: `docs/adr/0059-full-moodle-canvas-live-integration.md`

## Readiness Decision

Moodle and Canvas live integration implementation is complete through the provider-neutral contract, live transport helpers, durable execution worker, Student PWA launch boundary, reviewed-import return boundary, and reconciliation parity.

Production activation is an external release gate. It remains deferred until sandbox evidence is attached for both Moodle and Canvas. Do not mark full LMS integration production-ready until both evidence sections below are recorded.

## Moodle Sandbox Validation Evidence

Status: external evidence gate; no additional Academy code task is open.

Required evidence:

- tenant provider selection resolves active Moodle;
- Moodle credential validation succeeds without exposing token values;
- course shell operation executes against sandbox;
- roster sync executes for instructor and student memberships;
- Student PWA launch returns only safe fields;
- grade and progress return create reviewed imports only;
- reconciliation report includes expected and observed course shells, roster drift, grade return drift, progress return drift, capability drift, and credential health.

Local evidence command:

```bash
node --import tsx --test src/modules/lms-contract/__tests__/moodle-*.test.ts src/modules/student-pwa/__tests__/lms-launch-orchestration.test.ts
```

## Canvas Sandbox Validation Evidence

Status: external evidence gate; no additional Academy code task is open.

Required evidence:

- tenant provider selection resolves active Canvas;
- Canvas OAuth/token refresh validation succeeds without exposing token values;
- course shell operation executes against sandbox;
- roster sync executes for instructor and student memberships;
- Student PWA launch returns only safe fields;
- grade and progress return create reviewed imports only;
- reconciliation report includes expected and observed course shells, roster drift, grade return drift, progress return drift, capability drift, and credential health.

Local evidence command:

```bash
node --import tsx --test src/modules/lms-contract/__tests__/canvas-*.test.ts src/modules/student-pwa/__tests__/lms-launch-orchestration.test.ts
```

## Tests Run For Closeout

```bash
node --import tsx --test src/modules/lms-contract/__tests__/provider-readiness.test.ts src/app/api/academy/lms/readiness/route.test.ts
npm test
npm run lint
npm run build
git diff --check
```

## Known Limitations

- Real Moodle and Canvas sandbox evidence is not attached yet; this is an external activation gate, not an open implementation task.
- `/admin/settings/lms` is a readiness and operator-review surface; actual tenant provider persistence remains controlled by the provider configuration workflow.
- Pause/resume API actions are guarded and accepted for operator review; they do not silently mutate production provider state.
- Production activation requires tenant owner approval and provider owner signoff.

## Rollback Procedure

Use `docs/runbooks/provider-activation.md#lms-rollback`.

Rollback must pause the provider worker and keep Academy SIS records intact. Do not delete course, roster, grade, progress, transcript, or reviewed-import records during LMS rollback.
