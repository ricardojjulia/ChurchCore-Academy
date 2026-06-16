# Admissions Transactional Workflow Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the admissions-to-enrollment MVP workflow surface and remove the existing Edge runtime build warning.

**Architecture:** Keep the existing transactional conversion service and database schema. Add only safe review-model projection and UI linking for converted applications. Move `/api/ai` back to the default Next.js runtime.

**Tech Stack:** Next.js App Router, React, TypeScript, Node test runner, Supabase/Postgres-backed Academy services.

---

### Task 1: Edge Runtime Warning Regression

**Files:**
- Modify: `src/app/api/ai/route.ts`
- Test: `src/app/api/ai/__tests__/route.test.ts`

- [x] **Step 1: Add a failing source-regression test**

Add a test that reads `src/app/api/ai/route.ts` and asserts it does not export `runtime = "edge"`.

- [x] **Step 2: Run the focused test**

Run: `npm test -- src/app/api/ai/__tests__/route.test.ts`

Expected before implementation: the new test fails because the route still exports Edge runtime.

- [x] **Step 3: Remove the Edge runtime export**

Delete `export const runtime = "edge";` from `src/app/api/ai/route.ts`.

- [x] **Step 4: Re-run the focused test**

Run: `npm test -- src/app/api/ai/__tests__/route.test.ts`

Expected after implementation: all API AI route tests pass.

### Task 2: Converted Admissions Student Link

**Files:**
- Modify: `src/modules/admissions/review-model.ts`
- Modify: `src/modules/admissions/__tests__/review-model.test.ts`
- Modify: `src/components/admissions-application-list.tsx`
- Test: `src/components/__tests__/admissions-application-list.test.ts`

- [x] **Step 1: Add failing review-model coverage**

Assert that converted applications expose `studentProfileId` and unconverted applications do not.

- [x] **Step 2: Add failing component source coverage**

Assert the admissions list imports `Link`, renders `View student record`, and uses `/students/${application.studentProfileId}`.

- [x] **Step 3: Run the focused tests**

Run: `npm test -- src/modules/admissions/__tests__/review-model.test.ts src/components/__tests__/admissions-application-list.test.ts`

Expected before implementation: the new assertions fail.

- [x] **Step 4: Add the safe projection and link**

Add `studentProfileId?: string` to `AdmissionReviewItem`, project it only for converted applications, and render a link for converted rows.

- [x] **Step 5: Re-run the focused tests**

Run: `npm test -- src/modules/admissions/__tests__/review-model.test.ts src/components/__tests__/admissions-application-list.test.ts`

Expected after implementation: tests pass.

### Task 3: Documentation And Verification

**Files:**
- Modify: `docs/project-status.md`
- Modify: `docs/superpowers/plans/2026-06-16-admissions-transactional-workflow.md`

- [x] **Step 1: Update project status**

Record that admissions-to-student conversion is now visible in the staff workflow.

- [x] **Step 2: Mark this plan complete**

Change each task checkbox to `[x]` after implementation and verification.

- [x] **Step 3: Run full verification**

Run:

```bash
npm run lint
npm test
npm run build
git diff --check
```

Expected: all commands exit successfully and build output does not include the Edge runtime static-generation warning.
