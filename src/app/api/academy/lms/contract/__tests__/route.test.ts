import assert from "node:assert/strict";
import test from "node:test";
import {
  POST,
  buildLmsContractDescriptorPayload,
  buildLmsCourseShellPlanPayload,
  buildLmsGradeReturnPlanPayload,
  buildLmsProgressReturnPlanPayload,
  buildLmsRosterSyncPlanPayload,
} from "@/app/api/academy/lms/contract/route";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { AcademyActor } from "@/modules/academy-auth/policy";

const institutionAdmin: AcademyActor = {
  userId: "user-admin",
  tenantId: "tenant-contract",
  roles: ["institution_admin"],
};

const registrar: AcademyActor = {
  userId: "user-registrar",
  tenantId: "tenant-contract",
  roles: ["registrar"],
};

function profile(provider: "none" | "canvas" | "moodle") {
  const created = createInstitutionProfileDefaults({
    tenantId: "tenant-contract",
    institutionName: "Contract Academy",
    legalName: "Contract Academy",
    primaryMode: "college",
    lmsProvider: provider,
    now: "2026-06-12T00:00:00.000Z",
  });

  if (provider !== "none") {
    return {
      ...created,
      lmsPreference: {
        provider,
        selectionStatus: "active" as const,
      },
    };
  }

  return created;
}

test("descriptor payload returns resolved tenant provider and capabilities", async () => {
  const payload = await buildLmsContractDescriptorPayload(
    {
      fetchInstitutionProfile: async () => profile("canvas"),
    },
    registrar,
    "tenant-contract",
    "corr-1",
  );

  assert.equal(payload.tenant.providerId, "canvas");
  assert.equal(payload.provider.id, "canvas");
  assert.equal(payload.provider.configurationStatus, "configured");
  assert.ok(payload.provider.capabilities.includes("course_shell_provisioning"));
});

test("descriptor payload rejects cross-tenant actor before repository access", async () => {
  let repositoryCalled = false;

  await assert.rejects(
    () =>
      buildLmsContractDescriptorPayload(
        {
          fetchInstitutionProfile: async () => {
            repositoryCalled = true;
            return profile("none");
          },
        },
        {
          ...registrar,
          tenantId: "other-tenant",
        },
        "tenant-contract",
        "corr-2",
      ),
    /Forbidden institution configuration access./,
  );

  assert.equal(repositoryCalled, false);
});

test("course shell plan payload returns canvas planning operations for active canvas tenants", async () => {
  const payload = await buildLmsCourseShellPlanPayload(
    {
      fetchInstitutionProfile: async () => profile("canvas"),
    },
    institutionAdmin,
    "tenant-contract",
    "corr-course-shell",
    {
      courseId: "course-1",
      sectionId: "section-1",
      academicYearId: "year-1",
      academicPeriodId: "period-1",
      mappingIntent: "ready_to_provision",
      syncPolicy: "full_section_sync",
      idempotencyKey: "idemp-course-shell-1",
    },
  );

  assert.equal(payload.operation, "course_shell_plan");
  assert.equal(payload.providerId, "canvas");
  assert.equal(payload.plan.result.status, "success");
  assert.equal(payload.plan.providerOperations.length, 1);
});

test("course shell plan payload returns unsupported result for no-LMS tenants", async () => {
  const payload = await buildLmsCourseShellPlanPayload(
    {
      fetchInstitutionProfile: async () => profile("none"),
    },
    institutionAdmin,
    "tenant-contract",
    "corr-course-shell-none",
    {
      courseId: "course-1",
      sectionId: "section-1",
      academicYearId: "year-1",
      academicPeriodId: "period-1",
      mappingIntent: "ready_to_provision",
      syncPolicy: "full_section_sync",
      idempotencyKey: "idemp-course-shell-none-1",
    },
  );

  assert.equal(payload.providerId, "none");
  assert.equal(payload.plan.result?.status, "unsupported");
});

test("course shell plan payload returns Moodle planning operations for active Moodle tenants", async () => {
  const payload = await buildLmsCourseShellPlanPayload(
    {
      fetchInstitutionProfile: async () => profile("moodle"),
    },
    institutionAdmin,
    "tenant-contract",
    "corr-moodle-course-shell",
    {
      courseId: "course-1",
      sectionId: "section-1",
      academicYearId: "year-1",
      academicPeriodId: "period-1",
      mappingIntent: "ready_to_provision",
      syncPolicy: "full_section_sync",
      idempotencyKey: "idemp-moodle-course-shell-1",
    },
  );

  assert.equal(payload.operation, "course_shell_plan");
  assert.equal(payload.providerId, "moodle");
  assert.equal(payload.plan.result.status, "success");
  assert.equal(payload.plan.providerOperations.length, 1);
  assert.doesNotMatch(JSON.stringify(payload), /contract stub is not implemented/i);
});

test("roster sync plan payload rejects non-admin actors before repository access", async () => {
  let repositoryCalled = false;

  await assert.rejects(
    () =>
      buildLmsRosterSyncPlanPayload(
        {
          fetchInstitutionProfile: async () => {
            repositoryCalled = true;
            return profile("canvas");
          },
        },
        registrar,
        "tenant-contract",
        "corr-roster-denied",
        {
          sectionId: "section-1",
          instructorPersonIds: ["instructor-1"],
          studentPersonIds: ["student-1"],
          enrollmentStates: {
            "student-1": "active",
          },
          idempotencyKey: "idemp-roster-1",
        },
      ),
    /Forbidden institution configuration access./,
  );

  assert.equal(repositoryCalled, false);
});

test("grade return plan payload returns canvas reviewed-import plan for active canvas tenants", async () => {
  const payload = await buildLmsGradeReturnPlanPayload(
    {
      fetchInstitutionProfile: async () => profile("canvas"),
    },
    institutionAdmin,
    "tenant-contract",
    "corr-grade-return",
    {
      courseId: "course-1",
      sectionId: "section-1",
      idempotencyKey: "idemp-grade-return-1",
      importSourceLabel: "Canvas API",
      results: [
        {
          studentPersonId: "student-1",
          providerResultId: "grade-1",
          label: "Quiz 1",
          value: "90",
          reviewStatus: "accepted_for_review",
        },
      ],
    },
  );

  assert.equal(payload.operation, "grade_return_plan");
  assert.equal(payload.providerId, "canvas");
  assert.equal(payload.plan.result.status, "needs_review");
  assert.equal(payload.plan.reviewedImport?.importKind, "grade_return");
  assert.equal(payload.plan.reviewedImport?.results[0]?.reviewStatus, "pending_review");
});

test("grade return plan payload returns Moodle reviewed-import plan for active Moodle tenants", async () => {
  const payload = await buildLmsGradeReturnPlanPayload(
    {
      fetchInstitutionProfile: async () => profile("moodle"),
    },
    institutionAdmin,
    "tenant-contract",
    "corr-moodle-grade-return",
    {
      courseId: "course-1",
      sectionId: "section-1",
      idempotencyKey: "idemp-moodle-grade-return-1",
      importSourceLabel: "Moodle Web Service",
      results: [
        {
          studentPersonId: "student-1",
          providerResultId: "grade-1",
          label: "Quiz 1",
          value: "90",
          reviewStatus: "accepted_for_review",
        },
      ],
    },
  );

  assert.equal(payload.operation, "grade_return_plan");
  assert.equal(payload.providerId, "moodle");
  assert.equal(payload.plan.result.status, "needs_review");
  assert.equal(payload.plan.reviewedImport?.importKind, "grade_return");
  assert.equal(payload.plan.reviewedImport?.results[0]?.reviewStatus, "pending_review");
  assert.doesNotMatch(JSON.stringify(payload), /contract stub is not implemented/i);
});

test("progress return plan payload returns canvas reviewed-import plan for active canvas tenants", async () => {
  const payload = await buildLmsProgressReturnPlanPayload(
    {
      fetchInstitutionProfile: async () => profile("canvas"),
    },
    institutionAdmin,
    "tenant-contract",
    "corr-progress-return",
    {
      courseId: "course-1",
      sectionId: "section-1",
      idempotencyKey: "idemp-progress-return-1",
      importSourceLabel: "Canvas API",
      results: [
        {
          studentPersonId: "student-1",
          providerProgressId: "progress-1",
          label: "Week 1",
          summary: "Complete",
          reviewStatus: "accepted_for_review",
        },
      ],
    },
  );

  assert.equal(payload.operation, "progress_return_plan");
  assert.equal(payload.providerId, "canvas");
  assert.equal(payload.plan.result.status, "needs_review");
  assert.equal(payload.plan.reviewedImport?.importKind, "progress_return");
  assert.equal(payload.plan.reviewedImport?.results[0]?.reviewStatus, "pending_review");
});

test("grade return plan payload rejects non-admin actors before repository access", async () => {
  let repositoryCalled = false;

  await assert.rejects(
    () =>
      buildLmsGradeReturnPlanPayload(
        {
          fetchInstitutionProfile: async () => {
            repositoryCalled = true;
            return profile("canvas");
          },
        },
        registrar,
        "tenant-contract",
        "corr-grade-denied",
        {
          courseId: "course-1",
          sectionId: "section-1",
          idempotencyKey: "idemp-grade-return-denied",
          importSourceLabel: "Canvas API",
          results: [],
        },
      ),
    /Forbidden institution configuration access./,
  );

  assert.equal(repositoryCalled, false);
});

test("POST returns 400 for malformed JSON body", async () => {
  const response = await POST(
    new Request("http://localhost/api/academy/lms/contract", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-academy-user-id": "user-admin",
        "x-academy-tenant-id": "tenant-contract",
        "x-academy-roles": "institution_admin",
      },
      body: "{malformed-json",
    }),
  );

  const payload = (await response.json()) as { error: string };
  assert.equal(response.status, 400);
  assert.match(payload.error, /Malformed JSON body\./);
});

test("POST returns 400 for invalid grade_return_plan payload", async () => {
  const response = await POST(
    new Request("http://localhost/api/academy/lms/contract", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-academy-user-id": "user-admin",
        "x-academy-tenant-id": "tenant-contract",
        "x-academy-roles": "institution_admin",
      },
      body: JSON.stringify({
        operation: "grade_return_plan",
        courseId: "course-1",
        sectionId: "section-1",
        idempotencyKey: "idemp-grade-1",
        importSourceLabel: "Canvas API",
        results: [
          {
            studentPersonId: "student-1",
            label: "Quiz 1",
            value: "90",
            reviewStatus: "accepted_for_review",
          },
        ],
      }),
    }),
  );

  const payload = (await response.json()) as { error: string };
  assert.equal(response.status, 400);
  assert.match(payload.error, /Invalid grade_return result entry\./);
});

test("POST returns 400 for invalid progress_return_plan payload", async () => {
  const response = await POST(
    new Request("http://localhost/api/academy/lms/contract", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-academy-user-id": "user-admin",
        "x-academy-tenant-id": "tenant-contract",
        "x-academy-roles": "institution_admin",
      },
      body: JSON.stringify({
        operation: "progress_return_plan",
        courseId: "course-1",
        sectionId: "section-1",
        idempotencyKey: "idemp-progress-1",
        importSourceLabel: "Canvas API",
        results: [
          {
            studentPersonId: "student-1",
            providerProgressId: "progress-1",
            label: "Week 1",
            summary: "Complete",
            reviewStatus: "not-a-real-status",
          },
        ],
      }),
    }),
  );

  const payload = (await response.json()) as { error: string };
  assert.equal(response.status, 400);
  assert.match(payload.error, /Invalid progress_return result entry\./);
});
