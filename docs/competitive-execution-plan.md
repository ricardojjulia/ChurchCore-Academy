# ChurchCore Academy — Master Execution Plan
## From 3.5/10 to Market-Leading SIS

**Established:** 2026-06-22
**Governs:** All implementation work for Tier 1–3 of the Competitive Roadmap
**Authority:** Supersedes all prior sprint plans until every Tier 1 and Tier 2 checkbox is ☒

---

## How to Use This Plan

Each sprint section below names one or more parallel agent pairs (A, B, C).
Each agent pair runs as a background agent using the `backend-builder` or `frontend-builder`
agent type. After all pairs in a sprint complete, run `npm test && npm run lint && npm run build`
before starting the next sprint.

**Agent prompt instruction for every agent:** Start by reading `CLAUDE.md` and the story file
listed. Then read the ADR linked in the story's Technical Notes section. Then read the existing
codebase files listed in Technical Notes. Do not refactor code outside the story scope.
Follow the factory process: module function → repository → API route → UI → tests.

---

## Pre-Sprint Gate

Before any sprint begins, verify:
- [ ] Local Supabase is running (`supabase start`)
- [ ] `npm test` passes (currently: all tests green)
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

---

## SPRINT 1 — Kill the Blockers (Tier 1, Part A)

**Goal:** ShepherdAI becomes a real work-tracking tool. Email stops being a dead-end.
**Agents:** 2 parallel pairs

### Sprint 1-A: ShepherdAI Workflow Action Persistence
**Story:** `docs/superpowers/specs/T1-01-shepherd-ai-workflow-action-persistence.md`
**ADR:** `docs/adr/0039-shepherd-ai-workflow-action-persistence.md`
**Agent type:** `backend-builder` then `frontend-builder`

Implementation sequence:
1. Write migration: `academy_shepherd_ai_workflow_actions` table
   - columns: id, tenant_id, suggestion_id, actor_person_id, action (promote/dismiss/snooze/resolve), snooze_until (nullable), note (nullable), created_at
   - RLS: admin + registrar write; faculty read own section suggestions
2. Write `ShepherdAiWorkflowActionRepository` in `src/modules/shepherd-ai/`
   - `recordAction(tenantId, suggestionId, action, actorPersonId, options)` — insert
   - `fetchLatestActionBySuggestion(tenantId, suggestionIds[])` — returns map of suggestionId → latest action
3. Update `src/app/admin/workflows/page.tsx` — merge persisted actions with live suggestions
4. Update workflow action API routes to write to repository instead of in-memory
5. Tests: success, cross-tenant rejection, snooze expiry logic

### Sprint 1-B: Email Delivery Provider (Resend)
**Story:** `docs/superpowers/specs/T1-02-email-delivery-provider.md`
**ADR:** `docs/adr/0040-email-delivery-provider-and-queue-worker.md`
**Agent type:** `backend-builder`

Implementation sequence:
1. Add `resend` package (document in PR)
2. Write `src/lib/email-worker.ts`:
   - `deliverPendingEmails(client)` — polls for `status: 'queued'` messages, delivers via Resend REST API
   - Updates each record to `delivered` or `failed` with reason
   - Idempotency: skip messages already `delivered` or `failed`
3. Write `src/app/api/cron/email-worker/route.ts` — Vercel Cron endpoint (GET, verified by `CRON_SECRET` header)
4. Add `vercel.json` cron config: run every 60 seconds
5. Tests: deliver success, delivery failure handling, idempotency (no double-send), opt-out enforcement

**Sprint 1 verify:** `npm test && npm run lint && npm run build`

---

## SPRINT 2 — Kill the Blockers (Tier 1, Part B)

**Goal:** External applicants can submit applications. GPA-drop becomes the first live ShepherdAI signal with real data.
**Agents:** 2 parallel pairs

### Sprint 2-A: Public Applicant Portal
**Story:** `docs/superpowers/specs/T1-03-public-applicant-portal.md`
**ADR:** `docs/adr/0041-public-applicant-portal-auth-boundary.md`
**Agent type:** `frontend-builder` + `backend-builder`

Implementation sequence:
1. Write `src/app/apply/page.tsx` — public page, no auth required
   - Form: legal name, email, phone, program interest (dropdown from public program list), start term, personal statement
   - Honeypot field for spam prevention
2. Write `src/app/api/apply/route.ts` — POST, no session required
   - Resolve tenant from request domain or `?school=` query param
   - Rate limit via Supabase RPC (`check_apply_rate_limit(ip_hash, tenant_id)`)
   - Create `academy_admissions_applications` record with `status: submitted`
   - Issue confirmation token (UUID, stored as SHA-256 hash)
   - Enqueue confirmation email via `CommunicationsService`
   - Return `{ token }` to client
3. Write `src/app/apply/status/page.tsx` — token-based status lookup (no session)
4. Write the rate-limit RPC migration
5. Tests: success, duplicate email handling, rate limit rejection, cross-tenant isolation

### Sprint 2-B: GPA-Drop Early-Alert Signal
**Story:** `docs/superpowers/specs/T1-04-gpa-drop-early-alert.md`
**ADR:** `docs/adr/0043-gpa-calculation-engine-grade-profile-linkage.md`
**Agent type:** `backend-builder`

Implementation sequence:
1. Write `src/modules/grading/gpa-calculator.ts` — `computeStudentGpa()` function
   - Reads official gradebook records
   - Applies institution grading scale
   - Handles pass/fail exclusion, incomplete exclusion, 0-credit exclusion
   - Returns GPA to 2 decimal places or null
2. Wire `computeStudentGpa()` into the grade-posting action (same transaction)
3. Write GPA-drop ShepherdAI signal in `src/modules/shepherd-ai/signals/`
   - Fires after GPA write if GPA < warning threshold
   - Generates `academic_standing_or_credit_progress_review` suggestion
   - Urgency: `high` if GPA < 1.5, `medium` if 1.5–2.0
4. Tests: GPA calculation accuracy, pass/fail exclusion, signal generation, no-grades null return

**Sprint 2 verify:** `npm test && npm run lint && npm run build`

---

## SPRINT 3 — Complete Tier 1 + Stripe Foundation

**Goal:** Every Tier 1 blocker is resolved. Stripe wired for payment collection.
**Agents:** 2 parallel pairs

### Sprint 3-A: Student Transcript Request
**Story:** `docs/superpowers/specs/T1-05-student-transcript-request.md`
**Agent type:** `frontend-builder` + `backend-builder`

Implementation sequence:
1. Write `src/app/api/academy/transcripts/request/route.ts` — POST, student session
   - Billing hold check before allowing
   - Creates `academy_transcript_issuances` with `status: requested`
   - Enqueues confirmation email
2. Update `src/app/student/documents/page.tsx` — add Request Transcript form + status display
3. Update `src/app/admin/transcripts/page.tsx` — surface `requested` status items at top of queue
4. Tests: success, billing hold block, duplicate handling, cross-tenant rejection, download gate

### Sprint 3-B: Stripe Payment Collection
**Story:** `docs/superpowers/specs/T2-01-stripe-payment-collection.md`
**ADR:** `docs/adr/0042-stripe-payment-integration-pci-boundary.md`
**Agent type:** `backend-builder` then `frontend-builder`

Implementation sequence:
1. Add `stripe` package (document in PR)
2. Write `src/lib/stripe.ts` — singleton Stripe client, key from `process.env.STRIPE_SECRET_KEY`
3. Write `src/app/api/academy/billing/checkout/route.ts` — creates Stripe Checkout Session
4. Write `src/app/api/academy/billing/stripe-webhook/route.ts`
   - Verify signature with `STRIPE_WEBHOOK_SECRET`
   - On `checkout.session.completed`: post credit ledger entry (idempotent by session ID)
5. Update `src/app/student/account/page.tsx` — add "Pay Now" button linking to checkout
6. Tests: checkout creation, webhook success, webhook idempotency, signature rejection

**Sprint 3 verify:** `npm test && npm run lint && npm run build`

---

## SPRINT 4 — Admin CRUD Trifecta

**Goal:** Registrars can create courses, sections, and calendar terms without touching the database.
**Agents:** 3 parallel pairs

### Sprint 4-A: Course Catalog CRUD
**Story:** `docs/superpowers/specs/T2-03-admin-course-catalog-crud.md`
**Agent type:** `backend-builder` + `frontend-builder`

Key files: `src/modules/course-catalog/`, `src/app/admin/courses/page.tsx`, `src/app/api/academy/courses/`

### Sprint 4-B: Section Create + Instructor Assignment
**Story:** `docs/superpowers/specs/T2-04-section-create-assign-instructor.md`
**Agent type:** `backend-builder` + `frontend-builder`

Key files: `src/modules/course-catalog/`, `src/app/admin/sections/page.tsx`, `src/app/api/academy/sections/`

### Sprint 4-C: Academic Calendar CRUD
**Story:** `docs/superpowers/specs/T2-05-academic-calendar-crud.md`
**Agent type:** `backend-builder` + `frontend-builder`

Key files: `src/modules/academic-calendar/`, `src/app/admin/settings/calendar/page.tsx`, `src/app/api/academy/calendar/`

**Sprint 4 verify:** `npm test && npm run lint && npm run build`

---

## SPRINT 5 — Grading + Records Depth

**Goal:** GPA is computed from real grades. Faculty can create assignments. Registrars can edit student records.
**Agents:** 3 parallel pairs

### Sprint 5-A: Faculty Assignment Creation
**Story:** `docs/superpowers/specs/T2-07-faculty-assignment-creation.md`
**Agent type:** `backend-builder` + `frontend-builder`

Key files: `src/modules/grading/`, `src/app/faculty/gradebook/page.tsx`, `src/app/api/academy/gradebook/assignments/`

### Sprint 5-B: Student Record Editable Fields
**Story:** `docs/superpowers/specs/T2-11-student-record-editable-fields.md`
**Agent type:** `backend-builder` + `frontend-builder`

Key files: `src/modules/people/`, `src/app/admin/students/[id]/page.tsx`, `src/app/api/academy/students/`
New migrations: `academy_student_advisor_notes`, `academy_student_holds`

### Sprint 5-C: Application Document Checklist
**Story:** `docs/superpowers/specs/T2-02-application-document-checklist.md`
**Agent type:** `backend-builder` + `frontend-builder`

Key files: `src/modules/admissions/`, `src/app/admin/admissions/`, `src/app/api/academy/admissions/`
New migrations: `academy_program_document_requirements`, `academy_application_document_items`

**Sprint 5 verify:** `npm test && npm run lint && npm run build`

---

## SPRINT 6 — Transcripts, Registration, Attendance

**Goal:** Transcript PDFs are real documents. Students can self-register. Attendance flags fire.
**Agents:** 3 parallel pairs

### Sprint 6-A: Transcript PDF Generation
**Story:** `docs/superpowers/specs/T2-08-transcript-pdf-generation.md`
**ADR:** `docs/adr/0044-transcript-pdf-generation-strategy.md`
**Agent type:** `backend-builder`

Add `@react-pdf/renderer` package. Write `src/modules/grading/transcript-pdf.ts`. Wire into transcript approval action. Update download URL route to enforce released-only access.

### Sprint 6-B: Student Self-Registration
**Story:** `docs/superpowers/specs/T2-09-student-self-registration.md`
**Agent type:** `backend-builder` + `frontend-builder`

Key files: `src/modules/course-catalog/registration-service.ts` (extend), `src/app/student/courses/page.tsx`
Enrollment window enforcement reads from term `enrollment_open_at` / `enrollment_close_at` (Sprint 4-C prerequisite).

### Sprint 6-C: Attendance Enforcement + Guardian Alerts
**Story:** `docs/superpowers/specs/T2-10-attendance-enforcement-guardian-alerts.md`
**Agent type:** `backend-builder`

Extend attendance service with threshold check. Add institution config keys. Guardian email uses CommunicationsService (Sprint 1-B prerequisite). ShepherdAI signal fires independently.

**Sprint 6 verify:** `npm test && npm run lint && npm run build`

---

## TIER 2 CHECKPOINT

After Sprint 6, verify:
- [ ] Every Tier 1 checkbox in competitive-roadmap.md is ☒
- [ ] Every Tier 2 checkbox in competitive-roadmap.md is ☒
- [ ] Tests green, lint clean, build clean
- [ ] Demo the full flow: applicant submits → staff reviews → enrolls → takes a course → gets graded → GPA computed → transcript requested → PDF generated → payment made

If checkpoint passes: update `docs/project-status.md` and `docs/competitive-roadmap.md` progress log.

---

## SPRINT 7 — Differentiators Begin (Tier 3, Part A)

**Goal:** Ministry Formation Records ships. ShepherdAI watchlist is live. Guardian access is properly scoped.
**Agents:** 3 parallel pairs

### Sprint 7-A: Ministry Formation Records
**Story:** `docs/superpowers/specs/T3-01-ministry-formation-records.md`
**ADR:** `docs/adr/0045-ministry-formation-records-model-privacy-boundary.md`
**Agent type:** `backend-builder` + `frontend-builder`

New domain: `src/modules/ministry-formation/`
New migrations: `academy_ministry_formation_records`, `academy_ministry_practicum_logs`, `academy_ministry_formation_evaluations`
New pages: `src/app/admin/ministry/page.tsx`, `src/app/faculty/ministry/page.tsx`

### Sprint 7-B: Guardian Scoped Access
**Story:** `docs/superpowers/specs/T3-03-guardian-scoped-access.md`
**Agent type:** `backend-builder` + `frontend-builder`

Update `src/app/guardian/` pages. Implement scoped data functions. Add FERPA restriction flag. Remove any admin-data leakage from guardian routes.

### Sprint 7-C: ShepherdAI Attendance Signal + Watchlist
**Stories:** `docs/superpowers/specs/T3-04-shepherd-ai-attendance-pattern-alert.md` + `T3-05`
**Agent type:** `backend-builder` + `frontend-builder`

Extend ShepherdAI signals. Add watchlist view to workflow queue page. Requires Sprint 1-A (persistence) to be live.

**Sprint 7 verify:** `npm test && npm run lint && npm run build`

---

## SPRINT 8 — Differentiators Complete (Tier 3, Part B)

**Goal:** LMS works for real. Students have full self-service. Aid letters go out.
**Agents:** 3 parallel pairs

### Sprint 8-A: LMS Live HTTP Integration (Moodle)
**Story:** `docs/superpowers/specs/T3-02-lms-live-http-integration.md`
**ADR:** `docs/adr/0046-lms-http-client-implementation-retry-strategy.md`
**Agent type:** `backend-builder`

Implement `MoodleHttpClient` in `src/modules/lms-contract/moodle-adapter/`. Wire real `enrollUser`, `getCourseUrl`, `syncGrades` calls. Add circuit breaker with Postgres state table.

### Sprint 8-B: Student PWA Full Self-Service
**Story:** `docs/superpowers/specs/T3-06-student-pwa-full-self-service.md`
**Agent type:** `frontend-builder`

Wire all existing backend endpoints to PWA UI actions. Update courses, account, documents, aid, settings pages. Add loading states, error toasts, offline detection.

### Sprint 8-C: Financial Aid Award Letter + Tuition Schedule
**Stories:** `docs/superpowers/specs/T3-07-financial-aid-award-letter.md`
**ADR:** `docs/adr/0047-tuition-schedule-and-payment-plan-engine.md`
**Agent type:** `backend-builder` + `frontend-builder`

Award letter PDF generation. Student acceptance/decline workflow. Tuition schedule engine with payment plan installment creation.

**Sprint 8 verify:** `npm test && npm run lint && npm run build`

---

## TIER 3 CHECKPOINT — Competitive Milestone

After Sprint 8, verify:
- [ ] Every Tier 3 checkbox is ☒
- [ ] Full end-to-end demo: applicant submits → accepted → enrolled → takes course in Moodle → gets grade → GPA computed → transcript PDF released → student pays via Stripe → Ministry Formation record entered → ShepherdAI watchlist shows at-risk students
- [ ] Tests green, lint clean, build clean
- [ ] Run `npm run build` on Vercel preview deployment

**At this milestone:** ChurchCore Academy is competitive against Populi for seminary and Bible college buyers. No competitor has Ministry Formation Records or a single-platform multi-institution-type SIS.

---

## Tier 4 Work (Post-Competitive Milestone)

After Tier 3 checkpoint, begin Tier 4 in priority order:
1. Denomination integration
2. IPEDS/ATS reporting
3. Alumni CRM
4. Canvas live HTTP integration
5. Regulated federal financial aid

---

## Agent Invocation Template

When starting any sprint agent, use this briefing structure:

```
You are implementing [STORY TITLE] for ChurchCore Academy.

Read these files first (in order):
1. /Users/rjulia/ChurchCore Academy/CLAUDE.md
2. /Users/rjulia/ChurchCore Academy/docs/superpowers/specs/[STORY-FILE].md
3. [ADR file if applicable]
4. [Key existing source files listed in the story's Technical Notes]

Factory rules:
- Business logic in src/modules/ only
- API routes stay thin: resolve actor, call module, map errors
- Every new table needs a migration + RLS
- Tests: success case, validation case, cross-tenant rejection case minimum
- Run npm test && npm run lint && npm run build before reporting done
- Do not refactor code outside story scope
- Do not use `any` type
- Never resolve process.env inside module functions (route layer only)

Deliver: migration (if any) → module function → repository → API route → UI → tests
```

---

## Progress Tracking

Update `docs/competitive-roadmap.md` as each story completes:
- Change `☐` to `☒` in the feature table
- Add a row to the Progress Log with date and story ID
- Update `docs/project-status.md`

The competitive roadmap is the single source of truth for what is done.
