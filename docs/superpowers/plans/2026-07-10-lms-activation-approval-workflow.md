# LMS Activation Approval Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a governed LMS activation request and approval workflow.

**Architecture:** Add a tenant-scoped activation request table/repository, compute eligibility from existing sandbox evidence and check results, extend the LMS readiness API, and render request/approve/reject controls on `/admin/settings/lms`.

**Tech Stack:** Next.js App Router, React, TypeScript, Postgres/Supabase RLS, node:test with `tsx`.

---

### Task 1: Activation Request Repository

**Files:**
- Modify: `supabase/migrations/20260710180231_lms_activation_approval_requests.sql`
- Create: `src/modules/lms-contract/activation-requests.ts`
- Test: `src/modules/lms-contract/__tests__/activation-requests.test.ts`

- [x] Write failing tests for migration shape, secret rejection, eligibility, request, approve, reject, and list latest.
- [x] Implement migration, validation, eligibility, mapper, and repository.
- [x] Run `node --import tsx --test src/modules/lms-contract/__tests__/activation-requests.test.ts`.

### Task 2: Readiness API Integration

**Files:**
- Modify: `src/app/api/academy/lms/readiness/route.ts`
- Modify: `src/app/api/academy/lms/readiness/route.test.ts`
- Modify: `src/modules/lms-contract/provider-readiness.ts`

- [x] Write failing tests for GET activation request status and POST request/approve/reject actions.
- [x] Add activation requests to readiness provider model.
- [x] Wire GET to list latest activation requests.
- [x] Wire POST to request, approve, and reject activation.
- [x] Run `node --import tsx --test src/app/api/academy/lms/readiness/route.test.ts`.

### Task 3: Settings UI

**Files:**
- Create: `src/app/admin/settings/lms/LmsActivationRequestActions.tsx`
- Modify: `src/app/admin/settings/lms/page.tsx`
- Modify: `src/app/admin/settings/lms/__tests__/page-source.test.ts`

- [x] Write failing source test for activation request controls and safe action names.
- [x] Render current activation request status and admin controls.
- [x] Run `node --import tsx --test src/app/admin/settings/lms/__tests__/page-source.test.ts`.

### Task 4: Verification And Publish

- [x] Run focused LMS activation tests.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `npm run db:migrate:local`.
- [x] Run `npm run verify:migration-seed-rehearsal`.
- [x] Run `git diff --check`.
- [x] Browser-smoke `/admin/settings/lms` activation request action.
- [ ] Commit, push, open PR, wait for CI, merge, and sync local `main`.
