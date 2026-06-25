# ADR-0057 — Financial Aid Award Letter Generation and Regulatory Boundary

**Date:** 2026-06-25
**Status:** Accepted
**Deciders:** Ricardo Julia (sole approver)
**Council review:** `docs/reviews/2026-06-25-council-review-10-partial-gap-closeout.md`

---

## Context

The financial aid module stores aid packages and award items. Students cannot see a formatted award
letter, and no acceptance workflow exists. Institutions cannot issue official award notifications
through the system, which means financial aid communication happens outside Academy (email, printed
letters) with no audit trail.

Federal financial aid (Title IV, Pell Grants) remains behind an activation gate (ADR-0036).
This ADR governs institutional aid (scholarships, grants, work-study allocated by the institution)
and the award letter generation for that aid category. Federal aid letters are deferred.

---

## Decision

### 1. Award letter entity

Add `academy_aid_letters` table:

- `id`, `tenant_id`, `student_person_id`
- `aid_package_id` — references the aid package this letter covers
- `term_id`
- `status`: `draft` | `issued` | `accepted` | `declined` | `expired`
- `issued_at`
- `accepted_at`
- `declined_at`
- `expires_at` — institution sets an acceptance deadline; letters expire if not accepted by this date
- `acceptance_ip_hash` — SHA-256 hash of the student's request IP at acceptance time (not raw IP)
- `storage_path` — Supabase Storage path to the generated PDF (set when status transitions to `issued`)

### 2. PDF generation

Award letter PDFs are generated using `@react-pdf/renderer` (already a project dependency).

Letter content:
- Institution name and logo (from `InstitutionProfile`)
- Student name, student ID, program, term
- Award table: each aid item with name, type (scholarship/grant/work-study/institutional-loan), and amount
- Total institutional aid amount
- Net cost estimate: total charges (from payment plan) minus total aid
- Acceptance terms: a plain-language statement that accepting constitutes agreement to the institution's
  aid policies
- Signature line: "By accepting this award, you confirm the information above is correct."
- Acceptance deadline date (`expires_at`)

PDF generation is **synchronous on the issuing staff action** (not queued). Typical award letters are
small (1–2 pages); synchronous generation is acceptable.

The generated PDF is stored in Supabase Storage private bucket `academy-aid-letters` at path:
`{tenant_id}/{student_person_id}/{aid_letter_id}.pdf`

### 3. Issuance flow

Admin/financial aid officer at `/admin/financial-aid/packages/[id]`:
1. Reviews the aid package items and amounts.
2. Clicks "Issue Award Letter".
3. System generates PDF and creates `academy_aid_letters` record in status `issued`.
4. Enqueues a notification email to the student (ADR-0040): "Your financial aid award letter is ready."

### 4. Student acceptance flow

Student at `/student/account/financial-aid`:
1. Sees "View Award Letter" button when a letter is in `issued` status.
2. Opens the award letter PDF (signed URL, 15-minute expiry).
3. Sees "Accept Award" and "Decline Award" buttons.
4. On Accept: `POST /api/academy/financial-aid/award-letters/[id]/accept`
   - Records `accepted_at`, `acceptance_ip_hash`.
   - Transitions status to `accepted`.
   - Emits audit event.
5. On Decline: `POST /api/academy/financial-aid/award-letters/[id]/decline`
   - Records `declined_at`, transitions to `declined`.
   - Notifies financial aid office via communications queue.

If `expires_at` is in the past when the student views the letter, the Accept button is disabled
and a message reads: "This offer has expired. Contact the financial aid office."

A Vercel Cron job (`/api/cron/aid-letter-expiry`, runs daily at 03:00 UTC) transitions letters
from `issued` to `expired` when `expires_at < now()`.

### 5. Regulatory boundary

This ADR governs institutional aid only. Federal aid (Title IV, Pell, FSEOG, Direct Loans) requires:
- FAFSA processing data from the Department of Education
- Satisfactory Academic Progress (SAP) calculation
- Return of Title IV funds calculation (R2T4)

These requirements are outside scope. The `aid_package` table has an `aid_source` column;
packages with `aid_source = federal` may not have award letters generated through this flow
until ADR-0036 regulated aid activation is completed.

---

## Consequences

- Institutions can issue official digital award letters with a full audit trail.
- Students can review, accept, or decline aid offers through the PWA.
- The acceptance IP hash provides evidence of student action without storing raw PII.
- Federal aid remains gated, preventing premature compliance violations.

---

## Alternatives Considered

**Async PDF generation via queue:**
Rejected for this scope. Award letters are generated infrequently, are small in size, and staff
expect immediate feedback. Queue-based generation adds latency and complexity without benefit.
If large-batch letter generation is needed in the future, the issuing flow can be adapted.

**E-signature via DocuSign or similar:**
Deferred. A PWA-native "accept" button with IP hash is sufficient for institutional aid. Federal
aid acceptance that requires a formal promissory note will need a third-party e-signature service.
That decision belongs in the regulated aid activation ADR.

---

## Security / Privacy Review Notes

- Award letter PDF must not be accessible via a public URL. Signed URLs only, 15-minute expiry.
- `acceptance_ip_hash` must be SHA-256 of the client IP; raw IP must not be stored in the database.
- Expired letters must not be downloadable or acceptable after `expires_at`.
- The aid officer issuing the letter must have `financial_aid` or `admin` role (tenant-verified).

---

## Related

- ADR-0036 — Regulated/federal aid activation boundary
- ADR-0040 — Email delivery provider and queue worker
- ADR-0044 — Transcript PDF generation strategy (same @react-pdf/renderer pattern)
- ADR-0055 — Student PWA full self-service (exposes acceptance flow)
