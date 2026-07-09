# LMS Sandbox Evidence Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist LMS sandbox validation evidence and show it in the readiness surface.

**Architecture:** Add a tenant-scoped evidence table, a focused repository/service under `src/modules/lms-contract`, extend the existing readiness API, and add a small client form to `/admin/settings/lms`.

**Tech Stack:** Next.js App Router, React, TypeScript, Postgres/Supabase RLS, node:test with `tsx`.

---

### Task 1: Schema And Repository

**Files:**
- Modify: `supabase/migrations/20260709230528_lms_sandbox_evidence.sql`
- Create: `src/modules/lms-contract/sandbox-evidence.ts`
- Test: `src/modules/lms-contract/__tests__/sandbox-evidence.test.ts`

- [x] Write failing tests for migration RLS and repository mapping.
- [x] Implement the table, RLS, repository, and evidence validation.
- [x] Run focused tests.

### Task 2: Readiness API Integration

**Files:**
- Modify: `src/app/api/academy/lms/readiness/route.ts`
- Modify: `src/app/api/academy/lms/readiness/route.test.ts`

- [x] Write failing tests for loading persisted evidence and posting evidence.
- [x] Extend GET to pass persisted evidence into `buildLmsProviderReadinessModel`.
- [x] Extend POST with `record_sandbox_evidence`.
- [x] Run focused route tests.

### Task 3: Settings UI

**Files:**
- Modify: `src/app/admin/settings/lms/page.tsx`
- Create: `src/app/admin/settings/lms/LmsSandboxEvidenceForm.tsx`
- Modify: `src/app/admin/settings/lms/__tests__/page-source.test.ts`

- [x] Write failing source test for the evidence form and API action.
- [x] Render the form for Moodle and Canvas.
- [x] Run focused UI source test.

### Task 4: Verification

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `npm run verify:migration-seed-rehearsal`.
- [x] Run `git diff --check`.
- [x] Browser-smoke `/admin/settings/lms` evidence recording.
