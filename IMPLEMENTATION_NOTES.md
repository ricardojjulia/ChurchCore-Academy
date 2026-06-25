# Application Document Checklist Implementation Notes

## Completed (Backend)

### Database Migrations
- `supabase/migrations/20260625_academy_document_types.sql` - Document type registry
- `supabase/migrations/20260625_academy_application_documents.sql` - Application documents with RLS

### Module Layer
- Extended `src/modules/admissions/types.ts` with document types and application documents
- Extended `src/modules/admissions/postgres-repository.ts` with document management repository functions
- Created `src/modules/admissions/document-service.ts` - Full service layer with tenant isolation, role checking, and audit logging
- Created `src/lib/supabase/storage.ts` - Supabase Storage provider for presigned URLs

### Tests
- Created `src/modules/admissions/__tests__/document-service.test.ts` with comprehensive coverage:
  - Success cases for all operations
  - Cross-tenant rejection tests
  - File type and size validation
  - Waiver note requirement
  - Checklist completion logic
  - Secret field protection (download URL redaction test)

### API Routes (Partial)
- `src/app/api/academy/admissions/document-types/route.ts` - Document type management
- Updated `src/app/api/academy/admissions/applications/[id]/documents/route.ts` - Checklist retrieval

## Remaining Work (Not in Scope for Backend Task)

### API Routes
The following routes need to be created following the same pattern as document-types:

1. POST `/api/academy/admissions/applications/[id]/documents/upload-url`
   - Accept: { documentTypeSlug, fileName, mimeType, sizeBytes }
   - Call: `service.generateUploadUrl(...)`
   - Return: { uploadUrl, storagePath }

2. PATCH `/api/academy/admissions/applications/[id]/documents/[docId]/confirm`
   - Accept: { storagePath }
   - Call: `service.confirmUpload(...)`
   - Return: { document }

3. PATCH `/api/academy/admissions/applications/[id]/documents/[docId]/receive`
   - Call: `service.markReceived(...)`
   - Return: { document }

4. PATCH `/api/academy/admissions/applications/[id]/documents/[docId]/waive`
   - Accept: { waiverNote }
   - Call: `service.waiveDocument(...)`
   - Return: { document }

5. GET `/api/academy/admissions/applications/[id]/documents/[docId]/download`
   - Call: `service.generateDownloadUrl(...)`
   - Return: { downloadUrl }

### Admissions Decision Integration
The existing admissions decision route (location TBD - not found in initial scan) needs to be updated:

Before creating a decision record, call:
```typescript
const completionStatus = await documentService.canAdvanceToDecision(
  actor,
  tenantId,
  applicationId,
);

if (!completionStatus.complete) {
  return NextResponse.json(
    {
      error: "Application cannot advance to decision. Required documents are missing.",
      missingDocuments: completionStatus.missingDocuments,
    },
    { status: 422 },
  );
}
```

### Frontend (Not in Scope)
- Admin application detail page document checklist UI
- Applicant /apply/status document upload UI
- Admin document type management page

## Notes

- **Existing Code Conflict**: There is an existing document checklist implementation at `src/modules/admissions/document-checklist.ts` with a different schema (program-level requirements instead of institution-level document types). ADR-0048 (approved 2026-06-25) represents the new approach. The old implementation may need to be deprecated or the two systems reconciled.

- **Storage Bucket**: The bucket `academy-application-documents` must be created in Supabase Storage and set to private. RLS policies in Supabase handle access control at the database level, but storage access uses signed URLs generated server-side.

- **Tenant Isolation**: All service methods enforce `actor.tenantId === tenantId` before repository access, following the architecture requirement.

- **Audit Events**: Every sensitive operation (create type, upload, receive, waive, download) creates an audit event via `PostgresAcademyAuditRepository`.

- **File Validation**: MIME type and size validation happens in the service layer before issuing upload URLs. Supported types: PDF, JPEG, PNG. Max size: 10 MB.
