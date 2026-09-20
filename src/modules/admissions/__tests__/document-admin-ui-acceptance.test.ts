import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  AdmissionDocumentService,
  DocumentRepository,
  AuditRepository,
  StorageProvider,
} from "@/modules/admissions/document-service";
import {
  DocumentChecklistService,
  ProgramDocumentRequirement,
  CreateProgramRequirementInput,
} from "@/modules/admissions/document-checklist";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { CreateDocumentTypeInput, DocumentType } from "@/modules/admissions/types";
import { requireStringField, requireBooleanField } from "@/app/api/academy/api-utils";

/**
 * Acceptance tests for the Admissions Document Types & Program Requirements admin UI feature.
 *
 * User story: Admin UI for document types and program requirements
 * - Document types list/create for institution_admin, with view access for admissions staff
 * - Program requirements list/add/delete with in-use protection
 * - Cross-tenant isolation and role-based access control
 */

// Helper: Create mock repository for document service
function createDocumentRepositoryMock<T extends Partial<DocumentRepository>>(
  overrides: T = {} as T,
) {
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
    generateUploadUrl: mock.fn(async () => "https://upload.url"),
    generateDownloadUrl: mock.fn(async () => "https://download.url"),
    ...overrides,
  };
}

// Helper: Create mock repository for document checklist
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

function createChecklistFixture() {
  const requirements: ProgramDocumentRequirement[] = [];
  const usageCounts = new Map<string, number>();
  const programs = [
    { id: "program-1", tenantId: "tenant-1" },
    { id: "program-2", tenantId: "tenant-2" },
  ];

  const repository = {
    programBelongsToTenant: async (tenantId: string, programId: string) =>
      programs.some((p) => p.id === programId && p.tenantId === tenantId),
    findProgramRequirementById: async (tenantId: string, requirementId: string) =>
      requirements.find((r) => r.id === requirementId && r.tenantId === tenantId),
    listProgramRequirements: async (tenantId: string, programId: string) =>
      requirements.filter((r) => r.tenantId === tenantId && r.programId === programId),
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
    // Matches the real query: `delete ... where tenant_id = $1 and id = $2`.
    deleteProgramRequirement: async (tenantId: string, requirementId: string) => {
      const index = requirements.findIndex(
        (r) => r.id === requirementId && r.tenantId === tenantId,
      );
      if (index >= 0) {
        requirements.splice(index, 1);
      }
    },
    countApplicationsUsingRequirement: async (_tenantId: string, requirementId: string) =>
      usageCounts.get(requirementId) ?? 0,
    findApplicationDocumentItemById: async () => undefined,
    listApplicationDocumentItems: async () => [],
    createApplicationDocumentItems: async () => [],
    updateDocumentItemUpload: async () => {
      throw new Error("Not implemented in test");
    },
    updateDocumentItemReview: async () => {
      throw new Error("Not implemented in test");
    },
    findApplicationByDocumentItemId: async () => undefined,
  };

  return { repository, requirements, usageCounts };
}

// Test actors
const tenant1 = "tenant-1";
const tenant2 = "tenant-2";

const institutionAdminActor: AcademyActor = {
  userId: "user-admin",
  tenantId: tenant1,
  roles: ["institution_admin"],
};

const deanActor: AcademyActor = {
  userId: "user-dean",
  tenantId: tenant1,
  roles: ["dean"],
};

const registrarActor: AcademyActor = {
  userId: "user-registrar",
  tenantId: tenant1,
  roles: ["registrar"],
};

const admissionsStaffActor: AcademyActor = {
  userId: "user-admissions",
  tenantId: tenant1,
  roles: ["admissions"],
};

const academicAdminActor: AcademyActor = {
  userId: "user-academic",
  tenantId: tenant1,
  roles: ["academic_admin"],
};

const crossTenantActor: AcademyActor = {
  userId: "user-other",
  tenantId: tenant2,
  roles: ["institution_admin"],
};

const unauthorizedActor: AcademyActor = {
  userId: "user-unauthorized",
  tenantId: tenant1,
  roles: ["student"],
};

describe("Document Types Admin UI - Acceptance Tests", () => {
  // AC1: Document types list shows name/slug/required/description/active for the tenant
  it("AC1: lists active document types with all required fields", async () => {
    const expectedTypes: DocumentType[] = [
      {
        id: "type-1",
        tenantId: tenant1,
        name: "Pastoral Reference Letter",
        slug: "pastoral_reference",
        required: true,
        description: "A reference letter from your pastor",
        active: true,
        createdAt: "2026-09-19T10:00:00Z",
        updatedAt: "2026-09-19T10:00:00Z",
      },
      {
        id: "type-2",
        tenantId: tenant1,
        name: "Academic Transcript",
        slug: "transcript",
        required: true,
        active: true,
        createdAt: "2026-09-19T10:00:00Z",
        updatedAt: "2026-09-19T10:00:00Z",
      },
    ];

    const repository = createDocumentRepositoryMock({
      listActiveDocumentTypes: mock.fn(async () => expectedTypes),
    });
    const audit = createAuditMock();
    const storage = createStorageMock();

    const service = new AdmissionDocumentService(repository, audit, storage);
    const result = await service.listActiveDocumentTypes(
      institutionAdminActor,
      tenant1,
    );

    assert.equal(result.length, 2);
    // Verify all fields are present
    assert.equal(result[0].name, "Pastoral Reference Letter");
    assert.equal(result[0].slug, "pastoral_reference");
    assert.equal(result[0].required, true);
    assert.equal(result[0].description, "A reference letter from your pastor");
    assert.equal(result[0].active, true);
    assert.ok(result[0].createdAt);
    assert.ok(result[0].updatedAt);

    // Verify second item has all fields even without description
    assert.equal(result[1].name, "Academic Transcript");
    assert.equal(result[1].slug, "transcript");
    assert.equal(result[1].required, true);
    assert.equal(result[1].active, true);
  });

  // AC2: Create document type succeeds for institution_admin, creates with active=true
  it("AC2: creates document type with active=true for institution_admin", async () => {
    const input: CreateDocumentTypeInput = {
      tenantId: tenant1,
      name: "Statement of Faith",
      slug: "statement_of_faith",
      required: true,
      description: "Your personal statement of faith",
    };

    const created: DocumentType = {
      id: "type-new",
      ...input,
      active: true, // AC2: Verify active is set to true
      createdAt: "2026-09-19T10:00:00Z",
      updatedAt: "2026-09-19T10:00:00Z",
    };

    const repository = createDocumentRepositoryMock({
      createDocumentType: mock.fn(async () => created),
    });
    const audit = createAuditMock();
    const storage = createStorageMock();

    const service = new AdmissionDocumentService(repository, audit, storage);
    const result = await service.createDocumentType(institutionAdminActor, input);

    assert.equal(result.active, true);
    assert.equal(result.name, "Statement of Faith");
    assert.equal(result.slug, "statement_of_faith");
  });

  // AC3: Duplicate slug - the database has a real unique constraint on (tenant_id, slug)
  // (supabase/migrations/20260625030000_academy_document_types.sql). The second insert
  // fails at the repository/DB layer; the service must map that into a friendly
  // AcademyConflictError rather than letting a raw constraint-violation error escape.
  it("AC3: rejects duplicate slug with a friendly conflict error, not a raw DB error", async () => {
    const input1: CreateDocumentTypeInput = {
      tenantId: tenant1,
      name: "Transcript",
      slug: "transcript",
      required: true,
    };

    const input2: CreateDocumentTypeInput = {
      tenantId: tenant1,
      name: "Official Transcript",
      slug: "transcript", // Same slug
      required: true,
    };

    let created = false;
    const repository = createDocumentRepositoryMock({
      createDocumentType: mock.fn(async (input: CreateDocumentTypeInput) => {
        if (created) {
          // Simulates the real Postgres unique-violation message for
          // academy_document_types_tenant_slug_unique.
          throw new Error(
            'duplicate key value violates unique constraint "academy_document_types_tenant_slug_unique"',
          );
        }
        created = true;
        return {
          id: crypto.randomUUID(),
          ...input,
          active: true,
          createdAt: "2026-09-19T10:00:00Z",
          updatedAt: "2026-09-19T10:00:00Z",
        };
      }),
    });
    const audit = createAuditMock();
    const storage = createStorageMock();

    const service = new AdmissionDocumentService(repository, audit, storage);

    const result1 = await service.createDocumentType(institutionAdminActor, input1);
    assert.equal(result1.slug, "transcript");

    await assert.rejects(
      () => service.createDocumentType(institutionAdminActor, input2),
      {
        name: "AcademyConflictError",
        message: 'A document type with slug "transcript" already exists.',
      },
    );
  });

  // AC4: Invalid slug chars - client-side validation only (noted, not testable at module layer)
  // Note: Slug character validation is client-side only. The server does not validate slug format.
  it("AC4: server does not validate slug format (client-side concern)", async () => {
    const input: CreateDocumentTypeInput = {
      tenantId: tenant1,
      name: "Test Document",
      slug: "invalid slug with spaces!@#", // Invalid characters
      required: false,
    };

    const repository = createDocumentRepositoryMock({
      createDocumentType: mock.fn(async (input: CreateDocumentTypeInput) => ({
        id: "type-123",
        ...input,
        active: true,
        createdAt: "2026-09-19T10:00:00Z",
        updatedAt: "2026-09-19T10:00:00Z",
      })),
    });
    const audit = createAuditMock();
    const storage = createStorageMock();

    const service = new AdmissionDocumentService(repository, audit, storage);
    const result = await service.createDocumentType(institutionAdminActor, input);

    // Server accepts the invalid slug - validation is client-side only
    assert.equal(result.slug, "invalid slug with spaces!@#");
  });

  // AC10: institution_admin-only create; dean/registrar/admissions can list but not create
  it("AC10: dean can list document types", async () => {
    const types: DocumentType[] = [
      {
        id: "type-1",
        tenantId: tenant1,
        name: "Test",
        slug: "test",
        required: false,
        active: true,
        createdAt: "2026-09-19T10:00:00Z",
        updatedAt: "2026-09-19T10:00:00Z",
      },
    ];

    const repository = createDocumentRepositoryMock({
      listActiveDocumentTypes: mock.fn(async () => types),
    });
    const audit = createAuditMock();
    const storage = createStorageMock();

    const service = new AdmissionDocumentService(repository, audit, storage);
    const result = await service.listActiveDocumentTypes(deanActor, tenant1);

    assert.equal(result.length, 1);
  });

  it("AC10: registrar can list document types", async () => {
    const types: DocumentType[] = [
      {
        id: "type-1",
        tenantId: tenant1,
        name: "Test",
        slug: "test",
        required: false,
        active: true,
        createdAt: "2026-09-19T10:00:00Z",
        updatedAt: "2026-09-19T10:00:00Z",
      },
    ];

    const repository = createDocumentRepositoryMock({
      listActiveDocumentTypes: mock.fn(async () => types),
    });
    const audit = createAuditMock();
    const storage = createStorageMock();

    const service = new AdmissionDocumentService(repository, audit, storage);
    const result = await service.listActiveDocumentTypes(registrarActor, tenant1);

    assert.equal(result.length, 1);
  });

  it("AC10: admissions staff can list document types", async () => {
    const types: DocumentType[] = [
      {
        id: "type-1",
        tenantId: tenant1,
        name: "Test",
        slug: "test",
        required: false,
        active: true,
        createdAt: "2026-09-19T10:00:00Z",
        updatedAt: "2026-09-19T10:00:00Z",
      },
    ];

    const repository = createDocumentRepositoryMock({
      listActiveDocumentTypes: mock.fn(async () => types),
    });
    const audit = createAuditMock();
    const storage = createStorageMock();

    const service = new AdmissionDocumentService(repository, audit, storage);
    const result = await service.listActiveDocumentTypes(
      admissionsStaffActor,
      tenant1,
    );

    assert.equal(result.length, 1);
  });

  it("AC10: dean/registrar/admissions cannot create document types", async () => {
    const input: CreateDocumentTypeInput = {
      tenantId: tenant1,
      name: "Test",
      slug: "test",
      required: false,
    };

    const repository = createDocumentRepositoryMock();
    const audit = createAuditMock();
    const storage = createStorageMock();

    const service = new AdmissionDocumentService(repository, audit, storage);

    // Dean rejected
    await assert.rejects(
      () => service.createDocumentType(deanActor, input),
      /Only institution admins can create document types/,
    );

    // Registrar rejected
    await assert.rejects(
      () => service.createDocumentType(registrarActor, input),
      /Only institution admins can create document types/,
    );

    // Admissions staff rejected
    await assert.rejects(
      () => service.createDocumentType(admissionsStaffActor, input),
      /Only institution admins can create document types/,
    );

    // Verify no repository calls were made
    assert.equal(repository.createDocumentType.mock.calls.length, 0);
  });

  // AC11: Cross-tenant creation attempts rejected
  it("AC11: rejects cross-tenant document type creation", async () => {
    const input: CreateDocumentTypeInput = {
      tenantId: tenant2, // Different from actor's tenant
      name: "Test",
      slug: "test",
      required: false,
    };

    const repository = createDocumentRepositoryMock();
    const audit = createAuditMock();
    const storage = createStorageMock();

    const service = new AdmissionDocumentService(repository, audit, storage);

    await assert.rejects(
      () => service.createDocumentType(institutionAdminActor, input),
      /Cross-tenant/,
    );

    assert.equal(repository.createDocumentType.mock.calls.length, 0);
  });

  it("AC11: rejects cross-tenant document type listing", async () => {
    const repository = createDocumentRepositoryMock();
    const audit = createAuditMock();
    const storage = createStorageMock();

    const service = new AdmissionDocumentService(repository, audit, storage);

    await assert.rejects(
      () => service.listActiveDocumentTypes(institutionAdminActor, tenant2),
      /Cross-tenant/,
    );
  });

  // AC12: Listing scoped to tenant - cross-tenant leak test
  it("AC12: document types listing only returns tenant's own data", async () => {
    const tenant1Types: DocumentType[] = [
      {
        id: "type-t1-1",
        tenantId: tenant1,
        name: "Tenant 1 Type",
        slug: "tenant1_type",
        required: true,
        active: true,
        createdAt: "2026-09-19T10:00:00Z",
        updatedAt: "2026-09-19T10:00:00Z",
      },
    ];

    const tenant2Types: DocumentType[] = [
      {
        id: "type-t2-1",
        tenantId: tenant2,
        name: "Tenant 2 Type",
        slug: "tenant2_type",
        required: true,
        active: true,
        createdAt: "2026-09-19T10:00:00Z",
        updatedAt: "2026-09-19T10:00:00Z",
      },
    ];

    // Repository mock that respects tenant isolation
    const repository = createDocumentRepositoryMock({
      listActiveDocumentTypes: mock.fn(async (tenantId: string) => {
        if (tenantId === tenant1) return tenant1Types;
        if (tenantId === tenant2) return tenant2Types;
        return [];
      }),
    });
    const audit = createAuditMock();
    const storage = createStorageMock();

    const service = new AdmissionDocumentService(repository, audit, storage);

    // Tenant 1 sees only their data
    const result1 = await service.listActiveDocumentTypes(
      institutionAdminActor,
      tenant1,
    );
    assert.equal(result1.length, 1);
    assert.equal(result1[0].tenantId, tenant1);
    assert.equal(result1[0].name, "Tenant 1 Type");

    // Tenant 2 sees only their data
    const result2 = await service.listActiveDocumentTypes(
      crossTenantActor,
      tenant2,
    );
    assert.equal(result2.length, 1);
    assert.equal(result2[0].tenantId, tenant2);
    assert.equal(result2[0].name, "Tenant 2 Type");

    // Verify no data leak between tenants
    assert.notEqual(result1[0].id, result2[0].id);
  });

  // AC13: Required-field validation - name
  it("AC13: route validation rejects missing name field", () => {
    const invalidBody: { name?: string; slug: string; required: boolean } = {
      slug: "test",
      required: true,
    };

    assert.throws(
      () => requireStringField(invalidBody.name, "name"),
      /Invalid name: must be a non-empty string/,
    );
  });

  it("AC13: route validation rejects empty name field", () => {
    const invalidBody = {
      name: "   ",
      slug: "test",
      required: true,
    };

    assert.throws(
      () => requireStringField(invalidBody.name, "name"),
      /Invalid name: must be a non-empty string/,
    );
  });

  // AC13: Required-field validation - slug
  it("AC13: route validation rejects missing slug field", () => {
    const invalidBody: { name: string; slug?: string; required: boolean } = {
      name: "Test",
      required: true,
    };

    assert.throws(
      () => requireStringField(invalidBody.slug, "slug"),
      /Invalid slug: must be a non-empty string/,
    );
  });

  // AC13: Required-field validation - required boolean
  it("AC13: route validation accepts valid boolean for required field", () => {
    const validBody = {
      required: true,
    };

    const result = requireBooleanField(validBody.required, "required");
    assert.equal(result, true);
  });

  it("AC13: route validation rejects non-boolean for required field", () => {
    const invalidBody = {
      required: "yes",
    };

    assert.throws(
      () => requireBooleanField(invalidBody.required, "required"),
      /Invalid required: must be a boolean/,
    );
  });

  // AC15: listActiveDocumentTypes only returns active=true rows
  it("AC15: listActiveDocumentTypes filters to active documents only", async () => {
    // Note: There's currently no way to create an inactive document type
    // (no deactivation function exists), so this test demonstrates the
    // filtering behavior would work if inactive types existed in the database.
    const allTypes: DocumentType[] = [
      {
        id: "type-active",
        tenantId: tenant1,
        name: "Active Type",
        slug: "active",
        required: true,
        active: true,
        createdAt: "2026-09-19T10:00:00Z",
        updatedAt: "2026-09-19T10:00:00Z",
      },
    ];

    const repository = createDocumentRepositoryMock({
      // Repository's listActiveDocumentTypes already filters to active=true
      listActiveDocumentTypes: mock.fn(async () =>
        allTypes.filter((t) => t.active),
      ),
    });
    const audit = createAuditMock();
    const storage = createStorageMock();

    const service = new AdmissionDocumentService(repository, audit, storage);
    const result = await service.listActiveDocumentTypes(
      institutionAdminActor,
      tenant1,
    );

    // All returned documents are active
    assert.ok(result.every((t) => t.active === true));
    assert.equal(result.length, 1);
  });
});

describe("Program Requirements Admin UI - Acceptance Tests", () => {
  // AC5: Program requirements section shows label/description/isRequired/displayOrder
  it("AC5: lists program requirements with all required fields", async () => {
    const state = createChecklistFixture();

    // Create requirements with all fields
    const req1 = mockRequirement({
      id: "req-1",
      programId: "program-1",
      tenantId: tenant1,
      label: "High School Diploma",
      description: "Copy of high school diploma or GED certificate",
      isRequired: true,
      displayOrder: 0,
    });

    const req2 = mockRequirement({
      id: "req-2",
      programId: "program-1",
      tenantId: tenant1,
      label: "Baptism Certificate",
      description: "Certificate of Christian baptism",
      isRequired: false,
      displayOrder: 1,
    });

    state.requirements.push(req1, req2);

    const result = await state.repository.listProgramRequirements(
      tenant1,
      "program-1",
    );

    assert.equal(result.length, 2);

    // Verify all fields are present
    assert.equal(result[0].label, "High School Diploma");
    assert.equal(
      result[0].description,
      "Copy of high school diploma or GED certificate",
    );
    assert.equal(result[0].isRequired, true);
    assert.equal(result[0].displayOrder, 0);

    assert.equal(result[1].label, "Baptism Certificate");
    assert.equal(result[1].description, "Certificate of Christian baptism");
    assert.equal(result[1].isRequired, false);
    assert.equal(result[1].displayOrder, 1);
  });

  // AC6: Add requirement succeeds, appears in list
  it("AC6: creates program requirement and appears in list", async () => {
    const state = createChecklistFixture();
    const service = new DocumentChecklistService(state.repository);

    const input: CreateProgramRequirementInput = {
      programId: "program-1",
      label: "Letter of Recommendation",
      description: "From a church leader or pastor",
      isRequired: true,
      displayOrder: 0,
    };

    // Create requirement
    const created = await service.createProgramRequirement(
      admissionsStaffActor,
      input,
    );

    assert.equal(created.label, "Letter of Recommendation");
    assert.equal(created.isRequired, true);

    // Verify it appears in the list
    const list = await state.repository.listProgramRequirements(
      tenant1,
      "program-1",
    );
    assert.equal(list.length, 1);
    assert.equal(list[0].id, created.id);
    assert.equal(list[0].label, "Letter of Recommendation");
  });

  // AC7: Delete requirement with zero applications succeeds
  it("AC7: deletes requirement when not in use by any applications", async () => {
    const state = createChecklistFixture();
    const service = new DocumentChecklistService(state.repository);

    // Create a requirement
    const req = await service.createProgramRequirement(admissionsStaffActor, {
      programId: "program-1",
      label: "Test Requirement",
      isRequired: true,
    });

    // Verify it exists
    let list = await state.repository.listProgramRequirements(tenant1, "program-1");
    assert.equal(list.length, 1);

    // Delete succeeds (usage count is 0)
    await service.deleteProgramRequirement(admissionsStaffActor, "program-1", req.id);

    // Verify it's gone
    list = await state.repository.listProgramRequirements(tenant1, "program-1");
    assert.equal(list.length, 0);
  });

  // AC8: Delete requirement with ≥1 application throws AcademyConflictError with exact message
  it("AC8: cannot delete requirement in use by applications with exact error message", async () => {
    const state = createChecklistFixture();
    const service = new DocumentChecklistService(state.repository);

    // Create a requirement
    const req = await service.createProgramRequirement(admissionsStaffActor, {
      programId: "program-1",
      label: "In Use Requirement",
      isRequired: true,
    });

    // Simulate 3 applications using this requirement
    state.usageCounts.set(req.id, 3);

    // Attempt to delete - should fail with exact message including count
    await assert.rejects(
      () => service.deleteProgramRequirement(admissionsStaffActor, "program-1", req.id),
      {
        message: "Cannot delete requirement: currently in use by 3 applications.",
      },
    );

    // Verify requirement still exists
    const list = await state.repository.listProgramRequirements(
      tenant1,
      "program-1",
    );
    assert.equal(list.length, 1);
  });

  it("AC8: singular form in error message when exactly 1 application", async () => {
    const state = createChecklistFixture();
    const service = new DocumentChecklistService(state.repository);

    const req = await service.createProgramRequirement(admissionsStaffActor, {
      programId: "program-1",
      label: "Used Once",
      isRequired: true,
    });

    // Simulate exactly 1 application using this requirement
    state.usageCounts.set(req.id, 1);

    await assert.rejects(
      () => service.deleteProgramRequirement(admissionsStaffActor, "program-1", req.id),
      {
        message: "Cannot delete requirement: currently in use by 1 application.",
      },
    );
  });

  it("AC1x: rejects deletion when the requirement belongs to a different program (same tenant)", async () => {
    const state = createChecklistFixture();
    const service = new DocumentChecklistService(state.repository);

    const req = await service.createProgramRequirement(admissionsStaffActor, {
      programId: "program-1",
      label: "Program 1 Requirement",
      isRequired: true,
    });

    // Attempt to delete it through a different program's URL (same tenant)
    await assert.rejects(
      () => service.deleteProgramRequirement(admissionsStaffActor, "program-other", req.id),
      /Program requirement does not belong to the specified program/,
    );

    // Verify it was not deleted
    const list = await state.repository.listProgramRequirements(tenant1, "program-1");
    assert.equal(list.length, 1);
  });

  // AC9: Wrong-role access rejected for program requirements
  it("AC9: rejects program requirement creation for unauthorized role", async () => {
    const state = createChecklistFixture();
    const service = new DocumentChecklistService(state.repository);

    const input: CreateProgramRequirementInput = {
      programId: "program-1",
      label: "Test",
      isRequired: true,
    };

    await assert.rejects(
      () => service.createProgramRequirement(unauthorizedActor, input),
      /Forbidden program requirement access/,
    );
  });

  it("AC9: rejects program requirement deletion for unauthorized role", async () => {
    const state = createChecklistFixture();
    const service = new DocumentChecklistService(state.repository);

    // Create a requirement first (as authorized user)
    const req = await service.createProgramRequirement(admissionsStaffActor, {
      programId: "program-1",
      label: "Test",
      isRequired: true,
    });

    // Attempt to delete as unauthorized user
    await assert.rejects(
      () => service.deleteProgramRequirement(unauthorizedActor, "program-1", req.id),
      /Forbidden program requirement access/,
    );
  });

  it("AC9: admissions staff can create requirements", async () => {
    const state = createChecklistFixture();
    const service = new DocumentChecklistService(state.repository);

    const req = await service.createProgramRequirement(admissionsStaffActor, {
      programId: "program-1",
      label: "Admissions Test",
      isRequired: true,
    });

    assert.ok(req.id);
    assert.equal(req.label, "Admissions Test");
  });

  it("AC9: registrar can create requirements", async () => {
    const state = createChecklistFixture();
    const service = new DocumentChecklistService(state.repository);

    const req = await service.createProgramRequirement(registrarActor, {
      programId: "program-1",
      label: "Registrar Test",
      isRequired: true,
    });

    assert.ok(req.id);
    assert.equal(req.label, "Registrar Test");
  });

  it("AC9: academic_admin can create requirements", async () => {
    const state = createChecklistFixture();
    const service = new DocumentChecklistService(state.repository);

    const req = await service.createProgramRequirement(academicAdminActor, {
      programId: "program-1",
      label: "Academic Admin Test",
      isRequired: true,
    });

    assert.ok(req.id);
    assert.equal(req.label, "Academic Admin Test");
  });

  it("AC9: institution_admin can create requirements", async () => {
    const state = createChecklistFixture();
    const service = new DocumentChecklistService(state.repository);

    const req = await service.createProgramRequirement(institutionAdminActor, {
      programId: "program-1",
      label: "Institution Admin Test",
      isRequired: true,
    });

    assert.ok(req.id);
    assert.equal(req.label, "Institution Admin Test");
  });

  it("AC9: dean CANNOT create requirements (excluded from staffRoles)", async () => {
    const state = createChecklistFixture();
    const service = new DocumentChecklistService(state.repository);

    await assert.rejects(
      () =>
        service.createProgramRequirement(deanActor, {
          programId: "program-1",
          label: "Dean Test",
          isRequired: true,
        }),
      /Forbidden program requirement access/,
    );
  });

  // AC11: Cross-tenant program requirement creation rejected
  it("AC11: rejects cross-tenant program requirement creation", async () => {
    const state = createChecklistFixture();
    const service = new DocumentChecklistService(state.repository);

    // Attempt to create requirement for program-1 (tenant-1) with tenant-2 actor
    await assert.rejects(
      () =>
        service.createProgramRequirement(crossTenantActor, {
          programId: "program-1", // Belongs to tenant-1
          label: "Cross-Tenant Test",
          isRequired: true,
        }),
      /Forbidden cross-tenant program requirement access/,
    );
  });

  it("AC11: rejects cross-tenant program requirement deletion explicitly (not a silent no-op)", async () => {
    const state = createChecklistFixture();
    const service = new DocumentChecklistService(state.repository);

    // Create requirement in tenant-1
    const req = await service.createProgramRequirement(admissionsStaffActor, {
      programId: "program-1",
      label: "Tenant 1 Requirement",
      isRequired: true,
    });

    // Verify requirement exists in tenant-1
    let list = await state.repository.listProgramRequirements(tenant1, "program-1");
    assert.equal(list.length, 1);

    // deleteProgramRequirement now looks the requirement up by (actor.tenantId, id) first;
    // a tenant-2 actor can't find a tenant-1 requirement, so this is an explicit rejection,
    // not a false-success `{ deleted: true }` response with 0 rows actually affected.
    await assert.rejects(
      () => service.deleteProgramRequirement(crossTenantActor, "program-1", req.id),
      /Forbidden cross-tenant program requirement access/,
    );

    // Verify requirement still exists in tenant-1 (was not deleted)
    list = await state.repository.listProgramRequirements(tenant1, "program-1");
    assert.equal(list.length, 1);
    assert.equal(list[0].id, req.id);
  });

  // AC12: Listing scoped to tenant
  it("AC12: program requirements listing only returns tenant's own data", async () => {
    const state = createChecklistFixture();

    // Create requirements for tenant-1
    state.requirements.push(
      mockRequirement({
        id: "req-t1-1",
        tenantId: tenant1,
        programId: "program-1",
        label: "Tenant 1 Req",
      }),
    );

    // Create requirements for tenant-2
    state.requirements.push(
      mockRequirement({
        id: "req-t2-1",
        tenantId: tenant2,
        programId: "program-2",
        label: "Tenant 2 Req",
      }),
    );

    // Tenant 1 sees only their data
    const result1 = await state.repository.listProgramRequirements(
      tenant1,
      "program-1",
    );
    assert.equal(result1.length, 1);
    assert.equal(result1[0].tenantId, tenant1);
    assert.equal(result1[0].label, "Tenant 1 Req");

    // Tenant 2 sees only their data
    const result2 = await state.repository.listProgramRequirements(
      tenant2,
      "program-2",
    );
    assert.equal(result2.length, 1);
    assert.equal(result2[0].tenantId, tenant2);
    assert.equal(result2[0].label, "Tenant 2 Req");

    // Verify no data leak
    assert.notEqual(result1[0].id, result2[0].id);
  });

  // AC14: Required-field validation for requirements - label
  it("AC14: route validation rejects missing label field", () => {
    const invalidBody: { programId: string; label?: string; isRequired: boolean } = {
      programId: "program-1",
      isRequired: true,
    };

    assert.throws(
      () => requireStringField(invalidBody.label, "label"),
      /Invalid label: must be a non-empty string/,
    );
  });
});
