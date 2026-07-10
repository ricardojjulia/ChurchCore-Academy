import type { LmsReadinessEvidenceItem } from "@/modules/lms-contract/provider-readiness";
import type {
  LmsSandboxCheckProvider,
  RecordLmsSandboxCheckResultInput,
} from "@/modules/lms-contract/sandbox-check-results";

export interface RunLmsSandboxChecksInput {
  providerId: LmsSandboxCheckProvider;
  recordedEvidence: LmsReadinessEvidenceItem[];
  rosterEligibleSectionCount: number;
}

const providerName: Record<LmsSandboxCheckProvider, string> = {
  moodle: "Moodle",
  canvas: "Canvas",
};

function recordedEvidence(input: RunLmsSandboxChecksInput) {
  return input.recordedEvidence.filter((evidence) => evidence.status === "recorded");
}

function evidenceReference(input: RunLmsSandboxChecksInput) {
  return recordedEvidence(input)[0]?.reference ?? "No sandbox evidence reference recorded.";
}

function hasLaunchEvidence(input: RunLmsSandboxChecksInput) {
  return recordedEvidence(input).find((evidence) => /launch|smoke/i.test(evidence.label) || /launch|smoke/i.test(evidence.reference));
}

export function runLmsSandboxChecks(input: RunLmsSandboxChecksInput): RecordLmsSandboxCheckResultInput[] {
  const displayName = providerName[input.providerId];
  const evidence = recordedEvidence(input);
  const launchEvidence = hasLaunchEvidence(input);

  return [
    {
      providerId: input.providerId,
      checkKey: "configuration_review",
      checkLabel: `${displayName} configuration review`,
      status: evidence.length > 0 ? "passed" : "failed",
      safeSummary: evidence.length > 0
        ? `Recorded ${displayName} sandbox evidence is present.`
        : `No recorded ${displayName} sandbox evidence is present.`,
      reference: evidenceReference(input),
      durationMs: 1,
    },
    {
      providerId: input.providerId,
      checkKey: "roster_preview",
      checkLabel: `${displayName} roster preview`,
      status: input.rosterEligibleSectionCount > 0 ? "passed" : "failed",
      safeSummary: input.rosterEligibleSectionCount > 0
        ? `Found ${input.rosterEligibleSectionCount} roster-eligible sections.`
        : "No roster-eligible sections are available for sandbox planning.",
      reference: "section-roster-preview",
      durationMs: 1,
    },
    {
      providerId: input.providerId,
      checkKey: "launch_smoke",
      checkLabel: `${displayName} launch smoke`,
      status: launchEvidence ? "passed" : "skipped",
      safeSummary: launchEvidence
        ? `${displayName} launch smoke evidence is recorded.`
        : `${displayName} launch smoke is skipped until a sandbox launch evidence reference is recorded.`,
      reference: launchEvidence?.reference ?? "docs/releases/2026-06-26-full-lms-integration-readiness.md",
      durationMs: 1,
    },
  ];
}
