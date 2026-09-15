# Program Curriculum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add year-versioned Program Curriculum so admins can define required courses for a program by academic year of entry.

**Architecture:** Add a tenant-scoped `academy_program_curriculum_requirements` table keyed by academic program, academic year, and course. Implement a small module with validation, repository persistence, request-scoped API routes, and a Program detail UI panel that edits one catalog year at a time.

**Tech Stack:** Next.js App Router, React 19, TypeScript, PostgreSQL/Supabase RLS, Node test runner, ESLint.

---

### Task 1: Persistence And Domain Contract

- [x] Write failing tests for migration shape, service validation, repository replacement semantics, and API source boundary.
- [x] Add the append-only migration.
- [x] Add `program-curriculum` types, service, and Postgres repository.
- [x] Verify focused tests pass.

### Task 2: API And Admin UI

- [x] Add `GET` and `PUT` routes under `/api/academy/programs/[id]/curriculum`.
- [x] Load years, active courses, and initial curriculum on the Program detail page.
- [x] Add a client-side curriculum editor panel to the Program detail page.
- [x] Preserve existing Program detail edit/archive behavior.

### Task 3: Verification

- [x] Run focused program-curriculum tests.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Browser smoke `/admin/programs/[id]` curriculum panel.
- [x] Commit the verified slice.
