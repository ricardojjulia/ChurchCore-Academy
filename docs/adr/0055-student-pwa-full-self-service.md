# ADR-0055 — Student PWA Full Self-Service Scope and Data Boundary

**Date:** 2026-06-25
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Council review:** `docs/reviews/2026-06-25-council-review-10-partial-gap-closeout.md`

---

## Context

The student PWA has routes for dashboard, courses, account, and financial aid. All routes are
read-only — no student can take any action. Students cannot register for courses, request
transcripts, view or pay installments, or accept aid offers. This makes the PWA a display
panel rather than a self-service portal.

This ADR defines the four self-service transactions the student PWA will support and the data
boundary governing what students can see and do.

---

## Decision

### 1. Self-service transactions

The student PWA adds four transactional surfaces:

**1a. Course registration (add/drop)**
- Accessible at `/student/courses` — section catalog filtered to open, available sections
- "Register" button calls `POST /api/academy/registrations` (ADR-0052)
- "Drop" button calls `DELETE /api/academy/registrations/[id]` (ADR-0052)
- Registration window dates displayed; buttons disabled with explanatory text outside the window

**1b. Transcript request**
- Accessible at `/student/account/transcripts`
- Form: purpose (personal copy, graduate application, employer verification), delivery method
  (download, sealed PDF, email to institution), recipient address
- Submits `POST /api/academy/transcripts/requests`
- Student sees request status (pending, processing, ready, sent)
- Download link appears when status is `ready` (signed URL, 15-minute expiry)

**1c. Payment portal**
- Accessible at `/student/account/billing`
- Reads the student's active payment plans and installments (ADR-0042 / ADR-0047)
- "Pay Now" button per installment opens the Stripe Payment Link in a new tab (no card details
  enter the Academy UI; PCI SAQ-A boundary maintained)
- Shows paid installments with `paid_at` confirmation

**1d. Financial aid view and acceptance**
- Accessible at `/student/account/financial-aid`
- Lists aid packages, award items, and total award
- "Accept Award Letter" button records acceptance via `POST /api/academy/financial-aid/award-letters/[id]/accept`
- Shows signed award letter PDF download after acceptance (ADR-0057)

### 2. Data boundary

The student actor may only access records where `student_person_id = auth.uid()` or
`registration.student_id → student.person_id = auth.uid()`. This is enforced at the service
layer via `withAcademyDatabaseContext` (tenant + student-ownership check).

Students **cannot** see:
- Other students' records
- Advisor notes with `visible_to_student = false`
- Ministry Formation Records (pastoral privacy — ADR-0045)
- Financial details of other payment plan holders
- Held transcript records (status `held`)

### 3. PWA navigation

The student nav gains active action buttons:
- "Register for Courses" (links to section catalog)
- "Request Transcript" (links to transcript request form)
- "Pay Tuition" (links to payment portal)
- "View Aid Award" (links to aid acceptance)

Buttons are conditionally shown based on available data (no payment plan = no billing link shown).

### 4. Offline and mobile

Student PWA routes must work at mobile viewport widths (320px minimum). Registration and payment
flows must not require desktop-width interactions. Offline support is deferred — focus is on
authenticated mobile-responsive transactional flows.

---

## Consequences

- Students can manage their academic lifecycle from the PWA without contacting the registrar for
  routine transactions.
- The payment flow delegates card capture entirely to Stripe, maintaining PCI SAQ-A boundary.
- The data boundary ensures students cannot access each other's records or sensitive staff notes.

---

## Alternatives Considered

**Build a single combined "My Account" page for all transactions:**
Rejected. Each transaction domain (courses, billing, transcripts, aid) has distinct data and flows.
Merging them into one page creates UI complexity and makes the routes harder to permission-gate.

**Allow student transcript PDF download without a request step:**
Rejected. Official transcripts require a request record for compliance purposes (ADR-0034).
Unofficial/informal transcript views may be added separately.

---

## Security / Privacy Review Notes

- Every student-facing route must resolve `auth.uid()` from the verified Supabase session.
  Never trust a `studentId` query parameter without session verification.
- Transcript signed URL download route must log an access audit event.
- Payment portal must not render card numbers, CVV, or bank account numbers.
- Held transcripts (`status = held`) must not appear in the student download list.

---

## Related

- ADR-0034 — Transcript request and issuance workflow
- ADR-0042 — Stripe payment integration and PCI boundary
- ADR-0047 — Tuition schedule and payment plan engine
- ADR-0052 — Student self-registration add/drop
- ADR-0057 — Financial aid award letter generation
