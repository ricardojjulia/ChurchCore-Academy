import assert from "node:assert/strict";
import test from "node:test";
import { LmsCapability, LmsTenantContext, validateLmsLaunchResponseSafety } from "../contract";
import { noLmsProvider } from "../no-lms-provider";

const tenant: LmsTenantContext = {
  tenantId: "tenant-no-lms",
  institutionMode: "bible_school",
  supportedModes: ["bible_school"],
  providerId: "none",
  correlationId: "corr-no-lms",
};

const actor = {
  personId: "student-1",
  role: "student",
  auditActorId: "audit-student-1",
  studentPersonId: "student-1",
};

test("no-LMS provider declares no external LMS capabilities", () => {
  assert.equal(noLmsProvider.descriptor.id, "none");
  assert.equal(noLmsProvider.descriptor.displayName, "No LMS");
  assert.deepEqual(noLmsProvider.descriptor.capabilities, []);
});

test("no-LMS launch returns a safe unavailable Student PWA response", () => {
  const response = noLmsProvider.createLaunchResponse({
    tenant,
    actor,
    courseId: "course-1",
    sectionId: "section-1",
    targetStudentPersonId: "student-1",
    redirectPath: "/student/lms",
    nonce: "nonce-1",
  });

  assert.deepEqual(response, {
    status: "unavailable",
    displayLabel: "Learning",
    unavailableReason: "This institution has not enabled an external LMS.",
    auditReference: "corr-no-lms:none:identity_launch",
  });
  assert.deepEqual(validateLmsLaunchResponseSafety(response), []);
  assert.doesNotMatch(JSON.stringify(response), /token|secret|payload|providerApi/i);
});

test("no-LMS provider returns explicit unsupported outcomes for external operations", () => {
  const unsupportedCapabilities: LmsCapability[] = [
    "single_logout",
    "course_shell_provisioning",
    "section_mapping",
    "roster_sync",
    "enrollment_sync",
    "grade_return",
    "progress_return",
    "webhooks",
  ];

  for (const capability of unsupportedCapabilities) {
    const result = noLmsProvider.unsupported(capability, tenant, `op-${capability}`);

    assert.equal(result.status, "unsupported");
    assert.equal(result.providerId, "none");
    assert.equal(result.capability, capability);
    assert.equal(result.tenantId, "tenant-no-lms");
    assert.equal(result.correlationId, "corr-no-lms");
    assert.equal(result.operationId, `op-${capability}`);
    assert.equal(result.retryable, false);
    assert.equal(result.safeMessage, "This institution has not enabled an external LMS.");
  }
});

test("no-LMS reconciliation is a no-op report with no drift", () => {
  assert.deepEqual(noLmsProvider.reconcile(tenant), {
    tenantId: "tenant-no-lms",
    providerId: "none",
    correlationId: "corr-no-lms",
    missingMappings: [],
    staleMappings: [],
    duplicateProviderObjects: [],
    rosterDrift: [],
    enrollmentDrift: [],
    gradeReturnDrift: [],
    progressReturnDrift: [],
    capabilityMismatches: [],
    requiredActions: [],
  });
});
