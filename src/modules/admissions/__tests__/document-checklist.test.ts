import assert from "node:assert/strict";
import test from "node:test";
import {
  ApplicationDocumentItem,
  ConfirmDocumentUploadInput,
  CreateProgramRequirementInput,
  DocumentChecklistService,
  DocumentStorageClient,
  ProgramDocumentRequirement,
  ReviewDocumentItemInput,
} from "@/modules/admissions/document-checklist";
import { AdmissionApplication } from "@/modules/admissions/types";
import { AcademyActor } from "@/modules/academy-auth/policy";

const applicantActor: AcademyActor = {
  userId: "person-applicant",
  tenantId: "tenant-1",
  roles: ["applicant"],
};

const admissionsStaffActor: AcademyActor = {
  userId: "person-staff",
  tenantId: "tenant-1",
  roles: ["admissions"],
};

const crossTenantActor: AcademyActor = {
  userId: "person-other",
  tenantId: "tenant-2",
  roles: ["admissions"],
};

function mockRequirement(
  overrides: Partial<ProgramDocumentRequirement> = {},
): ProgramDocumentRequirement {
  return {
    id: "req-1",
    tenantId: "tenant-1",
    programId: "program-1",
    label: "High School Transcript",
    description: "Official transcript from high school",
    isRequired: true,
    displayOrder: 0,
    ...overrides,
  };
}

function mockDocumentItem(
  overrides: Partial<ApplicationDocumentItem> = {},
): ApplicationDocumentItem {
  return {
    id: "item-1",
    tenantId: "tenant-1",
    applicationId: "app-1",
    requirementId: "req-1",
    label: "High School Transcript",
    isRequired: true,
    status: "pending",
    ...overrides,
  };
}

function mockApplication(
  overrides: Partial<AdmissionApplication> = {},
): AdmissionApplication {
  return {
    id: "app-1",
    tenantId: "tenant-1",
    applicantPersonId: "person-applicant",
    programId: "program-1",
    legalName: "Jordan Rivera",
    email: "jordan@example.com",
    status: "draft",
    createdAt: "2026-06-23T14:30:00.000Z",
    updatedAt: "2026-06-23T14:30:00.000Z",
    ...overrides,
  };
}

function fixture() {
  const requirements: ProgramDocumentRequirement[] = [];
  const documentItems: ApplicationDocumentItem[] = [];
  const applications: AdmissionApplication[] = [mockApplication()];
  const usageCounts = new Map<string, number>();
  // Programs scoped to tenant-1
  const programs = [{ id: "program-1", tenantId: "tenant-1" }];

  const repository = {
    programBelongsToTenant: async (tenantId: string, programId: string) =>
      programs.some((p) => p.id === programId && p.tenantId === tenantId),
    findProgramRequirementById: async (_tenantId: string, requirementId: string) =>
      requirements.find((r) => r.id === requirementId),
    listProgramRequirements: async (_tenantId: string, _programId: string) =>
      requirements.slice(),
    createProgramRequirement: async (
      tenantId: string,
      input: CreateProgramRequirementInput,
    ) => {
      const req = mockRequirement({
        id: `req-${requirements.length + 1}`,
        tenantId,
        ...input,
      });
      requirements.push(req);
      return req;
    },
    deleteProgramRequirement: async (_tenantId: string, requirementId: string) => {
      const index = requirements.findIndex((r) => r.id === requirementId);
      if (index >= 0) {
        requirements.splice(index, 1);
      }
    },
    countApplicationsUsingRequirement: async (_tenantId: string, requirementId: string) =>
      usageCounts.get(requirementId) ?? 0,
    findApplicationDocumentItemById: async (_tenantId: string, documentItemId: string) =>
      documentItems.find((item) => item.id === documentItemId),
    listApplicationDocumentItems: async (_tenantId: string, _applicationId: string) =>
      documentItems.slice(),
    createApplicationDocumentItems: async (
      tenantId: string,
      applicationId: string,
      reqs: ProgramDocumentRequirement[],
    ) => {
      const newItems = reqs.map((req, index) =>
        mockDocumentItem({
          id: `item-${documentItems.length + index + 1}`,
          tenantId,
          applicationId,
          requirementId: req.id,
          label: req.label,
          isRequired: req.isRequired,
        }),
      );
      documentItems.push(...newItems);
      reqs.forEach((req) => {
        usageCounts.set(req.id, (usageCounts.get(req.id) ?? 0) + 1);
      });
      return newItems;
    },
    updateDocumentItemUpload: async (
      _tenantId: string,
      documentItemId: string,
      storagePath: string,
      storageFilename: string,
      uploadedAt: string,
    ) => {
      const item = documentItems.find((i) => i.id === documentItemId);
      if (!item) {
        throw new Error("Document item not found during upload update.");
      }
      item.status = "uploaded";
      item.storagePath = storagePath;
      item.storageFilename = storageFilename;
      item.uploadedAt = uploadedAt;
      return item;
    },
    updateDocumentItemReview: async (
      _tenantId: string,
      documentItemId: string,
      status: ApplicationDocumentItem["status"],
      reviewedByPersonId: string,
      reviewedAt: string,
      officerNote?: string,
    ) => {
      const item = documentItems.find((i) => i.id === documentItemId);
      if (!item) {
        throw new Error("Document item not found during review update.");
      }
      item.status = status;
      item.reviewedByPersonId = reviewedByPersonId;
      item.reviewedAt = reviewedAt;
      item.officerNote = officerNote;
      return item;
    },
    findApplicationByDocumentItemId: async (_tenantId: string, _documentItemId: string) =>
      applications[0],
  };

  return { repository, requirements, documentItems, applications, usageCounts };
}

test("createProgramRequirement: success", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  const req = await service.createProgramRequirement(admissionsStaffActor, {
    programId: "program-1",
    label: "Official Transcript",
    description: "High school or college transcript",
    isRequired: true,
    displayOrder: 1,
  });

  assert.equal(req.label, "Official Transcript");
  assert.equal(req.isRequired, true);
  assert.equal(state.requirements.length, 1);
});

test("createProgramRequirement: cross-tenant rejection", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  await assert.rejects(
    () =>
      service.createProgramRequirement(crossTenantActor, {
        programId: "program-1",
        label: "Transcript",
        isRequired: true,
      }),
    /Forbidden cross-tenant program requirement access/,
  );
});

test("snapshotChecklistForApplication: items created per program requirements", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  state.requirements.push(mockRequirement({ id: "req-1", label: "Transcript" }));
  state.requirements.push(
    mockRequirement({ id: "req-2", label: "Recommendation Letter", displayOrder: 1 }),
  );

  const items = await service.snapshotChecklistForApplication(
    admissionsStaffActor,
    "app-1",
    "program-1",
  );

  assert.equal(items.length, 2);
  assert.equal(items[0].label, "Transcript");
  assert.equal(items[1].label, "Recommendation Letter");
  assert.equal(items[0].status, "pending");
});

test("snapshotChecklistForApplication: idempotency - second call returns existing items", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  state.requirements.push(mockRequirement({ id: "req-1" }));
  const firstItems = await service.snapshotChecklistForApplication(
    admissionsStaffActor,
    "app-1",
    "program-1",
  );

  const secondItems = await service.snapshotChecklistForApplication(
    admissionsStaffActor,
    "app-1",
    "program-1",
  );

  assert.equal(firstItems.length, 1);
  assert.equal(secondItems.length, 1);
  assert.equal(firstItems[0].id, secondItems[0].id);
  assert.equal(state.documentItems.length, 1);
});

test("getApplicationChecklist: empty checklist - completionPct = 100", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  const view = await service.getApplicationChecklist(applicantActor, "app-1");

  assert.equal(view.items.length, 0);
  assert.equal(view.completionPct, 100);
});

test("getApplicationChecklist: 2 required items 1 reviewed - completionPct = 50", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  state.documentItems.push(
    mockDocumentItem({ id: "item-1", isRequired: true, status: "reviewed" }),
  );
  state.documentItems.push(
    mockDocumentItem({ id: "item-2", isRequired: true, status: "uploaded" }),
  );

  const view = await service.getApplicationChecklist(applicantActor, "app-1");

  assert.equal(view.items.length, 2);
  assert.equal(view.completionPct, 50);
});

test("confirmDocumentUpload: success - status = uploaded", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  state.documentItems.push(mockDocumentItem({ id: "item-1", status: "pending" }));

  const uploadInput: ConfirmDocumentUploadInput = {
    documentItemId: "item-1",
    storagePath: "academy-documents/tenant-1/applications/app-1/item-1/transcript.pdf",
    storageFilename: "transcript.pdf",
    contentType: "application/pdf",
    fileSizeBytes: 500_000,
  };

  const result = await service.confirmDocumentUpload(applicantActor, uploadInput);

  assert.equal(result.item.status, "uploaded");
  assert.equal(result.item.storagePath, uploadInput.storagePath);
  assert.equal(result.oldStoragePath, undefined);
});

test("confirmDocumentUpload: non-PDF contentType - validation error", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  state.documentItems.push(mockDocumentItem({ id: "item-1" }));

  const uploadInput: ConfirmDocumentUploadInput = {
    documentItemId: "item-1",
    storagePath: "path",
    storageFilename: "file.docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileSizeBytes: 100_000,
  };

  await assert.rejects(
    () => service.confirmDocumentUpload(applicantActor, uploadInput),
    /Only PDF documents are accepted/,
  );
});

test("confirmDocumentUpload: file too large - size validation error", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  state.documentItems.push(mockDocumentItem({ id: "item-1" }));

  const uploadInput: ConfirmDocumentUploadInput = {
    documentItemId: "item-1",
    storagePath: "path",
    storageFilename: "large.pdf",
    contentType: "application/pdf",
    fileSizeBytes: 15 * 1024 * 1024,
  };

  await assert.rejects(
    () => service.confirmDocumentUpload(applicantActor, uploadInput),
    /file size exceeds the 10MB limit/,
  );
});

test("confirmDocumentUpload: replaces existing - oldStoragePath returned", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  state.documentItems.push(
    mockDocumentItem({
      id: "item-1",
      status: "uploaded",
      storagePath: "old-path/file.pdf",
      storageFilename: "old-file.pdf",
    }),
  );

  const uploadInput: ConfirmDocumentUploadInput = {
    documentItemId: "item-1",
    storagePath: "new-path/file.pdf",
    storageFilename: "new-file.pdf",
    contentType: "application/pdf",
    fileSizeBytes: 200_000,
  };

  const result = await service.confirmDocumentUpload(applicantActor, uploadInput);

  assert.equal(result.oldStoragePath, "old-path/file.pdf");
  assert.equal(result.item.storagePath, "new-path/file.pdf");
});

test("reviewDocumentItem: reviewed - status = reviewed, note saved", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  state.documentItems.push(mockDocumentItem({ id: "item-1", status: "uploaded" }));

  const reviewInput: ReviewDocumentItemInput = {
    documentItemId: "item-1",
    decision: "reviewed",
    officerNote: "Document verified and accepted",
  };

  const result = await service.reviewDocumentItem(admissionsStaffActor, reviewInput);

  assert.equal(result.status, "reviewed");
  assert.equal(result.officerNote, "Document verified and accepted");
  assert.equal(result.reviewedByPersonId, "person-staff");
});

test("reviewDocumentItem: resubmission_required - status = resubmission_required", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  state.documentItems.push(mockDocumentItem({ id: "item-1", status: "uploaded" }));

  const reviewInput: ReviewDocumentItemInput = {
    documentItemId: "item-1",
    decision: "resubmission_required",
    officerNote: "Document is unclear, please resubmit",
  };

  const result = await service.reviewDocumentItem(admissionsStaffActor, reviewInput);

  assert.equal(result.status, "resubmission_required");
  assert.equal(result.officerNote, "Document is unclear, please resubmit");
});

test("reviewDocumentItem: applicant actor cannot review - authorization error", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  state.documentItems.push(mockDocumentItem({ id: "item-1", status: "uploaded" }));

  const reviewInput: ReviewDocumentItemInput = {
    documentItemId: "item-1",
    decision: "reviewed",
  };

  await assert.rejects(
    () => service.reviewDocumentItem(applicantActor, reviewInput),
    /Forbidden document review access/,
  );
});

test("getSignedDownloadUrl: cross-applicant - throws AcademyAuthorizationError", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  state.documentItems.push(
    mockDocumentItem({
      id: "item-1",
      status: "uploaded",
      storagePath: "path/file.pdf",
    }),
  );

  const otherApplicantActor: AcademyActor = {
    userId: "person-other-applicant",
    tenantId: "tenant-1",
    roles: ["applicant"],
  };

  const storageClient: DocumentStorageClient = {
    generateSignedUploadUrl: async () => "signed-upload-url",
    delete: async () => {},
    generateSignedDownloadUrl: async () => "signed-download-url",
  };

  await assert.rejects(
    () => service.getSignedDownloadUrl(otherApplicantActor, "item-1", storageClient),
    /Forbidden document access/,
  );
});

test("deleteProgramRequirement: cannot delete if in use", async () => {
  const state = fixture();
  const service = new DocumentChecklistService(state.repository);

  state.requirements.push(mockRequirement({ id: "req-1" }));
  state.usageCounts.set("req-1", 2);

  await assert.rejects(
    () => service.deleteProgramRequirement(admissionsStaffActor, "req-1"),
    /Cannot delete program requirement: it is used by existing applications/,
  );
});
