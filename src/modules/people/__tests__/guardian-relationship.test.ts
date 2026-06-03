import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import {
  GuardianAccessCategory,
  PeopleConfiguration,
  canGuardianAccessStudentCategory,
  validatePeopleConfiguration,
} from "@/modules/people/validation";

const now = "2026-06-02T00:00:00.000Z";

function configWithRelationship(overrides: Partial<PeopleConfiguration> = {}): PeopleConfiguration {
  const institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-guardian",
    institutionName: "Guardian Academy",
    legalName: "Guardian Academy",
    primaryMode: "childrens_school",
    supportedModes: ["childrens_school"],
    now,
  });

  return {
    institutionProfile,
    people: [
      {
        id: "student-lena",
        tenantId: "tenant-guardian",
        displayName: "Lena Rivera",
        personStatus: "active",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "guardian-marisol",
        tenantId: "tenant-guardian",
        displayName: "Marisol Rivera",
        email: "marisol@example.edu",
        personStatus: "active",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "pickup-contact",
        tenantId: "tenant-guardian",
        displayName: "Theo Rivera",
        personStatus: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    roleAssignments: [
      {
        id: "role-student",
        tenantId: "tenant-guardian",
        personId: "student-lena",
        role: "student",
        scopeType: "tenant",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "role-guardian",
        tenantId: "tenant-guardian",
        personId: "guardian-marisol",
        role: "guardian",
        scopeType: "student",
        scopeId: "student-lena",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    studentProfiles: [
      {
        id: "student-profile-lena",
        tenantId: "tenant-guardian",
        personId: "student-lena",
        studentNumber: "S-2001",
        studentType: "child",
        enrollmentStatus: "active",
        guardianRequired: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    staffProfiles: [],
    relationships: [
      {
        id: "guardian-full",
        tenantId: "tenant-guardian",
        studentPersonId: "student-lena",
        relatedPersonId: "guardian-marisol",
        relationshipType: "guardian",
        authority: "academic_decision",
        visibility: "full_guardian",
        status: "active",
        startsOn: "2026-01-01",
        createdAt: now,
        updatedAt: now,
      },
    ],
    accountLinks: [],
    ...overrides,
  };
}

test("allows full guardians to access guardian-visible student categories only", () => {
  const config = configWithRelationship();

  const categories: GuardianAccessCategory[] = ["directory", "schedule", "documents", "progress", "grades"];
  assert.deepEqual(
    categories.map((category) =>
      canGuardianAccessStudentCategory(config, {
        guardianPersonId: "guardian-marisol",
        studentPersonId: "student-lena",
        category,
        asOf: "2026-06-02",
      }),
    ),
    [true, true, true, true, true],
  );
  assert.equal(
    canGuardianAccessStudentCategory(config, {
      guardianPersonId: "guardian-marisol",
      studentPersonId: "student-lena",
      category: "billing",
      asOf: "2026-06-02",
    }),
    false,
  );
});

test("denies guardian access when the relationship is expired or inactive", () => {
  const config = configWithRelationship({
    relationships: [
      {
        ...configWithRelationship().relationships[0],
        endsOn: "2026-05-01",
      },
    ],
  });

  assert.equal(
    canGuardianAccessStudentCategory(config, {
      guardianPersonId: "guardian-marisol",
      studentPersonId: "student-lena",
      category: "schedule",
      asOf: "2026-06-02",
    }),
    false,
  );
});

test("requires guardian role scope to match the backed student relationship", () => {
  const config = configWithRelationship({
    people: [
      ...configWithRelationship().people,
      {
        id: "student-other",
        tenantId: "tenant-guardian",
        displayName: "Noah Carter",
        personStatus: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
    roleAssignments: configWithRelationship().roleAssignments.map((assignment) =>
      assignment.id === "role-guardian"
        ? {
            ...assignment,
            scopeId: "student-other",
          }
        : assignment,
    ),
  });

  assert.deepEqual(validatePeopleConfiguration(config), ["Guardian role assignment role-guardian must be scoped to the related student relationship."]);
});

test("rejects emergency contacts with guardian-level visibility or authority", () => {
  const config = configWithRelationship({
    relationships: [
      configWithRelationship().relationships[0],
      {
        ...configWithRelationship().relationships[0],
        id: "emergency-overexposed",
        relatedPersonId: "pickup-contact",
        relationshipType: "emergency_contact",
        authority: "academic_decision",
        visibility: "full_guardian",
      },
    ],
  });

  assert.deepEqual(validatePeopleConfiguration(config), [
    "Student relationship emergency-overexposed emergency contacts cannot have academic or registration decision authority.",
    "Student relationship emergency-overexposed contact-only relationships cannot use guardian-level visibility.",
  ]);
});

test("limits pickup contacts to pickup authority and non-academic visibility", () => {
  const config = configWithRelationship({
    relationships: [
      configWithRelationship().relationships[0],
      {
        ...configWithRelationship().relationships[0],
        id: "pickup-overexposed",
        relatedPersonId: "pickup-contact",
        relationshipType: "pickup_contact",
        authority: "academic_decision",
        visibility: "grades",
      },
    ],
  });

  assert.deepEqual(validatePeopleConfiguration(config), [
    "Student relationship pickup-overexposed pickup contacts must use pickup authority or no authority.",
    "Student relationship pickup-overexposed contact-only relationships cannot use guardian-level visibility.",
  ]);
});
