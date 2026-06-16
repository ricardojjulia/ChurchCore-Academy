# Gradebook Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement ADR-2025-009 Gradebook Sprint 1.1 for ChurchCore Academy without building Phase 2 AI features.

**Architecture:** The pasted prompt uses generic `organizations`, `courses`, `enrollments`, `user_roles`, and UUID user IDs; this repo uses tenant-scoped Academy tables such as `academy_institution_profiles`, `academy_courses`, `academy_course_sections`, `academy_people`, `academy_program_enrollments`, `academy_course_section_registrations`, and `academy_private` RLS helpers. Implement the ADR semantics in repo-native `academy_gradebook_*` tables so migrations run against the existing schema while preserving SIS/LMS separation, sensitivity tiers, append-only overrides, server-side authorization, and learner-safe display.

**Tech Stack:** Supabase Postgres migrations and RLS, Next.js App Router, server actions, TypeScript, Zod, React Hook Form-ready schemas, shadcn-compatible UI primitives, Node test runner.

---

### File Map

- Create `supabase/migrations/20260616002351_gradebook_phase1.sql`: Phase 1 gradebook schema, RLS, grants, append-only audit trigger, pastoral sensitivity audit trigger.
- Create `src/types/gradebook.ts`: domain TypeScript contracts from ADR-2025-009, adapted to existing Academy tenant/person IDs.
- Create `src/lib/gradebook/growthFrameFilter.ts`: learner-safe text transformation.
- Create `docs/growth-frame-filter.md`: documented learner-safe rules.
- Create `src/lib/actions/gradebook/submitGradeAction.ts`: typed grade write action with validation and server-side course ownership checks.
- Create `src/lib/actions/gradebook/overrideGradeAction.ts`: typed override action with transaction and immutable audit insert.
- Create `src/components/academy/gradebook/*`: minimal Phase 1 gradebook components and Phase 2 placeholders.
- Create route scaffolds under `src/app/dashboard/admin/gradebook`, `src/app/dashboard/instructor/gradebook`, and `src/app/dashboard/learner/grades`.
- Create tests under `src/modules/gradebook/__tests__`, `src/lib/gradebook/__tests__`, `src/lib/actions/gradebook/__tests__`, and component tests where possible.

### Task 1: Migration and RLS

- [ ] Write migration tests that assert the gradebook migration creates `academy_gradebook_scales`, `academy_gradebook_scale_entries`, `academy_gradebook_assignments`, `academy_gradebook_submissions`, `academy_gradebook_records`, `academy_gradebook_course_summaries`, and `academy_gradebook_override_audit`.
- [ ] Write tests asserting `sensitivity_tier` exists on records and course summaries, `is_late` is not a generated stored column, `ai_narrative_id` does not exist, and Phase 2 AI fields remain nullable hooks only.
- [ ] Fill `supabase/migrations/20260616002351_gradebook_phase1.sql` with repo-native table definitions and comments mapping them to ADR-2025-009 generic names.
- [ ] Add RLS with `service_role` warning comments and `academy_private` helper functions. Grant only necessary table privileges to `authenticated`; revoke all from `anon`.
- [ ] Add append-only trigger for `academy_gradebook_override_audit` and pastoral write audit trigger inserting into `academy_audit_events`.
- [ ] Run migration tests.

### Task 2: Types and GrowthFrameFilter

- [ ] Create `src/types/gradebook.ts` with ADR-2025-009 Phase 1 types.
- [ ] Create `src/lib/gradebook/growthFrameFilter.ts` with percentage-to-growth-label rules, pastoral-safe copy, and raw score secondary display only.
- [ ] Create `docs/growth-frame-filter.md` documenting all five transformation rules and Phase 2 gating notes.
- [ ] Add tests for 90/80/70/60/<60 labels, second-person statements, raw score not primary, and pastoral copy.
- [ ] Run gradebook library tests.

### Task 3: Server Actions

- [ ] Create `submitGradeAction` with `submitGradeSchema`, typed results, authenticated actor resolution, course ownership checks, submission/assignment matching, no Phase 2 AI population, safe DB error handling, and cache revalidation.
- [ ] Create `overrideGradeAction` with `overrideGradeSchema`, typed results, transaction-owned update plus audit insert, mandatory "Reason for adjustment", previous/new JSON snapshots, and safe error handling.
- [ ] Add unit tests using dependency injection for validation failures, unauthenticated access, unauthorized course access, submission mismatch, successful grade write, override transaction success, and wrapped DB errors.
- [ ] Run action tests.

### Task 4: Components and Routes

- [ ] Create minimal Phase 1 components: `GradebookTable`, `GradeEntryForm`, `OverrideForm`, `OverrideAuditLog`, `GradeDisplayCard`, `GrowthFramedGrade`, `ColumnVisibilityConfig`, plus placeholder `ConsentStatusBadge` and `AIGeneratedBadge`.
- [ ] Ensure `OverrideAuditLog` always shows "Adjustment History — Permanent Record" with no edit/delete/collapse controls.
- [ ] Ensure `OverrideForm` label is exactly "Reason for adjustment" and shows the permanent-record success notice text.
- [ ] Ensure learner display uses `GrowthFramedGrade` and never renders raw percentage as the primary label.
- [ ] Add route scaffolds for admin, instructor, and learner portals with server-side role comments and safe empty states.
- [ ] Run lint and build.

### Task 5: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run lint -- --quiet`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Verify no references to Phase 2 table creation exist for `ai_learner_scores` or `ai_progress_narratives`.
- [ ] Summarize completed acceptance checklist items and any intentionally deferred Phase 2 work.
