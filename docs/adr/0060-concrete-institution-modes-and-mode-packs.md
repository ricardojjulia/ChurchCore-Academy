# ADR 0060: Concrete Institution Modes And Mode Packs

Date: 2026-06-29
Status: accepted

## Context

ADR 0002 accepted institution modes plus operating rules as the tenant-level configuration model. Implementation work proved the model useful, but it also exposed a weakness: `mixed` is currently treated like a selectable institution mode even though it is really a summary of multiple concrete modes.

The platform tenant creation UI and demo seeds can currently produce "Primary mode: Mixed" while supported modes are Bible school, seminary, and children's school. That reads like fake data because "mixed" does not describe a real operating school type and because selected modes do not yet create enough visible downstream behavior.

ChurchCore Academy needs institution modes to be operational choices. Selecting Bible School, Seminary, College, Children's School, Youth Seminary, or similar modes should apply reviewable defaults and workflow posture instead of only changing dashboard labels.

## Decision

ChurchCore Academy will model institution configuration with concrete institution modes and mode packs.

Concrete institution modes are selectable. `mixed` is not selectable. Multi-mode status is derived when two or more concrete modes are selected.

Initial concrete mode taxonomy:

- `bible_school`
- `seminary`
- `college`
- `university`
- `childrens_school`
- `youth_seminary`
- `ministry_training_center`
- `continuing_education`
- `homeschool_hybrid`

Each concrete mode must have a mode pack. A mode pack defines default posture for:

- academic calendar system and term structure;
- subdivisions and branch expectations;
- program, credential, and course catalog defaults;
- admissions and enrollment workflow templates;
- grading, GPA, transcript, progress-record, and completion-record posture;
- guardian, minor, and student-PWA posture;
- LMS preference posture;
- dashboard queues and registrar/faculty/admin workflow defaults;
- validation rules and warnings.

Tenant-level configuration will store selected concrete modes and explicit tenant overrides. Aggregate operating rules and capabilities may be derived for compatibility, but mode-specific behavior must come from selected mode packs rather than broad checks against `primaryMode`.

When a tenant has existing operational data, disabling a mode must be guarded by dependency checks. The system must either block the disable operation or require archival of related programs, courses, academic periods, enrollments, workflows, and records first.

This ADR supersedes the portion of ADR 0002 that allowed `mixed` as an accepted selectable institution mode. ADR 0002 remains valid for the broader principle that institution identity and operating rules are separate.

## Consequences

This makes institution configuration honest and operational. Users choose the actual program/school models they run, and the software applies meaningful defaults.

This also increases implementation responsibility. Adding a new mode now requires a behavior pack, tests, labels, migration handling, and review of student/guardian/official-record impacts. That is intentional. It prevents product drift where labels look impressive but do not change the software.

Existing profiles and seeds that use `primaryMode = 'mixed'` need migration or compatibility handling. Existing UI copy that says "Primary mode: Mixed" should become "Institution model: Multi-mode" or similar.

## Alternatives Considered

Keep `mixed` as a selectable mode:

- rejected because it creates fake primary-mode data;
- rejected because it hides which concrete modes drive behavior;
- rejected because defaults collapse mixed tenants into a single resolved primary mode.

Feature flags only:

- rejected because institution identity is still valuable for onboarding, product language, and OOTB setup;
- rejected because a raw feature matrix is harder for school operators to understand.

Concrete modes plus mode packs:

- accepted because it preserves product language while making behavior explicit, testable, and reviewable.

## Review Notes

- Product boundary: modes describe Academy-owned SIS operating posture, not accreditation or legal authorization.
- Security/privacy: mode changes can affect minors, guardians, transcripts, LMS sync, and PWA exposure, so mutable mode settings require role gates, tenant isolation, and audit events.
- Testing: each mode pack needs default, validation, migration, and provisioning tests.
- Rollback: migrations must preserve existing tenants by converting legacy `mixed` profiles into selected concrete modes and derived multi-mode display.
