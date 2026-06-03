import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { PeopleConfiguration, validatePeopleConfiguration } from "@/modules/people/validation";

const now = "2026-06-02T00:00:00.000Z";

function baseConfig(overrides: Partial<PeopleConfiguration> = {}): PeopleConfiguration {
  const institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-people",
    institutionName: "People Academy",
    legalName: "People Academy",
    primaryMode: "childrens_school",
    supportedModes: ["childrens_school", "bible_school"],
    now,
  });

  return {
    institutionProfile,
    people: [
      {
        id: "person-student-child",
        tenantId: "tenant-people",
        displayName: "Lena Rivera",
        givenName: "Lena",
        familyName: "Rivera",
        personStatus: "active",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "person-guardian",
        tenantId: "tenant-people",
        displayName: "Marisol Rivera",
        givenName: "Marisol",
        familyName: "Rivera",
        email: "marisol@example.edu",
        personStatus: "active",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "person-teacher",
        tenantId: "tenant-people",
        displayName: "Jonah Wells",
        givenName: "Jonah",
        familyName: "Wells",
        email: "jonah@example.edu",
        personStatus: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    roleAssignments: [
      {
        id: "role-student",
        tenantId: "tenant-people",
        personId: "person-student-child",
        role: "student",
        scopeType: "tenant",
        status: "active",
        startsOn: "2026-01-01",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "role-guardian",
        tenantId: "tenant-people",
        personId: "person-guardian",
        role: "guardian",
        scopeType: "student",
        scopeId: "person-student-child",
        status: "active",
        startsOn: "2026-01-01",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "role-teacher",
        tenantId: "tenant-people",
        personId: "person-teacher",
        role: "teacher",
        scopeType: "tenant",
        status: "active",
        startsOn: "2026-01-01",
        createdAt: now,
        updatedAt: now,
      },
    ],
    studentProfiles: [
      {
        id: "student-profile-child",
        tenantId: "tenant-people",
        personId: "person-student-child",
        studentNumber: "S-1001",
        studentType: "child",
        enrollmentStatus: "active",
        guardianRequired: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    staffProfiles: [
      {
        id: "staff-teacher",
        tenantId: "tenant-people",
        personId: "person-teacher",
        staffNumber: "T-1001",
        title: "K-5 Teacher",
        primaryRole: "teacher",
        employmentStatus: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    relationships: [
      {
        id: "relationship-guardian",
        tenantId: "tenant-people",
        studentPersonId: "person-student-child",
        relatedPersonId: "person-guardian",
        relationshipType: "guardian",
        authority: "academic_decision",
        visibility: "full_guardian",
        status: "active",
        startsOn: "2026-01-01",
        createdAt: now,
        updatedAt: now,
      },
    ],
    accountLinks: [
      {
        id: "account-guardian",
        tenantId: "tenant-people",
        personId: "person-guardian",
        provider: "supabase_auth",
        externalSubject: "auth-guardian",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    ...overrides,
  };
}

test("accepts a children's school student with guardian relationship and teacher staff profile", () => {
  assert.deepEqual(validatePeopleConfiguration(baseConfig()), []);
});

test("rejects cross-tenant people domain references", () => {
  const config = baseConfig({
    roleAssignments: [
      {
        ...baseConfig().roleAssignments[0],
        tenantId: "other-tenant",
      },
    ],
    relationships: [
      {
        ...baseConfig().relationships[0],
        tenantId: "other-tenant",
      },
    ],
  });

  const errors = validatePeopleConfiguration(config);

  assert.match(errors.join("\n"), /Role assignment role-student tenant must match the institution tenant/);
  assert.match(errors.join("\n"), /Student relationship relationship-guardian tenant must match the institution tenant/);
});

test("requires student profiles to have a matching active student role", () => {
  const config = baseConfig({
    roleAssignments: baseConfig().roleAssignments.filter((assignment) => assignment.id !== "role-student"),
  });

  assert.deepEqual(validatePeopleConfiguration(config), ["Student profile student-profile-child must have an active student role assignment."]);
});

test("requires child students to have an active guardian relationship when guardians are required", () => {
  const config = baseConfig({
    relationships: [],
  });

  assert.deepEqual(validatePeopleConfiguration(config), [
    "Guardian role assignment role-guardian must be student-scoped and backed by an active student relationship.",
    "Child student profile student-profile-child must have an active guardian relationship.",
  ]);
});

test("rejects guardian tenant-wide student visibility without a student-scoped relationship", () => {
  const config = baseConfig({
    roleAssignments: baseConfig().roleAssignments.map((assignment) =>
      assignment.id === "role-guardian"
        ? {
            ...assignment,
            scopeType: "tenant",
            scopeId: undefined,
          }
        : assignment,
    ),
  });

  assert.deepEqual(validatePeopleConfiguration(config), ["Guardian role assignment role-guardian must be student-scoped and backed by an active student relationship."]);
});

test("requires instructional staff profiles to have active instructional roles", () => {
  const config = baseConfig({
    roleAssignments: baseConfig().roleAssignments.filter((assignment) => assignment.id !== "role-teacher"),
  });

  assert.deepEqual(validatePeopleConfiguration(config), ["Staff profile staff-teacher must have an active role assignment for teacher."]);
});

test("requires advisors to reference advisor-capable people", () => {
  const config = baseConfig({
    studentProfiles: [
      {
        ...baseConfig().studentProfiles[0],
        advisorPersonId: "person-guardian",
      },
    ],
  });

  assert.deepEqual(validatePeopleConfiguration(config), ["Student profile student-profile-child advisor must have an active advisor-capable role."]);
});

test("rejects account links that carry provider secrets", () => {
  const config = baseConfig({
    accountLinks: [
      {
        ...baseConfig().accountLinks[0],
        credentialSecret: "not-allowed",
      },
    ],
  });

  assert.deepEqual(validatePeopleConfiguration(config), ["Account link account-guardian must not store provider secrets or tokens."]);
});
