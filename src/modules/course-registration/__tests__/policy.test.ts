import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import {
  assertCourseRegistrationAccess,
  canManageCourseRegistration,
} from "@/modules/course-registration/policy";

const registrar: AcademyActor = {
  userId: "user-registrar",
  tenantId: "tenant-a",
  roles: ["registrar"],
};

test("registrar can manage same-tenant course registration", () => {
  assert.equal(canManageCourseRegistration(registrar, "tenant-a"), true);
  assert.doesNotThrow(() =>
    assertCourseRegistrationAccess(registrar, "tenant-a"),
  );
});

test("cross-tenant actors are denied", () => {
  assert.equal(canManageCourseRegistration(registrar, "tenant-b"), false);
  assert.throws(
    () => assertCourseRegistrationAccess(registrar, "tenant-b"),
    /Forbidden course registration access/,
  );
});

test("student cannot manage course registration", () => {
  const student: AcademyActor = {
    userId: "user-student",
    tenantId: "tenant-a",
    roles: ["student"],
  };

  assert.equal(canManageCourseRegistration(student, "tenant-a"), false);
});
