# Institution Mode Packs Design

## Factory Intake

Feature: Operationalized institution modes and mode packs.

Product area: Institution Configuration, Platform Tenant Control, Academic Workflow Defaults.

Primary users:

- platform administrators;
- institution administrators;
- registrars;
- implementation consultants;
- future AI coding agents working from repo-owned docs.

Institution modes affected:

- Bible school;
- seminary;
- college;
- university;
- children's school;
- youth seminary;
- ministry training center;
- continuing education institute;
- homeschool hybrid/co-op.

Data touched:

- `academy_institution_profiles`;
- platform tenant provisioning payloads;
- academy configuration defaults;
- academic calendar defaults and validation;
- grading/course/admissions workflow defaults;
- seed/demo institution profiles.

LMS provider impact: mode packs may set LMS posture to none, planned, active, or unconfigured, but provider integration remains behind provider-neutral LMS contracts.

Student PWA impact: selected modes may enable or disable student and guardian surfaces by default.

ShepherdAI impact: selected modes may become deterministic context signals, but they must not create black-box recommendations.

Security/privacy risks: mode changes can alter guardian/minor handling, official records, transcripts, LMS sync, and exposed student surfaces. Mode mutation must be role-gated, tenant-scoped, validated, and audited.

## Problem

The current profile can show `Primary mode: Mixed` while the underlying tenant supports concrete modes such as Bible school, seminary, and children's school. This is confusing and feels fake because `mixed` is not a school type. The current defaults do influence behavior in limited ways, but a mixed tenant resolves to one primary mode for many defaults, which loses the purpose of selecting multiple modes.

The product needs mode choices that change software behavior.

## Goals

1. Make institution modes opt-in/opt-out concrete choices.
2. Remove `mixed` as a selectable supported mode.
3. Derive single-mode or multi-mode display from selected concrete modes.
4. Require every supported mode to have a mode pack.
5. Wire mode packs into OOTB defaults and workflow templates.
6. Preserve backward compatibility for legacy profiles and seeds.
7. Guard mode opt-out when operational data exists.

## Non-Goals

- Do not claim accreditation, licensing, or legal authority from a mode choice.
- Do not implement provider-specific LMS behavior inside Academy mode packs.
- Do not build a full workflow designer in this change.
- Do not make mode toggles unrestricted after operational data exists.
- Do not add display-only labels without behavior packs.

## Accepted UX Model

Institution settings should expose:

- selected institution modes as checkbox/toggle cards;
- a derived institution model summary: Single-mode or Multi-mode;
- selected mode pack summary;
- tenant overrides;
- warnings when selected modes conflict with current capabilities;
- blocked opt-out reasons when dependent data exists.

Platform tenant creation should expose common presets and an advanced mode selector.

Examples:

- Bible School only: single-mode, module calendar, completion records, clock hours.
- Seminary only: single-mode, academic-year/semester posture, credits, GPA, transcripts.
- Children's School only: single-mode, school-year posture, grade levels, guardians, progress records.
- Seminary plus Children's School: multi-mode, branch/subdivision requirements, both transcript and guardian capabilities enabled with mode-specific validation.

## Mode Pack Contract

Each mode pack must define:

- `mode`;
- `label`;
- `description`;
- `defaultCalendarSystem`;
- `defaultTermStructure`;
- `defaultInstructionalRoleLabel`;
- `officialRecordName`;
- `usesGradeLevels`;
- `usesPrograms`;
- `usesCohorts`;
- `usesCredits`;
- `usesClockHours`;
- `usesGpa`;
- `usesTranscripts`;
- `usesGuardians`;
- `allowsMinors`;
- default capabilities;
- recommended subdivisions;
- workflow templates;
- validation warnings.

Mode packs should be pure TypeScript data/functions in `src/modules/academy-config` so defaults, validation, provisioning, and tests share one source of truth.

## Recommended Initial Mode Packs

### Bible School

Default posture: modules or rolling cohorts, programs, cohorts, clock hours, completion records, no guardians by default, no GPA by default.

### Seminary

Default posture: academic year, semester, programs, cohorts, credits, GPA, transcripts, faculty/professor language.

### College

Default posture: academic year, semester or quarter, programs, credits, GPA, transcripts, registrar and graduation workflows.

### University

Default posture: college-like academic model with stronger subdivision/department assumptions and faculty language.

### Children's School

Default posture: school year, trimester or year-round, grade levels, guardians, minors, progress records, teacher language.

### Youth Seminary

Default posture: ministry/formation programs for minors or youth cohorts, guardians enabled, completion/progress records, optional credits disabled by default.

### Ministry Training Center

Default posture: module or rolling enrollment, clock hours, competencies optional in future, completion records, instructor language.

### Continuing Education

Default posture: rolling enrollment or modules, completion records, non-degree certificates, no GPA by default.

### Homeschool Hybrid

Default posture: school-year or hybrid calendar, guardians enabled, grade bands, progress records, cohorts optional.

## Data Model Direction

Short-term compatibility:

- keep current columns while introducing concrete-mode validation and normalization;
- read legacy `primaryMode = 'mixed'` as derived multi-mode;
- strip `mixed` from `supportedModes` during normalization;
- derive display label from concrete selected modes.

Future schema direction:

- add explicit selected mode pack storage if JSON profile fields are insufficient;
- add audit events for mode changes;
- add dependency checks before mode disable;
- preserve aggregate `operatingRules` and `capabilities` only as derived compatibility data.

## Workflow Wiring

At minimum, selected mode packs should feed:

- platform tenant provisioning;
- institution settings review model;
- academic calendar profile defaults;
- subdivision validation;
- grading profile defaults;
- course catalog profile defaults;
- admissions workflow presets;
- transcript/completion/progress record posture;
- guardian/minor capabilities;
- Student PWA and guardian portal defaults;
- ShepherdAI deterministic context labels.

## Validation Rules

- At least one concrete mode must be selected.
- `mixed` must not be accepted as a concrete selected mode.
- Multi-mode is derived from two or more selected concrete modes.
- Any mode that allows minors must enable guardian support unless explicitly blocked with a validation error.
- Transcript-bearing modes must support credits or clock hours.
- Children's School and Homeschool Hybrid require grade-band or grade-level posture.
- Multi-mode tenants must have active subdivision branches or an explicit setup warning for each selected concrete mode.
- Disabling a mode with dependent data must be blocked or require archival.

## Testing Strategy

Add tests for:

- mode taxonomy contains no selectable `mixed`;
- mode packs exist for every concrete mode;
- selected modes normalize legacy `mixed`;
- default profile generation for each mode;
- multi-mode aggregate capability resolution;
- tenant provisioning passes selected modes;
- platform UI payload includes selected concrete modes;
- seeds do not write `mixed` into supported modes;
- validation blocks unsupported opt-out with dependent data;
- institution review displays derived model instead of fake primary mode.

## Rollout

1. Add taxonomy and mode-pack resolver.
2. Normalize legacy mixed-mode profiles.
3. Update seeds and platform provisioning.
4. Update admin review UI.
5. Add guarded mode mutation APIs/UI.
6. Wire OOTB workflow defaults.
7. Verify migrations, tests, lint, build, and browser behavior.

## Rollback

Rollback must preserve tenant profiles. If a migration adds new mode-pack metadata, rollback should keep old `primaryMode`, `supportedModes`, `operatingRules`, and `capabilities` readable. Do not delete tenant mode history.
