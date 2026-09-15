import {
  type LmsCapability,
  type LmsCredentialHealth,
  type LmsReconciliationReport,
  createEmptyLmsReconciliationReport,
} from "./contract";
import { ResolvedTenantLmsProvider } from "./tenant-provider-selection";

type MoodleRosterRole = "editingteacher" | "teacher" | "student";
type MoodleEnrollmentState = "active" | "paused" | "withdrawn" | "completed";

export interface MoodleReconciliationConfiguration {
  tenantId: string;
  requiredCapabilities: LmsCapability[];
  credentialHealth?: LmsCredentialHealth;
  accessToken?: string;
  refreshToken?: string;
  clientSecret?: string;
  sharedSecret?: string;
  webhookSecret?: string;
  rawProviderPayload?: unknown;
}

export interface MoodleExpectedCourseShell {
  courseId: string;
  sectionId?: string;
  stableCourseKey: string;
  stableSectionKey?: string;
}

export interface MoodleObservedCourseShell {
  providerObjectId: string;
  stableCourseKey: string;
  stableSectionKey?: string;
}

export interface MoodleRosterMembershipSnapshot {
  sectionId: string;
  personId: string;
  role: MoodleRosterRole;
  enrollmentState: MoodleEnrollmentState;
}

export interface MoodleReconciliationSnapshot {
  expectedCourseShells: MoodleExpectedCourseShell[];
  observedCourseShells: MoodleObservedCourseShell[];
  expectedRosterMemberships: MoodleRosterMembershipSnapshot[];
  observedRosterMemberships: MoodleRosterMembershipSnapshot[];
  expectedGradeReturnIds: string[];
  observedGradeReturnIds: string[];
  expectedProgressReturnIds: string[];
  observedProgressReturnIds: string[];
  observedCapabilities: LmsCapability[];
}

export interface CreateMoodleReconciliationReportInput {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration: MoodleReconciliationConfiguration;
  snapshot: MoodleReconciliationSnapshot;
}

export interface MoodleProviderDocsChecklist {
  requiredSetup: string[];
  security: string[];
  deployment: string[];
  trademark: string[];
}

function assertTenantMatch(input: CreateMoodleReconciliationReportInput) {
  if (input.configuration.tenantId !== input.resolvedProvider.tenant.tenantId) {
    throw new Error("Cannot create Moodle reconciliation report across tenants.");
  }
}

function courseShellKey(shell: { stableCourseKey: string; stableSectionKey?: string }) {
  return shell.stableSectionKey ?? shell.stableCourseKey;
}

function rosterKey(member: MoodleRosterMembershipSnapshot) {
  return `${member.sectionId}:${member.personId}`;
}

function missingValues(expected: string[], observed: string[]) {
  const observedSet = new Set(observed);
  return expected.filter((value) => !observedSet.has(value));
}

function unexpectedValues(expected: string[], observed: string[]) {
  const expectedSet = new Set(expected);
  return observed.filter((value) => !expectedSet.has(value));
}

function duplicateValues(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].filter(([, count]) => count > 1);
}

function providerStatusAction(status: ResolvedTenantLmsProvider["descriptor"]["configurationStatus"]) {
  switch (status) {
    case "not_configured":
      return "Activate Moodle before reconciliation can run.";
    case "paused":
      return "Resume Moodle before reconciliation can run.";
    case "needs_review":
      return "Complete Moodle migration review before reconciliation can run.";
    case "configured":
      return undefined;
  }
}

function addAction(actions: string[], action: string) {
  if (!actions.includes(action)) {
    actions.push(action);
  }
}

function reconcileCourseShells(report: LmsReconciliationReport, snapshot: MoodleReconciliationSnapshot) {
  const expectedKeys = snapshot.expectedCourseShells.map(courseShellKey);
  const observedKeys = snapshot.observedCourseShells.map(courseShellKey);
  const expectedByKey = new Map(snapshot.expectedCourseShells.map((shell) => [courseShellKey(shell), shell]));

  for (const key of missingValues(expectedKeys, observedKeys)) {
    const expected = expectedByKey.get(key);
    report.missingMappings.push(`Missing Moodle course shell for section ${expected?.sectionId ?? expected?.courseId ?? key}.`);
  }

  for (const key of unexpectedValues(expectedKeys, observedKeys)) {
    report.staleMappings.push(`Stale Moodle course shell ${key} is not mapped in Academy.`);
  }

  for (const [key, count] of duplicateValues(observedKeys)) {
    report.duplicateProviderObjects.push(`Duplicate Moodle course shell ${key} appears ${count} times.`);
  }

  if (report.missingMappings.length || report.staleMappings.length || report.duplicateProviderObjects.length) {
    addAction(report.requiredActions, "Review Moodle course shell mappings before the next sync.");
  }
}

function reconcileRoster(report: LmsReconciliationReport, snapshot: MoodleReconciliationSnapshot) {
  const observedByKey = new Map(snapshot.observedRosterMemberships.map((member) => [rosterKey(member), member]));
  const expectedByKey = new Map(snapshot.expectedRosterMemberships.map((member) => [rosterKey(member), member]));

  for (const expected of snapshot.expectedRosterMemberships) {
    const observed = observedByKey.get(rosterKey(expected));

    if (!observed) {
      report.rosterDrift.push(`Missing Moodle roster member ${rosterKey(expected)}.`);
      continue;
    }

    if (observed.role !== expected.role || observed.enrollmentState !== expected.enrollmentState) {
      report.rosterDrift.push(
        `Roster drift for ${rosterKey(expected)}: expected ${expected.role}/${expected.enrollmentState}, observed ${observed.role}/${observed.enrollmentState}.`,
      );
    }

    if (observed.enrollmentState !== expected.enrollmentState) {
      report.enrollmentDrift.push(`Enrollment drift for ${rosterKey(expected)}: expected ${expected.enrollmentState}, observed ${observed.enrollmentState}.`);
    }
  }

  for (const observed of snapshot.observedRosterMemberships) {
    if (!expectedByKey.has(rosterKey(observed))) {
      report.rosterDrift.push(`Unexpected Moodle roster member ${rosterKey(observed)} exists.`);
    }
  }

  if (report.rosterDrift.length || report.enrollmentDrift.length) {
    addAction(report.requiredActions, "Review Moodle roster membership drift before the next sync.");
  }
}

function reconcileReturnIds(report: LmsReconciliationReport, input: { expected: string[]; observed: string[]; label: string; target: "grade" | "progress" }) {
  const drift = input.target === "grade" ? report.gradeReturnDrift : report.progressReturnDrift;

  for (const value of missingValues(input.expected, input.observed)) {
    drift.push(`Missing Moodle ${input.label} ${value}.`);
  }

  for (const value of unexpectedValues(input.expected, input.observed)) {
    drift.push(`Unexpected Moodle ${input.label} ${value}.`);
  }

  if (drift.length) {
    addAction(
      report.requiredActions,
      input.target === "grade"
        ? "Review Moodle grade return drift before posting any reviewed import."
        : "Review Moodle progress return drift before releasing progress records.",
    );
  }
}

function reconcileCapabilities(report: LmsReconciliationReport, configuration: MoodleReconciliationConfiguration, snapshot: MoodleReconciliationSnapshot) {
  const observed = new Set(snapshot.observedCapabilities);

  for (const capability of configuration.requiredCapabilities) {
    if (!observed.has(capability)) {
      report.capabilityMismatches.push(`Moodle capability ${capability} is required by Academy but unavailable in the observed provider snapshot.`);
    }
  }

  if (report.capabilityMismatches.length) {
    addAction(report.requiredActions, "Review Moodle provider capabilities and tenant configuration.");
  }
}

function applyParitySummary(
  report: LmsReconciliationReport,
  configuration: MoodleReconciliationConfiguration,
  snapshot: MoodleReconciliationSnapshot,
) {
  report.parity = {
    expectedCourseShells: snapshot.expectedCourseShells.length,
    observedCourseShells: snapshot.observedCourseShells.length,
    rosterDrift: report.rosterDrift.length,
    gradeReturnDrift: report.gradeReturnDrift.length,
    progressReturnDrift: report.progressReturnDrift.length,
    capabilityDrift: report.capabilityMismatches.length,
    credentialHealth: configuration.credentialHealth ?? "valid",
  };
}

export function createMoodleReconciliationReport(input: CreateMoodleReconciliationReportInput): LmsReconciliationReport {
  assertTenantMatch(input);

  const report = createEmptyLmsReconciliationReport(
    input.resolvedProvider.tenant.tenantId,
    "moodle",
    input.resolvedProvider.tenant.correlationId,
  );
  const gateAction = providerStatusAction(input.resolvedProvider.descriptor.configurationStatus);

  if (gateAction) {
    report.capabilityMismatches.push(`Moodle reconciliation is ${input.resolvedProvider.descriptor.configurationStatus} for this tenant.`);
    report.requiredActions.push(gateAction);
    return report;
  }

  reconcileCourseShells(report, input.snapshot);
  reconcileRoster(report, input.snapshot);
  reconcileReturnIds(report, {
    expected: input.snapshot.expectedGradeReturnIds,
    observed: input.snapshot.observedGradeReturnIds,
    label: "grade return",
    target: "grade",
  });
  reconcileReturnIds(report, {
    expected: input.snapshot.expectedProgressReturnIds,
    observed: input.snapshot.observedProgressReturnIds,
    label: "progress return",
    target: "progress",
  });
  reconcileCapabilities(report, input.configuration, input.snapshot);
  applyParitySummary(report, input.configuration, input.snapshot);

  return report;
}

export function createMoodleProviderDocsChecklist(): MoodleProviderDocsChecklist {
  return {
    requiredSetup: [
      "Enable Moodle Web Services only for tenants using Moodle sync.",
      "Enable only the protocol required by the configured adapter path.",
      "Create a custom External Service with only the functions required by enabled sync families.",
      "Assign least-privilege capabilities to the Moodle service user.",
      "Configure launch mode separately from server-to-server sync credentials.",
      "Run reconciliation after launch, course shell, roster, grade, or progress configuration changes.",
    ],
    security: [
      "Store Web Service tokens, OIDC secrets, LTI keys, and webhook secrets only in the tenant-scoped secret layer.",
      "Do not expose Moodle tokens, raw provider payloads, or internal Moodle identifiers to Student PWA responses.",
      "Redact provider metadata in audit events and reconciliation summaries.",
      "Rotate Moodle service credentials during tenant provider migration or staff turnover.",
    ],
    deployment: [
      "Use HTTPS for production Moodle base URLs.",
      "Confirm the Moodle version and enabled functions before tenant activation.",
      "Keep local Docker Moodle profiles separate from production cloud-to-cloud configuration.",
      "Document firewall, IP restriction, and token expiration settings for each tenant.",
    ],
    trademark: [
      "Use Moodle names and marks only to describe interoperability; do not imply endorsement.",
      "Keep ChurchCore Academy branding distinct from Moodle branding in tenant-facing materials.",
    ],
  };
}
