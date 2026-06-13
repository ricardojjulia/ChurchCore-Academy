import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAdmissionsAccess,
  canAccessAdmissions,
} from "@/modules/admissions/policy";
import { AcademyActor } from "@/modules/academy-auth/policy";

const applicant: AcademyActor = {
  userId: "person-applicant",
  tenantId: "tenant-1",
  roles: ["student"],
};

const admissionsStaff: AcademyActor = {
  userId: "person-staff",
  tenantId: "tenant-1",
  roles: ["admissions"],
};

test("applicants can read and submit only their own application", () => {
  assert.equal(
    canAccessAdmissions(
      applicant,
      "tenant-1",
      "person-applicant",
      "read",
    ),
    true,
  );
  assert.equal(
    canAccessAdmissions(
      applicant,
      "tenant-1",
      "person-other",
      "submit",
    ),
    false,
  );
});

test("admissions staff can read and decide same-tenant applications", () => {
  assert.equal(
    canAccessAdmissions(
      admissionsStaff,
      "tenant-1",
      "person-applicant",
      "review",
    ),
    true,
  );
  assert.equal(
    canAccessAdmissions(
      admissionsStaff,
      "tenant-1",
      "person-applicant",
      "decide",
    ),
    true,
  );
});

test("students, guardians, and faculty cannot decide applications", () => {
  for (const role of ["student", "guardian", "faculty"] as const) {
    assert.throws(
      () =>
        assertAdmissionsAccess(
          {
            userId: `person-${role}`,
            tenantId: "tenant-1",
            roles: [role],
          },
          "tenant-1",
          "person-applicant",
          "decide",
        ),
      /Forbidden admissions access/,
    );
  }
});

test("cross-tenant actors are denied", () => {
  assert.equal(
    canAccessAdmissions(
      admissionsStaff,
      "tenant-2",
      "person-applicant",
      "read",
    ),
    false,
  );
});
