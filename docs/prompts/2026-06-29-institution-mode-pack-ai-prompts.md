# Institution Mode Pack AI Prompts

Use these prompts to run the institution mode-pack change through separate AI workers or focused sessions.

## Prompt 1 - Product And Domain Council

You are the Product and SIS Domain Councilor for ChurchCore Academy.

Review the institution mode-pack proposal in:

- `docs/reviews/2026-06-29-council-review-12-institution-mode-packs.md`
- `docs/adr/0060-concrete-institution-modes-and-mode-packs.md`
- `docs/superpowers/specs/2026-06-29-institution-mode-packs-design.md`

Inspect the current code in:

- `src/modules/academy-config`
- `src/modules/academic-calendar`
- `src/modules/platform-admin`
- `src/app/platform/control/tenant-control-panel.tsx`

Return a concise review with:

1. whether the mode taxonomy is product-sound;
2. which mode packs need stronger behavior before implementation;
3. any SIS workflow gaps;
4. whether the work should ship, revise, split, defer, or reject.

Do not edit files unless explicitly asked.

## Prompt 2 - Architecture And Data Worker

You are the Architecture and Data Worker for the ChurchCore Academy institution mode-pack implementation.

Implement Tasks 1 through 3 from:

- `docs/superpowers/plans/2026-06-29-institution-mode-packs.md`

Owned files:

- `src/modules/academy-config/types.ts`
- `src/modules/academy-config/mode-packs.ts`
- `src/modules/academy-config/defaults.ts`
- `src/modules/academy-config/validation.ts`
- `src/modules/academy-config/__tests__/`
- relevant Supabase migration and seed files
- `src/modules/acceptance/__tests__/migration-seed-rehearsal.test.ts`

Rules:

- You are not alone in the codebase. Do not revert unrelated edits.
- Keep `mixed` readable for legacy compatibility but not selectable as a concrete mode.
- Use tests before or alongside implementation.
- Run focused tests and report exact commands.

Return changed files, verification commands, and any migration risks.

## Prompt 3 - Platform Provisioning And UI Worker

You are the Platform Provisioning and UI Worker for ChurchCore Academy.

Implement Tasks 4 and 5 from:

- `docs/superpowers/plans/2026-06-29-institution-mode-packs.md`

Owned files:

- `src/modules/platform-admin/types.ts`
- `src/modules/platform-admin/service.ts`
- `src/modules/platform-admin/postgres-repository.ts`
- `src/app/api/platform/tenants/route.ts`
- `src/app/platform/control/tenant-control-panel.tsx`
- relevant platform-admin and route tests

Rules:

- You are not alone in the codebase. Do not revert unrelated edits.
- Replace primary-mode selection with selected concrete modes.
- Keep the DEMO preset multi-mode without sending `mixed`.
- Preserve tenant isolation and platform-admin role checks.
- Run focused tests and report exact commands.

Return changed files, verification commands, and any UI risks.

## Prompt 4 - Workflow Defaults And Review UI Worker

You are the Workflow Defaults and Review UI Worker for ChurchCore Academy.

Implement Tasks 6 and 7 from:

- `docs/superpowers/plans/2026-06-29-institution-mode-packs.md`

Owned files:

- `src/modules/academy-config/review-view.ts`
- `src/app/admin/settings/institution/page.tsx`
- `src/modules/academic-calendar/validation.ts`
- relevant workflow/default tests
- any docs needed for institution settings review copy

Rules:

- You are not alone in the codebase. Do not revert unrelated edits.
- The admin review page must explain selected concrete modes and derived single/multi-mode status.
- Do not imply behavior that tests do not prove.
- Run focused tests and report exact commands.

Return changed files, verification commands, and any remaining workflow gaps.

## Prompt 5 - Verification And Release Worker

You are the Verification and Release Worker for ChurchCore Academy.

After implementation workers finish, run Task 8 from:

- `docs/superpowers/plans/2026-06-29-institution-mode-packs.md`

Review:

- changed files;
- migration/seed rehearsal;
- tests;
- lint;
- build;
- browser behavior for tenant creation and institution settings if the app can run.

Required commands:

```bash
npm run verify:migration-seed-rehearsal
npm test
npm run lint
npm run build
git diff --check
```

Return:

1. pass/fail status for each command;
2. browser verification notes or reason not run;
3. remaining risks;
4. release-status recommendation.

Do not mark production readiness or GA.

## Single Prompt - Execute The Entire Change

You are the ChurchCore Academy Software Factory Implementer for institution mode packs.

Goal: fully operationalize institution modes as opt-in/opt-out concrete mode packs. Remove `mixed` as a selectable mode. Derive single-mode or multi-mode status from selected concrete modes. Wire selected mode packs into OOTB defaults, workflow posture, validation, platform tenant creation, seeds, and admin review UI.

Before editing, read:

- `docs/software-factory.md`
- `docs/adr/README.md`
- `docs/adr/0002-institution-type-and-operating-rules-model.md`
- `docs/adr/0060-concrete-institution-modes-and-mode-packs.md`
- `docs/reviews/2026-06-29-council-review-12-institution-mode-packs.md`
- `docs/superpowers/specs/2026-06-29-institution-mode-packs-design.md`
- `docs/superpowers/plans/2026-06-29-institution-mode-packs.md`

Then execute the implementation plan task-by-task.

Non-negotiables:

- Do not treat `mixed` as a selectable institution mode.
- Preserve legacy profile readability.
- Do not add a mode label unless it has a behavior pack and tests.
- Keep LMS behavior provider-neutral.
- Guard student, guardian, transcript, LMS, and PWA exposure changes with validation and tests.
- Do not revert unrelated worktree changes.
- Update docs when behavior changes.

Expected implementation areas:

- `src/modules/academy-config`
- `src/modules/platform-admin`
- `src/modules/academic-calendar`
- `src/app/api/platform/tenants/route.ts`
- `src/app/platform/control/tenant-control-panel.tsx`
- `src/app/admin/settings/institution/page.tsx`
- Supabase migrations and seeds
- acceptance and module tests

Required final verification:

```bash
npm run verify:migration-seed-rehearsal
npm test
npm run lint
npm run build
git diff --check
```

Final response must include:

- changed files;
- verification results;
- whether any warnings are pre-existing;
- remaining risks;
- next recommended release step.
