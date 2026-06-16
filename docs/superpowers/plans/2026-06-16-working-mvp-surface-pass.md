# Working MVP Surface Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make staff/admin MVP navigation and index screens usable with existing tenant-scoped data.

**Architecture:** Add server-rendered index pages for Students and Programs using `loadProtectedAcademyDataset`, and add dashboard quick-action cards on `/`. The slice uses existing layouts, data loaders, and detail routes without schema changes.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Supabase-backed Academy dataset loader, Node test runner, ESLint.

---

### Task 1: Protect Index Routes With Tests

**Files:**
- Create: `src/app/__tests__/working-surface-pages.test.ts`

- [x] **Step 1: Add source-level regression tests**

Create tests that read `src/app/students/page.tsx`, `src/app/programs/page.tsx`, and `src/app/page.tsx`. Assert that Students and Programs do not import `redirect`, that both use `loadProtectedAcademyDataset`, and that the dashboard includes route labels for Admissions, Students, Programs, Faculty/Admin, Workflows, Admin Gradebook, Faculty Gradebook, and Student PWA.

- [x] **Step 2: Run the test and confirm it fails before implementation**

Run: `npm test -- src/app/__tests__/working-surface-pages.test.ts`

Expected before implementation: failures for redirect-only pages and missing dashboard quick actions.

### Task 2: Replace `/students` Redirect With Index Page

**Files:**
- Modify: `src/app/students/page.tsx`

- [x] **Step 1: Render the protected student index**

Use `AcademyShell`, `Card`, `Badge`, and `Table` components. Load `{ dataset }` from `loadProtectedAcademyDataset()`. Render student name, enrollment status, program, credits, GPA or `Not tracked`, and a link to `/students/${student.id}`.

- [x] **Step 2: Add a useful empty state**

If the protected tenant has no student records, render a staff-facing empty state linking to Admissions instead of redirecting to `/`.

### Task 3: Replace `/programs` Redirect With Index Page

**Files:**
- Modify: `src/app/programs/page.tsx`

- [x] **Step 1: Render the protected program index**

Use `AcademyShell`, `Card`, `Badge`, and `Table`. Load `{ dataset }` from `loadProtectedAcademyDataset()`. Render program name, credential, cohort, required credits, active student count, and a link to `/programs/${program.id}`.

- [x] **Step 2: Add a useful empty state**

If the tenant has no programs, render an empty state linking to settings/courses instead of redirecting to `/`.

### Task 4: Add Dashboard Quick Actions

**Files:**
- Modify: `src/app/page.tsx`

- [x] **Step 1: Add quick-action definitions**

Add a small array of route cards for Admissions, Students, Programs, Faculty/Admin, Workflows, Admin Gradebook, Faculty Gradebook, and Student PWA.

- [x] **Step 2: Render action cards below the metrics**

Use existing `Card`, `Link`, and icon styling patterns. Keep it readable and avoid adding a new component library.

### Task 5: Update Docs And Verify

**Files:**
- Modify: `docs/project-status.md`

- [x] **Step 1: Record the surface pass**

Add a short line that Students and Programs indexes plus dashboard quick actions are now working MVP surfaces.

- [x] **Step 2: Run verification**

Run:

```bash
npm run lint
npm test
npm run build
```

Expected: all pass. The existing Edge runtime static-generation warning may still appear during build.
