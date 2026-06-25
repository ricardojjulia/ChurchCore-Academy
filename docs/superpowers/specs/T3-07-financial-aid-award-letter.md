# Story: Financial Aid Award Letter Generation
**ID:** T3-07
**Tier:** 3 — Achieve Competitive Differentiation
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story
As a financial aid officer, I want to generate an official aid award letter for a student showing their complete aid package so they can make informed enrollment and payment decisions.

As a student, I want to view my financial aid award in the student portal and formally accept or decline the package so the institution has my documented decision on file.

## Background
`academy_aid_packages`, `academy_aid_awards`, and `academy_aid_disbursements` exist with real data. The admin financial-aid page reads and displays these. There is no award letter generation — no formatted document, no acceptance workflow, and students see only a summary on the PWA aid page. Without an award letter, a school cannot present financial aid to prospective students in a form they can act on.

## Acceptance Criteria
1. Financial aid officer clicks "Generate Award Letter" on a student's aid package record.
2. Letter is generated as a PDF using `@react-pdf/renderer` (same library as ADR-0044):
   - Institution header (logo + name + address)
   - Student name, ID, program, academic year/term
   - Itemized aid awards table: type (grant, scholarship, institutional aid, work-study, loan), amount, duration
   - Estimated cost of attendance (tuition + fees from tuition schedule if available, or admin-entered estimate)
   - Net cost calculation: cost of attendance minus total aid
   - Acceptance deadline
   - Acceptance instructions
3. PDF stored in Supabase Storage at `aid-letters/{tenantId}/{studentId}/{packageId}.pdf`.
4. Student receives a notification email: "Your financial aid award letter is ready to review."
5. Student sees the award on the PWA aid page with: total aid amount, net cost, and a "View Award Letter" download link.
6. Student can tap "Accept Award" or "Decline Award" from the PWA.
7. Officer sees the student's decision (accepted/declined + timestamp) on the aid package record.
8. Accepted packages trigger the system to schedule disbursements per the disbursement plan.

## Edge Cases
- Aid package with no awards (zero-aid letter): officer can still generate a letter showing $0 aid and full cost — useful for denial documentation.
- Cost of attendance not configured (no tuition schedule): officer enters a manual cost estimate at letter generation time.
- Student declines and later wants to accept: officer can re-open the decision within the acceptance deadline; student can then accept.
- Acceptance deadline passes with no decision: package status moves to `decision_expired`; officer notified.
- Two aid officers generate letters simultaneously: idempotent — second generation detects existing PDF in storage and reuses it.

## Out of Scope
- FAFSA/ISIR import (Tier 4)
- COD (Common Origination and Disbursement) integration (Tier 4)
- Federal Stafford/PLUS loan processing (Tier 4, requires regulated aid gate)
- SAP (Satisfactory Academic Progress) automated tracking (Tier 4)
- Appeals process (Tier 4)

## Role Matrix
| Role | Generate Letter | View Letter | Accept/Decline | View Decision |
|------|:--------------:|:-----------:|:--------------:|:-------------:|
| Financial Aid Officer | ✓ | ✓ | ✗ | ✓ |
| Admin | ✓ | ✓ | ✗ | ✓ |
| Registrar | ✗ | ✓ | ✗ | ✓ |
| Student | ✗ | Own released | ✓ | Own |
| Guardian | ✗ | ✗ | ✗ | ✗ |

## Technical Notes
- Package: `@react-pdf/renderer` — already added for T2-08 transcript PDF; this reuses the same dependency
- Storage: `aid-letters` bucket in Supabase Storage (private); signed URL pattern same as transcript PDF
- Function: `src/modules/billing/aid-letter-pdf.ts` — `generateAidAwardLetterPdf()`
- Acceptance decision: add `accepted_at`, `declined_at`, `decision_by_person_id` columns to `academy_aid_packages` or a new `academy_aid_package_decisions` table
- Notification: use existing `CommunicationsService` to enqueue the "award ready" email
- Dependency: T1-02 (email delivery) for the notification; T2-01 (Stripe) is not a dependency — aid letter precedes payment

## Tests Required
- `generateAidAwardLetterPdf()` success: PDF bytes returned, stored in correct path.
- `generateAidAwardLetterPdf()` idempotency: second call returns existing path without regenerating.
- `generateAidAwardLetterPdf()` zero-award package: PDF generated with $0 aid table (not an error).
- `recordStudentAidDecision()` accept: decision stored with timestamp and person ID.
- `recordStudentAidDecision()` decline: decision stored.
- `recordStudentAidDecision()` cross-student rejection: student cannot accept another student's aid package.
- `recordStudentAidDecision()` after deadline: blocked with "Acceptance deadline has passed."
- `getAidAwardLetterUrl()` released: returns signed URL.
- `getAidAwardLetterUrl()` cross-tenant: blocked.
- Notification enqueued: after PDF generation, one email message in queue for the student.
