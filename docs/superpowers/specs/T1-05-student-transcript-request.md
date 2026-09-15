# Story: Student Self-Service Transcript Request
**ID:** T1-05
**Tier:** 1 — Unblock Basic Operations
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story
As a student, I want to request an official transcript from the student portal so I can apply to graduate programs or provide proof of enrollment without calling the registrar's office.

As a registrar, I want to see all student-submitted transcript requests in my queue so I can process them in order.

## Background
The PWA documents page currently shows issued transcripts as read-only items. There is no way for a student to initiate a request — every CTA says "contact your institution." The transcript issuance workflow (hold/release/revoke) is fully built on the admin side and needs only a student-facing entry point to become end-to-end functional.

## Acceptance Criteria
1. Student sees a "Request Official Transcript" button on the PWA `/student/documents` page.
2. Tapping opens a request form with: recipient name, recipient email (for digital) or mailing address (for physical), delivery method (`digital` or `physical`), and an optional note to the registrar.
3. Submitting calls `POST /api/academy/transcripts/request` which creates an `academy_transcript_issuances` record with `status: requested` linked to the student's person ID.
4. Student receives a confirmation email ("Your transcript request has been received...") via the communications queue.
5. The registrar's `/admin/transcripts` page shows all requests with status `requested` at the top of the queue.
6. Registrar can approve (→ triggers PDF generation per ADR-0044, status → `issued`), hold (`status: held`), or reject (student notified by email).
7. Once `released`, the student sees a "Download Transcript" link on the documents page pointing to the signed URL.
8. Student cannot download a transcript that is in `issued` or `held` state — only `released`.

## Edge Cases
- Student with no posted grades: request allowed; registrar sees a warning "No posted grades on record" in the queue item.
- Student with a billing hold: request is blocked at form submission with message "Your account has an outstanding balance. Please resolve it before requesting an official transcript."
- Student submits duplicate request for same recipient in same term: warn with "A request for this recipient is already pending" and offer to view existing request status.
- Registrar PDF generation fails: status stays `issued`, registrar sees error notification, can retry.
- Recipient email bounces: logged as `failed_delivery` on the issuance record; registrar notified.

## Out of Scope
- Third-party transcript clearinghouse integration (Tier 4)
- Electronic transcript exchange (PESC XML/EDI) (Tier 4)
- Applicant-requested transcripts before enrollment (covered by T1-03 applicant portal)
- Rush processing or fee collection for transcript requests (Tier 2/T2-01)

## Role Matrix
| Role | Can Submit Request | Can View Queue | Can Approve/Reject | Can Download Released |
|------|:------------------:|:--------------:|:------------------:|:---------------------:|
| Student | Own records only | Own status only | ✗ | Own released only |
| Registrar | ✗ | All requests | ✓ | ✓ |
| Admin | ✗ | All requests | ✓ | ✓ |
| Faculty | ✗ | ✗ | ✗ | ✗ |
| Guardian | ✗ | ✗ | ✗ | ✗ |

## Technical Notes
- API route: `src/app/api/academy/transcripts/request/route.ts` (new) — POST only, requires student session
- Issuance model: `src/modules/grading/` — check `TranscriptService` and existing issuance repository
- Billing hold check: read `academy_billing_ledger_entries` balance before allowing request
- PDF generation fires in the approval action (existing registrar path), not at request time
- Communications queue: enqueue confirmation message via existing `CommunicationsService`
- PWA page: `src/app/student/documents/page.tsx` — add request button and status display

## Tests Required
- `createTranscriptRequest()` success: creates record with `status: requested`, enqueues confirmation email.
- `createTranscriptRequest()` billing hold rejection: student with positive outstanding balance receives validation error.
- `createTranscriptRequest()` cross-tenant rejection: student on tenant A cannot create a request attributed to tenant B.
- `getTranscriptRequests()` registrar scope: returns all tenant requests sorted by created_at desc.
- `getTranscriptRequests()` student scope: returns only the authenticated student's own requests.
- Download URL gate: `buildSignedDownloadUrl()` returns null (not a URL) for `issued` or `held` status.
