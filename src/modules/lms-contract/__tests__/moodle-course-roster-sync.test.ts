import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { InstitutionProfile, LmsSelectionStatus } from "@/modules/academy-config/types";
import { LmsActorContext, LmsCourseShellRequest, LmsRosterSyncRequest } from "../contract";
import {
  createMoodleCourseShellProvisioningPlan,
  createMoodleRosterSyncPlan,
  MoodleSyncConfiguration,
} from "../moodle-course-roster-sync";
import { resolveTenantLmsProvider } from "../tenant-provider-selection";

const now = "2026-06-04T12:00:00.000Z";

function profile(selectionStatus: LmsSelectionStatus = "active"): InstitutionProfile {
  const base = createInstitutionProfileDefaults({
    tenantId: "tenant-moodle-sync",
    institutionName: "Moodle Sync Academy",
    legalName: "Moodle Sync Academy",
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

function resolvedProvider(selectionStatus: LmsSelectionStatus = "active", correlationId = "corr-moodle-sync-1") {
  return resolveTenantLmsProvider(profile(selectionStatus), {
    tenantId: "tenant-moodle-sync",
    correlationId,
  });
}

const actor: LmsActorContext = {
  personId: "registrar-1",
  role: "registrar",
  auditActorId: "actor:registrar-1",
};

function syncConfig(overrides: Partial<MoodleSyncConfiguration> = {}): MoodleSyncConfiguration {
  return {
    tenantId: "tenant-moodle-sync",
    courseCategoryId: "academy-category",
    defaultInstructorRole: "editingteacher",
    defaultStudentRole: "student",
    ...overrides,
  };
}

function courseRequest(overrides: Partial<LmsCourseShellRequest> = {}): LmsCourseShellRequest {
  const resolved = resolvedProvider();

  return {
    tenant: resolved.tenant,
    actor,
    courseId: "course-bibl-101",
    sectionId: "section-bibl-101-a",
    academicYearId: "year-2026",
    academicPeriodId: "term-fall",
    subdivisionId: "school-ministry",
    mappingIntent: "ready_to_provision",
    syncPolicy: "roster_sync",
    idempotencyKey: "idem-course-shell-1",
    ...overrides,
  };
}

function rosterRequest(overrides: Partial<LmsRosterSyncRequest> = {}): LmsRosterSyncRequest {
  const resolved = resolvedProvider();

  return {
    tenant: resolved.tenant,
    actor,
    sectionId: "section-bibl-101-a",
    instructorPersonIds: ["faculty-1", "assistant-1"],
    studentPersonIds: ["student-1", "student-2", "guardian-1"],
    enrollmentStates: {
      "student-1": "active",
      "student-2": "paused",
      "guardian-1": "withdrawn",
    },
    idempotencyKey: "idem-roster-1",
    ...overrides,
  };
}

test("active Moodle course shell provisioning returns a safe idempotent sync plan", () => {
  const resolved = resolvedProvider();
  const plan = createMoodleCourseShellProvisioningPlan({
    resolvedProvider: resolved,
    configuration: syncConfig({
      accessToken: "secret-token",
      rawProviderPayload: { externalCourseId: "mdl-course-1" },
    }),
    request: courseRequest({ tenant: resolved.tenant }),
  });

  assert.equal(plan.result.status, "success");
  assert.equal(plan.result.providerId, "moodle");
  assert.equal(plan.result.capability, "course_shell_provisioning");
  assert.equal(plan.result.operationId, "idem-course-shell-1");
  assert.equal(plan.result.safeMessage, "Moodle course shell provisioning plan is ready.");
  assert.deepEqual(plan.providerOperations, [
    {
      type: "upsert_course_shell",
      idempotencyKey: "idem-course-shell-1",
      stableCourseKey: "tenant-moodle-sync:course-bibl-101",
      stableSectionKey: "tenant-moodle-sync:section-bibl-101-a",
      academicYearId: "year-2026",
      academicPeriodId: "term-fall",
      subdivisionId: "school-ministry",
      mappingIntent: "ready_to_provision",
      syncPolicy: "roster_sync",
      categoryId: "academy-category",
    },
  ]);
  assert.deepEqual(plan.auditEvent.redactedMetadata, {
    mappingIntent: "ready_to_provision",
    syncPolicy: "roster_sync",
    hasSection: true,
  });
  assert.doesNotMatch(JSON.stringify(plan), /secret-token|rawProviderPayload|accessToken|mdl-course-1/i);
});

test("active Moodle roster sync maps instructors and students without guardian elevation", () => {
  const resolved = resolvedProvider("active", "corr-moodle-sync-2");
  const plan = createMoodleRosterSyncPlan({
    resolvedProvider: resolved,
    configuration: syncConfig({
      accessToken: "secret-token",
      rawProviderPayload: { roster: "raw-moodle-roster" },
    }),
    request: rosterRequest({ tenant: resolved.tenant }),
  });

  assert.equal(plan.result.status, "success");
  assert.equal(plan.result.capability, "roster_sync");
  assert.deepEqual(plan.providerOperations, [
    {
      type: "sync_roster_membership",
      idempotencyKey: "idem-roster-1",
      stableSectionKey: "tenant-moodle-sync:section-bibl-101-a",
      memberships: [
        { personId: "faculty-1", role: "editingteacher", enrollmentState: "active" },
        { personId: "assistant-1", role: "editingteacher", enrollmentState: "active" },
        { personId: "student-1", role: "student", enrollmentState: "active" },
        { personId: "student-2", role: "student", enrollmentState: "paused" },
        { personId: "guardian-1", role: "student", enrollmentState: "withdrawn" },
      ],
    },
  ]);
  assert.deepEqual(plan.auditEvent.redactedMetadata, {
    instructorCount: 2,
    studentCount: 3,
    activeEnrollmentCount: 3,
  });
  assert.doesNotMatch(JSON.stringify(plan), /secret-token|raw-moodle-roster|accessToken|rawProviderPayload/i);
});

test("Moodle course and roster sync are gated by tenant provider status", () => {
  for (const [selectionStatus, expectedMessage] of [
    ["planned", "Moodle is planned but not active for this tenant."],
    ["paused", "Moodle is paused for this tenant."],
    ["migration_required", "Moodle requires migration review before use."],
  ] as const) {
    const resolved = resolvedProvider(selectionStatus, `corr-moodle-sync-${selectionStatus}`);
    const coursePlan = createMoodleCourseShellProvisioningPlan({
      resolvedProvider: resolved,
      configuration: syncConfig(),
      request: courseRequest({ tenant: resolved.tenant }),
    });
    const rosterPlan = createMoodleRosterSyncPlan({
      resolvedProvider: resolved,
      configuration: syncConfig(),
      request: rosterRequest({ tenant: resolved.tenant }),
    });

    assert.equal(coursePlan.result.status, "unsupported");
    assert.equal(coursePlan.result.safeMessage, expectedMessage);
    assert.deepEqual(coursePlan.providerOperations, []);

    assert.equal(rosterPlan.result.status, "unsupported");
    assert.equal(rosterPlan.result.safeMessage, expectedMessage);
    assert.deepEqual(rosterPlan.providerOperations, []);
  }
});

test("Moodle sync requires tenant-matched configuration and requests", () => {
  const resolved = resolvedProvider();

  assert.throws(
    () =>
      createMoodleCourseShellProvisioningPlan({
        resolvedProvider: resolved,
        configuration: syncConfig({ tenantId: "other-tenant" }),
        request: courseRequest({ tenant: resolved.tenant }),
      }),
    /Cannot create Moodle sync plan across tenants./,
  );

  assert.throws(
    () =>
      createMoodleRosterSyncPlan({
        resolvedProvider: resolved,
        configuration: syncConfig(),
        request: rosterRequest({
          tenant: {
            ...resolved.tenant,
            tenantId: "other-tenant",
          },
        }),
      }),
    /Cannot create Moodle sync plan across tenants./,
  );
});

test("Moodle sync requires idempotency keys before provider operations are planned", () => {
  const resolved = resolvedProvider();

  assert.throws(
    () =>
      createMoodleCourseShellProvisioningPlan({
        resolvedProvider: resolved,
        configuration: syncConfig(),
        request: courseRequest({ tenant: resolved.tenant, idempotencyKey: "" }),
      }),
    /Moodle sync requires an idempotency key./,
  );

  assert.throws(
    () =>
      createMoodleRosterSyncPlan({
        resolvedProvider: resolved,
        configuration: syncConfig(),
        request: rosterRequest({ tenant: resolved.tenant, idempotencyKey: "" }),
      }),
    /Moodle sync requires an idempotency key./,
  );
});
