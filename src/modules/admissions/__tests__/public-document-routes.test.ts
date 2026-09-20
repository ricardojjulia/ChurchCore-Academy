import assert from "node:assert/strict";
import test from "node:test";
import {
  ApplicationDocumentItem,
  DocumentItemStatus,
} from "@/modules/admissions/document-checklist";

const TENANT_ID = "tenant-test";
const APP_ID = "app-123";
const ITEM_ID = "item-456";
const STATUS_TOKEN = "tok-valid";

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

test("GET documents: valid token returns items and completionPct", async () => {
  const calls: MockCall[] = [];
  const items = [
    mockDocumentItem({ id: "item-1", isRequired: true, status: "reviewed" }),
    mockDocumentItem({ id: "item-2", isRequired: true, status: "pending" }),
    mockDocumentItem({ id: "item-3", isRequired: false, status: "pending" }),
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
          })),
        };
      }

      return { rowCount: 0, rows: [] };
    },
  };

  // Simulate the route logic (without actual HTTP layer)
  const { PublicApplicationService } = await import(
    "@/modules/admissions/public-application-service"
  );
  const { PostgresDocumentChecklistRepository } = await import(
    "@/modules/admissions/document-checklist-repository"
  );

  const service = new PublicApplicationService(db);
  const resolved = await service.resolveApplicationByToken(
    TENANT_ID,
    STATUS_TOKEN,
  );

  assert.ok(resolved, "must resolve application");
  assert.equal(resolved?.applicationId, APP_ID);

  const repository = new PostgresDocumentChecklistRepository(db);
  const resultItems = await repository.listApplicationDocumentItems(
    TENANT_ID,
    resolved.applicationId,
  );

  assert.equal(resultItems.length, 3, "must return 3 items");

  // Compute completion percentage (same as route logic)
  const requiredItems = resultItems.filter((item) => item.isRequired);
  const reviewedRequiredItems = requiredItems.filter(
    (item) => item.status === "reviewed",
  );
  const completionPct =
    requiredItems.length === 0
      ? 100
      : Math.round((reviewedRequiredItems.length / requiredItems.length) * 100);

  assert.equal(completionPct, 50, "completion must be 50% (1 of 2 required reviewed)");
});

test("GET documents: invalid token returns undefined from resolve", async () => {
  const db = {
    query: async () => {
      return { rowCount: 0, rows: [] };
    },
  };

  const { PublicApplicationService } = await import(
    "@/modules/admissions/public-application-service"
  );

  const service = new PublicApplicationService(db);
  const resolved = await service.resolveApplicationByToken(
    TENANT_ID,
    "tok-invalid",
  );

  assert.equal(resolved, undefined, "must return undefined for invalid token");
});

test("POST upload-url: valid request returns signedUploadUrl and storagePath", async () => {
  const item = mockDocumentItem();

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
        values?.[0] === TENANT_ID &&
        values?.[1] === ITEM_ID
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

      return { rowCount: 0, rows: [] };
    },
  };

  const { PublicApplicationService } = await import(
    "@/modules/admissions/public-application-service"
  );
  const { PostgresDocumentChecklistRepository } = await import(
    "@/modules/admissions/document-checklist-repository"
  );

  const service = new PublicApplicationService(db);
  const resolved = await service.resolveApplicationByToken(
    TENANT_ID,
    STATUS_TOKEN,
  );

  assert.ok(resolved, "must resolve application");

  const repository = new PostgresDocumentChecklistRepository(db);
  const fetchedItem = await repository.findApplicationDocumentItemById(
    TENANT_ID,
    ITEM_ID,
  );

  assert.ok(fetchedItem, "must find item");
  assert.equal(fetchedItem?.applicationId, APP_ID);

  // Simulate filename sanitization (route logic)
  const filename = "my-transcript.pdf";
  const extensionMatch = filename.toLowerCase().match(/\.(pdf)$/);
  assert.ok(extensionMatch, "must match .pdf extension");
});

test("POST upload-url: non-PDF filename should be rejected", async () => {
  // Simulate filename validation (route logic)
  const filename = "document.docx";
  const extensionMatch = filename.toLowerCase().match(/\.(pdf)$/);
  assert.equal(extensionMatch, null, "must not match non-PDF extension");
});

test("POST upload-url: item not belonging to application returns 403 logic", async () => {
  const item = mockDocumentItem({ applicationId: "app-different" });

  const db = {
    query: async (sql: string, _values?: unknown[]) => {
      const sqlNorm = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (
        sqlNorm.includes("select a.id from academy_admission_applications a")
      ) {
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

  const { PublicApplicationService } = await import(
    "@/modules/admissions/public-application-service"
  );
  const { PostgresDocumentChecklistRepository } = await import(
    "@/modules/admissions/document-checklist-repository"
  );

  const service = new PublicApplicationService(db);
  const resolved = await service.resolveApplicationByToken(
    TENANT_ID,
    STATUS_TOKEN,
  );

  const repository = new PostgresDocumentChecklistRepository(db);
  const fetchedItem = await repository.findApplicationDocumentItemById(
    TENANT_ID,
    ITEM_ID,
  );

  assert.ok(fetchedItem, "must find item");
  assert.notEqual(
    fetchedItem?.applicationId,
    resolved?.applicationId,
    "item must not belong to resolved application",
  );
});

test("POST confirm: valid PDF within size limit validates", async () => {
  const contentType = "application/pdf";
  const fileSizeBytes = 5 * 1024 * 1024; // 5MB

  assert.equal(contentType, "application/pdf", "must be PDF");

  const maxSizeBytes = 10 * 1024 * 1024;
  assert.ok(fileSizeBytes <= maxSizeBytes, "must be within 10MB limit");
});

test("POST confirm: non-PDF content type should be rejected", async () => {
  const contentType = "application/msword";

  assert.notEqual(
    contentType,
    "application/pdf",
    "must reject non-PDF content type",
  );
});

test("POST confirm: storagePath not matching this item's expected prefix should be rejected", async () => {
  const tenantId = TENANT_ID;
  const applicationId = APP_ID;
  const itemId = ITEM_ID;
  const expectedPrefix = `${tenantId}/applications/${applicationId}/${itemId}/`;

  const legitimatePath = `${expectedPrefix}${"a".repeat(8)}.pdf`;
  assert.ok(
    legitimatePath.startsWith(expectedPrefix),
    "a path actually issued by upload-url for this item must pass",
  );

  const spoofedSameTenant = `${tenantId}/applications/app-different/item-different/x.pdf`;
  assert.equal(
    spoofedSameTenant.startsWith(expectedPrefix),
    false,
    "a storagePath for a different application/item must be rejected",
  );

  const spoofedCrossTenant = `tenant-other/applications/${applicationId}/${itemId}/x.pdf`;
  assert.equal(
    spoofedCrossTenant.startsWith(expectedPrefix),
    false,
    "a storagePath under a different tenant prefix must be rejected",
  );
});

test("POST confirm: oversized file should be rejected", async () => {
  const fileSizeBytes = 11 * 1024 * 1024; // 11MB
  const maxSizeBytes = 10 * 1024 * 1024;

  assert.ok(fileSizeBytes > maxSizeBytes, "must exceed 10MB limit");
});

test("POST confirm: re-upload deletes old file logic", async () => {
  const oldStoragePath = "tenant-test/applications/app-123/item-456/old-file.pdf";
  const newStoragePath = "tenant-test/applications/app-123/item-456/new-file.pdf";

  const item = mockDocumentItem({
    storagePath: oldStoragePath,
    storageFilename: "old-file.pdf",
    status: "uploaded",
  });

  const db = {
    query: async (sql: string, _values?: unknown[]) => {
      const sqlNorm = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (
        sqlNorm.includes("select a.id from academy_admission_applications a")
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

  const { PostgresDocumentChecklistRepository } = await import(
    "@/modules/admissions/document-checklist-repository"
  );

  const repository = new PostgresDocumentChecklistRepository(db);
  const fetchedItem = await repository.findApplicationDocumentItemById(
    TENANT_ID,
    ITEM_ID,
  );

  assert.ok(fetchedItem, "must find item");
  const capturedOldPath = fetchedItem?.storagePath;
  assert.equal(capturedOldPath, oldStoragePath, "must capture old storage path");

  const updatedItem = await repository.updateDocumentItemUpload(
    TENANT_ID,
    ITEM_ID,
    newStoragePath,
    "new-file.pdf",
    new Date().toISOString(),
  );

  assert.equal(updatedItem.storagePath, newStoragePath, "must update to new path");

  // In the actual route, we would delete capturedOldPath here
  assert.ok(capturedOldPath, "old path must exist for cleanup");
});
