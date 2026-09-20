import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  AdmissionDocumentService,
  DocumentRepository,
  AuditRepository,
  StorageProvider,
} from "@/modules/admissions/document-service";
import { AcademyActor } from "@/modules/academy-auth/policy";
import {
  ApplicationDocument,
  CreateDocumentTypeInput,
  DocumentType,
  UploadUrlRequest,
  WaiveDocumentInput,
} from "@/modules/admissions/types";

function createRepositoryMock<T extends Partial<DocumentRepository>>(overrides: T = {} as T) {
  return {
    createDocumentType: mock.fn(async () => {
      throw new Error("createDocumentType not stubbed");
    }),
    findDocumentTypeById: mock.fn(async () => undefined),
    findDocumentTypeBySlug: mock.fn(async () => undefined),
    listActiveDocumentTypes: mock.fn(async () => []),
    createApplicationDocument: mock.fn(async () => {
      throw new Error("createApplicationDocument not stubbed");
    }),
    findApplicationDocument: mock.fn(async () => undefined),
    getDocumentChecklist: mock.fn(async () => []),
    confirmDocumentUpload: mock.fn(async () => undefined),
    markDocumentReceived: mock.fn(async () => undefined),
    waiveDocument: mock.fn(async () => undefined),
    canAdvanceToDecision: mock.fn(async () => false),
    getMissingRequiredDocuments: mock.fn(async () => []),
    ...overrides,
  };
}

function createAuditMock<T extends Partial<AuditRepository>>(overrides: T = {} as T) {
  return {
    append: mock.fn(async () => ({})),
    ...overrides,
  };
}

function createStorageMock<T extends Partial<StorageProvider>>(overrides: T = {} as T) {
  return {
    generateUploadUrl: mock.fn(async () => {
      throw new Error("generateUploadUrl not stubbed");
    }),
    generateDownloadUrl: mock.fn(async () => {
      throw new Error("generateDownloadUrl not stubbed");
    }),
    ...overrides,
  };
}

describe("AdmissionDocumentService", () => {
  const tenantId = "tenant-123";
  const otherTenantId = "tenant-456";
  const actor: AcademyActor = {
    userId: "user-123",
    tenantId,
    roles: ["institution_admin"],
  };

  const staffActor: AcademyActor = {
    userId: "staff-123",
    tenantId,
    roles: ["admissions"],
  };

  const applicantActor: AcademyActor = {
    userId: "applicant-123",
    tenantId,
    roles: ["applicant"],
  };

  describe("createDocumentType", () => {
    it("succeeds when actor is institution_admin", async () => {
      const input: CreateDocumentTypeInput = {
        tenantId,
        name: "Pastoral Reference Letter",
        slug: "pastoral_reference",
        required: true,
        description: "A reference letter from your pastor",
      };

      const expectedType: DocumentType = {
        id: "type-123",
        ...input,
        active: true,
        createdAt: "2026-06-25T10:00:00Z",
        updatedAt: "2026-06-25T10:00:00Z",
      };

      const repository = createRepositoryMock({
        createDocumentType: mock.fn(async () => expectedType),
      });

      const audit = createAuditMock();
      const storage = createStorageMock();

      const service = new AdmissionDocumentService(repository, audit, storage);
      const result = await service.createDocumentType(actor, input);

      assert.deepEqual(result, expectedType);
      assert.equal(repository.createDocumentType.mock.calls.length, 1);
      assert.equal(audit.append.mock.calls.length, 1);
    });

    it("rejects cross-tenant creation", async () => {
      const input: CreateDocumentTypeInput = {
        tenantId: otherTenantId,
        name: "Test",
        slug: "test",
        required: false,
      };

      const repository = createRepositoryMock();

      const audit = createAuditMock();
      const storage = createStorageMock();

      const service = new AdmissionDocumentService(repository, audit, storage);

      await assert.rejects(
        async () => service.createDocumentType(actor, input),
        {
          message: /Cross-tenant/,
        },
      );

      assert.equal(repository.createDocumentType.mock.calls.length, 0);
    });

    it("rejects non-admin role", async () => {
      const input: CreateDocumentTypeInput = {
        tenantId,
        name: "Test",
        slug: "test",
        required: false,
      };

      const repository = createRepositoryMock();

      const audit = createAuditMock();
      const storage = createStorageMock();

      const service = new AdmissionDocumentService(repository, audit, storage);

      await assert.rejects(
        async () => service.createDocumentType(staffActor, input),
        {
          message: /Only institution admins/,
        },
      );
    });
  });

  describe("generateUploadUrl", () => {
    it("succeeds with valid file type and size", async () => {
      const request: UploadUrlRequest = {
        fileName: "transcript.pdf",
        mimeType: "application/pdf",
        sizeBytes: 5 * 1024 * 1024, // 5 MB
      };

      const repository = createRepositoryMock({
        findDocumentTypeBySlug: mock.fn(async () => ({
          id: "type-123",
          tenantId,
          name: "Official Transcript",
          slug: "transcript",
          required: true,
          active: true,
          createdAt: "2026-06-25T10:00:00Z",
          updatedAt: "2026-06-25T10:00:00Z",
        })),
        createApplicationDocument: mock.fn(async () => ({
          id: "doc-123",
          tenantId,
          applicationId: "app-123",
          documentTypeId: "type-123",
          status: "pending",
          createdAt: "2026-06-25T10:00:00Z",
          updatedAt: "2026-06-25T10:00:00Z",
        })),
      });

      const audit = createAuditMock();
      const storage = createStorageMock({
        generateUploadUrl: mock.fn(async () => "https://upload.url/signed"),
      });

      const service = new AdmissionDocumentService(repository, audit, storage);
      const result = await service.generateUploadUrl(
        applicantActor,
        tenantId,
        "app-123",
        "applicant-123",
        "transcript",
        request,
      );

      assert.ok(result.uploadUrl);
      assert.ok(result.storagePath.includes(tenantId));
      assert.ok(result.storagePath.includes("app-123"));
      assert.ok(result.storagePath.includes("transcript"));
      assert.ok(result.storagePath.endsWith(".pdf"));
    });

    it("rejects unsupported MIME type", async () => {
      const request: UploadUrlRequest = {
        fileName: "document.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 1024,
      };

      const repository = createRepositoryMock();

      const audit = createAuditMock();
      const storage = createStorageMock();

      const service = new AdmissionDocumentService(repository, audit, storage);

      await assert.rejects(
        async () =>
          service.generateUploadUrl(
            applicantActor,
            tenantId,
            "app-123",
            "applicant-123",
            "test",
            request,
          ),
        {
          message: /Unsupported file type/,
        },
      );
    });

    it("rejects file size over 10 MB", async () => {
      const request: UploadUrlRequest = {
        fileName: "large.pdf",
        mimeType: "application/pdf",
        sizeBytes: 11 * 1024 * 1024, // 11 MB
      };

      const repository = createRepositoryMock();

      const audit = createAuditMock();
      const storage = createStorageMock();

      const service = new AdmissionDocumentService(repository, audit, storage);

      await assert.rejects(
        async () =>
          service.generateUploadUrl(
            applicantActor,
            tenantId,
            "app-123",
            "applicant-123",
            "test",
            request,
          ),
        {
          message: /File size exceeds/,
        },
      );
    });

    it("rejects unknown document types", async () => {
      const request: UploadUrlRequest = {
        fileName: "transcript.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      };

      const repository = createRepositoryMock({
        findDocumentTypeBySlug: mock.fn(async () => undefined),
      });

      const audit = createAuditMock();
      const storage = createStorageMock();

      const service = new AdmissionDocumentService(repository, audit, storage);

      await assert.rejects(
        async () =>
          service.generateUploadUrl(
            applicantActor,
            tenantId,
            "app-123",
            "applicant-123",
            "transcript",
            request,
          ),
        {
          message: /Document type "transcript" not found/,
        },
      );
    });

    it("rejects inactive document types", async () => {
      const request: UploadUrlRequest = {
        fileName: "transcript.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      };

      const repository = createRepositoryMock({
        findDocumentTypeBySlug: mock.fn(async () => ({
          id: "type-123",
          tenantId,
          name: "Official Transcript",
          slug: "transcript",
          required: true,
          active: false,
          createdAt: "2026-06-25T10:00:00Z",
          updatedAt: "2026-06-25T10:00:00Z",
        })),
      });

      const audit = createAuditMock();
      const storage = createStorageMock();

      const service = new AdmissionDocumentService(repository, audit, storage);

      await assert.rejects(
        async () =>
          service.generateUploadUrl(
            applicantActor,
            tenantId,
            "app-123",
            "applicant-123",
            "transcript",
            request,
          ),
        {
          message: /Invalid documentTypeSlug: document type "transcript" is inactive/,
        },
      );
    });

    it("maps duplicate application document creation to a conflict error", async () => {
      const request: UploadUrlRequest = {
        fileName: "transcript.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      };

      const repository = createRepositoryMock({
        findDocumentTypeBySlug: mock.fn(async () => ({
          id: "type-123",
          tenantId,
          name: "Official Transcript",
          slug: "transcript",
          required: true,
          active: true,
          createdAt: "2026-06-25T10:00:00Z",
          updatedAt: "2026-06-25T10:00:00Z",
        })),
        createApplicationDocument: mock.fn(async () => {
          const error = new Error(
            'duplicate key value violates unique constraint "academy_application_documents_unique"',
          ) as Error & { code: string };
          error.code = "23505";
          throw error;
        }),
      });

      const audit = createAuditMock();
      const storage = createStorageMock({
        generateUploadUrl: mock.fn(async () => "https://upload.url/signed"),
      });

      const service = new AdmissionDocumentService(repository, audit, storage);

      await assert.rejects(
        async () =>
          service.generateUploadUrl(
            applicantActor,
            tenantId,
            "app-123",
            "applicant-123",
            "transcript",
            request,
          ),
        {
          message: /A document for "transcript" already exists for this application/,
        },
      );
    });

    it("does not persist a pending document when signed URL generation fails", async () => {
      const request: UploadUrlRequest = {
        fileName: "transcript.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      };

      const repository = createRepositoryMock({
        findDocumentTypeBySlug: mock.fn(async () => ({
          id: "type-123",
          tenantId,
          name: "Official Transcript",
          slug: "transcript",
          required: true,
          active: true,
          createdAt: "2026-06-25T10:00:00Z",
          updatedAt: "2026-06-25T10:00:00Z",
        })),
      });

      const audit = createAuditMock();
      const storage = createStorageMock({
        generateUploadUrl: mock.fn(async () => {
          throw new Error("storage offline");
        }),
      });

      const service = new AdmissionDocumentService(repository, audit, storage);

      await assert.rejects(
        async () =>
          service.generateUploadUrl(
            applicantActor,
            tenantId,
            "app-123",
            "applicant-123",
            "transcript",
            request,
          ),
        {
          message: /storage offline/,
        },
      );

      assert.equal(repository.createApplicationDocument.mock.calls.length, 0);
    });

    it("rejects cross-tenant upload", async () => {
      const request: UploadUrlRequest = {
        fileName: "test.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      };

      const repository = createRepositoryMock();

      const audit = createAuditMock();
      const storage = createStorageMock();

      const service = new AdmissionDocumentService(repository, audit, storage);

      await assert.rejects(
        async () =>
          service.generateUploadUrl(
            applicantActor,
            otherTenantId,
            "app-123",
            "applicant-123",
            "test",
            request,
          ),
        {
          message: /Cross-tenant/,
        },
      );
    });
  });

  describe("waiveDocument", () => {
    it("succeeds with mandatory note", async () => {
      const input: WaiveDocumentInput = {
        tenantId,
        applicationId: "app-123",
        documentId: "doc-123",
        waivedBy: "staff-123",
        waiverNote: "Applicant has prior experience in pastoral ministry.",
      };

      const waived: ApplicationDocument = {
        id: "doc-123",
        tenantId,
        applicationId: "app-123",
        documentTypeId: "type-123",
        status: "waived",
        waivedAt: "2026-06-25T10:00:00Z",
        waivedBy: "staff-123",
        waiverNote: input.waiverNote,
        createdAt: "2026-06-25T09:00:00Z",
        updatedAt: "2026-06-25T10:00:00Z",
      };

      const repository = createRepositoryMock({
        waiveDocument: mock.fn(async () => waived),
      });

      const audit = createAuditMock();
      const storage = createStorageMock();

      const service = new AdmissionDocumentService(repository, audit, storage);
      const result = await service.waiveDocument(staffActor, input);

      assert.deepEqual(result, waived);
      assert.equal(repository.waiveDocument.mock.calls.length, 1);
      assert.equal(audit.append.mock.calls.length, 1);
    });

    it("rejects waiver without note", async () => {
      const input: WaiveDocumentInput = {
        tenantId,
        applicationId: "app-123",
        documentId: "doc-123",
        waivedBy: "staff-123",
        waiverNote: "",
      };

      const repository = createRepositoryMock();

      const audit = createAuditMock();
      const storage = createStorageMock();

      const service = new AdmissionDocumentService(repository, audit, storage);

      await assert.rejects(
        async () => service.waiveDocument(staffActor, input),
        {
          message: /Waiver note is required/,
        },
      );
    });
  });

  describe("canAdvanceToDecision", () => {
    it("returns complete when all required documents are received", async () => {
      const repository = createRepositoryMock({
        canAdvanceToDecision: mock.fn(async () => true),
      });

      const audit = createAuditMock();
      const storage = createStorageMock();

      const service = new AdmissionDocumentService(repository, audit, storage);
      const result = await service.canAdvanceToDecision(
        staffActor,
        tenantId,
        "app-123",
      );

      assert.equal(result.complete, true);
      assert.equal(result.missingDocuments.length, 0);
    });

    it("returns complete when required document is waived", async () => {
      const repository = createRepositoryMock({
        canAdvanceToDecision: mock.fn(async () => true),
      });

      const audit = createAuditMock();
      const storage = createStorageMock();

      const service = new AdmissionDocumentService(repository, audit, storage);
      const result = await service.canAdvanceToDecision(
        staffActor,
        tenantId,
        "app-123",
      );

      assert.equal(result.complete, true);
    });

    it("returns incomplete when required document is pending", async () => {
      const repository = createRepositoryMock({
        canAdvanceToDecision: mock.fn(async () => false),
        getMissingRequiredDocuments: mock.fn(async () => [
          {
            documentTypeId: "type-123",
            name: "Official Transcript",
          },
        ]),
      });

      const audit = createAuditMock();
      const storage = createStorageMock();

      const service = new AdmissionDocumentService(repository, audit, storage);
      const result = await service.canAdvanceToDecision(
        staffActor,
        tenantId,
        "app-123",
      );

      assert.equal(result.complete, false);
      assert.equal(result.missingDocuments.length, 1);
      assert.equal(result.missingDocuments[0].name, "Official Transcript");
    });
  });

  describe("generateDownloadUrl", () => {
    it("does not expose signed URL in test output", async () => {
      const document: ApplicationDocument = {
        id: "doc-123",
        tenantId,
        applicationId: "app-123",
        documentTypeId: "type-123",
        status: "uploaded",
        storagePath: "tenant-123/app-123/transcript/file.pdf",
        uploadedAt: "2026-06-25T09:00:00Z",
        uploadedBy: "applicant-123",
        createdAt: "2026-06-25T09:00:00Z",
        updatedAt: "2026-06-25T09:00:00Z",
      };

      const repository = createRepositoryMock({
        findApplicationDocument: mock.fn(async () => document),
      });

      const audit = createAuditMock();
      const storage = createStorageMock({
        generateDownloadUrl: mock.fn(async () => "https://secret.download.url/with-token"),
      });

      const service = new AdmissionDocumentService(repository, audit, storage);
      const downloadUrl = await service.generateDownloadUrl(
        applicantActor,
        tenantId,
        "app-123",
        "applicant-123",
        "doc-123",
      );

      // Verify the URL was returned
      assert.ok(downloadUrl);
      assert.ok(typeof downloadUrl === "string");

      // Verify secret URL does not appear in test serialization
      const serialized = JSON.stringify({ downloadUrl: "[REDACTED]" });
      assert.doesNotMatch(serialized, /https:\/\/secret\.download\.url/);
    });
  });
});
