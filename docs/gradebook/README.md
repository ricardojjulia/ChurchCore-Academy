# ChurchCore Academy Gradebook

ADR: `docs/adr/0024-gradebook-system.md`

Phase: 1, Sprint 1.1

## Scope

This slice creates the Gradebook foundation:

- Tenant-scoped Supabase schema and RLS for gradebook tables.
- Instructor grade submission action.
- Grade override action with immutable audit insert.
- Student-safe GrowthFrameFilter.
- Admin, instructor, and learner route scaffolds.
- Component scaffolds for grade display, grade entry, overrides, audit logs, consent, AI badges, and column visibility.

## Boundaries

The Gradebook domain keeps three layers separate:

- LMS delivery records: assignments and submissions.
- SIS records: grade records and course summaries.
- AI layer: deferred to Phase 2.

Phase 1 does not create `ai_learner_scores`, `ai_progress_narratives`, or learner-facing AI narratives.

## Routes

- `/dashboard/admin/gradebook`
- `/dashboard/instructor/gradebook`
- `/dashboard/learner/grades`

Repo aliases currently redirect canonical instructor/learner routes to the local faculty/student route names:

- `/dashboard/faculty/gradebook`
- `/dashboard/student/grades`

## Security Notes

All gradebook tables enable and force RLS. `anon` grants are revoked. Authenticated grants are explicit. `academy_gradebook_override_audit` is append-only by trigger and does not grant update/delete to authenticated users.

Pastoral sensitivity writes are recorded through `academy_private.academy_audit_pastoral_gradebook_write()`.
