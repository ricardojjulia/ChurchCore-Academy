import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { InstitutionProfile, LmsSelectionStatus } from "@/modules/academy-config/types";
import { PeopleConfiguration } from "@/modules/people/types";
import { createMoodleLaunchResponse, MoodleLaunchConfiguration } from "../moodle-launch";
import { resolveTenantLmsProvider } from "../tenant-provider-selection";

const now = "2026-06-04T12:00:00.000Z";

function profile(selectionStatus: LmsSelectionStatus = "active"): InstitutionProfile {
  const base = createInstitutionProfileDefaults({
    tenantId: "tenant-moodle-launch",
    institutionName: "Moodle Launch Academy",
    legalName: "Moodle Launch Academy",
    primaryMode: "college",
    lmsProvider: "moodle",
    now,
  });

  return {
    ...base,
    lmsPreference: {
      provider: "moodle",
      selectionStatus,
    },
  };
}

function actor(userId = "student-one", roles: AcademyActor["roles"] = ["student"], tenantId = "tenant-moodle-launch"): AcademyActor {
  return { userId, roles, tenantId };
}

function lmsActor(input: AcademyActor) {
  return {
    personId: input.userId,
    role: input.roles[0],
    auditActorId: `actor:${input.userId}`,
    studentPersonId: input.roles.includes("student") ? input.userId : undefined,
  };
}

function launchConfig(overrides: Partial<MoodleLaunchConfiguration> = {}): MoodleLaunchConfiguration {
  return {
    tenantId: "tenant-moodle-launch",
    launchMode: "oidc",
    launchBaseUrl: "https://moodle.example.edu/auth/oidc/",
    displayLabel: "Moodle",
    expiresInMinutes: 10,
    ...overrides,
  };
}

test("active configured Moodle tenant returns a display-safe launch response", () => {
  const student = actor();
  const resolved = resolveTenantLmsProvider(profile(), {
    tenantId: "tenant-moodle-launch",
    correlationId: "corr-moodle-launch-1",
  });

  const response = createMoodleLaunchResponse({
    resolvedProvider: resolved,
    configuration: launchConfig(),
    request: {
      tenant: resolved.tenant,
      actor: lmsActor(student),
      courseId: "course-101",
      sectionId: "section-101-a",
      targetStudentPersonId: "student-one",
      redirectPath: "/student/lms?course=course-101",
      nonce: "nonce-safe-001",
    },
    now: "2026-06-04T12:00:00.000Z",
  });

  assert.equal(response.status, "available");
  assert.equal(response.displayLabel, "Moodle");
  assert.match(response.launchUrl, /^https:\/\/moodle\.example\.edu\/auth\/oidc\/?\?/);
  assert.match(response.launchUrl, /state=corr-moodle-launch-1%3Anonce-safe-001/);
  assert.match(response.launchUrl, /redirect=%2Fstudent%2Flms%3Fcourse%3Dcourse-101/);
  assert.equal(response.expiresAt, "2026-06-04T12:10:00.000Z");
  assert.equal(response.auditReference, "corr-moodle-launch-1:moodle:identity_launch");

  assert.doesNotMatch(
    JSON.stringify(response),
    /accessToken|refreshToken|clientSecret|sharedSecret|webhookSecret|rawProviderPayload|providerUserId|moodleUserId|secret-token|mdl-user/i,
  );
});

test("Moodle launch is unavailable when configuration is missing or incomplete", () => {
  const resolved = resolveTenantLmsProvider(profile(), {
    tenantId: "tenant-moodle-launch",
    correlationId: "corr-moodle-launch-2",
  });

  const missing = createMoodleLaunchResponse({
    resolvedProvider: resolved,
    configuration: undefined,
    request: {
      tenant: resolved.tenant,
      actor: lmsActor(actor()),
      targetStudentPersonId: "student-one",
      redirectPath: "/student/lms",
      nonce: "nonce-safe-002",
    },
    now,
  });

  const incomplete = createMoodleLaunchResponse({
    resolvedProvider: resolved,
    configuration: launchConfig({ launchBaseUrl: "" }),
    request: {
      tenant: resolved.tenant,
      actor: lmsActor(actor()),
      targetStudentPersonId: "student-one",
      redirectPath: "/student/lms",
      nonce: "nonce-safe-003",
    },
    now,
  });

  assert.deepEqual(missing, {
    status: "unavailable",
    displayLabel: "Moodle",
    unavailableReason: "Moodle launch is not configured for this tenant.",
    auditReference: "corr-moodle-launch-2:moodle:identity_launch",
  });
  assert.deepEqual(incomplete, {
    status: "unavailable",
    displayLabel: "Moodle",
    unavailableReason: "Moodle launch is not configured for this tenant.",
    auditReference: "corr-moodle-launch-2:moodle:identity_launch",
  });
});

test("Moodle launch is gated by tenant provider status", () => {
  for (const [selectionStatus, expectedReason] of [
    ["planned", "Moodle is planned but not active for this tenant."],
    ["paused", "Moodle is paused for this tenant."],
    ["migration_required", "Moodle requires migration review before use."],
  ] as const) {
    const resolved = resolveTenantLmsProvider(profile(selectionStatus), {
      tenantId: "tenant-moodle-launch",
      correlationId: `corr-moodle-launch-${selectionStatus}`,
    });

    const response = createMoodleLaunchResponse({
      resolvedProvider: resolved,
      configuration: launchConfig(),
      request: {
        tenant: resolved.tenant,
        actor: lmsActor(actor()),
        targetStudentPersonId: "student-one",
        redirectPath: "/student/lms",
        nonce: `nonce-${selectionStatus}`,
      },
      now,
    });

    assert.deepEqual(response, {
      status: "unavailable",
      displayLabel: "Moodle",
      unavailableReason: expectedReason,
      auditReference: `${resolved.tenant.correlationId}:moodle:identity_launch`,
    });
  }
});

test("Moodle launch rejects cross-tenant launch configuration", () => {
  const resolved = resolveTenantLmsProvider(profile(), {
    tenantId: "tenant-moodle-launch",
    correlationId: "corr-moodle-launch-4",
  });

  assert.throws(
    () =>
      createMoodleLaunchResponse({
        resolvedProvider: resolved,
        configuration: launchConfig({ tenantId: "other-tenant" }),
        request: {
          tenant: resolved.tenant,
          actor: lmsActor(actor()),
          targetStudentPersonId: "student-one",
          redirectPath: "/student/lms",
          nonce: "nonce-safe-004",
        },
        now,
      }),
    /Cannot create Moodle launch response across tenants./,
  );
});

function peopleConfig(): PeopleConfiguration {
  const institutionProfile = profile();

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
      { id: "profile-one", tenantId: institutionProfile.tenantId, personId: "student-one", studentNumber: "S-1001", studentType: "child", enrollmentStatus: "active", guardianRequired: true, createdAt: now, updatedAt: now },
      { id: "profile-two", tenantId: institutionProfile.tenantId, personId: "student-two", studentNumber: "S-1002", studentType: "adult", enrollmentStatus: "active", guardianRequired: false, createdAt: now, updatedAt: now },
    ],
    staffProfiles: [],
    relationships: [
      { id: "relationship-full", tenantId: institutionProfile.tenantId, studentPersonId: "student-one", relatedPersonId: "guardian-full", relationshipType: "guardian", authority: "academic_decision", visibility: "full_guardian", status: "active", startsOn: "2026-01-01", createdAt: now, updatedAt: now },
    ],
    accountLinks: [
      { id: "unsafe-link", tenantId: institutionProfile.tenantId, personId: "student-one", provider: "moodle", externalSubject: "mdl-user-123", status: "active", credentialSecret: "secret-token", accessToken: "secret-token", refreshToken: "secret-token", createdAt: now, updatedAt: now },
    ],
  };
}

test("student and scoped guardian can create Moodle launch responses without leaking provider secrets", async () => {
  const { createStudentMoodleLaunchResponse } = await import("@/modules/student-pwa/moodle-launch");

  const studentResponse = createStudentMoodleLaunchResponse({
    actor: actor("student-one", ["student"]),
    people: peopleConfig(),
    configuration: launchConfig({
      accessToken: "secret-token",
      clientSecret: "secret-token",
      rawProviderPayload: { moodleUserId: "mdl-user-123" },
    }),
    targetStudentPersonId: "student-one",
    redirectPath: "/student/lms",
    nonce: "nonce-student",
    correlationId: "corr-moodle-student",
    now,
  });
  const guardianResponse = createStudentMoodleLaunchResponse({
    actor: actor("guardian-full", ["guardian"]),
    people: peopleConfig(),
    configuration: launchConfig({
      accessToken: "secret-token",
      clientSecret: "secret-token",
      rawProviderPayload: { moodleUserId: "mdl-user-123" },
    }),
    targetStudentPersonId: "student-one",
    redirectPath: "/student/lms",
    nonce: "nonce-guardian",
    correlationId: "corr-moodle-guardian",
    now,
  });

  assert.equal(studentResponse.status, "available");
  assert.equal(guardianResponse.status, "available");
  assert.doesNotMatch(JSON.stringify([studentResponse, guardianResponse]), /secret-token|mdl-user-123|accessToken|clientSecret|rawProviderPayload/i);
});

test("student Moodle launch bridge rejects unrelated students and cross-tenant actors", async () => {
  const { createStudentMoodleLaunchResponse } = await import("@/modules/student-pwa/moodle-launch");

  assert.throws(
    () =>
      createStudentMoodleLaunchResponse({
        actor: actor("student-two", ["student"]),
        people: peopleConfig(),
        configuration: launchConfig(),
        targetStudentPersonId: "student-one",
        redirectPath: "/student/lms",
        nonce: "nonce-other-student",
        correlationId: "corr-moodle-forbidden-1",
        now,
      }),
    /Forbidden student PWA access./,
  );

  assert.throws(
    () =>
      createStudentMoodleLaunchResponse({
        actor: actor("student-one", ["student"], "other-tenant"),
        people: peopleConfig(),
        configuration: launchConfig(),
        targetStudentPersonId: "student-one",
        redirectPath: "/student/lms",
        nonce: "nonce-cross-tenant",
        correlationId: "corr-moodle-forbidden-2",
        now,
      }),
    /Forbidden student PWA access./,
  );
});
