# T2-08 Transcript PDF Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete T2-08 transcript PDF generation and signed download access for released transcript issuances.

**Architecture:** Keep transcript document generation in the existing `src/modules/transcripts` module because this worktree already has the transcript service, storage, routes, and tests there. API routes remain thin: resolve actor, load the tenant-scoped issuance, enforce role/ownership/status, then delegate PDF storage and signed URL creation to module helpers.

**Tech Stack:** Next.js App Router API routes, TypeScript, Node `node:test`, Supabase Storage, `@react-pdf/renderer`.

---

### Task 1: Cover Missing T2-08 PDF Storage Behaviors

**Files:**
- Modify: `src/modules/transcripts/__tests__/pdf-generator.test.ts`
- Modify: `src/modules/transcripts/pdf-generator.tsx`
- Modify: `src/modules/transcripts/storage.ts`

- [x] **Step 1: Write focused tests**

Add tests that assert:
- `generateTranscriptPdf()` stores at `tenant/student/issuance.pdf` in the `transcripts` bucket and signs with a 900-second TTL.
- Existing objects are not uploaded again.
- Empty `gradeRows` still uploads a PDF.
- Internal issuance notes are not accepted as PDF data and do not appear in uploaded output assertions.

- [x] **Step 2: Run focused test**

Run: `node --import tsx --test src/modules/transcripts/__tests__/pdf-generator.test.ts`
Expected: PASS once the existing renderer/storage behavior is locked down for no-grade and privacy cases.

- [x] **Step 3: Implement minimal module changes**

Keep `TranscriptPdfData` limited to public transcript fields, preserve private bucket path generation, and keep signed URL TTL at 900 seconds.

- [x] **Step 4: Run focused test to verify green**

Run: `node --import tsx --test src/modules/transcripts/__tests__/pdf-generator.test.ts`
Expected: PASS.

### Task 2: Complete Released Download Route

**Files:**
- Modify: `src/app/api/academy/transcripts/[id]/download/route.ts`
- Modify: `src/app/api/academy/transcripts/__tests__/routes.test.ts`

- [x] **Step 1: Write failing route tests**

Add tests that assert:
- A student can download only their own released transcript and receives a redirect to a signed URL.
- A student cannot download another student's transcript.
- Held or issued transcripts return 403 instead of a signed URL.
- Missing storage on a released transcript triggers PDF generation once and updates the transcript storage path.

- [x] **Step 2: Run focused route test to verify red**

Run: `node --import tsx --test src/app/api/academy/transcripts/__tests__/routes.test.ts`
Expected: FAIL because the current route is not dependency-injectable for `findById` and does not generate PDFs on demand.

- [x] **Step 3: Implement minimal route changes**

Add testable dependencies for `findById`, PDF data generation, PDF storage generation, and storage URL persistence. Enforce tenant, role, ownership, and released-status checks before reading grade/PDF data.

- [x] **Step 4: Run focused route test to verify green**

Run: `node --import tsx --test src/app/api/academy/transcripts/__tests__/routes.test.ts`
Expected: PASS.

### Task 3: Final Verification

**Files:**
- Verify changed files only and full repo gates.

- [x] **Step 1: Run focused tests**

Run:
`node --import tsx --test src/modules/transcripts/__tests__/pdf-generator.test.ts`
`node --import tsx --test src/app/api/academy/transcripts/__tests__/routes.test.ts`

- [x] **Step 2: Run repo gates**

Run:
`npm run lint`
`npm run build`
`git diff --check`

- [x] **Step 3: Inspect diff**

Confirm no unrelated grading, billing, admissions, or registration files changed, and no secret/internal note field is rendered into transcript PDF data.
