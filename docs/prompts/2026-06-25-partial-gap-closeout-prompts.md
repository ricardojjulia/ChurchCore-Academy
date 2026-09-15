# AI Execution Prompts — PARTIAL Gap Closeout

Date: 2026-06-25
Council review: `docs/reviews/2026-06-25-council-review-10-partial-gap-closeout.md`
ADRs: 0048–0058 (plus implementation-only for ADR-0042, ADR-0044)

---

## Execution Model

Three sequential sprints with internal parallelism. Each sprint ends with a PR that must pass
`npm test && npm run lint && npm run build` before the next sprint begins.

```
SPRINT A (6 agents in parallel — no inter-dependencies)
  A-1  Academic calendar admin CRUD         ADR-0050
  A-2  Course catalog + section CRUD        ADR-0051
  A-3  Student record editable fields       ADR-0049
  A-4  Faculty assignment creation          ADR-0054
  A-5  Attendance enforcement + alerts      ADR-0053
  A-6  Application document checklist       ADR-0048
  ↓ merge Sprint A PR before starting Sprint B

SPRINT B (4 agents in parallel — depend on Sprint A services)
  B-1  Transcript PDF + grade history       ADR-0044
  B-2  Student self-registration add/drop   ADR-0052
  B-3  Stripe payment collection            ADR-0042
  B-4  Financial aid award letter           ADR-0057
  ↓ merge Sprint B PR before starting Sprint C

SPRINT C (3 agents in parallel — depend on Sprint B APIs)
  C-1  Student PWA full self-service        ADR-0055
  C-2  Guardian PWA shell                   ADR-0056
  C-3  Compliance reporting IPEDS           ADR-0058
  ↓ merge Sprint C PR — all PARTIAL → WORKING
```

Hard rules for every prompt:
- Run `npm test && npm run lint && npm run build` before declaring done.
- Never skip the cross-tenant rejection test case.
- Never emit raw grade, payment, or auth payloads in test output.
- Do not refactor code outside the named task scope.
- Read CLAUDE.md and the governing ADR before writing any code.

---

## SPRINT A PROMPTS

---

### Prompt A-1 — Academic Calendar Admin CRUD

You are implementing ADR-0050 (Academic Calendar Admin CRUD with Term-Lock Policy) for
ChurchCore Academy.

Read first:
- `CLAUDE.md`
- `docs/adr/0050-academic-calendar-admin-crud.md`
- `docs/superpowers/specs/T2-05-academic-calendar-crud.md`
- `src/app/admin/settings/calendar/page.tsx` (existing shell)
- `src/modules/academic-calendar/` (existing service and types)

Goal: implement full create/edit/archive/state-transition for terms and periods.

Backend tasks:
1. Add state lifecycle to term/period types (`planned` → `enrollment_open` → `active` → `completed` → `archived`).
2. Add `section_count` lock check: if any section references a period, period dates lock.
3. Add API routes: POST/PATCH for terms, POST/PATCH for periods, PATCH status transitions.
4. Enforce admin/registrar role on all routes.
5. Enforce tenant isolation.

Frontend tasks:
1. Replace read-only calendar view at `/admin/settings/calendar` with full CRUD.
2. Term list with state badges and transition buttons.
3. "New Term" modal with name, type, dates.
4. Period list with inline create/edit, lock indicators for locked fields.
5. Archive confirmation dialog.

Tests (in `src/modules/academic-calendar/__tests__/`):
- Success: create term, create period, edit unlocked period, state transition
- Rejection: edit locked period (active term), archive term with active sections
- Cross-tenant rejection

Verification: `npm test && npm run lint && npm run build`

---

### Prompt A-2 — Course Catalog and Section Admin CRUD

You are implementing ADR-0051 (Course Catalog and Section Admin CRUD with Archive Policy) for
ChurchCore Academy.

Read first:
- `CLAUDE.md`
- `docs/adr/0051-course-catalog-section-admin-crud.md`
- `docs/superpowers/specs/T2-03-admin-course-catalog-crud.md`
- `docs/superpowers/specs/T2-04-section-create-assign-instructor.md`
- `src/app/admin/courses/page.tsx` (existing shell)
- `src/modules/course-catalog/` (existing service and types)

Goal: implement full CRUD for courses and sections including archive policy and prerequisite wiring.

Backend tasks:
1. Add `archived`, `prerequisite_course_ids` to course types and repository.
2. Add circular prerequisite detection at the service layer.
3. Add `academy_course_sections` fields: `instructor_person_id`, `max_capacity`, `sync_policy`, state lifecycle.
4. Add API routes for course and section CRUD.
5. Add `checkPrerequisites(studentId, courseId)` service function (used by ADR-0052 self-registration).
6. Enforce tenant isolation and role gates.

Frontend tasks:
1. Course list at `/admin/courses` with create button, archive toggle.
2. Course detail page: edit form, section list, archive button.
3. Section create/edit modal: period picker, instructor picker, capacity, state transition.

Tests:
- Success: create course, create section, assign instructor, archive course with no active sections
- Rejection: archive course with active sections, circular prerequisite, cross-tenant
- `checkPrerequisites`: student with completed prereq (pass), student without prereq (fail)

Verification: `npm test && npm run lint && npm run build`

---

### Prompt A-3 — Student Record Editable Fields and Advisor Notes

You are implementing ADR-0049 (Student Record Editable Fields and Advisor Notes Audit Model) for
ChurchCore Academy.

Read first:
- `CLAUDE.md`
- `docs/adr/0049-student-record-editable-fields.md`
- `docs/superpowers/specs/T2-11-student-record-editable-fields.md`
- `src/modules/people/` (existing student service and types)
- `src/app/student/account/page.tsx` (existing shell)

Goal: implement student-editable contact fields, registrar-editable enrollment fields, and advisor notes.

Backend tasks:
1. Add PATCH route for student-editable fields (`preferred_name`, `phone`, contact address, emergency contact).
2. Emit immutable audit event (ADR-0019 pattern) for every field change with `old_value_hash`.
3. Add PATCH route for registrar fields (`enrollment_status`, `program_id`, `advisor_person_id`, `holds`) with required reason string.
4. Create `academy_advisor_notes` table migration.
5. Add POST route to create advisor note (advisor/registrar/admin only).
6. Add GET route for advisor notes filtered by `visible_to_student` for student actor.
7. Enforce that advisor notes are never returned to guardians.

Frontend tasks:
1. Student account page `/account` — editable contact form with save button.
2. Admin student detail page — enrollment status editor, advisor assignment, hold management.
3. Advisor notes panel (staff view): note list, add note modal with type selector and `visible_to_student` toggle.
4. Student PWA account page: show notes where `visible_to_student = true`.

Tests:
- Success: student edits own contact field, audit event emitted
- Success: registrar changes enrollment status with reason
- Success: advisor creates note, student cannot see note with `visible_to_student = false`
- Rejection: student edits enrollment status (forbidden), guardian reads advisor note (forbidden)
- Cross-tenant rejection

Migration: create `academy_advisor_notes` with RLS.

Verification: `npm test && npm run lint && npm run build`

---

### Prompt A-4 — Faculty Assignment Creation and Per-Assignment Grading

You are implementing ADR-0054 (Faculty Assignment Creation and Per-Assignment Grade Entry Model) for
ChurchCore Academy.

Read first:
- `CLAUDE.md`
- `docs/adr/0054-faculty-assignment-creation.md`
- `docs/superpowers/specs/T2-07-faculty-assignment-creation.md`
- `src/modules/grading/` (existing grade service and types)
- `src/app/faculty/gradebook/page.tsx` (existing shell)

Goal: implement assignment creation, bulk grade entry, weighted grade computation, and faculty UI.

CRITICAL (wildcard condition from Council Review X): The computed grade is advisory. Faculty must
still post through the existing `postGrade` service. Verify that the existing GPA recalculation
trigger fires when the faculty posts the pre-filled grade. Do NOT add a second GPA recalculation
path — use the existing one.

Backend tasks:
1. Create `academy_assignments` table migration with `locked` boolean.
2. Create `academy_assignment_submissions` table migration.
3. Add assignment CRUD API routes (POST, PATCH, GET).
4. Add `locked` enforcement: `max_points` and `weight` immutable after first submission.
5. Add bulk grade entry route: `POST /api/academy/sections/[id]/assignments/[assignmentId]/grades`.
6. Add `computeSectionGrades(sectionId)` service function returning advisory weighted grades.
7. Enforce that faculty actor is the section's instructor (or admin role).

Frontend tasks:
1. `/faculty/gradebook/[sectionId]` — assignment list with "Add Assignment" button.
2. `/faculty/gradebook/[sectionId]/assignments/[assignmentId]` — grade entry grid (student name + points field per row).
3. "Compute Grade" button → pre-fills final grade in existing grade-entry field.

Tests:
- Success: create assignment, add grades, compute weighted grade
- Success: GPA recalculation fires when faculty posts computed grade via existing `postGrade`
- Rejection: edit `max_points` after submission exists (locked), faculty grades section they don't instruct
- Weight validation: sum > 100 rejected
- Cross-tenant rejection

Migration: `academy_assignments`, `academy_assignment_submissions`.

Verification: `npm test && npm run lint && npm run build`

---

### Prompt A-5 — Attendance Threshold Enforcement and Guardian Alerts

You are implementing ADR-0053 (Attendance Threshold Enforcement and Guardian Absence Notification) for
ChurchCore Academy.

Read first:
- `CLAUDE.md`
- `docs/adr/0053-attendance-enforcement-guardian-alerts.md`
- `docs/superpowers/specs/T2-10-attendance-enforcement-guardian-alerts.md`
- `src/modules/attendance/` (existing service and types)

Goal: add threshold enforcement, ShepherdAI signal, and guardian notification triggers to attendance posting.

Backend tasks:
1. Add `minimum_attendance_percentage` config to sections (default 80).
2. Add `session_type` column to attendance session records.
3. After each attendance post, call `checkAttendanceThreshold(studentId, sectionId)`.
4. If below threshold and not already alerted in this period, enqueue ShepherdAI signal `attendance_threshold_breach`.
5. Implement 10-percentage-point deduplication (do not re-fire until attendance drops another 10 points).
6. Add guardian consecutive-absence rule: 3+ consecutive misses → enqueue guardian notification email.
7. Add `spiritual_formation` session type → notify guardian on first miss.
8. Add PATCH route for section attendance config (faculty/admin).

Tests:
- Success: attendance drops below threshold → ShepherdAI signal enqueued
- Deduplication: signal not re-fired until threshold drops another 10 points
- Guardian notification: 3 consecutive misses → email enqueued
- Guardian notification: `spiritual_formation` session → email enqueued on first miss
- No notification if guardian opt-out preference is set
- Cross-tenant rejection

Verification: `npm test && npm run lint && npm run build`

---

### Prompt A-6 — Application Document Checklist

You are implementing ADR-0048 (Application Document Checklist and Admissions Completion Workflow) for
ChurchCore Academy.

Read first:
- `CLAUDE.md`
- `docs/adr/0048-application-document-checklist.md`
- `docs/superpowers/specs/T2-02-application-document-checklist.md`
- `src/modules/` admissions area
- `src/app/admin/admissions/` (existing shell)

Goal: implement document type registry, application document records, Supabase Storage upload, checklist enforcement.

Backend tasks:
1. Create `academy_document_types` table migration with RLS.
2. Create `academy_application_documents` table migration with RLS.
3. Add presigned upload URL route: `POST /api/academy/admissions/applications/[id]/documents/upload-url`
   — validates file type (PDF/JPEG/PNG), max 10 MB, issues Supabase Storage presigned URL.
4. Add document status routes: mark received, waive with mandatory note.
5. Add `canAdvanceToDecision(applicationId)` service function.
6. Wire `canAdvanceToDecision` check into the admissions decision route (return 422 if checklist incomplete).
7. Add signed download URL route (15-minute expiry, audit log on each access).
8. Enforce admissions/admin role for all routes. Applicant token for applicant-facing upload.

Frontend tasks:
1. `/admin/admissions/[id]` — checklist section with document status, upload trigger, mark-received and waive actions.
2. `/apply/status` — applicant view: document checklist status, upload button for pending items.
3. Admin document type management at `/admin/admissions/document-types`.

Security enforcement: storage bucket must be private. No public URLs anywhere.

Tests:
- Success: upload URL issued, document marked received, decision advances
- Rejection: decision blocked when required document pending (no waiver)
- Success: waiver with note allows decision to advance
- Rejection: applicant cannot access another applicant's documents
- Cross-tenant rejection
- Secret field test: signed URL must not appear in test output (use `doesNotMatch`)

Migration: `academy_document_types`, `academy_application_documents`.

Verification: `npm test && npm run lint && npm run build`

---

## SPRINT B PROMPTS (after Sprint A PR merges)

---

### Prompt B-1 — Transcript PDF and Grade History Assembly

You are implementing the transcript PDF generation and grade history assembly for ChurchCore Academy.
The architectural decision is ADR-0044 (Transcript PDF Generation Strategy), which is already written.

Read first:
- `CLAUDE.md`
- `docs/adr/0044-transcript-pdf-generation-strategy.md`
- `docs/superpowers/specs/T2-08-transcript-pdf-generation.md`
- `src/modules/grading/` and `src/app/api/academy/transcripts/`

Goal: implement PDF generation from grade history records and wire the download to the transcript request flow.

Backend tasks:
1. Implement `generateTranscriptPdf(transcriptRequestId)` using `@react-pdf/renderer`.
2. PDF content: institution header, student name/ID/program, term-by-term grade table (section, grade,
   credits, grade points), cumulative GPA, issued date, registrar signature line.
3. Grade history assembly: query posted grades across all terms for the student, grouped by term.
   Only include grades with status `posted` (not drafts, not held records).
4. Store generated PDF in Supabase Storage private bucket `academy-transcripts` at
   `{tenant_id}/{student_person_id}/{transcript_request_id}.pdf`.
5. On PDF stored, update transcript request status to `ready` and set `storage_path`.
6. Add signed URL download route: `GET /api/academy/transcripts/[id]/download` (15-minute expiry, audit log).
7. Wire generation into the existing transcript request workflow (triggered when status transitions to `processing`).

Tests:
- Success: transcript request transitions to `ready` after PDF generation, signed URL issued
- Rejection: held transcript record not included in grade history
- Rejection: student cannot download another student's transcript
- Cross-tenant rejection
- Secret field test: storage path must not appear in client response body

Verification: `npm test && npm run lint && npm run build`

---

### Prompt B-2 — Student Self-Registration Add/Drop

You are implementing ADR-0052 (Student Self-Registration Add/Drop and Enrollment Window Policy) for
ChurchCore Academy.

Read first:
- `CLAUDE.md`
- `docs/adr/0052-student-self-registration.md`
- `docs/superpowers/specs/T2-09-student-self-registration.md`
- Sprint A output: `checkPrerequisites` service function (ADR-0051) and period dates (ADR-0050)
- `src/modules/` enrollment area
- `src/app/api/academy/registrations/` (existing routes)

Goal: add student-initiated add/drop to the existing registration service, enforcing window dates,
prerequisites, capacity, and guardian approval for minors.

Backend tasks:
1. Add `registration_open_at`, `registration_close_at`, `last_drop_date`, `withdrawal_date` to period schema.
2. Add window validation to registration create route (actor = student).
3. Wire `checkPrerequisites` (from Sprint A A-2) into the add flow.
4. Add atomic capacity decrement with row-level locking.
5. Add schedule conflict check.
6. Implement drop flow: clean drop vs W-grade vs registrar-required based on date comparison.
7. Add guardian approval flow for students under 18 (status `pending_guardian_approval`, notification enqueue).
8. Add guardian approval route with one-use expiring token.
9. Add registrar force-enroll/force-drop with required override reason and audit event.

Frontend tasks:
1. `/student/courses` — open section catalog (filtered to `enrollment_open` sections with capacity).
2. "Register" button per section, disabled outside window with explanatory text.
3. Enrolled section list with "Drop" button.
4. Guardian approval page at `/apply/guardian-approve/[token]`.

Tests:
- Success: student adds section within window, capacity decremented
- Rejection: add outside registration window
- Rejection: add to full section
- Rejection: add without completed prerequisite
- Schedule conflict rejection
- Clean drop before `last_drop_date`, W-grade drop after, blocked after `withdrawal_date`
- Guardian approval flow: under-18 registration creates `pending_guardian_approval`, approval token works
- Cross-tenant rejection

Verification: `npm test && npm run lint && npm run build`

---

### Prompt B-3 — Stripe Payment Collection

You are implementing the Stripe payment checkout flow for ChurchCore Academy.
The architectural decision is ADR-0042 (Stripe Payment Integration and PCI Boundary), already written.
ADR-0047 (Tuition Schedule Engine) defines the payment plan model — that model is in place from Sprint A.

Read first:
- `CLAUDE.md`
- `docs/adr/0042-stripe-payment-integration-pci-boundary.md`
- `docs/adr/0047-tuition-schedule-and-payment-plan-engine.md`
- `docs/superpowers/specs/T2-01-stripe-payment-collection.md`
- `src/modules/billing/` (existing ledger, tuition schedule service)

Goal: wire Stripe checkout to payment plan installments and handle the webhook → ledger credit path.

Backend tasks:
1. Add Stripe SDK to the project (document reason in PR description).
2. Implement `generateStripePaymentLink(installmentId)` — creates a Stripe Payment Link for the
   installment amount with `installment_id` in metadata.
3. Store `stripe_payment_link_id` on the installment record after successful link creation.
4. Implement Stripe webhook handler at `POST /api/webhooks/stripe`:
   - Verify `stripe-signature` header against `STRIPE_WEBHOOK_SECRET`.
   - On `checkout.session.completed`: extract `installment_id` from metadata, call `billing.postCredit`,
     set installment `status = paid`, `paid_at`.
   - If all installments in the plan are paid, set `payment_plan.status = completed`.
   - Reject events without `installment_id` metadata.
5. Stripe secret keys never stored in Academy DB, never logged.
6. Add Vercel Cron for late fees (`/api/cron/billing-late-fees`, daily 02:00 UTC) from ADR-0047 if not already implemented.

Frontend tasks:
1. `/student/account/billing` — payment plan summary, installment list with status, amount, due date.
2. "Pay Now" button per pending installment → opens `stripe_payment_link_id` in new tab.
3. Paid installments show `paid_at` confirmation.
4. Admin billing view: payment plan status per student.

Tests:
- Success: `generateStripePaymentLink` produces a link ID, stores it on installment
- Success: webhook `checkout.session.completed` → ledger credit posted, installment `paid`
- Rejection: webhook with invalid signature rejected (no processing)
- Rejection: webhook without `installment_id` metadata rejected
- Secret field test: Stripe secret keys must never appear in test output or DB records
- Cross-tenant rejection

Verification: `npm test && npm run lint && npm run build`

---

### Prompt B-4 — Financial Aid Award Letter

You are implementing ADR-0057 (Financial Aid Award Letter Generation and Regulatory Boundary) for
ChurchCore Academy.

Read first:
- `CLAUDE.md`
- `docs/adr/0057-financial-aid-award-letter.md`
- `docs/superpowers/specs/T3-07-financial-aid-award-letter.md`
- `src/modules/financial-aid/` (existing service and types)

Goal: implement award letter PDF generation, issuance flow, student acceptance/decline, and expiry cron.

Backend tasks:
1. Create `academy_aid_letters` table migration with RLS.
2. Implement `generateAwardLetterPdf(aidLetterId)` using `@react-pdf/renderer`.
   PDF content: institution header, student name/program/term, award table, total aid, net cost,
   acceptance terms, acceptance deadline.
3. Store generated PDF in Supabase Storage private bucket `academy-aid-letters`.
4. Issue flow: admin creates letter → PDF generated → status `issued` → student notification enqueued.
5. Student acceptance route: `POST /api/academy/financial-aid/award-letters/[id]/accept`
   — records `accepted_at`, `acceptance_ip_hash` (SHA-256 of request IP, never raw IP), transitions status.
6. Student decline route: `POST /api/academy/financial-aid/award-letters/[id]/decline`.
7. Signed download URL route (15-minute expiry).
8. Vercel Cron `POST /api/cron/aid-letter-expiry` (daily 03:00 UTC): transition `issued` letters past
   `expires_at` to `expired`.
9. Block federal aid packages (`aid_source = federal`) from this generation flow.

Frontend tasks:
1. Admin `/admin/financial-aid/packages/[id]` — "Issue Award Letter" button, letter status.
2. Student `/student/account/financial-aid` — "View Award Letter" button, "Accept" / "Decline" buttons,
   expired state display.

Tests:
- Success: letter issued → PDF generated → student can accept
- Success: student acceptance records `acceptance_ip_hash` (not raw IP)
- Rejection: accept expired letter (blocked)
- Rejection: issue letter for `aid_source = federal` package (blocked)
- Rejection: student accepts another student's letter (forbidden)
- Cross-tenant rejection
- Secret field test: `acceptance_ip_hash` must not equal the raw IP string

Migration: `academy_aid_letters`.

Verification: `npm test && npm run lint && npm run build`

---

## SPRINT C PROMPTS (after Sprint B PR merges)

---

### Prompt C-1 — Student PWA Full Self-Service

You are implementing ADR-0055 (Student PWA Full Self-Service Scope and Data Boundary) for
ChurchCore Academy.

Read first:
- `CLAUDE.md`
- `docs/adr/0055-student-pwa-full-self-service.md`
- `docs/superpowers/specs/T3-06-student-pwa-full-self-service.md`
- Sprint A output: student record edits (ADR-0049)
- Sprint B output: self-registration API (ADR-0052), transcript PDF download route, Stripe payment links (ADR-0042), aid letter acceptance (ADR-0057)
- `src/app/student/` (existing PWA shells)

Goal: transform the read-only student PWA into a full self-service portal by wiring the four transaction surfaces.

Frontend tasks (no new backend — all APIs built in Sprint A and Sprint B):
1. `/student/courses` — section catalog with "Register" button; enrolled sections with "Drop" button.
   Wire to `POST /api/academy/registrations` and `DELETE /api/academy/registrations/[id]`.
   Show window status (open/closed/dates); disable buttons outside window with explanatory text.
2. `/student/account/transcripts` — transcript request form (purpose, delivery method, recipient).
   Show request status list. Show "Download" button for `ready` requests (signed URL, open in new tab).
3. `/student/account/billing` — payment plan summary (total, paid, remaining).
   Installment list: amount, due date, status, "Pay Now" button (opens Stripe Payment Link in new tab).
   Paid installments show `paid_at` confirmation.
4. `/student/account/financial-aid` — aid packages, award items, total.
   "View Award Letter" → opens PDF. "Accept Award" / "Decline Award" buttons.
   Expired letter state. Post-acceptance confirmation.
5. PWA nav: add action links for the four surfaces; conditionally show based on available data.
6. Mobile responsive: all flows must work at 320px viewport width.

Security enforcement: every API call must use the authenticated session. Validate that `studentId`
is derived from `auth.uid()`, never from a URL parameter.

Tests (frontend integration / acceptance):
- Student can register for an open section
- Student cannot register outside the window (button disabled, explanatory text present)
- Student can view transcript request and download ready transcript
- Student can view installments and "Pay Now" links are Stripe URLs (not Academy card forms)
- Student can view award letter and accept it
- Student cannot see another student's data (session-scoped)

Visual check: test all four flows at mobile and desktop width before marking done.

Verification: `npm test && npm run lint && npm run build`

---

### Prompt C-2 — Guardian PWA Shell

You are implementing ADR-0056 (Guardian PWA Shell Auth Boundary and Scoped Portal Policy) for
ChurchCore Academy.

Read first:
- `CLAUDE.md`
- `docs/adr/0056-guardian-pwa-shell.md`
- `docs/superpowers/specs/T3-03-guardian-scoped-access.md`
- Sprint A output: attendance enforcement (ADR-0053), student records (ADR-0049)
- `src/app/guardian/` (existing partial shell)
- `src/modules/people/` (guardian-student relationship)

Goal: build the full guardian portal shell and wire it to real data for linked students only.

CRITICAL (wildcard condition from Council Review X): every guardian API route must include a
cross-join on `academy_guardian_students` with `guardian_person_id = auth.uid()`. Never trust
a `studentId` URL parameter without verifying the guardian-student link at the service layer.

Backend tasks:
1. Add API routes:
   - `GET /api/academy/guardian/students` — linked students (cross-join enforced)
   - `GET /api/academy/guardian/students/[studentId]/attendance` — attendance for linked student
   - `GET /api/academy/guardian/students/[studentId]/grades` — grade summary for linked student
   - `GET /api/academy/guardian/students/[studentId]/billing` — payment plan view (no pay button)
   - `PATCH /api/academy/guardian/students/[studentId]/notification-preferences`
2. Enforce FERPA rights flag: guardians with `ferpa_rights = false` see attendance only.
3. Block Ministry Formation Records from all guardian routes (do not query that table in guardian routes).
4. Block advisor notes from all guardian routes.

Frontend tasks:
1. `/guardian` dashboard — linked student cards with GPA, attendance %, notification badge.
2. `/guardian/students/[studentId]` — student detail tabs: Attendance, Grades, Billing.
3. Attendance tab: session-by-session view, absences highlighted.
4. Grades tab: section grade summary (no per-assignment detail).
5. Billing tab: payment plan status, installment due dates (view-only, no pay button).
6. FERPA-restricted view: show only attendance for guardians with `ferpa_rights = false`.
7. 18+ student notice banner.
8. Mobile responsive.

Tests:
- Success: guardian sees only their linked students
- Rejection: guardian queries another guardian's student by `studentId` (forbidden at service layer)
- Rejection: guardian route never returns Ministry Formation Records
- Rejection: guardian route never returns advisor notes
- FERPA restriction: `ferpa_rights = false` guardian sees attendance only, not grades
- Cross-tenant rejection

Visual check: test at mobile and desktop width.

Verification: `npm test && npm run lint && npm run build`

---

### Prompt C-3 — Compliance Reporting (IPEDS and Scheduled Delivery)

You are implementing ADR-0058 (Compliance and Institutional Reporting: IPEDS Subset and Scheduled
Delivery) for ChurchCore Academy.

Read first:
- `CLAUDE.md`
- `docs/adr/0058-compliance-reporting.md`
- `docs/superpowers/specs/` — `2026-06-21-reporting-exports-design.md`
- `src/app/admin/` (existing reporting surfaces)

IMPORTANT (wildcard condition from Council Review X): IPEDS output is labeled "IPEDS-formatted
(review required)" with a mandatory disclaimer: "Review this export with your IPEDS data preparer
before submission. ChurchCore Academy does not certify IPEDS compliance." This must appear in both
the UI and in the exported file header.

Goal: add IPEDS export, institution compliance configuration, and scheduled report delivery.

Backend tasks:
1. Add `ipeds_unitid`, `full_time_credit_hours_threshold`, and per-program `cip_code` fields to
   `InstitutionProfile` (new optional fields; existing records default to null/undefined).
2. Implement `generateIpedsExport(tenantId)` — produces structured JSON/CSV with IC and EF components.
   Compute enrollment headcount, level breakdown, full-time/part-time split (using threshold from config).
   Include IPEDS disclaimer header in the CSV file.
3. Create `academy_scheduled_reports` table migration with RLS.
4. Implement scheduled report generation service: generates report, stores in Storage private bucket,
   enqueues notification email with signed URL (no PII in email body).
5. Add Vercel Cron `POST /api/cron/scheduled-reports` (daily 04:00 UTC).
6. Add report CRUD API routes (admin/registrar role required).
7. Report storage: `academy-reports` private bucket, 90-day retention cleanup cron.

Frontend tasks:
1. `/admin/reporting` — add IPEDS tab: institution config status, export button, disclaimer banner.
2. `/admin/settings/compliance` — UNITID field, `full_time_credit_hours_threshold`, program CIP code table.
3. Scheduled reports tab: list, frequency, recipients, last run, next run, enable/disable, "New Scheduled Report" modal.

Tests:
- Success: IPEDS export produces correct headcount and level breakdown
- IPEDS disclaimer header present in CSV output
- UNITID null → export includes warning field "unitid_not_configured"
- Scheduled report: cron triggers generation, notification email enqueued, signed URL in email body
- Rejection: scheduled report email must not contain student names or grades
- Cross-tenant rejection

Migration: `academy_scheduled_reports`.

Verification: `npm test && npm run lint && npm run build`

---

## Post-Sprint Verification

After Sprint C PR merges, update `docs/competitive-roadmap.md` Honest State table:
- Admissions → **WORKING**
- Student records → **WORKING**
- Academic calendar → **WORKING**
- Course catalog → **WORKING**
- Enrollment/registration → **WORKING**
- Attendance → **WORKING**
- Gradebook → **WORKING**
- Transcripts → **WORKING**
- Student PWA → **WORKING**
- Guardian portal → **WORKING**
- Billing → **WORKING**
- Financial aid → **WORKING**
- Reporting → **WORKING** (with IPEDS disclaimer note)

All 13 domains WORKING. Product is shippable.
