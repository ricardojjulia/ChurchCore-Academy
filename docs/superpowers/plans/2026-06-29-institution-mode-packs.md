# Institution Mode Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert institution modes from mostly display-oriented profile values into opt-in/opt-out concrete mode packs that drive defaults, workflow posture, validation, and review UI.

**Architecture:** Add a concrete mode taxonomy and mode-pack resolver in `src/modules/academy-config`, then thread it through platform tenant provisioning, seeds, validation, and admin review. Preserve legacy profile compatibility while removing `mixed` as a selectable institution mode.

**Tech Stack:** Next.js App Router, TypeScript, Supabase/Postgres migrations, existing repository tests, React client tenant-control UI.

---

## File Map

- Modify: `src/modules/academy-config/types.ts`
  - Split concrete modes from derived institution model.
- Create: `src/modules/academy-config/mode-packs.ts`
  - Own mode taxonomy, labels, defaults, workflow pack metadata, and aggregation helpers.
- Modify: `src/modules/academy-config/defaults.ts`
  - Build profiles from selected concrete modes using mode packs.
- Modify: `src/modules/academy-config/validation.ts`
  - Reject selectable `mixed`, validate mode packs, and validate aggregate rules.
- Modify: `src/modules/academy-config/review-view.ts`
  - Display derived single-mode/multi-mode model and selected mode packs.
- Modify: `src/modules/platform-admin/types.ts`
  - Accept selected concrete modes, not `mixed`.
- Modify: `src/modules/platform-admin/service.ts`
  - Normalize and validate mode selections during tenant creation.
- Modify: `src/modules/platform-admin/postgres-repository.ts`
  - Provision calendar, grading, catalog, and subdivisions from mode-pack aggregate defaults.
- Modify: `src/app/api/platform/tenants/route.ts`
  - Parse selected modes safely.
- Modify: `src/app/platform/control/tenant-control-panel.tsx`
  - Replace primary-mode select with mode preset/checkbox UI.
- Modify: `src/modules/academic-calendar/validation.ts`
  - Use derived multi-mode state and concrete modes.
- Modify: `supabase/migrations/*seed*institution*.sql`
  - Remove `mixed` from supported modes in seeds.
- Create: `supabase/migrations/YYYYMMDDHHMMSS_normalize_institution_mode_packs.sql`
  - Normalize legacy supported modes and preserve readable profiles.
- Add/update tests under:
  - `src/modules/academy-config/__tests__/`
  - `src/modules/platform-admin/__tests__/`
  - `src/modules/academic-calendar/__tests__/`
  - `src/modules/acceptance/__tests__/migration-seed-rehearsal.test.ts`

## Task 1: Taxonomy And Mode Pack Contract

- [x] Add a failing test that every concrete mode has one mode pack and `mixed` is not concrete.

Run:

```bash
npm test -- src/modules/academy-config/__tests__/mode-packs.test.ts
```

Expected: fail because `mode-packs.ts` does not exist.

- [x] Create `src/modules/academy-config/mode-packs.ts` with concrete modes, labels, pack defaults, and aggregate helper functions.

- [x] Update `src/modules/academy-config/types.ts` to distinguish:
  - `ConcreteInstitutionMode`;
  - derived `InstitutionModel = "single_mode" | "multi_mode"`;
  - legacy-compatible `InstitutionMode` only where needed.

- [x] Run the focused taxonomy test.

Expected: pass.

## Task 2: Defaults And Validation

- [x] Add failing tests for:
  - profile defaults for each concrete mode;
  - multi-mode aggregate behavior;
  - legacy `mixed` normalization;
  - validation error when `supportedModes` includes `mixed`.

- [x] Refactor `src/modules/academy-config/defaults.ts` to use mode packs.

- [x] Refactor `src/modules/academy-config/validation.ts` to enforce concrete-mode rules.

- [x] Run focused tests:

```bash
npm test -- src/modules/academy-config
```

Expected: pass.

## Task 3: Migration And Seeds

- [x] Add a migration that normalizes legacy profile JSON:
  - remove `mixed` from `supported_modes`;
  - when `primary_mode = 'mixed'`, keep compatibility but ensure concrete selected modes remain;
  - preserve timestamps and tenant rows.

- [x] Update demo seed migrations so `supported_modes` contains concrete modes only.

- [x] Extend migration rehearsal tests to assert no seed writes `mixed` into `supported_modes`.

- [x] Run:

```bash
npm run verify:migration-seed-rehearsal
npm test -- src/modules/acceptance/__tests__/migration-seed-rehearsal.test.ts
```

Expected: pass.

## Task 4: Platform Tenant Creation

- [x] Add route/service/repository tests proving tenant creation accepts selected concrete modes and rejects `mixed`.

- [x] Update platform admin types and service normalization.

- [x] Update tenant route parsing.

- [x] Update repository provisioning to use aggregate mode-pack defaults.

- [x] Run:

```bash
npm test -- src/modules/platform-admin src/app/api/platform/tenants
```

Expected: pass.

## Task 5: Tenant Control UI

- [x] Add or update component tests for selected mode payloads.

- [x] Replace the primary-mode select with common presets plus concrete-mode checkboxes.

- [x] Ensure the DEMO preset selects Bible School, Seminary, and Children's School without selecting `mixed`.

- [x] Run focused UI tests if present, otherwise run full test suite after implementation.

## Task 6: Admin Review UI And Academic Validation

- [x] Update review model tests so the admin institution page shows:
  - Institution model: Multi-mode;
  - Selected modes list;
  - Applied mode packs or warnings.

- [x] Update academic calendar validation to derive multi-mode from selected concrete modes.

- [x] Run:

```bash
npm test -- src/modules/academy-config src/modules/academic-calendar
```

Expected: pass.

## Task 7: Workflow Defaults

- [x] Add tests proving selected mode packs drive at least:
  - calendar profile defaults;
  - grading profile defaults;
  - course catalog profile defaults;
  - subdivision branch expectations;
  - guardian/minor capability posture.

- [x] Wire mode-pack aggregate defaults into provisioning and validation.

- [x] Keep LMS provider behavior provider-neutral.

## Task 8: Docs And Closeout

- [x] Update ADR 0002 only if needed to point to ADR 0060; do not erase history.

- [x] Update `docs/product/factory-roadmap.md` and any institution configuration docs that still describe `mixed` as selectable.

- [x] Run final verification:

```bash
npm run verify:migration-seed-rehearsal
npm test
npm run lint
npm run build
git diff --check
```

Expected: all pass except any known pre-existing warnings must be reported explicitly.

## Acceptance Criteria

- Users can opt into concrete institution modes.
- `mixed` is no longer selectable as a mode.
- Single-mode and multi-mode are derived.
- Each concrete mode has a behavior pack.
- Demo seed data no longer presents fake primary-mode data.
- Platform tenant creation provisions OOTB configs from selected mode packs.
- Admin review explains selected modes and applied behavior.
- Tests cover taxonomy, defaults, validation, provisioning, migration rehearsal, and review display.
