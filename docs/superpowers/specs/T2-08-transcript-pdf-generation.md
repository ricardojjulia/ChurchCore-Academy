# Story: Transcript PDF Generation
**ID:** T2-08
**Tier:** 2 — Complete Core SIS Workflows
**Status:** Ready for implementation
**Date:** 2026-06-22

## User Story
As a registrar, I want to generate a formatted, official PDF transcript from posted grade records so I can release a printable document to students and send it to receiving institutions — without using a word processor.

As a student, I want to download my official released transcript as a PDF so I have a document that looks like it came from a real institution.

## Background
Transcript issuances exist as database records with a full hold/release workflow. There is no engine that turns those records into a formatted document. "Transcript" currently means a status record, not a document. ADR-0044 approves `@react-pdf/renderer` for server-side PDF generation stored in Supabase Storage.

## Acceptance Criteria
1. When a registrar approves a transcript request, `generateTranscriptPdf(tenantId, studentId, issuanceId, client)` is called.
2. PDF content: institution logo + name + address (from institution profile), student name + ID + program, term-by-term grade table (course code, title, credits, grade, quality points), cumulative GPA, issuance date + issuance ID for verification.
3. PDF is stored in a private Supabase Storage bucket: `transcripts/{tenantId}/{studentId}/{issuanceId}.pdf`.
4. Signed download URL (15-minute TTL) is generated and returned to the registrar after generation.
5. Student can access their own released transcript download link from the PWA `/student/documents` page (signed URL regenerated on demand, always 15-min TTL).
6. PDF is generated once and reused on subsequent download requests (idempotent: if file already exists in Storage, return new signed URL without regenerating).
7. Transcript with `status: held` or `status: issued` (not yet released): no PDF is accessible; download link is not shown.

## Edge Cases
- Student with no posted grades: PDF generated with empty grade table and a note "No grade records on file as of [date]."
- Withdrawn student: PDF includes grade records through the term of withdrawal; no grades after.
- Institution has no logo uploaded: PDF renders with institution name as text header only.
- PDF generation fails (storage error, renderer crash): `status` remains `issued` (not moved to `released`); error is logged; registrar sees "PDF generation failed — please retry."
- Registrar downloads 50 times: new signed URL generated each time, same underlying file.
- Student downloads before release: 403 from the download URL route.

## Out of Scope
- Official seal or holographic watermark (Tier 4)
- Third-party clearinghouse electronic delivery (Tier 4)
- Unofficial transcript (lower-security version for student self-printing) — this is the official only
- Ministry Formation transcript (separate document type per ADR-0045, Tier 3)

## Role Matrix
| Role | Generate PDF | Access Released PDF | Access Unreleased |
|------|:-----------:|:-------------------:|:-----------------:|
| Registrar | ✓ | ✓ | ✓ (for review) |
| Admin | ✓ | ✓ | ✓ |
| Student | ✗ | Own released only | ✗ |
| Faculty | ✗ | ✗ | ✗ |
| Guardian | ✗ | ✗ | ✗ |

## Technical Notes
- Package: `@react-pdf/renderer` — add to dependencies; document in PR description per CLAUDE.md
- Function: `src/modules/grading/transcript-pdf.ts` — `generateTranscriptPdf()`
- Storage: Supabase service-role client for bucket writes; regular authenticated client for signed URL generation
- Bucket: `transcripts` — private, no public access
- Idempotency: check if `{tenantId}/{studentId}/{issuanceId}.pdf` exists in Storage before regenerating
- ADR reference: ADR-0044 governs this feature
- Grade data source: `academy_gradebook_records` where `status = 'official'`, grouped by term
- Grading scale: join `academy_grading_scales` to render quality points column

## Tests Required
- `generateTranscriptPdf()` success: PDF bytes returned, stored in correct bucket path.
- `generateTranscriptPdf()` idempotency: calling twice does not generate two files; second call returns existing path.
- `generateTranscriptPdf()` no-grades case: PDF generated with empty grade table (not an error).
- `getTranscriptDownloadUrl()` released status: returns valid signed URL.
- `getTranscriptDownloadUrl()` held status: returns null (no URL).
- `getTranscriptDownloadUrl()` cross-tenant: student on tenant A cannot get URL for tenant B transcript.
- Secret field guard: issuance internal notes must not appear in PDF output (`doesNotMatch`).
