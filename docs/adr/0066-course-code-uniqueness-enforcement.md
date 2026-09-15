# ADR-0066 — Course Code Uniqueness: Database Constraint + Module Validation

**Date:** 2026-07-02
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Council review:** Academic Foundation design session 2026-07-02

---

## Context

The Course Catalog requires that course codes be unique within a tenant (e.g., "THEO-101" cannot
exist twice for the same institution). The existing `academy_courses` table already has a unique
constraint `(tenant_id, code)` in the schema (per existing migration). The module layer in
`src/modules/course-catalog/mutations.ts` also checks for duplicates before insert using a
`SELECT` query and throws `AcademyConflictError`.

The question for this design session is whether to rely on:
1. **Database constraint only** — remove the application-level check, catch the DB unique
   violation, and translate it to a 409 response.
2. **Module validation only** — rely on the pre-insert SELECT check, remove or ignore the DB
   constraint.
3. **Both** — keep the DB constraint as the authoritative enforcement mechanism and keep the
   module-level pre-check as an early, user-friendly error path.

---

## Decision

**Both layers enforce uniqueness: DB constraint is authoritative, module pre-check gives early
user-friendly errors.**

### Database layer

The `unique (tenant_id, code)` constraint on `academy_courses` is the authoritative enforcement
point. It cannot be bypassed by concurrent inserts or bulk imports. It is the source of truth.

A new migration is **not needed** — this constraint already exists in migration
`20260524xxx_course_catalog.sql` (confirmed in existing schema).

### Module layer

The pre-insert SELECT check in `createCourse` and `updateCourse` (in mutations.ts) is retained.
It runs before the INSERT and throws `AcademyConflictError("Course with code X already exists.")`
with a clean human-readable message. This is important because:

- The DB constraint violation message (`duplicate key value violates unique constraint`) is a raw
  Postgres error that must not be surfaced to clients (CLAUDE.md rule: never return database
  error messages directly to the client).
- The pre-check eliminates the need to catch and translate DB errors in the API route layer.

If the pre-check somehow passes but the DB constraint fires (race condition), the `handleApi`
utility's generic 500 path catches it. This is acceptable — race conditions in course code
creation are rare, and the DB prevents corruption regardless.

### Program code (same rule applies)

The `academy_academic_programs` table already has `unique (tenant_id, program_code)`. The same
dual-enforcement rule applies to program codes in the Program Management UI.

---

## Consequences

- No new migration is required for uniqueness enforcement.
- The module layer continues to emit `AcademyConflictError` for duplicate codes, which the API
  utility maps to HTTP 409.
- The UI displays the 409 message directly: "A course with this code already exists."
- When updating a course code, the existing code-change guard (cannot change code when sections
  exist) remains in place.

---

## Alternatives Rejected

**Database constraint only (remove module pre-check):**
Rejected. Would require catching raw Postgres errors in the API layer and translating them, which
adds complexity and risks exposing DB internals if the catch is incomplete.

**Module validation only (remove DB constraint):**
Rejected. Application-level checks are not atomic — a concurrent insert could bypass them.
The DB constraint is the only race-safe enforcement point.

---

## Related

- ADR-0032 — UUID/text schema consistency
- ADR-0051 — Course catalog and section admin CRUD
