# ADR-0068 Program And Course Route Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue ADR-0068 by migrating the admin Programs and Courses route families to route-level SIS design-system classes and clear the remaining student detail lint warning.

**Architecture:** Keep behavior unchanged. Preserve the existing Card/Table/Badge primitives, replace older route-local `ops-*` and `student-empty-state` class usage in `/admin/programs` and `/admin/courses` with token-backed `sis-route-*` classes, and retain legacy CSS selectors for other route groups until they are migrated.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind/token CSS, Node test runner, ESLint.

---

### Task 1: Route Migration Contract

**Files:**
- Create: `src/app/admin/__tests__/design-system-route-migration.test.ts`
- Modify: `src/app/admin/programs/page.tsx`
- Modify: `src/app/admin/programs/new/page.tsx`
- Modify: `src/app/admin/programs/[id]/ProgramDetailClient.tsx`
- Modify: `src/app/admin/courses/page.tsx`
- Modify: `src/styles/admin.css`

- [x] Write a failing source contract that rejects legacy route classes in the Programs and Courses route families.
- [x] Verify the test fails because the routes still use `ops-*` and `student-empty-state`.
- [x] Add token-backed `sis-route-*` CSS selectors.
- [x] Move Programs and Courses route-family class names to `sis-route-*`.
- [x] Verify the focused route migration test passes.

### Task 2: Lint Cleanup

**Files:**
- Modify: `src/app/admin/students/[id]/page.tsx`

- [x] Write a source contract that rejects the unused `RelationshipRow` interface.
- [x] Verify the test fails while the unused interface exists.
- [x] Remove the unused interface.
- [x] Verify the focused route migration test passes.

### Task 3: Verification

- [x] Run `node --import tsx --test src/app/admin/__tests__/design-system-route-migration.test.ts`.
- [x] Run `node --import tsx --test src/components/ui/design-system-contract.test.ts`.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Browser-smoke `/admin/programs` and `/admin/courses`.
- [x] Commit the verified slice.
