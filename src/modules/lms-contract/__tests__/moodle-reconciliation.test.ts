import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { InstitutionProfile, LmsSelectionStatus } from "@/modules/academy-config/types";
import {
  createMoodleProviderDocsChecklist,
  createMoodleReconciliationReport,
  MoodleReconciliationConfiguration,
  MoodleReconciliationSnapshot,
} from "../moodle-reconciliation";
import { summarizeLmsReconciliationReport } from "../sync-audit-reconciliation";
import { resolveTenantLmsProvider } from "../tenant-provider-selection";

const now = "2026-06-05T12:00:00.000Z";

function profile(selectionStatus: LmsSelectionStatus = "active"): InstitutionProfile {
  const base = createInstitutionProfileDefaults({
    tenantId: "tenant-moodle-reconcile",
    institutionName: "Moodle Reconciliation Academy",
    legalName: "Moodle Reconciliation Academy",
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

function resolvedProvider(selectionStatus: LmsSelectionStatus = "active", correlationId = "corr-moodle-reconcile-1") {
  return resolveTenantLmsProvider(profile(selectionStatus), {
    tenantId: "tenant-moodle-reconcile",
    correlationId,
  });
}

function configuration(overrides: Partial<MoodleReconciliationConfiguration> = {}): MoodleReconciliationConfiguration {
  return {
    tenantId: "tenant-moodle-reconcile",
    requiredCapabilities: ["identity_launch", "course_shell_provisioning", "roster_sync", "grade_return", "progress_return", "reconciliation"],
    accessToken: "secret-token",
    rawProviderPayload: { providerCourseId: "mdl-course-raw" },
    ...overrides,
  };
}

function snapshot(overrides: Partial<MoodleReconciliationSnapshot> = {}): MoodleReconciliationSnapshot {
  return {
    expectedCourseShells: [
      { courseId: "course-bibl-101", sectionId: "section-bibl-101-a", stableCourseKey: "tenant-moodle-reconcile:course-bibl-101", stableSectionKey: "tenant-moodle-reconcile:section-bibl-101-a" },
      { courseId: "course-theo-201", sectionId: "section-theo-201-a", stableCourseKey: "tenant-moodle-reconcile:course-theo-201", stableSectionKey: "tenant-moodle-reconcile:section-theo-201-a" },
    ],
    observedCourseShells: [
      { providerObjectId: "mdl-course-101", stableCourseKey: "tenant-moodle-reconcile:course-bibl-101", stableSectionKey: "tenant-moodle-reconcile:section-bibl-101-a" },
      { providerObjectId: "mdl-course-101-duplicate", stableCourseKey: "tenant-moodle-reconcile:course-bibl-101", stableSectionKey: "tenant-moodle-reconcile:section-bibl-101-a" },
      { providerObjectId: "mdl-stale-course", stableCourseKey: "tenant-moodle-reconcile:course-old", stableSectionKey: "tenant-moodle-reconcile:section-old" },
    ],
    expectedRosterMemberships: [
      { sectionId: "section-bibl-101-a", personId: "student-1", role: "student", enrollmentState: "active" },
      { sectionId: "section-bibl-101-a", personId: "faculty-1", role: "editingteacher", enrollmentState: "active" },
    ],
    observedRosterMemberships: [
      { sectionId: "section-bibl-101-a", personId: "student-1", role: "student", enrollmentState: "active" },
      { sectionId: "section-bibl-101-a", personId: "faculty-1", role: "editingteacher", enrollmentState: "paused" },
      { sectionId: "section-bibl-101-a", personId: "unexpected-person", role: "student", enrollmentState: "active" },
    ],
    expectedGradeReturnIds: ["moodle-grade-1", "moodle-grade-2"],
    observedGradeReturnIds: ["moodle-grade-1", "moodle-grade-stale"],
    expectedProgressReturnIds: ["moodle-progress-1"],
    observedProgressReturnIds: ["moodle-progress-stale"],
    observedCapabilities: ["identity_launch", "course_shell_provisioning", "roster_sync", "grade_return"],
    ...overrides,
  };
}

test("Moodle reconciliation reports mapping roster return and capability drift without provider secrets", () => {
  const resolved = resolvedProvider();
  const report = createMoodleReconciliationReport({
    resolvedProvider: resolved,
    configuration: configuration(),
    snapshot: snapshot(),
  });

  assert.deepEqual(report.missingMappings, ["Missing Moodle course shell for section section-theo-201-a."]);
  assert.deepEqual(report.staleMappings, ["Stale Moodle course shell tenant-moodle-reconcile:section-old is not mapped in Academy."]);
  assert.deepEqual(report.duplicateProviderObjects, ["Duplicate Moodle course shell tenant-moodle-reconcile:section-bibl-101-a appears 2 times."]);
  assert.deepEqual(report.rosterDrift, [
    "Roster drift for section-bibl-101-a:faculty-1: expected editingteacher/active, observed editingteacher/paused.",
    "Unexpected Moodle roster member section-bibl-101-a:unexpected-person exists.",
  ]);
  assert.deepEqual(report.enrollmentDrift, ["Enrollment drift for section-bibl-101-a:faculty-1: expected active, observed paused."]);
  assert.deepEqual(report.gradeReturnDrift, [
    "Missing Moodle grade return moodle-grade-2.",
    "Unexpected Moodle grade return moodle-grade-stale.",
  ]);
  assert.deepEqual(report.progressReturnDrift, [
    "Missing Moodle progress return moodle-progress-1.",
    "Unexpected Moodle progress return moodle-progress-stale.",
  ]);
  assert.deepEqual(report.capabilityMismatches, [
    "Moodle capability progress_return is required by Academy but unavailable in the observed provider snapshot.",
    "Moodle capability reconciliation is required by Academy but unavailable in the observed provider snapshot.",
  ]);
  assert.deepEqual(report.requiredActions, [
    "Review Moodle course shell mappings before the next sync.",
    "Review Moodle roster membership drift before the next sync.",
    "Review Moodle grade return drift before posting any reviewed import.",
    "Review Moodle progress return drift before releasing progress records.",
    "Review Moodle provider capabilities and tenant configuration.",
  ]);
  assert.deepEqual(summarizeLmsReconciliationReport(report), {
    tenantId: "tenant-moodle-reconcile",
    providerId: "moodle",
    correlationId: "corr-moodle-reconcile-1",
    status: "needs_action",
    driftCount: 12,
    requiredActionCount: 5,
  });
  assert.doesNotMatch(JSON.stringify(report), /secret-token|rawProviderPayload|mdl-course-raw|accessToken/i);
});

test("clean Moodle reconciliation report has no required action", () => {
  const resolved = resolvedProvider("active", "corr-moodle-reconcile-clean");
  const cleanSnapshot = snapshot({
    expectedCourseShells: [
      { courseId: "course-bibl-101", sectionId: "section-bibl-101-a", stableCourseKey: "tenant-moodle-reconcile:course-bibl-101", stableSectionKey: "tenant-moodle-reconcile:section-bibl-101-a" },
    ],
    observedCourseShells: [
      { providerObjectId: "mdl-course-101", stableCourseKey: "tenant-moodle-reconcile:course-bibl-101", stableSectionKey: "tenant-moodle-reconcile:section-bibl-101-a" },
    ],
    expectedRosterMemberships: [
      { sectionId: "section-bibl-101-a", personId: "student-1", role: "student", enrollmentState: "active" },
    ],
    observedRosterMemberships: [
      { sectionId: "section-bibl-101-a", personId: "student-1", role: "student", enrollmentState: "active" },
    ],
    expectedGradeReturnIds: ["moodle-grade-1"],
    observedGradeReturnIds: ["moodle-grade-1"],
    expectedProgressReturnIds: ["moodle-progress-1"],
    observedProgressReturnIds: ["moodle-progress-1"],
    observedCapabilities: configuration().requiredCapabilities,
  });

  const report = createMoodleReconciliationReport({
    resolvedProvider: resolved,
    configuration: configuration(),
    snapshot: cleanSnapshot,
  });

  assert.deepEqual(summarizeLmsReconciliationReport(report), {
    tenantId: "tenant-moodle-reconcile",
    providerId: "moodle",
    correlationId: "corr-moodle-reconcile-clean",
    status: "clean",
    driftCount: 0,
    requiredActionCount: 0,
  });
});

test("Moodle reconciliation is gated by tenant provider status", () => {
  for (const [selectionStatus, expectedAction] of [
    ["planned", "Activate Moodle before reconciliation can run."],
    ["paused", "Resume Moodle before reconciliation can run."],
    ["migration_required", "Complete Moodle migration review before reconciliation can run."],
  ] as const) {
    const resolved = resolvedProvider(selectionStatus, `corr-moodle-reconcile-${selectionStatus}`);
    const report = createMoodleReconciliationReport({
      resolvedProvider: resolved,
      configuration: configuration(),
      snapshot: snapshot(),
    });

    assert.deepEqual(report.capabilityMismatches, [`Moodle reconciliation is ${resolved.descriptor.configurationStatus} for this tenant.`]);
    assert.deepEqual(report.requiredActions, [expectedAction]);
    assert.deepEqual(report.missingMappings, []);
    assert.deepEqual(report.rosterDrift, []);
  }
});

test("Moodle reconciliation rejects cross-tenant configuration", () => {
  const resolved = resolvedProvider();

  assert.throws(
    () =>
      createMoodleReconciliationReport({
        resolvedProvider: resolved,
        configuration: configuration({ tenantId: "other-tenant" }),
        snapshot: snapshot(),
      }),
    /Cannot create Moodle reconciliation report across tenants./,
  );
});

test("Moodle provider docs checklist covers required setup and deployment notes", () => {
  const checklist = createMoodleProviderDocsChecklist();

  assert.ok(checklist.requiredSetup.includes("Enable Moodle Web Services only for tenants using Moodle sync."));
  assert.ok(checklist.requiredSetup.includes("Create a custom External Service with only the functions required by enabled sync families."));
  assert.ok(checklist.security.includes("Store Web Service tokens, OIDC secrets, LTI keys, and webhook secrets only in the tenant-scoped secret layer."));
  assert.ok(checklist.deployment.includes("Use HTTPS for production Moodle base URLs."));
  assert.ok(checklist.trademark.includes("Use Moodle names and marks only to describe interoperability; do not imply endorsement."));
  assert.doesNotMatch(JSON.stringify(checklist), /accessToken|secret-token|rawProviderPayload/i);
});
