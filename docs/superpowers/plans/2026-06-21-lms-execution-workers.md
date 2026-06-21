# LMS Execution Workers Plan

Date: 2026-06-21
Spec: `docs/superpowers/specs/2026-06-21-lms-execution-workers-design.md`

## Objective

Make Moodle and Canvas LMS integration executable at the normalized operation boundary instead of returning plan-only stubs.

## Tasks

- [x] Inspect LMS contract modules, Moodle/Canvas planners, route tests, provider-selection policy, and prior LMS design docs.
- [x] Add failing tests for LMS worker execution success, duplicate replay suppression, retryable provider failures, and active Moodle API planning.
- [x] Implement `LmsProviderOperationExecutor` and sequential `executeLmsProviderOperations`.
- [x] Wire active Moodle route payloads to Moodle course shell, roster, grade return, and progress return planners.
- [x] Preserve reviewed-import boundaries for grade/progress return.
- [x] Add operational runbook and update the Full SIS tracker.
- [x] Run focused tests, TypeScript, full tests, lint, build, and route smoke.
- [ ] Commit, push, open PR, watch CI, and merge from the updated base.

## Verification Commands

```bash
node --import tsx --test src/modules/lms-contract/__tests__/lms-execution-worker.test.ts src/app/api/academy/lms/contract/__tests__/route.test.ts
npx tsc --noEmit
npm test
npm run lint
npm run build
git diff --check
```

## Notes

- This slice creates the executable boundary and removes Moodle stubs. It does not embed provider credentials in repo code and does not implement provider-specific HTTP clients with real secrets.
- Official academic records remain behind Academy review and registrar posting.

Verification note: focused LMS worker/contract route tests, `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`, `git diff --check`, and protected-route HTTP smoke passed.
