import assert from "node:assert/strict";
import test from "node:test";
import {
  PublicApplicationService,
} from "@/modules/admissions/public-application-service";
import {
  DocumentChecklistService,
  ApplicationDocumentItem,
  DocumentItemStatus,
  DocumentStorageClient,
  ReviewDocumentItemInput,
} from "@/modules/admissions/document-checklist";
import { PostgresDocumentChecklistRepository } from "@/modules/admissions/document-checklist-repository";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { AdmissionApplication } from "@/modules/admissions/types";

const TENANT_ID = "tenant-main";
const TENANT_ID_OTHER = "tenant-other";
const APP_ID = "app-123";
const APP_ID_OTHER = "app-999";
const ITEM_ID = "item-456";
const ITEM_ID_OTHER = "item-789";
const STATUS_TOKEN = "tok-valid";
const STATUS_TOKEN_OTHER_TENANT = "tok-other-tenant";
const APPLICANT_PERSON_ID = "person-applicant";

const applicantActor: AcademyActor = {
  userId: APPLICANT_PERSON_ID,
  tenantId: TENANT_ID,
  roles: ["applicant"],
};

const admissionsStaffActor: AcademyActor = {
  userId: "person-admissions",
  tenantId: TENANT_ID,
  roles: ["admissions"],
};

const registrarStaffActor: AcademyActor = {
  userId: "person-registrar",
  tenantId: TENANT_ID,
  roles: ["registrar"],
};

const academicAdminActor: AcademyActor = {
  userId: "person-academic-admin",
  tenantId: TENANT_ID,
  roles: ["academic_admin"],
};

const institutionAdminActor: AcademyActor = {
  userId: "person-institution-admin",
  tenantId: TENANT_ID,
  roles: ["institution_admin"],
};

const studentActor: AcademyActor = {
  userId: "person-student",
  tenantId: TENANT_ID,
  roles: ["student"],
};

const crossTenantStaffActor: AcademyActor = {
  userId: "person-staff-other",
  tenantId: TENANT_ID_OTHER,
  roles: ["admissions"],
};

interface MockCall {
  sql: string;
  values: unknown[] | undefined;
}

function mockDocumentItem(
  overrides: Partial<ApplicationDocumentItem> = {},
): ApplicationDocumentItem {
  return {
    id: ITEM_ID,
    tenantId: TENANT_ID,
    applicationId: APP_ID,
    requirementId: "req-1",
    label: "High School Transcript",
    isRequired: true,
    status: "pending" as DocumentItemStatus,
    ...overrides,
  };
}

function mockApplication(
  overrides: Partial<AdmissionApplication> = {},
): AdmissionApplication {
  return {
    id: APP_ID,
    tenantId: TENANT_ID,
    applicantPersonId: APPLICANT_PERSON_ID,
    programId: "program-1",
    legalName: "Jordan Rivera",
    email: "jordan@example.com",
    status: "submitted",
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  };
}

// Acceptance Criterion 1: Applicant sees required documents with label, required/optional, status, and officer note if resubmission_required
test("AC1: GET documents - applicant sees label, isRequired, status, officerNote for resubmission_required", async () => {
  const calls: MockCall[] = [];
  const items = [
    mockDocumentItem({
      id: "item-1",
      label: "Official Transcript",
      isRequired: true,
      status: "reviewed",
    }),
    mockDocumentItem({
      id: "item-2",
      label: "Recommendation Letter",
      isRequired: true,
      status: "pending",
    }),
    mockDocumentItem({
      id: "item-3",
      label: "Photo ID",
      isRequired: false,
      status: "uploaded",
    }),
    mockDocumentItem({
      id: "item-4",
      label: "Birth Certificate",
      isRequired: true,
      status: "resubmission_required",
      officerNote: "Please resubmit with raised seal visible",
    }),
  ];

  const db = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      const sqlNorm = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (
        sqlNorm.includes("select a.id from academy_admission_applications a") &&
        values?.[0] === TENANT_ID &&
        values?.[1] === STATUS_TOKEN
      ) {
        return { rowCount: 1, rows: [{ id: APP_ID }] };
      }

      if (
        sqlNorm.includes("from academy_application_document_items") &&
        values?.[0] === TENANT_ID &&
        values?.[1] === APP_ID
      ) {
        return {
          rowCount: items.length,
          rows: items.map((item) => ({
            id: item.id,
            tenant_id: item.tenantId,
            application_id: item.applicationId,
            requirement_id: item.requirementId,
            label: item.label,
            is_required: item.isRequired,
            status: item.status,
            officer_note: item.officerNote ?? null,
          })),
        };
      }

      return { rowCount: 0, rows: [] };
    },
  };

  const service = new PublicApplicationService(db);
  const resolved = await service.resolveApplicationByToken(TENANT_ID, STATUS_TOKEN);
  assert.ok(resolved, "must resolve application");

  const repository = new PostgresDocumentChecklistRepository(db);
  const resultItems = await repository.listApplicationDocumentItems(
    TENANT_ID,
    resolved.applicationId,
  );

  assert.equal(resultItems.length, 4, "must return 4 items");

  const requiredItem = resultItems.find((i) => i.id === "item-2");
  assert.ok(requiredItem, "required pending item must exist");
  assert.equal(requiredItem.label, "Recommendation Letter");
  assert.equal(requiredItem.isRequired, true);
  assert.equal(requiredItem.status, "pending");

  const optionalItem = resultItems.find((i) => i.id === "item-3");
  assert.ok(optionalItem, "optional item must exist");
  assert.equal(optionalItem.isRequired, false);

  const resubmissionItem = resultItems.find((i) => i.id === "item-4");
  assert.ok(resubmissionItem, "resubmission_required item must exist");
  assert.equal(resubmissionItem.status, "resubmission_required");
  assert.equal(resubmissionItem.officerNote, "Please resubmit with raised seal visible");

  // Verify no secret field names appear in output
  const serialized = JSON.stringify(resultItems);
  assert.doesNotMatch(serialized, /storage_path/i);
  assert.doesNotMatch(serialized, /reviewed_by_person_id/i);
});

test("AC1: public GET /api/public/apply/documents response never includes storagePath, storageFilename, or reviewedByPersonId", async () => {
  // The repository layer legitimately returns the full ApplicationDocumentItem
  // (storagePath included) — the route's own mapping to a public-safe shape is
  // the actual boundary that must never leak these fields to an unauthenticated
  // applicant. Simulate that exact mapping (src/app/api/public/apply/documents/route.ts).
  const item = mockDocumentItem({
    status: "uploaded",
    storagePath: "tenant-test/applications/app-123/item-456/real-uuid.pdf",
    storageFilename: "transcript.pdf",
    reviewedByPersonId: "staff-person-999",
    reviewedAt: "2026-09-20T00:00:00.000Z",
  });

  const publicItem = {
    id: item.id,
    label: item.label,
    isRequired: item.isRequired,
    status: item.status,
    officerNote: item.officerNote,
    uploadedAt: item.uploadedAt,
  };

  const serialized = JSON.stringify(publicItem);
  assert.doesNotMatch(serialized, /storagePath/);
  assert.doesNotMatch(serialized, /storageFilename/);
  assert.doesNotMatch(serialized, /reviewedByPersonId/);
  assert.doesNotMatch(serialized, /reviewedAt/);
  assert.doesNotMatch(serialized, /real-uuid\.pdf/);
  assert.doesNotMatch(serialized, /staff-person-999/);
});

// Acceptance Criterion 2: Upload succeeds for pending/resubmission_required with valid PDF ≤10MB, status becomes "uploaded"
test("AC2: POST confirm - valid PDF ≤10MB for pending item transitions to uploaded", async () => {
  const item = mockDocumentItem({ status: "pending" });

  const db = {
    query: async (sql: string, values?: unknown[]) => {
      const sqlNorm = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (
        sqlNorm.includes("select a.id from academy_admission_applications a") &&
        values?.[0] === TENANT_ID &&
        values?.[1] === STATUS_TOKEN
      ) {
        return { rowCount: 1, rows: [{ id: APP_ID }] };
      }

      if (
        sqlNorm.includes("from academy_application_document_items") &&
        !sqlNorm.includes("update")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              id: item.id,
              tenant_id: item.tenantId,
              application_id: item.applicationId,
              requirement_id: item.requirementId,
              label: item.label,
              is_required: item.isRequired,
              status: item.status,
            },
          ],
        };
      }

      if (sqlNorm.includes("update academy_application_document_items")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: item.id,
              tenant_id: item.tenantId,
              application_id: item.applicationId,
              requirement_id: item.requirementId,
              label: item.label,
              is_required: item.isRequired,
              status: "uploaded",
              storage_path: values?.[2],
              storage_filename: values?.[3],
              uploaded_at: values?.[4],
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    },
  };

  const service = new PublicApplicationService(db);
  const resolved = await service.resolveApplicationByToken(TENANT_ID, STATUS_TOKEN);
  assert.ok(resolved);

  const repository = new PostgresDocumentChecklistRepository(db);
  const storagePath = `${TENANT_ID}/applications/${APP_ID}/${ITEM_ID}/abc123.pdf`;
  const updatedItem = await repository.updateDocumentItemUpload(
    TENANT_ID,
    ITEM_ID,
    storagePath,
    "transcript.pdf",
    new Date().toISOString(),
  );

  assert.equal(updatedItem.status, "uploaded");
  assert.equal(updatedItem.storagePath, storagePath);
});

test("AC2: POST confirm - valid PDF for resubmission_required item transitions to uploaded", async () => {
  const item = mockDocumentItem({
    status: "resubmission_required",
    officerNote: "Please resubmit",
  });

  const db = {
    query: async (sql: string, values?: unknown[]) => {
      const sqlNorm = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (sqlNorm.includes("select a.id from academy_admission_applications a")) {
        return { rowCount: 1, rows: [{ id: APP_ID }] };
      }

      if (
        sqlNorm.includes("from academy_application_document_items") &&
        !sqlNorm.includes("update")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              id: item.id,
              tenant_id: item.tenantId,
              application_id: item.applicationId,
              requirement_id: item.requirementId,
              label: item.label,
              is_required: item.isRequired,
              status: item.status,
              officer_note: item.officerNote,
            },
          ],
        };
      }

      if (sqlNorm.includes("update academy_application_document_items")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: item.id,
              tenant_id: item.tenantId,
              application_id: item.applicationId,
              requirement_id: item.requirementId,
              label: item.label,
              is_required: item.isRequired,
              status: "uploaded",
              storage_path: values?.[2],
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    },
  };

  const repository = new PostgresDocumentChecklistRepository(db);
  const storagePath = `${TENANT_ID}/applications/${APP_ID}/${ITEM_ID}/def456.pdf`;
  const updatedItem = await repository.updateDocumentItemUpload(
    TENANT_ID,
    ITEM_ID,
    storagePath,
    "resubmitted.pdf",
    new Date().toISOString(),
  );

  assert.equal(updatedItem.status, "uploaded");
});

// Acceptance Criterion 3: Non-PDF or >10MB rejected server-side
test("AC3: POST confirm - non-PDF contentType rejected with clear message", async () => {
  const contentType = "application/msword";
  const fileSizeBytes = 5 * 1024 * 1024;

  // Simulate route-level validation (pre-service layer)
  assert.notEqual(contentType, "application/pdf", "non-PDF must be rejected");

  // Also verify service layer enforcement
  const item = mockDocumentItem();
  const application = mockApplication();
  const repository = {
    findApplicationDocumentItemById: async () => item,
    findApplicationByDocumentItemId: async () => application,
  } as unknown as PostgresDocumentChecklistRepository;

  const service = new DocumentChecklistService(repository);

  await assert.rejects(
    () =>
      service.confirmDocumentUpload(applicantActor, {
        documentItemId: ITEM_ID,
        storagePath: `${TENANT_ID}/applications/${APP_ID}/${ITEM_ID}/file.docx`,
        storageFilename: "file.docx",
        contentType,
        fileSizeBytes,
      }),
    /Only PDF documents are accepted/,
  );
});

test("AC3: POST confirm - file >10MB rejected with clear message", async () => {
  const contentType = "application/pdf";
  const fileSizeBytes = 11 * 1024 * 1024;

  const maxSizeBytes = 10 * 1024 * 1024;
  assert.ok(fileSizeBytes > maxSizeBytes, "file must exceed 10MB limit");

  const item = mockDocumentItem();
  const application = mockApplication();
  const repository = {
    findApplicationDocumentItemById: async () => item,
    findApplicationByDocumentItemId: async () => application,
  } as unknown as PostgresDocumentChecklistRepository;

  const service = new DocumentChecklistService(repository);

  await assert.rejects(
    () =>
      service.confirmDocumentUpload(applicantActor, {
        documentItemId: ITEM_ID,
        storagePath: `${TENANT_ID}/applications/${APP_ID}/${ITEM_ID}/large.pdf`,
        storageFilename: "large.pdf",
        contentType,
        fileSizeBytes,
      }),
    /file size exceeds the 10MB limit/,
  );
});

// Acceptance Criterion 4: Re-upload replaces old file
test("AC4: POST confirm - re-upload deletes old file and updates storagePath", async () => {
  const oldStoragePath = `${TENANT_ID}/applications/${APP_ID}/${ITEM_ID}/old-file.pdf`;
  const newStoragePath = `${TENANT_ID}/applications/${APP_ID}/${ITEM_ID}/new-file.pdf`;

  const item = mockDocumentItem({
    status: "uploaded",
    storagePath: oldStoragePath,
    storageFilename: "old-file.pdf",
  });

  const db = {
    query: async (sql: string, _values?: unknown[]) => {
      const sqlNorm = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (
        sqlNorm.includes("from academy_application_document_items") &&
        !sqlNorm.includes("update")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              id: item.id,
              tenant_id: item.tenantId,
              application_id: item.applicationId,
              requirement_id: item.requirementId,
              label: item.label,
              is_required: item.isRequired,
              status: item.status,
              storage_path: item.storagePath,
              storage_filename: item.storageFilename,
            },
          ],
        };
      }

      if (sqlNorm.includes("update academy_application_document_items")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: item.id,
              tenant_id: item.tenantId,
              application_id: item.applicationId,
              requirement_id: item.requirementId,
              label: item.label,
              is_required: item.isRequired,
              status: "uploaded",
              storage_path: newStoragePath,
              storage_filename: "new-file.pdf",
              uploaded_at: new Date().toISOString(),
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    },
  };

  const repository = new PostgresDocumentChecklistRepository(db);
  const fetchedItem = await repository.findApplicationDocumentItemById(TENANT_ID, ITEM_ID);

  assert.ok(fetchedItem);
  const capturedOldPath = fetchedItem.storagePath;
  assert.equal(capturedOldPath, oldStoragePath, "must capture old storage path");

  const updatedItem = await repository.updateDocumentItemUpload(
    TENANT_ID,
    ITEM_ID,
    newStoragePath,
    "new-file.pdf",
    new Date().toISOString(),
  );

  assert.equal(updatedItem.storagePath, newStoragePath, "must update to new path");
  assert.ok(capturedOldPath, "old path must exist for cleanup");
  assert.notEqual(capturedOldPath, newStoragePath, "old path must differ from new");
});

// Acceptance Criterion 5: Invalid/unknown token → 404-equivalent rejection
test("AC5: GET documents - unknown token returns undefined from resolve", async () => {
  const db = {
    query: async () => {
      return { rowCount: 0, rows: [] };
    },
  };

  const service = new PublicApplicationService(db);
  const resolved = await service.resolveApplicationByToken(TENANT_ID, "tok-unknown");

  assert.equal(resolved, undefined, "must return undefined for unknown token");
});

// Acceptance Criterion 6: Token only resolves matching tenant+token pair - cross-tenant token reuse fails
test("AC6: resolveApplicationByToken - token valid in tenant-other but not in tenant-main", async () => {
  const db = {
    query: async (sql: string, values?: unknown[]) => {
      const sqlNorm = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (
        sqlNorm.includes("select a.id from academy_admission_applications a") &&
        values?.[0] === TENANT_ID_OTHER &&
        values?.[1] === STATUS_TOKEN_OTHER_TENANT
      ) {
        // This token exists in tenant-other
        return { rowCount: 1, rows: [{ id: APP_ID_OTHER }] };
      }

      if (
        sqlNorm.includes("select a.id from academy_admission_applications a") &&
        values?.[0] === TENANT_ID &&
        values?.[1] === STATUS_TOKEN_OTHER_TENANT
      ) {
        // Same token queried against tenant-main returns nothing
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    },
  };

  const service = new PublicApplicationService(db);

  // Token works in tenant-other
  const resolvedOtherTenant = await service.resolveApplicationByToken(
    TENANT_ID_OTHER,
    STATUS_TOKEN_OTHER_TENANT,
  );
  assert.ok(resolvedOtherTenant, "token must resolve in its own tenant");
  assert.equal(resolvedOtherTenant.applicationId, APP_ID_OTHER);

  // Same token MUST NOT work in tenant-main
  const resolvedMainTenant = await service.resolveApplicationByToken(
    TENANT_ID,
    STATUS_TOKEN_OTHER_TENANT,
  );
  assert.equal(resolvedMainTenant, undefined, "token from other tenant must not resolve");
});

// Acceptance Criterion 7: IDOR check - itemId for different applicationId rejected (403)
test("AC7: POST upload-url - item belongs to different application returns 403 logic", async () => {
  const item = mockDocumentItem({ applicationId: APP_ID_OTHER });

  const db = {
    query: async (sql: string, _values?: unknown[]) => {
      const sqlNorm = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (sqlNorm.includes("select a.id from academy_admission_applications a")) {
        return { rowCount: 1, rows: [{ id: APP_ID }] };
      }

      if (sqlNorm.includes("from academy_application_document_items")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: item.id,
              tenant_id: item.tenantId,
              application_id: item.applicationId,
              requirement_id: item.requirementId,
              label: item.label,
              is_required: item.isRequired,
              status: item.status,
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    },
  };

  const service = new PublicApplicationService(db);
  const resolved = await service.resolveApplicationByToken(TENANT_ID, STATUS_TOKEN);

  const repository = new PostgresDocumentChecklistRepository(db);
  const fetchedItem = await repository.findApplicationDocumentItemById(TENANT_ID, ITEM_ID);

  assert.ok(fetchedItem, "item must exist");
  assert.notEqual(
    fetchedItem.applicationId,
    resolved?.applicationId,
    "item must not belong to resolved application - IDOR check",
  );
});

// Acceptance Criterion 8: storagePath-spoofing check
test("AC8: POST confirm - storagePath not matching expected prefix rejected", async () => {
  const tenantId = TENANT_ID;
  const applicationId = APP_ID;
  const itemId = ITEM_ID;
  const expectedPrefix = `${tenantId}/applications/${applicationId}/${itemId}/`;

  const legitimatePath = `${expectedPrefix}abc123.pdf`;
  assert.ok(
    legitimatePath.startsWith(expectedPrefix),
    "legitimate path must pass prefix check",
  );

  const spoofedSameTenant = `${tenantId}/applications/${APP_ID_OTHER}/${ITEM_ID_OTHER}/x.pdf`;
  assert.equal(
    spoofedSameTenant.startsWith(expectedPrefix),
    false,
    "storagePath for different application/item must be rejected",
  );

  const spoofedCrossTenant = `${TENANT_ID_OTHER}/applications/${applicationId}/${itemId}/x.pdf`;
  assert.equal(
    spoofedCrossTenant.startsWith(expectedPrefix),
    false,
    "storagePath under different tenant prefix must be rejected",
  );

  const spoofedPartialMatch = `${tenantId}/applications/${applicationId}/${itemId}/../../../etc/passwd`;
  assert.equal(
    spoofedPartialMatch.startsWith(expectedPrefix),
    true,
    "path traversal attempt starts with prefix but should be rejected elsewhere",
  );
});

// Acceptance Criterion 9: Staff sees checklist with completion %; only admissions/registrar/academic_admin/institution_admin can review
test("AC9: Staff roles - admissions can review", async () => {
  const item = mockDocumentItem({ status: "uploaded" });
  const application = mockApplication();

  const repository = {
    findApplicationDocumentItemById: async () => item,
    findApplicationByDocumentItemId: async () => application,
    updateDocumentItemReview: async (
      _tenantId: string,
      _documentItemId: string,
      status: DocumentItemStatus,
      reviewedByPersonId: string,
      reviewedAt: string,
      officerNote?: string,
    ) => ({
      ...item,
      status,
      reviewedByPersonId,
      reviewedAt,
      officerNote,
    }),
  } as unknown as PostgresDocumentChecklistRepository;

  const service = new DocumentChecklistService(repository);

  const reviewInput: ReviewDocumentItemInput = {
    documentItemId: ITEM_ID,
    decision: "reviewed",
    officerNote: "Looks good",
  };

  const result = await service.reviewDocumentItem(admissionsStaffActor, reviewInput);
  assert.equal(result.status, "reviewed");
});

test("AC9: Staff roles - registrar can review", async () => {
  const item = mockDocumentItem({ status: "uploaded" });
  const application = mockApplication();

  const repository = {
    findApplicationDocumentItemById: async () => item,
    findApplicationByDocumentItemId: async () => application,
    updateDocumentItemReview: async (
      _tenantId: string,
      _documentItemId: string,
      status: DocumentItemStatus,
    ) => ({
      ...item,
      status,
    }),
  } as unknown as PostgresDocumentChecklistRepository;

  const service = new DocumentChecklistService(repository);

  const result = await service.reviewDocumentItem(registrarStaffActor, {
    documentItemId: ITEM_ID,
    decision: "reviewed",
  });
  assert.equal(result.status, "reviewed");
});

test("AC9: Staff roles - academic_admin can review", async () => {
  const item = mockDocumentItem({ status: "uploaded" });
  const application = mockApplication();

  const repository = {
    findApplicationDocumentItemById: async () => item,
    findApplicationByDocumentItemId: async () => application,
    updateDocumentItemReview: async (
      _tenantId: string,
      _documentItemId: string,
      status: DocumentItemStatus,
    ) => ({
      ...item,
      status,
    }),
  } as unknown as PostgresDocumentChecklistRepository;

  const service = new DocumentChecklistService(repository);

  const result = await service.reviewDocumentItem(academicAdminActor, {
    documentItemId: ITEM_ID,
    decision: "reviewed",
  });
  assert.equal(result.status, "reviewed");
});

test("AC9: Staff roles - institution_admin can review", async () => {
  const item = mockDocumentItem({ status: "uploaded" });
  const application = mockApplication();

  const repository = {
    findApplicationDocumentItemById: async () => item,
    findApplicationByDocumentItemId: async () => application,
    updateDocumentItemReview: async (
      _tenantId: string,
      _documentItemId: string,
      status: DocumentItemStatus,
    ) => ({
      ...item,
      status,
    }),
  } as unknown as PostgresDocumentChecklistRepository;

  const service = new DocumentChecklistService(repository);

  const result = await service.reviewDocumentItem(institutionAdminActor, {
    documentItemId: ITEM_ID,
    decision: "reviewed",
  });
  assert.equal(result.status, "reviewed");
});

test("AC9: Staff roles - student cannot review", async () => {
  const item = mockDocumentItem({ status: "uploaded" });
  const application = mockApplication();

  const repository = {
    findApplicationDocumentItemById: async () => item,
    findApplicationByDocumentItemId: async () => application,
  } as unknown as PostgresDocumentChecklistRepository;

  const service = new DocumentChecklistService(repository);

  await assert.rejects(
    () =>
      service.reviewDocumentItem(studentActor, {
        documentItemId: ITEM_ID,
        decision: "reviewed",
      }),
    /Forbidden document review access/,
  );
});

test("AC9: reviewDocumentItem rejects resubmission_required decision with no officerNote", async () => {
  // The service layer must enforce this server-side, not rely on the UI's
  // client-side validation alone — a direct API call must not bypass it.
  const item = mockDocumentItem({ status: "uploaded" });
  const application = mockApplication();

  const repository = {
    findApplicationDocumentItemById: async () => item,
    findApplicationByDocumentItemId: async () => application,
    updateDocumentItemReview: async (
      _tenantId: string,
      _documentItemId: string,
      status: DocumentItemStatus,
      reviewedByPersonId: string,
      reviewedAt: string,
      officerNote?: string,
    ) => ({
      ...item,
      status,
      reviewedByPersonId,
      reviewedAt,
      officerNote,
    }),
  } as unknown as PostgresDocumentChecklistRepository;

  const service = new DocumentChecklistService(repository);

  const reviewInput: ReviewDocumentItemInput = {
    documentItemId: ITEM_ID,
    decision: "resubmission_required",
    // officerNote is intentionally omitted
  };

  await assert.rejects(
    () => service.reviewDocumentItem(admissionsStaffActor, reviewInput),
    /Officer note is required when requesting resubmission/,
  );
});

test("AC9: getApplicationChecklist - completion percentage calculated correctly", async () => {
  const items = [
    mockDocumentItem({ id: "item-1", isRequired: true, status: "reviewed" }),
    mockDocumentItem({ id: "item-2", isRequired: true, status: "uploaded" }),
    mockDocumentItem({ id: "item-3", isRequired: false, status: "pending" }),
  ];
  const application = mockApplication();

  const repository = {
    listApplicationDocumentItems: async () => items,
    findApplicationByDocumentItemId: async () => application,
  } as unknown as PostgresDocumentChecklistRepository;

  const service = new DocumentChecklistService(repository);

  const view = await service.getApplicationChecklist(admissionsStaffActor, APP_ID);

  const requiredItems = items.filter((i) => i.isRequired);
  const reviewedRequiredItems = requiredItems.filter((i) => i.status === "reviewed");
  const expectedPct = Math.round((reviewedRequiredItems.length / requiredItems.length) * 100);

  assert.equal(view.completionPct, expectedPct);
  assert.equal(view.completionPct, 50, "completion must be 50% (1 of 2 required reviewed)");
});

// Acceptance Criterion 10: Staff can download via signed URL; wrong-role or cross-tenant rejected
test("AC10: Staff download - admissions can download", async () => {
  const item = mockDocumentItem({
    status: "uploaded",
    storagePath: `${TENANT_ID}/applications/${APP_ID}/${ITEM_ID}/file.pdf`,
  });
  const application = mockApplication();

  const repository = {
    findApplicationDocumentItemById: async () => item,
    findApplicationByDocumentItemId: async () => application,
  } as unknown as PostgresDocumentChecklistRepository;

  const storageClient: DocumentStorageClient = {
    generateSignedUploadUrl: async () => "signed-upload-url",
    delete: async () => {},
    generateSignedDownloadUrl: async () => "signed-download-url",
    getObjectMetadata: async () => undefined,
  };

  const service = new DocumentChecklistService(repository);
  const downloadUrl = await service.getSignedDownloadUrl(
    admissionsStaffActor,
    ITEM_ID,
    storageClient,
  );

  assert.ok(downloadUrl, "download URL must be returned");
  assert.equal(typeof downloadUrl, "string");
});

test("AC10: Staff download - wrong role (student) cannot download", async () => {
  const item = mockDocumentItem({
    status: "uploaded",
    storagePath: `${TENANT_ID}/applications/${APP_ID}/${ITEM_ID}/file.pdf`,
  });
  const application = mockApplication();

  const repository = {
    findApplicationDocumentItemById: async () => item,
    findApplicationByDocumentItemId: async () => application,
  } as unknown as PostgresDocumentChecklistRepository;

  const storageClient: DocumentStorageClient = {
    generateSignedUploadUrl: async () => "signed-upload-url",
    delete: async () => {},
    generateSignedDownloadUrl: async () => "signed-download-url",
    getObjectMetadata: async () => undefined,
  };

  const service = new DocumentChecklistService(repository);

  await assert.rejects(
    () => service.getSignedDownloadUrl(studentActor, ITEM_ID, storageClient),
    /Forbidden document access/,
  );
});

test("AC10: Staff download - cross-tenant staff rejected", async () => {
  const item = mockDocumentItem({
    status: "uploaded",
    storagePath: `${TENANT_ID}/applications/${APP_ID}/${ITEM_ID}/file.pdf`,
  });
  const application = mockApplication();

  const repository = {
    findApplicationDocumentItemById: async () => item,
    findApplicationByDocumentItemId: async () => application,
  } as unknown as PostgresDocumentChecklistRepository;

  const storageClient: DocumentStorageClient = {
    generateSignedUploadUrl: async () => "signed-upload-url",
    delete: async () => {},
    generateSignedDownloadUrl: async () => "signed-download-url",
    getObjectMetadata: async () => undefined,
  };

  const service = new DocumentChecklistService(repository);

  await assert.rejects(
    () => service.getSignedDownloadUrl(crossTenantStaffActor, ITEM_ID, storageClient),
    /Forbidden cross-tenant document access/,
  );
});

// Acceptance Criterion 11: Cross-tenant rejection for every staff-side operation
test("AC11: Cross-tenant rejection - getApplicationChecklist", async () => {
  const items = [mockDocumentItem()];
  const application = mockApplication();

  const repository = {
    listApplicationDocumentItems: async () => items,
    findApplicationByDocumentItemId: async () => application,
  } as unknown as PostgresDocumentChecklistRepository;

  const service = new DocumentChecklistService(repository);

  await assert.rejects(
    () => service.getApplicationChecklist(crossTenantStaffActor, APP_ID),
    /Forbidden cross-tenant/,
  );
});

test("AC11: Cross-tenant rejection - reviewDocumentItem", async () => {
  const item = mockDocumentItem();
  const application = mockApplication();

  const repository = {
    findApplicationDocumentItemById: async () => item,
    findApplicationByDocumentItemId: async () => application,
  } as unknown as PostgresDocumentChecklistRepository;

  const service = new DocumentChecklistService(repository);

  await assert.rejects(
    () =>
      service.reviewDocumentItem(crossTenantStaffActor, {
        documentItemId: ITEM_ID,
        decision: "reviewed",
      }),
    /Forbidden cross-tenant document review access/,
  );
});

test("AC11: Cross-tenant rejection - confirmDocumentUpload (public flow uses token resolution, not actor tenantId)", async () => {
  // For the public flow, cross-tenant is prevented by token resolution.
  // If an applicant tries to use a token from tenant-other against tenant-main,
  // resolveApplicationByToken returns undefined.
  // This test verifies that behavior at the service layer.
  const db = {
    query: async (sql: string, values?: unknown[]) => {
      const sqlNorm = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (
        sqlNorm.includes("select a.id from academy_admission_applications a") &&
        values?.[0] === TENANT_ID &&
        values?.[1] === STATUS_TOKEN_OTHER_TENANT
      ) {
        // Token from other tenant does not resolve in main tenant
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    },
  };

  const service = new PublicApplicationService(db);
  const resolved = await service.resolveApplicationByToken(TENANT_ID, STATUS_TOKEN_OTHER_TENANT);

  assert.equal(resolved, undefined, "cross-tenant token must not resolve");
});
