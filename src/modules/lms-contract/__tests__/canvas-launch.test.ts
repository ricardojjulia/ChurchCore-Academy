import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { InstitutionProfile, LmsSelectionStatus } from "@/modules/academy-config/types";
import { PeopleConfiguration } from "@/modules/people/types";
import { createCanvasLaunchResponse, CanvasLaunchConfiguration } from "../canvas-launch";
import { resolveTenantLmsProvider } from "../tenant-provider-selection";

const now = "2026-06-11T12:00:00.000Z";

function profile(selectionStatus: LmsSelectionStatus = "active"): InstitutionProfile {
  const base = createInstitutionProfileDefaults({
    tenantId: "tenant-canvas-launch",
    institutionName: "Canvas Launch Academy",
    legalName: "Canvas Launch Academy",
    primaryMode: "college",
    lmsProvider: "canvas",
    now,
  });

  return {
    ...base,
    lmsPreference: {
      provider: "canvas",
      selectionStatus,
    },
  };
}

function actor(userId = "student-one", roles: AcademyActor["roles"] = ["student"], tenantId = "tenant-canvas-launch"): AcademyActor {
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

function launchConfig(overrides: Partial<CanvasLaunchConfiguration> = {}): CanvasLaunchConfiguration {
  return {
    tenantId: "tenant-canvas-launch",
    launchMode: "oauth2",
    launchBaseUrl: "https://canvas.example.edu/login/oauth2/auth",
    displayLabel: "Canvas",
    expiresInMinutes: 10,
    ...overrides,
  };
}

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
      { id: "profile-one", tenantId: institutionProfile.tenantId, personId: "student-one", studentNumber: "S-2001", studentType: "child", enrollmentStatus: "active", guardianRequired: true, createdAt: now, updatedAt: now },
      { id: "profile-two", tenantId: institutionProfile.tenantId, personId: "student-two", studentNumber: "S-2002", studentType: "adult", enrollmentStatus: "active", guardianRequired: false, createdAt: now, updatedAt: now },
    ],
    staffProfiles: [],
    relationships: [
      { id: "relationship-full", tenantId: institutionProfile.tenantId, studentPersonId: "student-one", relatedPersonId: "guardian-full", relationshipType: "guardian", authority: "academic_decision", visibility: "full_guardian", status: "active", startsOn: "2026-01-01", createdAt: now, updatedAt: now },
    ],
    accountLinks: [
      { id: "unsafe-link", tenantId: institutionProfile.tenantId, personId: "student-one", provider: "canvas", externalSubject: "canvas-user-123", status: "active", credentialSecret: "secret-token", accessToken: "secret-token", refreshToken: "secret-token", createdAt: now, updatedAt: now },
    ],
  };
}

test("active configured Canvas tenant returns a display-safe launch response", () => {
  const student = actor();
  const resolved = resolveTenantLmsProvider(profile(), {
    tenantId: "tenant-canvas-launch",
    correlationId: "corr-canvas-launch-1",
  });

  const response = createCanvasLaunchResponse({
    resolvedProvider: resolved,
    configuration: launchConfig(),
    request: {
      tenant: resolved.tenant,
      actor: lmsActor(student),
      courseId: "course-201",
      sectionId: "section-201-a",
      targetStudentPersonId: "student-one",
      redirectPath: "/student/lms?course=course-201",
      nonce: "nonce-safe-001",
    },
    now,
  });

  assert.equal(response.status, "available");
  assert.equal(response.displayLabel, "Canvas");
  assert.match(response.launchUrl, /^https:\/\/canvas\.example\.edu\/login\/oauth2\/auth\?/);
  assert.match(response.launchUrl, /state=corr-canvas-launch-1%3Anonce-safe-001/);
  assert.equal(response.expiresAt, "2026-06-11T12:10:00.000Z");
  assert.equal(response.auditReference, "corr-canvas-launch-1:canvas:identity_launch");

  assert.doesNotMatch(
    JSON.stringify(response),
    /accessToken|refreshToken|clientSecret|sharedSecret|webhookSecret|rawProviderPayload|secret-token|canvas-user/i,
  );
});

test("Canvas launch is unavailable when configuration is missing or incomplete", () => {
  const resolved = resolveTenantLmsProvider(profile(), {
    tenantId: "tenant-canvas-launch",
    correlationId: "corr-canvas-launch-2",
  });

  const missing = createCanvasLaunchResponse({
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

  const incomplete = createCanvasLaunchResponse({
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
    displayLabel: "Canvas",
    unavailableReason: "Canvas launch is not configured for this tenant.",
    auditReference: "corr-canvas-launch-2:canvas:identity_launch",
  });
  assert.deepEqual(incomplete, {
    status: "unavailable",
    displayLabel: "Canvas",
    unavailableReason: "Canvas launch is not configured for this tenant.",
    auditReference: "corr-canvas-launch-2:canvas:identity_launch",
  });
});

test("Canvas launch is gated by tenant provider status", () => {
  for (const [selectionStatus, expectedReason] of [
    ["planned", "Canvas is planned but not active for this tenant."],
    ["paused", "Canvas is paused for this tenant."],
    ["migration_required", "Canvas requires migration review before use."],
  ] as const) {
    const resolved = resolveTenantLmsProvider(profile(selectionStatus), {
      tenantId: "tenant-canvas-launch",
      correlationId: `corr-canvas-launch-${selectionStatus}`,
    });

    const response = createCanvasLaunchResponse({
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
      displayLabel: "Canvas",
      unavailableReason: expectedReason,
      auditReference: `${resolved.tenant.correlationId}:canvas:identity_launch`,
    });
  }
});

test("Canvas launch returns safe unavailable reasons for credential circuit and mapping states", () => {
  const resolved = resolveTenantLmsProvider(profile(), {
    tenantId: "tenant-canvas-launch",
    correlationId: "corr-canvas-launch-readiness",
  });
  const request = {
    tenant: resolved.tenant,
    actor: lmsActor(actor()),
    courseId: "course-201",
    sectionId: "section-201-a",
    targetStudentPersonId: "student-one",
    redirectPath: "/student/lms",
    nonce: "nonce-readiness",
  };

  assert.equal(
    createCanvasLaunchResponse({
      resolvedProvider: resolved,
      configuration: launchConfig({ credentialStatus: "invalid" }),
      request,
      now,
    }).unavailableReason,
    "Canvas credentials need administrator review before launch.",
  );
  assert.equal(
    createCanvasLaunchResponse({
      resolvedProvider: resolved,
      configuration: launchConfig({ circuitState: "open" }),
      request,
      now,
    }).unavailableReason,
    "Canvas is temporarily paused while provider health recovers.",
  );
  assert.equal(
    createCanvasLaunchResponse({
      resolvedProvider: resolved,
      configuration: launchConfig({ mappedCourseIds: ["course-other"], mappedSectionIds: ["section-other"] }),
      request,
      now,
    }).unavailableReason,
    "Canvas course mapping is missing for this launch.",
  );
});

test("Canvas launch rejects cross-tenant launch configuration", () => {
  const resolved = resolveTenantLmsProvider(profile(), {
    tenantId: "tenant-canvas-launch",
    correlationId: "corr-canvas-launch-4",
  });

  assert.throws(
    () =>
      createCanvasLaunchResponse({
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
    /Cannot create Canvas launch response across tenants./,
  );
});

test("student and scoped guardian can create Canvas launch responses without leaking provider secrets", async () => {
  const { createStudentCanvasLaunchResponse } = await import("@/modules/student-pwa/canvas-launch");

  const studentResponse = createStudentCanvasLaunchResponse({
    actor: actor("student-one", ["student"]),
    people: peopleConfig(),
    configuration: launchConfig({
      accessToken: "secret-token",
      clientSecret: "secret-token",
      rawProviderPayload: { canvasUserId: "canvas-user-123" },
    }),
    targetStudentPersonId: "student-one",
    redirectPath: "/student/lms",
    nonce: "nonce-student",
    correlationId: "corr-canvas-student",
    now,
  });
  const guardianResponse = createStudentCanvasLaunchResponse({
    actor: actor("guardian-full", ["guardian"]),
    people: peopleConfig(),
    configuration: launchConfig({
      accessToken: "secret-token",
      clientSecret: "secret-token",
      rawProviderPayload: { canvasUserId: "canvas-user-123" },
    }),
    targetStudentPersonId: "student-one",
    redirectPath: "/student/lms",
    nonce: "nonce-guardian",
    correlationId: "corr-canvas-guardian",
    now,
  });

  assert.equal(studentResponse.status, "available");
  assert.equal(guardianResponse.status, "available");
  assert.doesNotMatch(JSON.stringify([studentResponse, guardianResponse]), /secret-token|canvas-user-123|accessToken|clientSecret|rawProviderPayload/i);
});

test("student Canvas launch bridge rejects unrelated students and cross-tenant actors", async () => {
  const { createStudentCanvasLaunchResponse } = await import("@/modules/student-pwa/canvas-launch");

  assert.throws(
    () =>
      createStudentCanvasLaunchResponse({
        actor: actor("student-two", ["student"]),
        people: peopleConfig(),
        configuration: launchConfig(),
        targetStudentPersonId: "student-one",
        redirectPath: "/student/lms",
        nonce: "nonce-other-student",
        correlationId: "corr-canvas-forbidden-1",
        now,
      }),
    /Forbidden student PWA access./,
  );

  assert.throws(
    () =>
      createStudentCanvasLaunchResponse({
        actor: actor("student-one", ["student"], "other-tenant"),
        people: peopleConfig(),
        configuration: launchConfig(),
        targetStudentPersonId: "student-one",
        redirectPath: "/student/lms",
        nonce: "nonce-cross-tenant",
        correlationId: "corr-canvas-forbidden-2",
        now,
      }),
    /Forbidden student PWA access./,
  );
});
