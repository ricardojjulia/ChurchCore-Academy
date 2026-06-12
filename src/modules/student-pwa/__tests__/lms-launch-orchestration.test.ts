import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { InstitutionProfile, LmsProvider } from "@/modules/academy-config/types";
import { PeopleConfiguration } from "@/modules/people/types";
import { createStudentLmsLaunchResponse } from "../lms-launch-orchestration";

const now = "2026-06-12T18:00:00.000Z";

function profile(provider: LmsProvider): InstitutionProfile {
  const base = createInstitutionProfileDefaults({
    tenantId: "tenant-student-launch",
    institutionName: "Student Launch Academy",
    legalName: "Student Launch Academy",
    primaryMode: "college",
    lmsProvider: provider,
    now,
  });

  return {
    ...base,
    lmsPreference: {
      provider,
      selectionStatus: provider === "none" ? "not_needed" : "active",
    },
  };
}

function actor(userId = "student-one", roles: AcademyActor["roles"] = ["student"], tenantId = "tenant-student-launch"): AcademyActor {
  return { userId, roles, tenantId };
}

function peopleConfig(provider: LmsProvider): PeopleConfiguration {
  const institutionProfile = profile(provider);

  return {
    institutionProfile,
    people: [
      { id: "student-one", tenantId: institutionProfile.tenantId, displayName: "Lena Rivera", personStatus: "active", createdAt: now, updatedAt: now },
      { id: "student-two", tenantId: institutionProfile.tenantId, displayName: "Noah Carter", personStatus: "active", createdAt: now, updatedAt: now },
      { id: "guardian-full", tenantId: institutionProfile.tenantId, displayName: "Marisol Rivera", personStatus: "active", createdAt: now, updatedAt: now },
    ],
    roleAssignments: [
      { id: "role-student-one", tenantId: institutionProfile.tenantId, personId: "student-one", role: "student", scopeType: "tenant", status: "active", createdAt: now, updatedAt: now },
      { id: "role-student-two", tenantId: institutionProfile.tenantId, personId: "student-two", role: "student", scopeType: "tenant", status: "active", createdAt: now, updatedAt: now },
      { id: "role-guardian-full", tenantId: institutionProfile.tenantId, personId: "guardian-full", role: "guardian", scopeType: "student", scopeId: "student-one", status: "active", createdAt: now, updatedAt: now },
    ],
    studentProfiles: [
      { id: "profile-one", tenantId: institutionProfile.tenantId, personId: "student-one", studentNumber: "S-3001", studentType: "child", enrollmentStatus: "active", guardianRequired: true, createdAt: now, updatedAt: now },
      { id: "profile-two", tenantId: institutionProfile.tenantId, personId: "student-two", studentNumber: "S-3002", studentType: "adult", enrollmentStatus: "active", guardianRequired: false, createdAt: now, updatedAt: now },
    ],
    staffProfiles: [],
    relationships: [
      { id: "relationship-full", tenantId: institutionProfile.tenantId, studentPersonId: "student-one", relatedPersonId: "guardian-full", relationshipType: "guardian", authority: "academic_decision", visibility: "full_guardian", status: "active", startsOn: "2026-01-01", createdAt: now, updatedAt: now },
    ],
    accountLinks: [],
  };
}

test("routes student launch through Canvas bridge for Canvas tenants", () => {
  const launch = createStudentLmsLaunchResponse({
    actor: actor("student-one", ["student"]),
    people: peopleConfig("canvas"),
    canvasConfiguration: {
      tenantId: "tenant-student-launch",
      launchMode: "oauth2",
      launchBaseUrl: "https://canvas.example.edu/login/oauth2/auth",
      displayLabel: "Canvas",
    },
    targetStudentPersonId: "student-one",
    redirectPath: "/student/lms",
    nonce: "nonce-canvas",
    correlationId: "corr-student-canvas",
    now,
  });

  assert.equal(launch.status, "available");
  assert.equal(launch.displayLabel, "Canvas");
  assert.match(launch.auditReference, /:canvas:identity_launch$/);
  assert.match(launch.launchUrl, /^https:\/\/canvas\.example\.edu/);
});

test("routes student launch through Moodle bridge for Moodle tenants", () => {
  const launch = createStudentLmsLaunchResponse({
    actor: actor("student-one", ["student"]),
    people: peopleConfig("moodle"),
    moodleConfiguration: {
      tenantId: "tenant-student-launch",
      launchMode: "oidc",
      launchBaseUrl: "https://moodle.example.edu/auth/oidc/",
      displayLabel: "Moodle",
    },
    targetStudentPersonId: "student-one",
    redirectPath: "/student/lms",
    nonce: "nonce-moodle",
    correlationId: "corr-student-moodle",
    now,
  });

  assert.equal(launch.status, "available");
  assert.equal(launch.displayLabel, "Moodle");
  assert.match(launch.auditReference, /:moodle:identity_launch$/);
  assert.match(launch.launchUrl, /^https:\/\/moodle\.example\.edu/);
});

test("returns explicit unavailable launch for no-LMS tenants", () => {
  const launch = createStudentLmsLaunchResponse({
    actor: actor("student-one", ["student"]),
    people: peopleConfig("none"),
    targetStudentPersonId: "student-one",
    redirectPath: "/student/lms",
    nonce: "nonce-none",
    correlationId: "corr-student-none",
    now,
  });

  assert.deepEqual(launch, {
    status: "unavailable",
    displayLabel: "Learning",
    unavailableReason: "This institution has not enabled an external LMS.",
    auditReference: "corr-student-none:none:identity_launch",
  });
});

test("forbidden actors are blocked before provider handling", () => {
  assert.throws(
    () =>
      createStudentLmsLaunchResponse({
        actor: actor("student-two", ["student"]),
        people: peopleConfig("canvas"),
        canvasConfiguration: {
          tenantId: "tenant-student-launch",
          launchMode: "oauth2",
          launchBaseUrl: "https://canvas.example.edu/login/oauth2/auth",
          displayLabel: "Canvas",
        },
        targetStudentPersonId: "student-one",
        redirectPath: "/student/lms",
        nonce: "nonce-forbidden-student",
        correlationId: "corr-student-forbidden-1",
        now,
      }),
    /Forbidden student PWA access./,
  );

  assert.throws(
    () =>
      createStudentLmsLaunchResponse({
        actor: actor("student-one", ["student"], "other-tenant"),
        people: peopleConfig("moodle"),
        moodleConfiguration: {
          tenantId: "tenant-student-launch",
          launchMode: "oidc",
          launchBaseUrl: "https://moodle.example.edu/auth/oidc/",
          displayLabel: "Moodle",
        },
        targetStudentPersonId: "student-one",
        redirectPath: "/student/lms",
        nonce: "nonce-forbidden-tenant",
        correlationId: "corr-student-forbidden-2",
        now,
      }),
    /Forbidden student PWA access./,
  );
});
