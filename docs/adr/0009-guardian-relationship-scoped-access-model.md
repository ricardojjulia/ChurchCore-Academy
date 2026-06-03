# ADR 0009: Guardian Relationship-Scoped Access Model

Date: 2026-06-02
Status: accepted

## Context

ChurchCore Academy must support children's schools as a first-class institution mode. Children's school support requires guardians, consent authority, school communication, schedule visibility, progress visibility, and document access.

A guardian role is not enough to decide access. A guardian must relate to specific students, and visibility can differ by child because of custody, consent, institutional policy, grade release rules, or emergency-contact limits.

Future student PWA and guardian surfaces must not expose all students in a tenant to anyone with a guardian role.

## Decision

Guardian access will be relationship-scoped.

A person may hold the `guardian` role, but access to student data requires an active `StudentRelationship` linking the guardian person to the student person.

Each relationship will carry:

- relationship type
- authority
- visibility
- status
- start and end dates

Guardian PWA/read-model access must check:

- tenant match
- active guardian role assignment
- active relationship to the requested student
- allowed visibility for the requested data category
- future grade/transcript release rules where applicable

Guardian role assignment alone grants no tenant-wide student visibility.

## Consequences

This supports:

- children's school guardian portals
- multiple guardians per student
- limited visibility for emergency contacts or pickup contacts
- custody and consent-sensitive access boundaries
- adult students without guardian relationships
- mixed institutions where guardian roles exist only for some branches

The tradeoff is that guardian onboarding and admin review UI must explain role assignment separately from student relationship visibility.

## Alternatives Considered

Tenant-wide guardian role access:

- rejected because it could expose all student records in a children's school tenant

Student record with inline guardian names:

- rejected because it cannot handle multiple guardians, visibility changes, inactive relationships, or future guardian login access cleanly

Relationship-scoped guardian access:

- accepted because it is explicit, auditable, and testable

## Review Notes

- Product boundary: Academy owns guardian relationship and student-visible record access as SIS data.
- LMS boundary: LMS launch or course content visibility may later consume guardian eligibility, but provider runtime access is handled by LMS adapters.
- Security/privacy: future implementation must deny expired relationships, cross-tenant relationships, guardian role without relationship, and relationship visibility outside the requested data category.
- Testing: implementation must cover child student guardian requirement, adult student no-guardian path, limited visibility, expired relationship denial, and cross-tenant denial.
- Rollback: this sprint changes docs only; future schema work must be reversible through migrations.
