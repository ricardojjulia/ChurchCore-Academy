# ADR 0002: Institution Type And Operating Rules Model

Date: 2026-06-01
Status: accepted

Superseded in part by: `docs/adr/0060-concrete-institution-modes-and-mode-packs.md`

## Context

ChurchCore Academy must support Bible schools, children's schools, seminaries, colleges, and universities without separate products.

The institution model is the first dependency for academic calendars, courses, grading, people and roles, student PWA, LMS integration, and ShepherdAI expansion. A weak model would force later code to branch by hardcoded assumptions.

## Decision

ChurchCore Academy will use an institution profile composed of:

- `InstitutionProfile`
- `InstitutionMode`
- `InstitutionOperatingRules`
- `InstitutionCapabilitySet`
- `InstitutionLmsPreference`

Each tenant may support one or more institution modes. The primary mode defines default product language and setup suggestions, but operating rules and capabilities define behavior.

The accepted institution modes are:

- `bible_school`
- `childrens_school`
- `seminary`
- `college`
- `university`
- `mixed`

The `mixed` mode is valid only when multiple concrete modes are supported.

Later decision note: ADR 0060 supersedes this line for future implementation. `mixed` must be treated as a derived multi-mode summary, not as a selectable institution mode.

## Consequences

This gives the platform stable language for faith-based institution types while keeping behavior configurable. It supports a Bible school, children's school, seminary, college, university, or combined institution without creating separate products.

The tradeoff is that implementation must include validation rules to prevent invalid combinations, such as minors without guardian support or LMS sync capabilities without an LMS provider.

## Alternatives Considered

Single institution type enum:

- rejected because it cannot model mixed institutions well
- would force branching as soon as one tenant serves multiple education models

Feature flag matrix only:

- rejected because it loses useful institution identity and onboarding defaults
- would make product language harder for faith-based schools to understand

Institution mode plus operating rules:

- accepted because it preserves clear institution identity while making behavior explicit and testable

## Review Notes

- Product boundary: Academy owns institution configuration as SIS system-of-record data.
- LMS boundary: LMS provider preference is stored here, but provider behavior remains in provider-neutral contracts.
- Security/privacy: future implementation must audit changes to guardian, transcript, LMS, and ShepherdAI capabilities.
- Testing: future implementation must test default profiles and invalid combinations for all institution modes.
- Rollback: this sprint changes docs only; future schema work must be reversible through migrations.
