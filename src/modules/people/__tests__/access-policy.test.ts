import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { canAccessPeopleDomain } from "../access-policy";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { PeopleConfiguration } from "../types";

function createMockConfig(tenantId: string): PeopleConfiguration {
  return {
    institutionProfile: {
      tenantId,
      institutionName: "Test Institution",
      legalName: "Test Institution Legal",
      primaryMode: "bible_school",
      supportedModes: ["bible_school"],
      operatingRules: {
        usesSubdivisions: false,
        usesGuardians: true,
        usesAdvisors: true,
        usesCohorts: false,
      },
      capabilities: {
        academicCalendar: true,
        courseCatalog: true,
        grading: true,
        studentPwa: false,
        lmsIntegration: false,
        covenantRecords: false,
      },
      lmsPreference: "none",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    people: [],
    roleAssignments: [],
    studentProfiles: [],
    staffProfiles: [],
    relationships: [],
    accountLinks: [],
  };
}

describe("PeopleAccessPolicy - New Actions", () => {
  const tenantId = "tenant-123";

  test("write_person: institution_admin can access", () => {
    const actor: AcademyActor = {
      userId: "user-1",
      tenantId,
      roles: ["institution_admin"],
    };

    const config = createMockConfig(tenantId);
    config.roleAssignments.push({
      id: "role-1",
      tenantId,
      personId: "user-1",
      role: "institution_admin",
      scopeType: "tenant",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    assert.strictEqual(
      canAccessPeopleDomain(actor, config, { action: "write_person", tenantId }),
      true
    );
  });

  test("write_person: registrar can access", () => {
    const actor: AcademyActor = {
      userId: "user-1",
      tenantId,
      roles: ["registrar"],
    };

    const config = createMockConfig(tenantId);
    config.roleAssignments.push({
      id: "role-1",
      tenantId,
      personId: "user-1",
      role: "registrar",
      scopeType: "tenant",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    assert.strictEqual(
      canAccessPeopleDomain(actor, config, { action: "write_person", tenantId }),
      true
    );
  });

  test("write_person: dean cannot access", () => {
    const actor: AcademyActor = {
      userId: "user-1",
      tenantId,
      roles: ["dean"],
    };

    const config = createMockConfig(tenantId);
    config.roleAssignments.push({
      id: "role-1",
      tenantId,
      personId: "user-1",
      role: "dean",
      scopeType: "tenant",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    assert.strictEqual(
      canAccessPeopleDomain(actor, config, { action: "write_person", tenantId }),
      false
    );
  });

  test("write_staff: institution_admin can access", () => {
    const actor: AcademyActor = {
      userId: "user-1",
      tenantId,
      roles: ["institution_admin"],
    };

    const config = createMockConfig(tenantId);
    config.roleAssignments.push({
      id: "role-1",
      tenantId,
      personId: "user-1",
      role: "institution_admin",
      scopeType: "tenant",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    assert.strictEqual(
      canAccessPeopleDomain(actor, config, { action: "write_staff", tenantId }),
      true
    );
  });

  test("write_staff: dean can access", () => {
    const actor: AcademyActor = {
      userId: "user-1",
      tenantId,
      roles: ["dean"],
    };

    const config = createMockConfig(tenantId);
    config.roleAssignments.push({
      id: "role-1",
      tenantId,
      personId: "user-1",
      role: "dean",
      scopeType: "tenant",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    assert.strictEqual(
      canAccessPeopleDomain(actor, config, { action: "write_staff", tenantId }),
      true
    );
  });

  test("write_staff: registrar cannot access", () => {
    const actor: AcademyActor = {
      userId: "user-1",
      tenantId,
      roles: ["registrar"],
    };

    const config = createMockConfig(tenantId);
    config.roleAssignments.push({
      id: "role-1",
      tenantId,
      personId: "user-1",
      role: "registrar",
      scopeType: "tenant",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    assert.strictEqual(
      canAccessPeopleDomain(actor, config, { action: "write_staff", tenantId }),
      false
    );
  });

  test("cross-tenant: always returns false", () => {
    const actor: AcademyActor = {
      userId: "user-1",
      tenantId: "tenant-other",
      roles: ["institution_admin"],
    };

    const config = createMockConfig(tenantId);
    config.roleAssignments.push({
      id: "role-1",
      tenantId,
      personId: "user-1",
      role: "institution_admin",
      scopeType: "tenant",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    assert.strictEqual(
      canAccessPeopleDomain(actor, config, { action: "write_person", tenantId }),
      false
    );
  });
});
