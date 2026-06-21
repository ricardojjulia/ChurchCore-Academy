import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import type { InstitutionProfile, LmsProvider } from "@/modules/academy-config/types";
import { createCanvasCourseShellProvisioningPlan, createCanvasRosterSyncPlan } from "../canvas-course-roster-sync";
import { resolveTenantLmsProvider } from "../tenant-provider-selection";

const now = "2026-06-11T12:00:00.000Z";

function profile(status: InstitutionProfile["lmsPreference"]["selectionStatus"] = "active"): InstitutionProfile {
  const base = createInstitutionProfileDefaults({
    tenantId: "tenant-canvas-sync",
    institutionName: "Canvas Sync Academy",
    legalName: "Canvas Sync Academy",
    primaryMode: "college",
    lmsProvider: "canvas",
    now,
  });

  return {
    ...base,
    lmsPreference: {
      provider: "canvas" as LmsProvider,
      selectionStatus: status,
    },
  };
}

const actor = {
  personId: "registrar-1",
  role: "registrar",
  auditActorId: "actor:registrar-1",
};

test("active Canvas course shell provisioning returns safe idempotent plan", () => {
  const resolved = resolveTenantLmsProvider(profile(), {
    tenantId: "tenant-canvas-sync",
    correlationId: "corr-canvas-sync-1",
  });

  const plan = createCanvasCourseShellProvisioningPlan({
    resolvedProvider: resolved,
    configuration: {
      tenantId: "tenant-canvas-sync",
      accountId: "acct-42",
      defaultInstructorRole: "teacher",
      defaultStudentRole: "student",
    },
    request: {
      tenant: resolved.tenant,
      actor,
      courseId: "course-401",
      sectionId: "section-401-a",
      academicYearId: "year-2026",
      academicPeriodId: "period-fall-2026",
      mappingIntent: "planned",
      syncPolicy: "manual",
      idempotencyKey: "op-canvas-shell-1",
    },
  });

  assert.equal(plan.result.status, "success");
  assert.equal(plan.result.providerId, "canvas");
  assert.equal(plan.providerOperations.length, 1);
  assert.equal(plan.providerOperations[0].type, "upsert_course_shell");
  assert.equal(plan.providerOperations[0].stableCourseKey, "tenant-canvas-sync:course-401");
  assert.equal(plan.providerOperations[0].accountId, "acct-42");
});

test("active Canvas roster sync maps instructors and students", () => {
  const resolved = resolveTenantLmsProvider(profile(), {
    tenantId: "tenant-canvas-sync",
    correlationId: "corr-canvas-sync-2",
  });

  const plan = createCanvasRosterSyncPlan({
    resolvedProvider: resolved,
    configuration: {
      tenantId: "tenant-canvas-sync",
      defaultInstructorRole: "teacher",
      defaultStudentRole: "student",
    },
    request: {
      tenant: resolved.tenant,
      actor,
      sectionId: "section-401-a",
      instructorPersonIds: ["faculty-1", "assistant-1"],
      studentPersonIds: ["student-1", "student-2"],
      enrollmentStates: {
        "student-1": "active",
        "student-2": "paused",
      },
      idempotencyKey: "op-canvas-roster-1",
    },
  });

  assert.equal(plan.result.status, "success");
  assert.equal(plan.providerOperations.length, 1);
  assert.deepEqual(plan.providerOperations[0].memberships, [
    { personId: "faculty-1", role: "teacher", enrollmentState: "active" },
    { personId: "assistant-1", role: "teacher", enrollmentState: "active" },
    { personId: "student-1", role: "student", enrollmentState: "active" },
    { personId: "student-2", role: "student", enrollmentState: "paused" },
  ]);
});

test("Canvas sync is gated by tenant provider status", () => {
  const resolved = resolveTenantLmsProvider(profile("planned"), {
    tenantId: "tenant-canvas-sync",
    correlationId: "corr-canvas-sync-3",
  });

  const shell = createCanvasCourseShellProvisioningPlan({
    resolvedProvider: resolved,
    configuration: {
      tenantId: "tenant-canvas-sync",
      defaultInstructorRole: "teacher",
      defaultStudentRole: "student",
    },
    request: {
      tenant: resolved.tenant,
      actor,
      courseId: "course-401",
      sectionId: "section-401-a",
      academicYearId: "year-2026",
      academicPeriodId: "period-fall-2026",
      mappingIntent: "planned",
      syncPolicy: "manual",
      idempotencyKey: "op-canvas-shell-2",
    },
  });

  const roster = createCanvasRosterSyncPlan({
    resolvedProvider: resolved,
    configuration: {
      tenantId: "tenant-canvas-sync",
      defaultInstructorRole: "teacher",
      defaultStudentRole: "student",
    },
    request: {
      tenant: resolved.tenant,
      actor,
      sectionId: "section-401-a",
      instructorPersonIds: ["faculty-1"],
      studentPersonIds: ["student-1"],
      enrollmentStates: { "student-1": "active" },
      idempotencyKey: "op-canvas-roster-2",
    },
  });

  assert.equal(shell.result.status, "unsupported");
  assert.equal(shell.providerOperations.length, 0);
  assert.equal(roster.result.status, "unsupported");
  assert.equal(roster.providerOperations.length, 0);
});

test("Canvas sync requires tenant match and idempotency key", () => {
  const resolved = resolveTenantLmsProvider(profile(), {
    tenantId: "tenant-canvas-sync",
    correlationId: "corr-canvas-sync-4",
  });

  assert.throws(
    () =>
      createCanvasCourseShellProvisioningPlan({
        resolvedProvider: resolved,
        configuration: {
          tenantId: "other-tenant",
          defaultInstructorRole: "teacher",
          defaultStudentRole: "student",
        },
        request: {
          tenant: resolved.tenant,
          actor,
          courseId: "course-401",
          sectionId: "section-401-a",
          academicYearId: "year-2026",
          academicPeriodId: "period-fall-2026",
          mappingIntent: "planned",
          syncPolicy: "manual",
          idempotencyKey: "op-canvas-shell-3",
        },
      }),
    /Cannot create Canvas sync plan across tenants./,
  );

  assert.throws(
    () =>
      createCanvasRosterSyncPlan({
        resolvedProvider: resolved,
        configuration: {
          tenantId: "tenant-canvas-sync",
          defaultInstructorRole: "teacher",
          defaultStudentRole: "student",
        },
        request: {
          tenant: resolved.tenant,
          actor,
          sectionId: "section-401-a",
          instructorPersonIds: ["faculty-1"],
          studentPersonIds: ["student-1"],
          enrollmentStates: { "student-1": "active" },
          idempotencyKey: "",
        },
      }),
    /Canvas sync requires an idempotency key./,
  );
});
