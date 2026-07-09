# Student Groups / Cohorts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete admin workflows for academic-year-scoped student groups and dated roster membership.

**Architecture:** Persist groups and memberships in dedicated tenant-scoped tables. Route all behavior through a typed service and Postgres repository, expose request-scoped APIs, and provide a single focused admin management surface plus student-record visibility.

**Tech Stack:** Next.js App Router, React, TypeScript, PostgreSQL/Supabase, Node test runner, existing ChurchCore Academy UI primitives.

---

### Task 1: Persistence And Domain Contract

**Files:**
- Create: `supabase/migrations/20260709132902_student_groups.sql`
- Create: `src/modules/student-groups/types.ts`
- Create: `src/modules/student-groups/service.ts`
- Create: `src/modules/student-groups/postgres-repository.ts`
- Test: `src/modules/student-groups/__tests__/student-groups.test.ts`

- [x] Write failing schema, authorization, validation, and repository tests.
- [x] Run the focused test and confirm failures are caused by missing behavior.
- [x] Add tenant-scoped group and membership tables with RLS and constraints.
- [x] Implement group lifecycle and roster operations.
- [x] Run the focused test until green.

### Task 2: Request-Scoped APIs

**Files:**
- Create: `src/app/api/academy/student-groups/route.ts`
- Create: `src/app/api/academy/student-groups/[id]/route.ts`
- Create: `src/app/api/academy/student-groups/[id]/members/route.ts`
- Create: `src/app/api/academy/student-groups/[id]/members/[membershipId]/route.ts`

- [x] Add failing route-structure assertions.
- [x] Implement list/create/update and roster add/remove handlers.
- [x] Verify every route resolves the actor and uses database context.

### Task 3: Admin And Student Surfaces

**Files:**
- Create: `src/app/admin/groups/page.tsx`
- Create: `src/app/admin/groups/StudentGroupsClient.tsx`
- Create: `src/app/admin/students/[id]/StudentGroupsCard.tsx`
- Modify: `src/app/admin/students/[id]/page.tsx`
- Modify: `src/components/admin-shell.tsx`

- [x] Add failing navigation and UI assertions.
- [x] Implement group management and roster controls.
- [x] Show group memberships on the student Academic Record.
- [x] Run focused tests until green.

### Task 4: Full Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run the repository migration/seed rehearsal command.
- [x] Run `git diff --check`.
- [x] Browser-smoke create, roster assignment, membership visibility, removal, and archive.
