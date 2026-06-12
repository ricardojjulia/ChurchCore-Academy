import assert from "node:assert/strict";
import test from "node:test";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import { InstitutionProfile, LmsSelectionStatus } from "@/modules/academy-config/types";
import {
  CanvasReconciliationConfiguration,
  CanvasReconciliationSnapshot,
  createCanvasProviderDocsChecklist,
  createCanvasReconciliationReport,
} from "../canvas-reconciliation";
import { summarizeLmsReconciliationReport } from "../sync-audit-reconciliation";
import { resolveTenantLmsProvider } from "../tenant-provider-selection";

const now = "2026-06-12T13:00:00.000Z";

function profile(selectionStatus: LmsSelectionStatus = "active"): InstitutionProfile {
  const base = createInstitutionProfileDefaults({
    tenantId: "tenant-canvas-reconcile",
    institutionName: "Canvas Reconciliation Academy",
    legalName: "Canvas Reconciliation Academy",
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

function resolvedProvider(selectionStatus: LmsSelectionStatus = "active", correlationId = "corr-canvas-reconcile-1") {
  return resolveTenantLmsProvider(profile(selectionStatus), {
    tenantId: "tenant-canvas-reconcile",
    correlationId,
  });
}

function configuration(overrides: Partial<CanvasReconciliationConfiguration> = {}): CanvasReconciliationConfiguration {
  return {
    tenantId: "tenant-canvas-reconcile",
    requiredCapabilities: ["identity_launch", "course_shell_provisioning", "roster_sync", "grade_return", "progress_return", "reconciliation"],
    accessToken: "secret-token",
    rawProviderPayload: { providerCourseId: "canvas-course-raw" },
    ...overrides,
  };
}

function snapshot(overrides: Partial<CanvasReconciliationSnapshot> = {}): CanvasReconciliationSnapshot {
  return {
    expectedCourseShells: [
      { courseId: "course-theo-201", sectionId: "section-theo-201-a", stableCourseKey: "tenant-canvas-reconcile:course-theo-201", stableSectionKey: "tenant-canvas-reconcile:section-theo-201-a" },
      { courseId: "course-min-301", sectionId: "section-min-301-a", stableCourseKey: "tenant-canvas-reconcile:course-min-301", stableSectionKey: "tenant-canvas-reconcile:section-min-301-a" },
    ],
    observedCourseShells: [
      { providerObjectId: "canvas-course-201", stableCourseKey: "tenant-canvas-reconcile:course-theo-201", stableSectionKey: "tenant-canvas-reconcile:section-theo-201-a" },
      { providerObjectId: "canvas-course-201-duplicate", stableCourseKey: "tenant-canvas-reconcile:course-theo-201", stableSectionKey: "tenant-canvas-reconcile:section-theo-201-a" },
      { providerObjectId: "canvas-stale-course", stableCourseKey: "tenant-canvas-reconcile:course-old", stableSectionKey: "tenant-canvas-reconcile:section-old" },
    ],
    expectedRosterMemberships: [
      { sectionId: "section-theo-201-a", personId: "student-1", role: "student", enrollmentState: "active" },
      { sectionId: "section-theo-201-a", personId: "faculty-1", role: "teacher", enrollmentState: "active" },
    ],
    observedRosterMemberships: [
      { sectionId: "section-theo-201-a", personId: "student-1", role: "student", enrollmentState: "active" },
      { sectionId: "section-theo-201-a", personId: "faculty-1", role: "teacher", enrollmentState: "paused" },
      { sectionId: "section-theo-201-a", personId: "unexpected-person", role: "student", enrollmentState: "active" },
    ],
    expectedGradeReturnIds: ["canvas-grade-1", "canvas-grade-2"],
    observedGradeReturnIds: ["canvas-grade-1", "canvas-grade-stale"],
    expectedProgressReturnIds: ["canvas-progress-1"],
    observedProgressReturnIds: ["canvas-progress-stale"],
    observedCapabilities: ["identity_launch", "course_shell_provisioning", "roster_sync", "grade_return"],
    ...overrides,
  };
}

test("Canvas reconciliation reports mapping roster return and capability drift without provider secrets", () => {
  const resolved = resolvedProvider();
  const report = createCanvasReconciliationReport({
    resolvedProvider: resolved,
    configuration: configuration(),
    snapshot: snapshot(),
  });

  assert.deepEqual(report.missingMappings, ["Missing Canvas course shell for section section-min-301-a."]);
  assert.deepEqual(report.staleMappings, ["Stale Canvas course shell tenant-canvas-reconcile:section-old is not mapped in Academy."]);
  assert.deepEqual(report.duplicateProviderObjects, ["Duplicate Canvas course shell tenant-canvas-reconcile:section-theo-201-a appears 2 times."]);
  assert.deepEqual(report.rosterDrift, [
    "Roster drift for section-theo-201-a:faculty-1: expected teacher/active, observed teacher/paused.",
    "Unexpected Canvas roster member section-theo-201-a:unexpected-person exists.",
  ]);
  assert.deepEqual(report.enrollmentDrift, ["Enrollment drift for section-theo-201-a:faculty-1: expected active, observed paused."]);
  assert.deepEqual(report.gradeReturnDrift, [
    "Missing Canvas grade return canvas-grade-2.",
    "Unexpected Canvas grade return canvas-grade-stale.",
  ]);
  assert.deepEqual(report.progressReturnDrift, [
    "Missing Canvas progress return canvas-progress-1.",
    "Unexpected Canvas progress return canvas-progress-stale.",
  ]);
  assert.deepEqual(report.capabilityMismatches, [
    "Canvas capability progress_return is required by Academy but unavailable in the observed provider snapshot.",
    "Canvas capability reconciliation is required by Academy but unavailable in the observed provider snapshot.",
  ]);
  assert.deepEqual(report.requiredActions, [
    "Review Canvas course shell mappings before the next sync.",
    "Review Canvas roster membership drift before the next sync.",
    "Review Canvas grade return drift before posting any reviewed import.",
    "Review Canvas progress return drift before releasing progress records.",
    "Review Canvas provider capabilities and tenant configuration.",
  ]);
  assert.deepEqual(summarizeLmsReconciliationReport(report), {
    tenantId: "tenant-canvas-reconcile",
    providerId: "canvas",
    correlationId: "corr-canvas-reconcile-1",
    status: "needs_action",
    driftCount: 12,
    requiredActionCount: 5,
  });
  assert.doesNotMatch(JSON.stringify(report), /secret-token|rawProviderPayload|canvas-course-raw|accessToken/i);
});

test("clean Canvas reconciliation report has no required action", () => {
  const resolved = resolvedProvider("active", "corr-canvas-reconcile-clean");
  const cleanSnapshot = snapshot({
    expectedCourseShells: [
      { courseId: "course-theo-201", sectionId: "section-theo-201-a", stableCourseKey: "tenant-canvas-reconcile:course-theo-201", stableSectionKey: "tenant-canvas-reconcile:section-theo-201-a" },
    ],
    observedCourseShells: [
      { providerObjectId: "canvas-course-201", stableCourseKey: "tenant-canvas-reconcile:course-theo-201", stableSectionKey: "tenant-canvas-reconcile:section-theo-201-a" },
    ],
    expectedRosterMemberships: [
      { sectionId: "section-theo-201-a", personId: "student-1", role: "student", enrollmentState: "active" },
    ],
    observedRosterMemberships: [
      { sectionId: "section-theo-201-a", personId: "student-1", role: "student", enrollmentState: "active" },
    ],
    expectedGradeReturnIds: ["canvas-grade-1"],
    observedGradeReturnIds: ["canvas-grade-1"],
    expectedProgressReturnIds: ["canvas-progress-1"],
    observedProgressReturnIds: ["canvas-progress-1"],
    observedCapabilities: configuration().requiredCapabilities,
  });

  const report = createCanvasReconciliationReport({
    resolvedProvider: resolved,
    configuration: configuration(),
    snapshot: cleanSnapshot,
  });

  assert.deepEqual(summarizeLmsReconciliationReport(report), {
    tenantId: "tenant-canvas-reconcile",
    providerId: "canvas",
    correlationId: "corr-canvas-reconcile-clean",
    status: "clean",
    driftCount: 0,
    requiredActionCount: 0,
  });
});

test("Canvas reconciliation is gated by tenant provider status", () => {
  for (const [selectionStatus, expectedAction] of [
    ["planned", "Activate Canvas before reconciliation can run."],
    ["paused", "Resume Canvas before reconciliation can run."],
    ["migration_required", "Complete Canvas migration review before reconciliation can run."],
  ] as const) {
    const resolved = resolvedProvider(selectionStatus, `corr-canvas-reconcile-${selectionStatus}`);
    const report = createCanvasReconciliationReport({
      resolvedProvider: resolved,
      configuration: configuration(),
      snapshot: snapshot(),
    });

    assert.deepEqual(report.capabilityMismatches, [`Canvas reconciliation is ${resolved.descriptor.configurationStatus} for this tenant.`]);
    assert.deepEqual(report.requiredActions, [expectedAction]);
    assert.deepEqual(report.missingMappings, []);
    assert.deepEqual(report.rosterDrift, []);
  }
});

test("Canvas reconciliation rejects cross-tenant configuration", () => {
  const resolved = resolvedProvider();

  assert.throws(
    () =>
      createCanvasReconciliationReport({
        resolvedProvider: resolved,
        configuration: configuration({ tenantId: "other-tenant" }),
        snapshot: snapshot(),
      }),
    /Cannot create Canvas reconciliation report across tenants./,
  );
});

test("Canvas provider docs checklist covers required setup and deployment notes", () => {
  const checklist = createCanvasProviderDocsChecklist();

  assert.ok(checklist.requiredSetup.includes("Enable Canvas API access only for tenants using Canvas sync."));
  assert.ok(checklist.requiredSetup.includes("Provision developer keys and enrollment scopes only for the enabled Academy sync families."));
  assert.ok(checklist.security.includes("Store API tokens, OAuth client secrets, LTI keys, and webhook secrets only in the tenant-scoped secret layer."));
  assert.ok(checklist.deployment.includes("Use HTTPS for production Canvas base URLs."));
  assert.ok(checklist.trademark.includes("Use Canvas names and marks only to describe interoperability; do not imply endorsement."));
  assert.doesNotMatch(JSON.stringify(checklist), /accessToken|secret-token|rawProviderPayload/i);
});
