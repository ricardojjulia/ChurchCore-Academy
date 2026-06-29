# Council Review XII - Institution Mode Packs

Date: 2026-06-29
Branch: docs/release-cleanup-2026-06-26
Baseline: local working tree on 2026-06-29
Scope: Institution configuration modes, opt-in/opt-out mode selection, mode packs, and OOTB workflow defaults.
Decision Requested: Should ChurchCore Academy operationalize institution modes as selectable mode packs and stop treating `mixed` as a selectable mode?

## Executive Verdict

Decision: revise
Release status: foundation
Confidence: high

The council agrees with the direction, with one correction: `mixed` must become a derived operating model, not a selectable institution mode. The current implementation already uses modes for defaults, capabilities, and some academic-calendar validation, but it is not operational enough to justify UI language that suggests three school/program types are fully configured. The next implementation should convert institution modes into opt-in/opt-out mode packs that provision defaults, workflow templates, validation, and reviewable capabilities.

## Evidence Reviewed

- `docs/adr/0002-institution-type-and-operating-rules-model.md`
- `docs/superpowers/specs/2026-06-01-institution-type-operating-rules-design.md`
- `src/modules/academy-config/types.ts`
- `src/modules/academy-config/defaults.ts`
- `src/modules/academy-config/validation.ts`
- `src/modules/academic-calendar/validation.ts`
- `src/modules/platform-admin/types.ts`
- `src/modules/platform-admin/service.ts`
- `src/modules/platform-admin/postgres-repository.ts`
- `src/app/platform/control/tenant-control-panel.tsx`
- `supabase/migrations/20260616085000_seed_demo_institution_foundation.sql`
- `supabase/migrations/20260624060000_seed_demo_multi_institution_showcase.sql`

## Product Council

Recommendation: agree, revise scope into a productized mode-pack system.

Institution labels are useful only if they produce visible behavior. Bible School, Seminary, College, Children's School, Youth Seminary, Ministry Training Center, Continuing Education Institute, and Homeschool Hybrid/Co-op are meaningful product choices for the ChurchCore Academy market. They should not be inert tags.

The UI should present modes as selectable cards or checkboxes. When one mode is selected, the tenant is single-mode. When two or more concrete modes are selected, the tenant is multi-mode. The label "Mixed" may appear as a summary, but users should not choose it as if it were a real school type.

## SIS Domain Council

Recommendation: agree, but preserve operational data safety.

Mode packs should drive defaults for:

- academic calendar system and term structure;
- subdivisions and branches;
- program and credential templates;
- admissions and enrollment workflows;
- guardian/minor requirements;
- course catalog defaults;
- grading, GPA, transcript, completion-record, and progress-record defaults;
- dashboard queues and registrar workflows.

Disabling a mode after operational data exists must be guarded. The implementation should either block the action or require archival of related programs, courses, academic periods, enrollments, and workflows first.

## Architecture Council

Recommendation: revise the data model before expanding the list.

Current model issues:

- `InstitutionMode` includes `mixed`.
- `supportedModes` can include `mixed`.
- `primaryMode` can be `mixed`.
- defaults resolve mixed tenants to the first concrete mode, which loses per-mode nuance.
- platform tenant creation sends only `primaryMode`, not a real selected-mode list.

The new design should introduce a concrete mode taxonomy and a mode-pack resolver. `mixed` should be derived from `supportedModes.length > 1`. Tenant-level aggregate capabilities should be computed from selected mode packs plus explicit tenant overrides.

## Security And Privacy Council

Recommendation: agree with audit and role constraints.

Mode choices can enable minors, guardians, official records, transcripts, LMS sync posture, and student-facing surfaces. These are not harmless preferences. Changes to selected modes and sensitive capabilities should be auditable, role-gated to institution/platform administrators, and tenant-scoped. RLS and API tests are required when mode changes become mutable through UI or API.

## UX And Accessibility Council

Recommendation: agree, but avoid configuration jargon.

The current "Primary mode: Mixed" display reads like fake data because it does not show what behavior changed. The new admin experience should show selected modes, applied packs, overridden defaults, and blocked opt-out reasons. It should use clear controls: checkboxes/toggles for mode opt-in/out, a select or segmented control for default branch only when needed, and review warnings for risky changes.

## Operations And Release Council

Recommendation: split implementation into small factory slices.

This change touches schema, seeds, platform provisioning, admin UI, defaults, validation, and downstream workflows. It should not be implemented as one unreviewed patch. The factory plan should split into:

1. Taxonomy and mode-pack resolver.
2. Schema and seed migration.
3. Platform tenant creation UI/API.
4. Institution settings review/edit UI.
5. Workflow/default wiring.
6. Verification and docs closeout.

## Wildcard Review

Objection: expanding the mode list could create a false sense of product maturity.

Response: accepted. The implementation must not add labels unless each mode has at least a minimal behavior pack and tests. "Youth Seminary" cannot just be a renamed seminary. It needs minor/guardian defaults or youth-specific workflow differences. "Continuing Education" cannot just be college. It needs rolling/module defaults and completion-record posture.

Objection: opt-out can corrupt historical records.

Response: accepted. Mode removal must be guarded by dependency checks and/or archive-only behavior.

Objection: too many modes could overwhelm tenant creation.

Response: accepted. Platform tenant creation can offer common presets while advanced settings expose the full taxonomy.

## Decision

Revise the institution configuration model into concrete institution modes plus mode packs.

Specific decision points:

- `mixed` is no longer a selectable institution mode.
- multi-mode is derived when two or more concrete modes are selected.
- supported modes are opt-in/opt-out concrete modes.
- selected modes apply mode packs with defaults and workflow templates.
- tenant-level overrides are allowed but must be explicit and reviewable.
- disabling a selected mode is blocked or requires archival when dependent operational data exists.

## Required Artifacts

- ADR 0060 for concrete modes and mode packs.
- Design spec for operationalized institution mode packs.
- Implementation plan for the full change.
- AI prompts for product/domain, architecture/data, UI/workflow, tests/release.
- One single prompt that can execute the entire change through the software factory.

## Open Risks

- Backward compatibility for existing `mixed` profiles and seeds.
- Distinguishing institution identity from legal/accreditation claims.
- Preventing UI-only mode labels.
- Keeping official records stable when modes change.
- Avoiding scattered `switch(mode)` logic across modules.

## Verdict

Proceed with the mode-pack architecture, but do not implement more display labels until the behavior wiring, migration path, validation, and tests are part of the same delivery package.
