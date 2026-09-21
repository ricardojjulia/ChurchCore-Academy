import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DocumentChecklistService,
  ProgramDocumentRequirement,
  CreateProgramRequirementInput,
} from "@/modules/admissions/document-checklist";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { requireStringField } from "@/app/api/academy/api-utils";

/**
 * Acceptance tests for the Admissions Program Document Requirements admin UI feature.
 *
 * User story: Admin UI for program document requirements
 * - Program requirements list/add/delete with in-use protection
 * - Cross-tenant isolation and role-based access control
 */

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
    updateDocumentItemWaiver: async () => {
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
