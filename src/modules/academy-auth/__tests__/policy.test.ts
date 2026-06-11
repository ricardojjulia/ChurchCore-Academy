import assert from "node:assert/strict";
import test from "node:test";
import {
  AcademyActor,
  assertInstitutionConfigAccess,
  assertPlatformStaffWorkspaceAccess,
  canAccessInstitutionConfig,
  canAccessPlatformStaffWorkspace,
} from "@/modules/academy-auth/policy";
import { resolveBootstrapAcademyActor } from "@/modules/academy-auth/request-context";

const institutionAdmin: AcademyActor = {
  userId: "user-admin",
  tenantId: "tenant-a",
  roles: ["institution_admin"],
};

test("allows institution administrators to read, write, and administer same-tenant configuration", () => {
  assert.equal(canAccessInstitutionConfig(institutionAdmin, "tenant-a", "read"), true);
  assert.equal(canAccessInstitutionConfig(institutionAdmin, "tenant-a", "write"), true);
  assert.equal(canAccessInstitutionConfig(institutionAdmin, "tenant-a", "admin"), true);
});

test("allows academic staff to read same-tenant configuration but not write it", () => {
  const registrar: AcademyActor = {
    userId: "user-registrar",
    tenantId: "tenant-a",
    roles: ["registrar"],
  };

  assert.equal(canAccessInstitutionConfig(registrar, "tenant-a", "read"), true);
  assert.equal(canAccessInstitutionConfig(registrar, "tenant-a", "write"), false);
});

test("denies institution configuration access across tenants", () => {
  assert.equal(canAccessInstitutionConfig(institutionAdmin, "tenant-b", "read"), false);
  assert.throws(
    () => assertInstitutionConfigAccess(institutionAdmin, "tenant-b", "read"),
    /Forbidden institution configuration access./,
  );
});

test("denies institution configuration access to non-admin student and guardian roles", () => {
  const student: AcademyActor = {
    userId: "user-student",
    tenantId: "tenant-a",
    roles: ["student"],
  };
  const guardian: AcademyActor = {
    userId: "user-guardian",
    tenantId: "tenant-a",
    roles: ["guardian"],
  };

  assert.equal(canAccessInstitutionConfig(student, "tenant-a", "read"), false);
  assert.equal(canAccessInstitutionConfig(guardian, "tenant-a", "read"), false);
});

test("resolves bootstrap Academy actor from request headers", () => {
  const actor = resolveBootstrapAcademyActor(
    new Headers({
      "x-academy-tenant-id": "tenant-a",
      "x-academy-user-id": "user-student",
      "x-academy-roles": "student,guardian",
    }),
  );

  assert.deepEqual(actor, {
    userId: "user-student",
    tenantId: "tenant-a",
    roles: ["student", "guardian"],
  });
});

test("allows only platform staff/admin roles for platform workspace", () => {
  assert.equal(canAccessPlatformStaffWorkspace(["platform_staff"]), true);
  assert.equal(canAccessPlatformStaffWorkspace(["platform_admin"]), true);
  assert.equal(canAccessPlatformStaffWorkspace(["institution_admin"]), false);

  assert.throws(() => assertPlatformStaffWorkspaceAccess(["student"]), /Forbidden platform staff access./);
});
