# ADR-0028 — Gradebook API Route Contract

**Date:** 2026-06-18  
**Status:** Accepted  
**Deciders:** Council Review IV (Agents 1, 2, 4 + synthesis)

---

## Context

The `gradebook` module has a complete schema (5 tables: `academy_gradebook_scales`, `academy_gradebook_scale_entries`, `academy_gradebook_assignments`, `academy_gradebook_submissions`, `academy_gradebook_records`, `academy_gradebook_course_summaries`), a `postgres-repository`, tests, and seed data. However, **zero API routes exist for gradebook operations**.

The faculty gradebook page (`/faculty/gradebook`) renders a grade entry UI but cannot persist or retrieve any grades — all submissions fail silently or error. Students cannot view their own grades because no endpoint exposes `academy_gradebook_records` or `academy_gradebook_course_summaries`.

This is a Tier 1 MVP blocker: faculty cannot grade, and students cannot see grades.

---

## Decision

Create the following API routes under `/src/app/api/academy/gradebook/`:

### Routes

| Route | Method | Actor | Purpose |
|---|---|---|---|
| `/gradebook/assignments` | GET | faculty, admin | List assignments for a section (scoped by `sectionId` query param) |
| `/gradebook/assignments` | POST | faculty, admin | Create an assignment for a section |
| `/gradebook/assignments/[id]` | PATCH | faculty, admin | Update assignment (title, max score, weight, due date) |
| `/gradebook/submissions` | GET | faculty, admin | List submissions for an assignment |
| `/gradebook/submissions` | POST | faculty, admin | Create or update a grade submission |
| `/gradebook/submissions/[id]` | PATCH | faculty, admin | Override a grade with audit note |
| `/gradebook/records` | GET | faculty, admin, student | Get course summary record(s) |

### Security Contract

Every route must:

1. Resolve the actor from the Supabase session — never from headers or `user_metadata`.
2. Verify tenant isolation: `section.tenant_id = actor.tenantId`.
3. Verify section ownership for faculty actors: `section.primary_instructor_id = actor.userId`. Faculty may not access sections they do not own.
4. Admin actors may access any section within their tenant.
5. Student actors may only read their own `academy_gradebook_records` (GET records with `studentId = actor.userId`).
6. Never return raw database error messages to the client.

### Module boundary

All DB access must go through `GradebookPostgresRepository`, not inline SQL in route files.

---

## Consequences

- Faculty gradebook UI becomes functional.
- Student PWA `/student/progress` can query real grade data.
- Admin gradebook overview can display real aggregates.
- Tests must cover: success case, cross-tenant rejection, and section-ownership rejection for faculty actors.

---

## Rejected Alternatives

- **Server components querying the DB directly** — violates the architecture rule that business logic lives in modules and routes stay thin.
- **Reusing the existing `/api/academy/registrations` route** — wrong abstraction; registrations are enrollment records, not grade records.
