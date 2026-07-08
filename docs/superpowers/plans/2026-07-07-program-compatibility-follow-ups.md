# Program Compatibility Follow-Ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the flagged follow-ups by reconciling admin-created academic programs with legacy program consumers, removing remaining deprecated `pg` import patterns, and preserving the ADR-0068 foundation already implemented on this branch.

**Architecture:** Keep `academy_academic_programs` as the canonical admin program model. Add an append-only compatibility migration and repository mirror so legacy consumers of `academy_programs` receive active/admin-created programs without changing their FK chains in this slice.

**Tech Stack:** Next.js App Router, TypeScript, Node test runner, PostgreSQL/Supabase migrations, `pg`.

---

### Task 1: Program Compatibility Contract

**Files:**
- Modify: `src/modules/academic-programs/__tests__/academic-programs.test.ts`
- Modify: `src/modules/academic-programs/postgres-repository.ts`
- Create: `supabase/migrations/20260707190000_academic_programs_legacy_compatibility.sql`

- [x] **Step 1: Write failing tests**

Add tests proving program creation, update, archive, and migration SQL keep the legacy table compatible with public admissions/reporting readers.

- [x] **Step 2: Verify red**

Run:

```bash
node --import tsx --test src/modules/academic-programs/__tests__/academic-programs.test.ts
```

Expected: fails because the migration file and legacy sync writes do not exist yet.

- [x] **Step 3: Implement minimal bridge**

Create an append-only migration that adds legacy compatibility columns and backfills from `academy_academic_programs`. Update `PostgresAcademicProgramRepository` so create/update/archive synchronize `academy_programs`.

- [x] **Step 4: Verify green**

Run:

```bash
node --import tsx --test src/modules/academic-programs/__tests__/academic-programs.test.ts
```

Expected: all academic-program tests pass.

### Task 2: `pg` Deprecation Pattern Cleanup

**Files:**
- Create: `scripts/__tests__/pg-import-pattern.test.ts`
- Modify: `scripts/verify-admissions-rls.ts`
- Modify: `scripts/verify-llis-consent-rls.ts`
- Modify: `scripts/verify-enrollment-conversion-rls.ts`

- [x] **Step 1: Write failing static guard**

Add a test that rejects `import pg from "pg"` and `new pg.Client`.

- [x] **Step 2: Verify red**

Run:

```bash
node --import tsx --test scripts/__tests__/pg-import-pattern.test.ts
```

Expected: fails on the three RLS verification scripts.

- [x] **Step 3: Replace imports**

Use named `Client` imports and type-only `Client` aliases from `pg`.

- [x] **Step 4: Verify green**

Run:

```bash
node --import tsx --test scripts/__tests__/pg-import-pattern.test.ts
```

Expected: static guard passes.

### Task 3: Full Verification

- [x] Run focused academic program tests.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Commit the verified follow-up slice.
