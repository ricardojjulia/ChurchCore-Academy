# Story: Application Document Checklist
**ID:** T2-02
**Tier:** 2 — Complete Core SIS Workflows
**Status:** Implemented in Sprint A / PR #61
**Date:** 2026-06-22

## User Story

As an admissions officer, I want to define a required document checklist per program so that applicants know exactly what to submit and I can track completion before making a decision.

As an applicant, I want to upload my documents to my application and see my checklist status so that I can complete my file without emailing the admissions office.

## Background

The admissions module at `src/modules/admissions/` handles application lifecycle (draft → submitted → under_review → accepted/declined). The `AdmissionApplication` type in `types.ts` references `programId`, linking each application to an `AcademicProgram` from `src/modules/academic-programs/`. Neither the admissions module nor the programs module contains a document checklist concept today. There is no file upload infrastructure in the codebase. Supabase Storage is the appropriate target for uploads given the existing Supabase stack.

## Acceptance Criteria

1. Admin can define a document checklist for a program: a named list of required document types (e.g., "Official Transcript", "Statement of Faith", "Recommendation Letter 1") each with a label, whether it is required or optional, and an optional description.
2. When an application is created for a program, the application inherits the program's current checklist as a snapshot of required items; changes to the program checklist after application submission do not alter existing application checklists.
3. Applicant sees their checklist on the application status page, with each item showing: label, required/optional, status (pending / uploaded / reviewed / resubmission required).
4. Applicant can upload a file (PDF only, max 10 MB) against a checklist item via a form on the status page. Files are stored in Supabase Storage under a tenant-scoped, application-scoped path. The upload URL is not exposed directly to the client; the server issues a signed upload URL or proxies the upload.
5. Admissions officer can view all uploaded documents on the application review page and open/download each file via a signed URL.
6. Admissions officer can mark a document item as "reviewed" (accepted) or "resubmission required" with an optional note.
7. The application review page shows a checklist completion percentage: (required items with status reviewed) / (total required items) × 100.
8. Application can proceed to a decision even if the checklist is incomplete; the system shows a warning but does not block the officer's decision (officer's discretion).

## Edge Cases

- Applicant uploads a file with an unsupported MIME type (not `application/pdf`): server rejects the upload with a 422 response and a clear error message; file is not stored.
- Applicant uploads a file exceeding 10 MB: server rejects before storage with a 413 response.
- Applicant uploads a second file against the same checklist item: the new file replaces the previous one; the old file is deleted from Supabase Storage. Status resets to "uploaded" (not "reviewed").
- Officer marks an item "resubmission required": status shows "resubmission required" on the applicant's status page with the officer's note; applicant can upload again.
- Application moves to "accepted" or "declined" with an incomplete checklist: checklist items are preserved in their current state; the warning is logged to the application event trail.
- Checklist is empty (program has no document requirements): the checklist section is hidden from the applicant status page; completion percentage is shown as 100%.
- Applicant accesses another applicant's document upload URL: storage path must be under the application ID, and the signed URL policy must scope access to the owning student only.
- Program checklist updated after applications exist: existing applications retain their snapshot; new applications inherit the updated checklist.

## Out of Scope

- Non-PDF file types (image, Word, etc.) — PDF only in v1.
- Virus or malware scanning of uploaded files.
- Bulk document download as ZIP.
- Automated email notification when a document is marked "resubmission required" (covered by T1-02 email delivery; triggered in a later sprint).
- Third-party document verification services.

## Role Matrix

| Action | applicant | admissions_officer | registrar | academic_admin | institution_admin |
|--------|:---------:|:------------------:|:---------:|:--------------:|:-----------------:|
| Define program document checklist | — | ✓ | — | ✓ | ✓ |
| View own application checklist | ✓ | — | — | — | — |
| Upload document to own application | ✓ | — | — | — | — |
| View all documents on any application | — | ✓ | ✓ | ✓ | ✓ |
| Mark document reviewed / resubmission required | — | ✓ | ✓ | ✓ | ✓ |
| Download any uploaded document | — | ✓ | ✓ | ✓ | ✓ |

## Technical Notes

- **New domain concepts:** `ProgramDocumentRequirement` (program-level template) and `ApplicationDocumentItem` (application-level snapshot + upload status). These belong in `src/modules/admissions/` alongside the existing `AdmissionApplication` type.
- **Admissions module:** `src/modules/admissions/types.ts`, `service.ts`, `postgres-repository.ts`, `validation.ts`. New functions follow the same pattern as existing service methods: resolve actor, enforce tenant, call repository.
- **Supabase Storage:** Use the Supabase service-role client (available in server-only routes) to generate signed upload URLs. Storage bucket: `academy-documents`. Path convention: `{tenantId}/applications/{applicationId}/{documentItemId}/{filename}`. Bucket should have private access; never public URLs.
- **Upload flow:** Client requests a signed upload URL from a new API route `POST /api/academy/admissions/applications/[id]/documents/[itemId]/upload-url`. Server validates actor, generates the signed URL via Supabase Storage SDK, returns it. Client uploads directly to Supabase Storage using the signed URL. After upload completes, client calls `PATCH /api/academy/admissions/applications/[id]/documents/[itemId]` to confirm the upload and set status to "uploaded".
- **File validation:** Validate `Content-Type: application/pdf` and size <= 10 MB server-side in the upload-url route before issuing the URL. Do not rely on client-provided headers alone.
- **Migrations:** New tables needed: `academy_program_document_requirements` and `academy_application_document_items`. Both require `tenant_id`, RLS, and the standard `id uuid primary key default gen_random_uuid()` pattern.
- **Checklist snapshot:** On application creation, copy the current `ProgramDocumentRequirement` rows into `academy_application_document_items` with `status: "pending"`. This snapshot is taken in the admissions service.
- **Application status page:** `src/app/admissions/` — the public-facing status page. The checklist component is a new shared component in `src/components/academy/admissions/`.
- **Review page:** `src/app/admin/admissions/` — extend the existing review model to include document items.
- **ADR reference:** No dedicated ADR required for this feature; follows existing Supabase Storage conventions documented in architecture.md.

## Tests Required

- `createApplicationDocumentItem()` success: document item created with status "pending" for a valid application and program requirement.
- `createApplicationDocumentItem()` cross-tenant rejection: actor on tenant A cannot create items for application on tenant B.
- `confirmDocumentUpload()` success: status transitions from "pending" to "uploaded"; previous storage path is deleted if replaced.
- `confirmDocumentUpload()` wrong file type: request with non-PDF MIME type returns validation error.
- `reviewDocumentItem()` success: officer marks item "reviewed"; status updates correctly.
- `reviewDocumentItem()` "resubmission required": note stored; status set correctly.
- `reviewDocumentItem()` non-officer rejection: applicant actor cannot call review operations on their own documents.
- Checklist completion percentage: 2 required items, 1 reviewed → 50%; all reviewed → 100%; no required items → 100%.
- Cross-tenant rejection on document download URL: applicant cannot request a signed URL for another applicant's document.
