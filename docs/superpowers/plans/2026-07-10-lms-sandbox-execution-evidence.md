# LMS Sandbox Execution Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and display deterministic Moodle/Canvas sandbox check run results.

**Architecture:** Add a tenant-scoped results table and repository under `src/modules/lms-contract`, a local sandbox check runner that consumes recorded evidence plus roster eligibility, extend the existing LMS readiness API, and add a compact run/check-results UI to `/admin/settings/lms`.

**Tech Stack:** Next.js App Router, React, TypeScript, Postgres/Supabase RLS, node:test with `tsx`.

---

### Task 1: Result Schema And Repository

**Files:**
- Modify: `supabase/migrations/20260710025815_lms_sandbox_execution_results.sql`
- Create: `src/modules/lms-contract/sandbox-check-results.ts`
- Test: `src/modules/lms-contract/__tests__/sandbox-check-results.test.ts`

- [x] Write failing tests for migration RLS, secret rejection, repository upsert/list, and readiness grouping.
- [x] Implement table, RLS policy, result validation, mapper, repository, and grouping helper.
- [x] Run `node --import tsx --test src/modules/lms-contract/__tests__/sandbox-check-results.test.ts`.

### Task 2: Deterministic Sandbox Runner

**Files:**
- Create: `src/modules/lms-contract/sandbox-check-runner.ts`
- Test: `src/modules/lms-contract/__tests__/sandbox-check-runner.test.ts`

- [x] Write failing tests for pass/fail/skipped behavior without provider secrets.
- [x] Implement provider-neutral check definitions and local deterministic runner.
- [x] Run `node --import tsx --test src/modules/lms-contract/__tests__/sandbox-check-runner.test.ts`.

### Task 3: Readiness API Integration

**Files:**
- Modify: `src/app/api/academy/lms/readiness/route.ts`
- Modify: `src/app/api/academy/lms/readiness/route.test.ts`
- Modify: `src/modules/lms-contract/provider-readiness.ts`

- [x] Write failing route tests for loading check results and posting `run_sandbox_checks`.
- [x] Extend readiness model with `sandboxCheckResults`.
- [x] Extend GET to include persisted results.
- [x] Extend POST to run and persist check results.
- [x] Run `node --import tsx --test src/app/api/academy/lms/readiness/route.test.ts`.

### Task 4: Settings UI

**Files:**
- Create: `src/app/admin/settings/lms/LmsSandboxCheckRunner.tsx`
- Modify: `src/app/admin/settings/lms/page.tsx`
- Modify: `src/app/admin/settings/lms/__tests__/page-source.test.ts`

- [x] Write failing source tests for check result display and run action.
- [x] Render latest check results per provider and admin-only run button.
- [x] Run `node --import tsx --test src/app/admin/settings/lms/__tests__/page-source.test.ts`.

### Task 5: Verification And Publish

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `npm run db:migrate:local`.
- [x] Run `npm run verify:migration-seed-rehearsal`.
- [x] Run `git diff --check`.
- [x] Browser-smoke `/admin/settings/lms` check execution.
- [ ] Commit, push, open PR, wait for CI, merge, and sync local `main`.
