# ADR 0005: Institution Subdivision Hierarchy

Date: 2026-06-01
Status: accepted

## Context

Faith-based education institutions organize themselves differently.

A children's school may need grade bands, divisions, and homeroom-style cohorts. A Bible school may need module cohorts and ministry-training tracks. A seminary may need departments and intensives. A university may need campuses, schools, departments, divisions, and cohorts.

The subdivision model must support all of these without forcing every tenant into a university structure.

## Decision

ChurchCore Academy will model institutional structure with typed subdivisions:

- `campus`
- `school`
- `department`
- `division`
- `grade_band`
- `cohort`

Each subdivision is tenant-scoped and may have an optional parent subdivision. Parent-child relationships are allowed only inside the same tenant and must be validated by subdivision type.

Subdivisions may be scoped to an institution mode, which lets mixed institutions maintain separate children's school, Bible school, seminary, college, or university branches under one tenant.

## Consequences

This keeps the model understandable for small institutions while still supporting larger university-style hierarchies.

It also gives later domains stable references:

- academic years and periods can be scoped to a subdivision
- enrollment windows can apply to grade bands or branches
- courses and sections can later attach to schools or departments
- student PWA views can show the right branch, cohort, or grade band
- LMS mappings can consume provider-neutral subdivision references

The tradeoff is that implementation must validate subdivision type rules instead of accepting arbitrary trees.

## Alternatives Considered

Single generic organization tree:

- rejected because it loses useful validation and product language

Separate tables for every structural concept only:

- rejected because it creates too much schema overhead before the product has proven which structures are used most

Typed subdivision records with optional parents:

- accepted because it is flexible, understandable, tenant-safe, and testable

## Review Notes

- Product boundary: Academy owns subdivisions as SIS system-of-record structure.
- LMS boundary: LMS course categories or account structures may map to subdivisions later, but provider runtime behavior is not part of this model.
- Security/privacy: all subdivision reads and writes must use tenant-scoped Academy permissions.
- Testing: future implementation must cover small Bible school, children's school, seminary, college, university, and mixed-institution hierarchies.
- Rollback: this sprint changes docs only; future schema work must be reversible through migrations.
