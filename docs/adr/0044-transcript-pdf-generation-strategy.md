# ADR-0044 — Transcript PDF Generation Strategy

**Status:** Accepted
**Date:** 2026-06-22
**Deciders:** @ricardojjulia

---

## Context

ADR-0034 established the transcript request and issuance workflow. ADR-0011 established official-record and audit requirements. The hold/release workflow is implemented: registrars can place a transcript on hold, review it, and release it. Released issuances are the only records authorized for delivery to students or external recipients.

No transcript generation engine exists. There is no code path from `academy_gradebook_records` to a formatted, printable document. The issuance workflow ends at `status: 'released'` with no artifact. Students who request their transcript receive nothing deliverable.

This is a critical gap for any institution operating ChurchCore Academy. Transcript generation is the primary deliverable of the official-records workflow, and it is the output that external recipients (employers, graduate schools, denominations) need.

A transcript is a legally significant document in some jurisdictions. Its format must convey institutional identity (letterhead, seal), academic completeness (all posted grades by term), cumulative GPA, and issuance authority (signature block, issuance date, seal). It must be tamper-evident — generating it as a PDF stored in object storage with a signed access URL is the standard approach.

The constraint from ADR-0013 (Student PWA data exposure model) and the CLAUDE.md rule — "Student PWA surfaces only released, reviewed records" — applies directly: transcript PDFs may only be generated for `released` issuances.

---

## Decision

Use `@react-pdf/renderer` to generate transcript PDFs server-side. Store generated PDFs in Supabase Storage. Deliver via time-limited signed URLs.

**Library rationale:**

`@react-pdf/renderer` generates PDFs from React component trees using a PDF-native layout engine (not a browser HTML-to-PDF conversion). It runs server-side in Node.js, requires no headless browser, and produces deterministic output. This avoids the operational complexity of Puppeteer or Playwright PDF generation while keeping the document template in the familiar React component model.

**Generation function:**

```ts
export async function generateTranscriptPdf(
  tenantId: string,
  studentId: string,
  issuanceId: string,
  client: PoolClient
): Promise<string> // returns Supabase Storage path
```

**Data inputs (all read from Postgres with tenant_id guard):**

1. `academy_student_profiles` — student legal name, ID number, program, enrollment dates
2. `academy_institutions` — institution name, address, accreditation statement, logo URL
3. `academy_gradebook_records` (status = 'official') — grade records grouped by academic term
4. `academy_grading_scales` — letter grade, quality points, description for each symbol
5. `academy_transcript_issuances` — issuance ID, requested date, released date, released by (registrar name)
6. GPA from `academy_student_profiles.gpa` (computed and written per ADR-0043) plus per-term GPA computed inline

**Document structure:**

1. Institution letterhead — name, logo, address, accreditation statement
2. Student identification block — legal name, student ID, program, enrollment dates
3. Term-by-term grade table — for each term: term name, course number, course title, credit hours, grade, quality points
4. Term GPA subtotal row after each term block
5. Cumulative summary — total credit hours attempted, total credit hours earned, cumulative GPA, academic standing
6. Issuance signature block — "Issued by: [registrar name]", issuance date, issuance ID (for verification)

**Storage:**

Generated PDF is stored at: `transcripts/{tenantId}/{studentId}/{issuanceId}.pdf` in Supabase Storage.

Storage bucket `transcripts` is private (not public). Access is only via signed URLs.

The issuance record is updated with `pdf_storage_path` after successful generation.

**Signed URL delivery:**

The transcript issuance API (`GET /api/academy/transcripts/[id]`) returns a signed URL valid for 15 minutes when the issuance `status = 'released'` and a PDF has been generated. If the PDF does not yet exist (first access after release), the API generates it on-demand before returning the URL. Subsequent accesses use the stored PDF — no re-generation.

**Student PWA access:**

Students access their transcript PDF from the PWA documents page. The PWA calls `GET /api/academy/student/transcripts/[id]` which enforces that the requesting student is the subject of the transcript, the issuance is `released`, and the tenant matches. The response is a signed URL — the student's browser fetches the PDF directly from Supabase Storage. The PDF does not pass through Academy server memory.

**Official vs unofficial transcripts:**

The generation function renders all officially posted grade records regardless of whether the institution considers the transcript "official" or "unofficial" in its issuance workflow. The issuance record's `official` boolean flag (set by the registrar at release time) is printed on the document in the signature block: "Official Transcript" or "Unofficial Transcript — For Student Use Only". The underlying data is identical.

**Guard against draft and held records:**

`generateTranscriptPdf` reads the issuance record first. If `status != 'released'`, it throws `TranscriptNotReleasedError`. This check runs before any grade data is read. There is no path from a draft or held issuance to a generated PDF.

---

## Consequences

**Positive:**
- The official-records workflow has a complete end-to-end path from grade posting through a deliverable, formatted PDF.
- PDFs are generated once and stored — repeated access does not re-execute the generation logic.
- Signed URLs keep the PDF private while giving time-limited access to authorized recipients.
- The React component model makes transcript layout maintainable by engineers already working in the codebase.
- The server-side generation approach does not require a headless browser, Puppeteer, or Playwright — no additional process management.

**Negative:**
- `@react-pdf/renderer` is a new dependency. It must be documented in the PR per CLAUDE.md rules.
- First-access generation adds latency to the transcript download on first request. For institutions with many grades per student, this may be noticeable. Acceptable at pilot scale; a background pre-generation job can be added later.
- Supabase Storage bucket configuration and private bucket RLS must be validated in the deployment runbook (ADR-0038).
- Transcript layout changes (logo, letterhead, column order) require a code change and re-generation of previously issued PDFs. A re-generation endpoint for registrars is out of scope for MVP but is a known follow-on need.

---

## Alternatives Considered

### Puppeteer or Playwright HTML-to-PDF

Rejected. Headless browser generation requires a separate process, adds significant memory overhead, and introduces Chromium as a deployment dependency. Vercel serverless functions do not support long-running Puppeteer processes without additional configuration.

### PDFKit (low-level PDF drawing API)

Rejected. PDFKit requires manual coordinate-based layout. The transcript's structured, multi-section format would be difficult to maintain with a drawing API. `@react-pdf/renderer` provides a composable layout model that matches how Academy UI components are already written.

### Deliver grades as a formatted HTML page (no PDF)

Rejected. External recipients (employers, graduate schools, denominational bodies) require a fixed-format document. An HTML page is not an acceptable substitute for a transcript in formal contexts.

### Delegate PDF generation to a third-party service (e.g., DocRaptor, WeasyPrint API)

Rejected. Third-party document generation services would receive student grade data in request payloads. Sending official student records to an external document service violates the data boundary established in ADR-0011 and ADR-0013.

---

## Review Notes

- **Security/privacy:** The Supabase Storage bucket must be private. Signed URLs must expire in 15 minutes. The student's legal name, ID number, and grade records are in the PDF — the PDF must never be publicly accessible. Every code path to `generateTranscriptPdf` must verify the issuance is `released` and the caller is authorized.
- **Testing:** Tests must cover: released issuance generates PDF and returns storage path, held issuance throws `TranscriptNotReleasedError`, grade records from a different tenant are not included, cumulative GPA matches `academy_student_profiles.gpa`, issuance record is updated with `pdf_storage_path` after generation.
- **New dependency:** `@react-pdf/renderer` — document reason in PR: server-side React PDF generation without headless browser, chosen for Node.js serverless compatibility and maintainable layout.
- **Storage path uniqueness:** `{tenantId}/{studentId}/{issuanceId}.pdf` is globally unique by `issuanceId` (UUID). No collision risk.

---

## Related

- ADR-0034 — Transcript Request Issuance Workflow
- ADR-0011 — Official Record, Transcript, and Audit Model
- ADR-0013 — Student PWA Data Exposure Model
- ADR-0043 — GPA Calculation Engine and Grade-to-Profile Linkage
- ADR-0024 — Gradebook System
- ADR-0038 — Competitive Acceptance and Deployment Readiness
