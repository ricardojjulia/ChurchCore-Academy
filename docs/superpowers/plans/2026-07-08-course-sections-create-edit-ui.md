# Course Sections Create Edit UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin create/edit workflows for Course Sections so Academy can schedule real sections before student enrollment and LMS roster sync.

**Architecture:** Reuse existing `course-catalog` section mutation functions and `/api/academy/sections` routes. Convert `/admin/sections` from a read-only roster view into a server-loaded page with course, period, staff, and subdivision options, plus a client dialog for create/edit.

**Tech Stack:** Next.js App Router, React 19, TypeScript, PostgreSQL/Supabase RLS, Node test runner, ESLint.

---

### Task 1: Red Tests And Route Contract

- [x] Write failing source tests for `/admin/sections` create/edit UI wiring.
- [x] Write failing source tests for section API payload support.
- [x] Verify focused tests fail before implementation.

### Task 2: Server Data And Client UI

- [x] Load active/draft courses, academic periods, subdivisions, and staff instructors on `/admin/sections`.
- [x] Add `SectionFormDialog` for create and edit workflows.
- [x] Add create button, edit buttons, and preserve the existing roster/registration review.
- [x] Keep the UI in ADR-0068 route-level classes instead of legacy admin-only panels.

### Task 3: API Coverage

- [x] Ensure section create accepts optional title, schedule, capacity, subdivision, and primary instructor.
- [x] Ensure section edit accepts title, delivery mode, schedule, capacity, and primary instructor role.
- [x] Keep mutations request-scoped through `withAcademyDatabaseContext`.

### Task 4: Verification

- [x] Run focused admin source tests.
- [x] Run focused section mutation/API tests.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Browser smoke create/edit section from `/admin/sections`.
- [x] Commit the verified slice.
