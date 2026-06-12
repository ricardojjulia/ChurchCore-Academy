import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { LmsProvider } from "@/modules/academy-config/types";
import { PeopleConfiguration } from "@/modules/people/types";
import { launchStudentLmsRequest } from "./route";

const now = "2026-06-12T19:00:00.000Z";

function peopleConfig(provider: LmsProvider): PeopleConfiguration {
  const institutionProfile = createInstitutionProfileDefaults({
    tenantId: "tenant-student-launch",
    institutionName: "Student Launch Academy",
    legalName: "Student Launch Academy",
    primaryMode: "college",
    lmsProvider: provider,
    now,
  });

  return {
    institutionProfile: {
      ...institutionProfile,
      lmsPreference: {
        provider,
        selectionStatus: provider === "none" ? "not_needed" : "active",
      },
    },
    people: [
      { id: "student-one", tenantId: institutionProfile.tenantId, displayName: "Lena Rivera", personStatus: "active", createdAt: now, updatedAt: now },
      { id: "student-two", tenantId: institutionProfile.tenantId, displayName: "Noah Carter", personStatus: "active", createdAt: now, updatedAt: now },
    ],
    roleAssignments: [
      { id: "role-student-one", tenantId: institutionProfile.tenantId, personId: "student-one", role: "student", scopeType: "tenant", status: "active", createdAt: now, updatedAt: now },
      { id: "role-student-two", tenantId: institutionProfile.tenantId, personId: "student-two", role: "student", scopeType: "tenant", status: "active", createdAt: now, updatedAt: now },
    ],
    studentProfiles: [
      { id: "profile-one", tenantId: institutionProfile.tenantId, personId: "student-one", studentNumber: "S-4001", studentType: "adult", enrollmentStatus: "active", guardianRequired: false, createdAt: now, updatedAt: now },
      { id: "profile-two", tenantId: institutionProfile.tenantId, personId: "student-two", studentNumber: "S-4002", studentType: "adult", enrollmentStatus: "active", guardianRequired: false, createdAt: now, updatedAt: now },
    ],
    staffProfiles: [],
    relationships: [],
    accountLinks: [],
  };
}

test("route resolves student actor from bootstrap headers when no Supabase session is available", async () => {
  const request = new Request("http://localhost/api/academy/student/lms/launch", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-academy-user-id": "student-one",
      "x-academy-tenant-id": "tenant-student-launch",
      "x-academy-roles": "student",
    },
    body: JSON.stringify({
      targetStudentPersonId: "student-one",
      redirectPath: "/student/lms",
    }),
  });

  const response = await launchStudentLmsRequest(request, {
    fetchPeopleConfiguration: async () => peopleConfig("none"),
  });
  const body = (await response.json()) as {
    launch: {
      status: string;
      displayLabel: string;
      unavailableReason?: string;
      auditReference: string;
    };
  };

  assert.equal(response.status, 200);
  assert.equal(body.launch.status, "unavailable");
  assert.equal(body.launch.displayLabel, "Learning");
  assert.match(body.launch.auditReference, /:none:identity_launch$/);
});

test("non-student actor is rejected by access policy enforcement", async () => {
  const request = new Request("http://localhost/api/academy/student/lms/launch", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-academy-user-id": "local-academy-admin",
      "x-academy-tenant-id": "tenant-student-launch",
      "x-academy-roles": "institution_admin",
    },
    body: JSON.stringify({
      targetStudentPersonId: "student-one",
      redirectPath: "/student/lms",
    }),
  });

  const response = await launchStudentLmsRequest(request, {
    fetchPeopleConfiguration: async () => peopleConfig("none"),
  });
  const body = (await response.json()) as { error: string };

  assert.equal(response.status, 403);
  assert.match(body.error, /Forbidden student PWA access./);
});

test("route returns available launch for Canvas tenant when launch config env is present", async () => {
  process.env.CANVAS_LAUNCH_BASE_URL = "https://canvas.example.edu/login/oauth2/auth";
  process.env.CANVAS_LAUNCH_MODE = "oauth2";

  try {
    const request = new Request("http://localhost/api/academy/student/lms/launch", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-academy-user-id": "student-one",
        "x-academy-tenant-id": "tenant-student-launch",
        "x-academy-roles": "student",
      },
      body: JSON.stringify({
        targetStudentPersonId: "student-one",
        redirectPath: "/student/lms",
      }),
    });

    const response = await launchStudentLmsRequest(request, {
      fetchPeopleConfiguration: async () => peopleConfig("canvas"),
    });
    const body = (await response.json()) as {
      launch: {
        status: string;
        displayLabel: string;
        launchUrl?: string;
        auditReference: string;
      };
    };

    assert.equal(response.status, 200);
    assert.equal(body.launch.status, "available");
    assert.equal(body.launch.displayLabel, "Canvas");
    assert.match(body.launch.auditReference, /:canvas:identity_launch$/);
    assert.match(body.launch.launchUrl ?? "", /^https:\/\/canvas\.example\.edu/);
  } finally {
    delete process.env.CANVAS_LAUNCH_BASE_URL;
    delete process.env.CANVAS_LAUNCH_MODE;
  }
});
