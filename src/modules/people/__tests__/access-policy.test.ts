import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { PeopleConfiguration } from "@/modules/people/types";
import { assertPeopleAccess, canAccessPeopleDomain } from "@/modules/people/access-policy";

const now = "2026-06-02T00:00:00.000Z";

function actor(personId: string, roles: AcademyActor["roles"]): AcademyActor {
  return {
    userId: personId,
    tenantId: "tenant-access",
    roles,
  };
}

function peopleConfig(): PeopleConfiguration {
  return {
    institutionProfile: createInstitutionProfileDefaults({
      tenantId: "tenant-access",
      institutionName: "Access Academy",
      legalName: "Access Academy",
      primaryMode: "childrens_school",
      supportedModes: ["childrens_school", "college"],
      now,
    }),
    people: [
      { id: "admin", tenantId: "tenant-access", displayName: "Admin", personStatus: "active", createdAt: now, updatedAt: now },
      { id: "registrar", tenantId: "tenant-access", displayName: "Registrar", personStatus: "active", createdAt: now, updatedAt: now },
      { id: "teacher", tenantId: "tenant-access", displayName: "Teacher", personStatus: "active", createdAt: now, updatedAt: now },
      { id: "advisor", tenantId: "tenant-access", displayName: "Advisor", personStatus: "active", createdAt: now, updatedAt: now },
      { id: "student", tenantId: "tenant-access", displayName: "Student", personStatus: "active", createdAt: now, updatedAt: now },
      { id: "guardian", tenantId: "tenant-access", displayName: "Guardian", personStatus: "active", createdAt: now, updatedAt: now },
    ],
    roleAssignments: [
      { id: "role-admin", tenantId: "tenant-access", personId: "admin", role: "institution_admin", scopeType: "tenant", status: "active", createdAt: now, updatedAt: now },
      { id: "role-registrar", tenantId: "tenant-access", personId: "registrar", role: "registrar", scopeType: "tenant", status: "active", createdAt: now, updatedAt: now },
      { id: "role-teacher", tenantId: "tenant-access", personId: "teacher", role: "teacher", scopeType: "tenant", status: "active", createdAt: now, updatedAt: now },
      { id: "role-advisor", tenantId: "tenant-access", personId: "advisor", role: "advisor", scopeType: "student", scopeId: "student", status: "active", createdAt: now, updatedAt: now },
      { id: "role-student", tenantId: "tenant-access", personId: "student", role: "student", scopeType: "tenant", status: "active", createdAt: now, updatedAt: now },
      { id: "role-guardian", tenantId: "tenant-access", personId: "guardian", role: "guardian", scopeType: "student", scopeId: "student", status: "active", createdAt: now, updatedAt: now },
    ],
    studentProfiles: [
      {
        id: "student-profile",
        tenantId: "tenant-access",
        personId: "student",
        studentNumber: "S-3001",
        studentType: "child",
        enrollmentStatus: "active",
        guardianRequired: true,
        advisorPersonId: "advisor",
        createdAt: now,
        updatedAt: now,
      },
    ],
    staffProfiles: [
      { id: "teacher-staff", tenantId: "tenant-access", personId: "teacher", staffNumber: "T-3001", title: "Teacher", primaryRole: "teacher", employmentStatus: "active", createdAt: now, updatedAt: now },
    ],
    relationships: [
      {
        id: "guardian-relationship",
        tenantId: "tenant-access",
        studentPersonId: "student",
        relatedPersonId: "guardian",
        relationshipType: "guardian",
        authority: "academic_decision",
        visibility: "full_guardian",
        status: "active",
        startsOn: "2026-01-01",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "teacher-mentor",
        tenantId: "tenant-access",
        studentPersonId: "student",
        relatedPersonId: "teacher",
        relationshipType: "mentor",
        authority: "view_only",
        visibility: "progress",
        status: "active",
        startsOn: "2026-01-01",
        createdAt: now,
        updatedAt: now,
      },
    ],
    accountLinks: [],
  };
}

test("allows institution administrators to administer people in their tenant", () => {
  const config = peopleConfig();

  assert.equal(canAccessPeopleDomain(actor("admin", ["institution_admin"]), config, { action: "admin_people", tenantId: "tenant-access" }), true);
  assert.equal(canAccessPeopleDomain(actor("admin", ["institution_admin"]), config, { action: "write_people", tenantId: "tenant-access" }), true);
});

test("denies people access across tenants before role evaluation", () => {
  const config = peopleConfig();
  const crossTenantActor = { ...actor("admin", ["institution_admin"]), tenantId: "other-tenant" };

  assert.equal(canAccessPeopleDomain(crossTenantActor, config, { action: "read_people", tenantId: "tenant-access" }), false);
  assert.throws(
    () => assertPeopleAccess(crossTenantActor, config, { action: "read_people", tenantId: "tenant-access" }),
    /Forbidden people domain access./,
  );
});

test("requires an active matching person role assignment for staff people access", () => {
  const config = peopleConfig();

  assert.equal(canAccessPeopleDomain(actor("registrar", ["registrar"]), config, { action: "read_people", tenantId: "tenant-access" }), true);
  assert.equal(canAccessPeopleDomain(actor("registrar", ["institution_admin"]), config, { action: "admin_people", tenantId: "tenant-access" }), false);
});

test("allows students to read only their own student record", () => {
  const config = peopleConfig();

  assert.equal(canAccessPeopleDomain(actor("student", ["student"]), config, { action: "read_student", tenantId: "tenant-access", targetPersonId: "student" }), true);
  assert.equal(canAccessPeopleDomain(actor("student", ["student"]), config, { action: "read_student", tenantId: "tenant-access", targetPersonId: "guardian" }), false);
});

test("allows guardians to read only relationship-visible student categories", () => {
  const config = peopleConfig();

  assert.equal(
    canAccessPeopleDomain(actor("guardian", ["guardian"]), config, {
      action: "read_student",
      tenantId: "tenant-access",
      targetPersonId: "student",
      guardianCategory: "schedule",
      asOf: "2026-06-02",
    }),
    true,
  );
  assert.equal(
    canAccessPeopleDomain(actor("guardian", ["guardian"]), config, {
      action: "read_student",
      tenantId: "tenant-access",
      targetPersonId: "student",
      guardianCategory: "billing",
      asOf: "2026-06-02",
    }),
    false,
  );
});

test("allows assigned advisors and instructional staff to read assigned students only", () => {
  const config = peopleConfig();

  assert.equal(canAccessPeopleDomain(actor("advisor", ["advisor"]), config, { action: "read_student", tenantId: "tenant-access", targetPersonId: "student" }), true);
  assert.equal(canAccessPeopleDomain(actor("teacher", ["teacher"]), config, { action: "read_student", tenantId: "tenant-access", targetPersonId: "student" }), true);
  assert.equal(canAccessPeopleDomain(actor("teacher", ["teacher"]), config, { action: "read_student", tenantId: "tenant-access", targetPersonId: "guardian" }), false);
});

test("limits people writes to institution admin and student-record staff roles", () => {
  const config = peopleConfig();

  assert.equal(canAccessPeopleDomain(actor("registrar", ["registrar"]), config, { action: "write_student", tenantId: "tenant-access", targetPersonId: "student" }), true);
  assert.equal(canAccessPeopleDomain(actor("teacher", ["teacher"]), config, { action: "write_student", tenantId: "tenant-access", targetPersonId: "student" }), false);
  assert.equal(canAccessPeopleDomain(actor("registrar", ["registrar"]), config, { action: "write_people", tenantId: "tenant-access" }), false);
});
