# ADR-2025-009: ChurchCore Academy Gradebook System

Status: Accepted for Phase 1 Sprint 1.1

Date: 2026-06-16

## Context

ChurchCore Academy needs a gradebook domain that keeps LMS delivery records separate from SIS record-of-truth grades. The domain must also honor LLIS privacy expectations for consent, sensitivity tiers, and pastoral data handling.

The council prompt names generic tables such as `assignments`, `assignment_submissions`, `grade_records`, and `course_grade_summaries`. This repository already uses tenant-scoped `academy_*` tables, so the implementation maps those concepts into `academy_gradebook_*` tables rather than introducing a second institution model.

## Decision

Implement Phase 1 as a repo-native Gradebook domain:

- LMS delivery layer: `academy_gradebook_assignments` and `academy_gradebook_submissions`.
- SIS record layer: `academy_gradebook_records` and `academy_gradebook_course_summaries`.
- Configuration layer: `academy_gradebook_scales` and `academy_gradebook_scale_entries`.
- Audit layer: `academy_gradebook_override_audit`, append-only by trigger.
- Sensitivity tier fields on assignments, records, and summaries.
- Nullable Phase 2 AI hooks only on grade records; no Phase 2 AI tables.
- Growth-framed learner display through `growthFrameFilter`.

All new public tables enable and force RLS. `anon` receives no table grants. Authenticated grants are explicit and constrained by tenant/person policies. Any `service_role` process must still perform manual authorization because it bypasses RLS.

## Consequences

Phase 1 establishes the durable data boundary and write APIs without implementing AI suggestions, AI learner scores, or progress narratives. Read-model wiring and bulk grade operations can build on this schema without changing the separation between LMS submissions and SIS grades.
