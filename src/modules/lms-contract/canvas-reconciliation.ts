import {
  type LmsCapability,
  type LmsCredentialHealth,
  type LmsReconciliationReport,
  createEmptyLmsReconciliationReport,
} from "./contract";
import { ResolvedTenantLmsProvider } from "./tenant-provider-selection";

type CanvasRosterRole = "teacher" | "ta" | "student";
type CanvasEnrollmentState = "active" | "paused" | "withdrawn" | "completed";

export interface CanvasReconciliationConfiguration {
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

export interface CanvasExpectedCourseShell {
  courseId: string;
  sectionId?: string;
  stableCourseKey: string;
  stableSectionKey?: string;
}

export interface CanvasObservedCourseShell {
  providerObjectId: string;
  stableCourseKey: string;
  stableSectionKey?: string;
}

export interface CanvasRosterMembershipSnapshot {
  sectionId: string;
  personId: string;
  role: CanvasRosterRole;
  enrollmentState: CanvasEnrollmentState;
}

export interface CanvasReconciliationSnapshot {
  expectedCourseShells: CanvasExpectedCourseShell[];
  observedCourseShells: CanvasObservedCourseShell[];
  expectedRosterMemberships: CanvasRosterMembershipSnapshot[];
  observedRosterMemberships: CanvasRosterMembershipSnapshot[];
  expectedGradeReturnIds: string[];
  observedGradeReturnIds: string[];
  expectedProgressReturnIds: string[];
  observedProgressReturnIds: string[];
  observedCapabilities: LmsCapability[];
}

export interface CreateCanvasReconciliationReportInput {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration: CanvasReconciliationConfiguration;
  snapshot: CanvasReconciliationSnapshot;
}

export interface CanvasProviderDocsChecklist {
  requiredSetup: string[];
  security: string[];
  deployment: string[];
  trademark: string[];
}

function assertTenantMatch(input: CreateCanvasReconciliationReportInput) {
  if (input.configuration.tenantId !== input.resolvedProvider.tenant.tenantId) {
    throw new Error("Cannot create Canvas reconciliation report across tenants.");
  }
}

function courseShellKey(shell: { stableCourseKey: string; stableSectionKey?: string }) {
  return shell.stableSectionKey ?? shell.stableCourseKey;
}

function rosterKey(member: CanvasRosterMembershipSnapshot) {
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
      return "Activate Canvas before reconciliation can run.";
    case "paused":
      return "Resume Canvas before reconciliation can run.";
    case "needs_review":
      return "Complete Canvas migration review before reconciliation can run.";
    case "configured":
      return undefined;
  }
}

function addAction(actions: string[], action: string) {
  if (!actions.includes(action)) {
    actions.push(action);
  }
}

function reconcileCourseShells(report: LmsReconciliationReport, snapshot: CanvasReconciliationSnapshot) {
  const expectedKeys = snapshot.expectedCourseShells.map(courseShellKey);
  const observedKeys = snapshot.observedCourseShells.map(courseShellKey);
  const expectedByKey = new Map(snapshot.expectedCourseShells.map((shell) => [courseShellKey(shell), shell]));

  for (const key of missingValues(expectedKeys, observedKeys)) {
    const expected = expectedByKey.get(key);
    report.missingMappings.push(`Missing Canvas course shell for section ${expected?.sectionId ?? expected?.courseId ?? key}.`);
  }

  for (const key of unexpectedValues(expectedKeys, observedKeys)) {
    report.staleMappings.push(`Stale Canvas course shell ${key} is not mapped in Academy.`);
  }

  for (const [key, count] of duplicateValues(observedKeys)) {
    report.duplicateProviderObjects.push(`Duplicate Canvas course shell ${key} appears ${count} times.`);
  }

  if (report.missingMappings.length || report.staleMappings.length || report.duplicateProviderObjects.length) {
    addAction(report.requiredActions, "Review Canvas course shell mappings before the next sync.");
  }
}

function reconcileRoster(report: LmsReconciliationReport, snapshot: CanvasReconciliationSnapshot) {
  const observedByKey = new Map(snapshot.observedRosterMemberships.map((member) => [rosterKey(member), member]));
  const expectedByKey = new Map(snapshot.expectedRosterMemberships.map((member) => [rosterKey(member), member]));

  for (const expected of snapshot.expectedRosterMemberships) {
    const observed = observedByKey.get(rosterKey(expected));

    if (!observed) {
      report.rosterDrift.push(`Missing Canvas roster member ${rosterKey(expected)}.`);
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
      report.rosterDrift.push(`Unexpected Canvas roster member ${rosterKey(observed)} exists.`);
    }
  }

  if (report.rosterDrift.length || report.enrollmentDrift.length) {
    addAction(report.requiredActions, "Review Canvas roster membership drift before the next sync.");
  }
}

function reconcileReturnIds(report: LmsReconciliationReport, input: { expected: string[]; observed: string[]; label: string; target: "grade" | "progress" }) {
  const drift = input.target === "grade" ? report.gradeReturnDrift : report.progressReturnDrift;

  for (const value of missingValues(input.expected, input.observed)) {
    drift.push(`Missing Canvas ${input.label} ${value}.`);
  }

  for (const value of unexpectedValues(input.expected, input.observed)) {
    drift.push(`Unexpected Canvas ${input.label} ${value}.`);
  }

  if (drift.length) {
    addAction(
      report.requiredActions,
      input.target === "grade"
        ? "Review Canvas grade return drift before posting any reviewed import."
        : "Review Canvas progress return drift before releasing progress records.",
    );
  }
}

function reconcileCapabilities(report: LmsReconciliationReport, configuration: CanvasReconciliationConfiguration, snapshot: CanvasReconciliationSnapshot) {
  const observed = new Set(snapshot.observedCapabilities);

  for (const capability of configuration.requiredCapabilities) {
    if (!observed.has(capability)) {
      report.capabilityMismatches.push(`Canvas capability ${capability} is required by Academy but unavailable in the observed provider snapshot.`);
    }
  }

  if (report.capabilityMismatches.length) {
    addAction(report.requiredActions, "Review Canvas provider capabilities and tenant configuration.");
  }
}

function applyParitySummary(
  report: LmsReconciliationReport,
  configuration: CanvasReconciliationConfiguration,
  snapshot: CanvasReconciliationSnapshot,
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

export function createCanvasReconciliationReport(input: CreateCanvasReconciliationReportInput): LmsReconciliationReport {
  assertTenantMatch(input);

  const report = createEmptyLmsReconciliationReport(
    input.resolvedProvider.tenant.tenantId,
    "canvas",
    input.resolvedProvider.tenant.correlationId,
  );
  const gateAction = providerStatusAction(input.resolvedProvider.descriptor.configurationStatus);

  if (gateAction) {
    report.capabilityMismatches.push(`Canvas reconciliation is ${input.resolvedProvider.descriptor.configurationStatus} for this tenant.`);
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

export function createCanvasProviderDocsChecklist(): CanvasProviderDocsChecklist {
  return {
    requiredSetup: [
      "Enable Canvas API access only for tenants using Canvas sync.",
      "Provision developer keys and enrollment scopes only for the enabled Academy sync families.",
      "Configure launch mode separately from server-to-server sync credentials.",
      "Restrict Canvas account and sub-account access to the tenant-approved academic scope.",
      "Run reconciliation after launch, course shell, roster, grade, or progress configuration changes.",
    ],
    security: [
      "Store API tokens, OAuth client secrets, LTI keys, and webhook secrets only in the tenant-scoped secret layer.",
      "Do not expose Canvas tokens, raw provider payloads, or internal Canvas identifiers to Student PWA responses.",
      "Redact provider metadata in audit events and reconciliation summaries.",
      "Rotate Canvas service credentials during tenant provider migration or staff turnover.",
    ],
    deployment: [
      "Use HTTPS for production Canvas base URLs.",
      "Confirm the Canvas instance domain, account scope, and enabled APIs before tenant activation.",
      "Document firewall, IP restriction, token expiration, and webhook retry settings for each tenant.",
      "Keep sandbox Canvas testing isolated from production tenant configuration.",
    ],
    trademark: [
      "Use Canvas names and marks only to describe interoperability; do not imply endorsement.",
      "Keep ChurchCore Academy branding distinct from Canvas branding in tenant-facing materials.",
    ],
  };
}
