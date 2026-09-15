# Council Review XV - Institution Mode Pack Closeout

Date: 2026-07-21
Branch: main
Baseline: cca2145 plus local working tree changes
Scope: Post-implementation review of ADR 0060 concrete institution modes, mode packs, tenant provisioning, admin review UI, migration handling, and verification evidence.
Decision Requested: Should the institution mode pack implementation ship as the accepted replacement for selectable `mixed` mode?

## Executive Verdict

Decision: ship
Release status: working vertical slice
Confidence: medium-high

The council accepts the implemented institution mode pack slice. ChurchCore Academy no longer treats `mixed` as a user-selectable institution mode, platform tenant creation now accepts concrete mode selections, mode packs drive aggregate defaults, seeds and migration handling normalize legacy `mixed` data, and the admin institution review explains the derived multi-mode posture. This is a working vertical slice for tenant creation and configuration review, not a full mutable post-create mode-management workflow.

## Evidence Reviewed

- `docs/adr/0060-concrete-institution-modes-and-mode-packs.md`
- `docs/reviews/2026-06-29-council-review-12-institution-mode-packs.md`
- `docs/superpowers/plans/2026-06-29-institution-mode-packs.md`
- `docs/prompts/2026-06-29-institution-mode-pack-ai-prompts.md`
- `src/modules/academy-config/mode-packs.ts`
- `src/modules/academy-config/defaults.ts`
- `src/modules/academy-config/validation.ts`
- `src/modules/academy-config/review-view.ts`
- `src/modules/platform-admin/service.ts`
- `src/modules/platform-admin/postgres-repository.ts`
- `src/app/api/platform/tenants/route.ts`
- `src/app/platform/control/tenant-control-panel.tsx`
- `src/app/admin/settings/institution/page.tsx`
- `src/modules/academic-calendar/validation.ts`
- `supabase/migrations/20260629212248_normalize_institution_mode_packs.sql`
- `supabase/migrations/20260616085000_seed_demo_institution_foundation.sql`
- `supabase/migrations/20260624060000_seed_demo_multi_institution_showcase.sql`

Verification evidence from the implementation closeout:

- `npm run verify:migration-seed-rehearsal`: passed with 87 applied rows and 87 migration files; seed rehearsal verified tenant `cca-main`.
- `npm test`: passed with 1239 tests, 0 failures.
- `npm run lint`: passed with 0 errors and 6 existing warnings.
- `npm run build`: passed on Next.js 16.2.9.
- `git diff --check`: passed.
- Browser smoke with `agent-browser`:
  - `/admin/settings/institution` showed `Institution model: Multi-mode`, `Default mode: Bible school`, selected concrete modes, applied packs, and no validation warnings.
  - `/platform/control` showed concrete mode checkboxes and no `Mixed` option.

## Product And Market Council

Recommendation: ship.

The change fixes the user-facing credibility problem that triggered the review. `Primary mode: Mixed` looked fake because it described a summary, not an actual education model. The new approach uses concrete product language: Bible School, Seminary, College, University, Children's School, Youth Seminary, Ministry Training Center, Continuing Education, and Homeschool Hybrid.

The product posture is stronger because mode selection now creates reviewable behavior instead of only changing labels. Platform admins can select the actual institution mix at tenant creation, and institution admins can see what configuration posture was applied.

Remaining product gap: post-create mode editing is not yet a user workflow. That is acceptable for this slice because tenant creation is the current operational boundary, but future customer onboarding will need guarded mode changes.

## SIS Domain Council

Recommendation: ship with follow-up.

The implementation threads selected modes through operating rules, capabilities, grading profile posture, calendar profile posture, course catalog posture, guardian/minor posture, and multi-mode subdivision branches. That is enough to make mode packs operational in the SIS foundation.

The domain council does not consider this complete for historical data management. Removing a mode after programs, courses, academic periods, enrollments, transcript records, guardian relationships, or workflows exist must require dependency checks. The ADR already names that guard; the implementation should not expose mutable mode disable until those checks exist.

## Architecture Council

Recommendation: ship.

The architecture now has a clear boundary:

- `ConcreteInstitutionMode` is selectable.
- `InstitutionModel` is derived as `single_mode` or `multi_mode`.
- legacy-compatible `InstitutionMode` can still include `mixed` where needed.
- mode pack resolution is centralized in `src/modules/academy-config/mode-packs.ts`.
- tenant provisioning normalizes selected modes before writing profiles.

This avoids scattered `primaryMode === "mixed"` logic and keeps provider-neutral LMS behavior intact. The compatibility migration preserves existing columns while correcting stored data.

Architectural follow-up: if mode packs begin creating real workflow rows, use a dedicated provisioning service and idempotency keys instead of adding more inserts directly to `PostgresPlatformAdminRepository`.

## Security And Privacy Council

Recommendation: ship for create-time provisioning only.

The current route remains platform-admin scoped, and this slice does not add a public mutable settings route for mode changes. That keeps the highest-risk operation behind the existing tenant provisioning workflow.

Security conditions for the next slice:

- mutable mode changes must be role-gated;
- changes must be tenant-scoped;
- mode enable/disable should write audit events;
- disabling modes that affect minors, guardians, official records, LMS sync, transcripts, or Student PWA exposure must check dependencies first;
- API tests must include forbidden-role and cross-tenant denial cases.

## UX And Accessibility Council

Recommendation: ship.

The admin review UI now says `Institution model: Multi-mode` and shows concrete selected modes and pack labels. This is clearer than asking users to interpret `Mixed` as a primary mode. The platform control UI uses checkboxes, which are the right control type for opt-in/opt-out choices.

Non-blocking UX improvement: the mode list should eventually be grouped into common presets and advanced options, with short descriptions per mode. The current checkbox list is acceptable for platform-admin setup but may feel dense as the taxonomy expands.

## Operations And Release Council

Recommendation: ship as a local verified working vertical slice.

The migration and seed rehearsal passed, and the local database was updated with the normalization migration. This is not a production activation decision. Before production rollout, operations still need a deployment note that explains how legacy `mixed` rows are normalized and how to verify tenant profiles after migration.

Working-tree note: the review observed broader dirty migration/dev-origin changes already present in the local workspace. This council decision applies to the institution mode pack implementation and does not approve unrelated dirty files.

## Testing And Code Health Council

Recommendation: ship.

The implementation has targeted coverage for:

- concrete taxonomy and mode-pack completeness;
- `mixed` rejection and legacy normalization;
- platform tenant route/service provisioning;
- seed rehearsal checks against `mixed`;
- admin review model display;
- academic calendar multi-mode validation.

The full test suite passed. Lint passed with warnings only. The six lint warnings are in existing calendar/apply files and are not introduced by this feature.

## Wildcard Review

Objection: the implementation may still overpromise because workflow templates are metadata, not executed workflow rows.

Response: accepted. The release label is `working vertical slice`, not `controlled-pilot candidate` or `production activated`. The shipped behavior is concrete mode selection, aggregate OOTB configuration, subdivision posture, and admin review. Actual workflow-row instantiation should be a later factory slice.

Objection: mode opt-out after tenant creation is the dangerous part, and it is not implemented.

Response: accepted. That is a blocker only if the product claims mutable mode management. This slice should not expose post-create disabling until dependency checks and audit events exist.

Objection: the taxonomy can still become a label collection if new modes are added casually.

Response: accepted. ADR 0060 must remain the gate: no new mode without a behavior pack, tests, migration handling, review copy, and domain impact assessment.

## Decision

The council decision is `ship`.

Release status is `working vertical slice`.

This approval covers:

- selectable concrete institution modes during platform tenant creation;
- derived single-mode or multi-mode display;
- mode-pack aggregate defaults for institution, calendar, grading, catalog, guardians/minors, and capability posture;
- seed and migration cleanup so `mixed` is not stored as a selected mode;
- admin review UI that explains selected modes and applied packs;
- tests and local verification evidence.

This approval does not cover:

- post-create institution mode editing;
- mode disable or archival workflows;
- audit events for mutable mode changes;
- production deployment or general availability;
- live provider activation.

## Required Follow-Up Prompt

Use the software factory to implement guarded mutable institution mode management after ADR 0060. Start from `docs/adr/0060-concrete-institution-modes-and-mode-packs.md`, `docs/reviews/2026-07-21-council-review-15-institution-mode-pack-closeout.md`, and the current `src/modules/academy-config/mode-packs.ts` implementation. Add a tenant-admin settings workflow for enabling concrete modes and requesting mode disable. Mode enable must recalculate reviewable aggregate defaults without erasing explicit tenant overrides. Mode disable must check dependent programs, courses, subdivisions, academic periods, enrollments, guardian relationships, official records, LMS mappings, and workflows; block the disable or require archival before proceeding. Add audit events, role gates, tenant isolation tests, API tests, UI tests, migration/seed rehearsal coverage if schema changes, browser smoke, and final verification with `npm run verify:migration-seed-rehearsal`, `npm test`, `npm run lint`, `npm run build`, and `git diff --check`.

## Verdict

Ship the current institution mode pack implementation as a verified working vertical slice. Do not claim full mutable mode-management maturity until the guarded edit/disable workflow is implemented and reviewed.
