import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import {
  assertEnrollmentConversionAccess,
  canAccessEnrollmentConversion,
} from "@/modules/enrollment-conversion/policy";

function actor(
  role: AcademyRole,
  tenantId = "tenant-1",
): AcademyActor {
  return {
    userId: `person-${role}`,
    tenantId,
    roles: [role],
  };
}

test("institution admins, registrars, and admissions staff can convert in their tenant", () => {
  for (const role of [
    "institution_admin",
    "registrar",
    "admissions",
  ] as const) {
    assert.equal(
      canAccessEnrollmentConversion(actor(role), "tenant-1"),
      true,
    );
  }
});

test("deans, faculty, students, and applicants cannot convert applications", () => {
  for (const role of [
    "dean",
    "faculty",
    "student",
    "applicant",
  ] as const) {
    assert.throws(
      () => assertEnrollmentConversionAccess(actor(role), "tenant-1"),
      /Forbidden enrollment conversion access/,
    );
  }
});

test("cross-tenant actors cannot convert applications", () => {
  assert.equal(
    canAccessEnrollmentConversion(actor("registrar"), "tenant-2"),
    false,
  );
});

test("an actor with any authorized verified role can convert", () => {
  const multiRoleActor: AcademyActor = {
    userId: "person-1",
    tenantId: "tenant-1",
    roles: ["faculty", "registrar"],
  };

  assert.doesNotThrow(() =>
    assertEnrollmentConversionAccess(multiRoleActor, "tenant-1"),
  );
});
