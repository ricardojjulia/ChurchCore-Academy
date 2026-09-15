# Student PWA Workflow Completion Plan

Date: 2026-06-21
Spec: `docs/superpowers/specs/2026-06-21-student-pwa-workflow-completion-design.md`

## Objective

Close the Student PWA workflow slice by removing placeholder behavior, tightening self-scoped registration reads, and preserving privacy-safe offline behavior.

## Tasks

- [x] Inspect Prompt 8, ADR-0012/0013 boundaries, current Student PWA routes, registration API, transcript API, communications, billing, aid, LMS launch, and offline policy.
- [x] Add failing tests for student self-scoped registration reads and registrar tenant-roster reads.
- [x] Refactor `GET /api/academy/registrations` into a testable helper and self-scope student registration reads by verified actor.
- [x] Add regression tests blocking Student PWA placeholder sprint language.
- [x] Route the Student PWA notification affordance to persisted messages.
- [x] Preserve transcript request workflow from the documents surface and clarify registrar-controlled fulfillment.
- [x] Run focused tests, TypeScript, full tests, lint, build, and protected-route/PWA HTTP smoke.
- [x] Update the full SIS program tracker and project status.
- [ ] Commit, push, open PR, watch CI, and merge from the updated base.

## Verification Commands

```bash
node --import tsx --test src/app/api/academy/registrations/__tests__/route.test.ts src/modules/student-pwa/__tests__/workflow-surface.test.ts src/modules/student-pwa/__tests__/server-read-model.test.ts src/modules/student-pwa/__tests__/offline-policy.test.ts
npx tsc --noEmit
npm test
npm run lint
npm run build
git diff --check
```

## Notes

- The PWA remains dynamic for student data routes.
- Live visual browser verification depends on in-app browser availability; HTTP route smoke remains required either way.

Verification note: focused Student PWA and registration route tests, `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`, `git diff --check`, and protected-route HTTP smoke passed.
