# Application Document API Routes — ADR-0048 Implementation Plan

## Status: IN PROGRESS

This plan formalizes the remaining backend API routes for the ADR-0048 document system
(`document-service.ts`). The service layer and migrations are already complete; only
the route layer and supporting service changes are outstanding.

Reference: `IMPLEMENTATION_NOTES.md`
ADR: ADR-0048 (approved 2026-06-25)
Service file: `src/modules/admissions/document-service.ts`

---

## Prompt A — Upload-URL Route (create doc record + presigned upload URL) ✅ SHIPPED

**Files modified:**
- `src/modules/admissions/types.ts` — added `documentId` to `UploadUrlResponse`
- `src/modules/admissions/document-service.ts` — added `findDocumentTypeBySlug` to `DocumentRepository`; updated `generateUploadUrl` to create the document record and return `documentId`
- `src/modules/admissions/postgres-repository.ts` — implemented `findDocumentTypeBySlug`
- `src/modules/admissions/__tests__/document-service.test.ts` — added mock for `findDocumentTypeBySlug`
- `src/modules/admissions/__tests__/document-admin-ui-acceptance.test.ts` — added mock for `findDocumentTypeBySlug`
- `src/app/api/academy/admissions/applications/[id]/documents/upload-url/route.ts` — new POST handler

**Route spec:**
```
POST /api/academy/admissions/applications/[id]/documents/upload-url
Body: { documentTypeSlug: string, fileName: string, mimeType: string, sizeBytes: number }
Auth: applicant (own app) or admissions staff
Returns: { uploadUrl: string, storagePath: string, documentId: string }
```

**Verification:** tsc ✅ clean, lint ✅ clean

---

## Prompt B — Confirm Upload Route

**Files to create:**
- `src/app/api/academy/admissions/applications/[id]/documents/[itemId]/confirm/route.ts`

**Route spec:**
```
PATCH /api/academy/admissions/applications/[id]/documents/[itemId]/confirm
Body: { storagePath: string }
Auth: applicant (own app) or admissions staff
Returns: { document: ApplicationDocument }
```

**Work:**
1. Resolve actor from session
2. Fetch application by `id` → get `applicantPersonId`, assert tenant match
3. Parse body: `requireStringField(body.storagePath, "storagePath")`
4. Instantiate service via `createAdmissionDocumentService(client)`
5. Call `service.confirmUpload(actor, tenantId, applicationId, applicantPersonId, itemId, storagePath)`
6. Return `{ document }`

**Security:** `assertAdmissionsAccess(actor, tenantId, applicantPersonId, "submit")` (done inside service)

---

## Prompt C — Mark Received Route

**Files to create:**
- `src/app/api/academy/admissions/applications/[id]/documents/[itemId]/receive/route.ts`

**Route spec:**
```
PATCH /api/academy/admissions/applications/[id]/documents/[itemId]/receive
Body: (none required)
Auth: admissions staff only
Returns: { document: ApplicationDocument }
```

**Work:**
1. Resolve actor from session
2. Fetch application by `id` → get `applicantPersonId`, assert tenant match
3. Instantiate service via `createAdmissionDocumentService(client)`
4. Call `service.markReceived(actor, tenantId, applicationId, applicantPersonId, itemId)`
5. Return `{ document }`

**Security:** `assertAdmissionsAccess(actor, tenantId, applicantPersonId, "review")` (done inside service — blocks non-staff)

---

## Prompt D — Waive Document Route

**Files to create:**
- `src/app/api/academy/admissions/applications/[id]/documents/[itemId]/waive/route.ts`

**Route spec:**
```
PATCH /api/academy/admissions/applications/[id]/documents/[itemId]/waive
Body: { waiverNote: string }
Auth: admissions staff only (institution_admin, dean, registrar, admissions)
Returns: { document: ApplicationDocument }
```

**Work:**
1. Resolve actor from session
2. Fetch application by `id` → get `applicantPersonId`, assert tenant match
3. Parse body: `requireStringField(body.waiverNote, "waiverNote")`
4. Instantiate service via `createAdmissionDocumentService(client)`
5. Call `service.waiveDocument(actor, { tenantId, applicationId, documentId: itemId, waivedBy: actor.userId, waiverNote })`
6. Return `{ document }`

**Security:** Service asserts staff role internally (admissions, dean, registrar, institution_admin).

---

## Prompt E — Download URL Route

**Files to create:**
- `src/app/api/academy/admissions/applications/[id]/documents/[itemId]/download/route.ts`

**Route spec:**
```
GET /api/academy/admissions/applications/[id]/documents/[itemId]/download
Auth: applicant (own app) or admissions staff
Returns: { downloadUrl: string }
```

**Work:**
1. Resolve actor from session
2. Fetch application by `id` → get `applicantPersonId`, assert tenant match
3. Instantiate service via `createAdmissionDocumentService(client)`
4. Call `service.generateDownloadUrl(actor, tenantId, applicationId, applicantPersonId, itemId)`
5. Return `{ downloadUrl }`

**Security:** `assertAdmissionsAccess(actor, tenantId, applicantPersonId, "read")` (done inside service)

---

## Prompt F — Admissions Decision Gate Integration

**Files to modify:**
- `src/app/api/academy/admissions/applications/[id]/decision/route.ts`

**Work:**
1. In the decision POST handler, before creating the decision record, call:
   ```typescript
   const docService = createAdmissionDocumentService(client);
   const completionStatus = await docService.canAdvanceToDecision(actor, tenantId, applicationId);
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
2. Import `createAdmissionDocumentService` from service-factory

**Security:** No new auth needed — decision route already asserts admissions access.

**Verification:** `npm run lint && npx tsc --noEmit && npm test`

---

## Execution Order

Prompts A–E are independent of each other (different route files). They can be done in any order.
Prompt F depends on the decision route already existing (it does) but not on A–E.

Suggested order: A ✅ → B → C → D → E → F (then full `npm test` pass on F)
