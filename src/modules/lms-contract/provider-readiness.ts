import type { InstitutionProfile, LmsProvider, LmsSelectionStatus } from "@/modules/academy-config/types";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";

export type LmsReadinessAccess = "read" | "manage";
export type LmsProviderReadinessStatus =
  | "not_configured"
  | "not_selected"
  | "active"
  | "paused"
  | "sandbox_evidence_pending"
  | "production_ready";
export type LmsProviderValidationStatus =
  | "not_configured"
  | "sandbox_evidence_pending"
  | "validated"
  | "failed";
export type LmsProviderCircuitState = "closed" | "open" | "unknown";
export type LmsReadinessEvidenceStatus = "pending" | "recorded";

export interface LmsReadinessEvidenceItem {
  label: string;
  status: LmsReadinessEvidenceStatus;
  reference: string;
}

export interface LmsReadinessActionState {
  enabled: boolean;
  reason: string;
}

export interface LmsProviderReadinessItem {
  providerId: Extract<LmsProvider, "moodle" | "canvas">;
  displayName: string;
  selectionStatus: LmsSelectionStatus | "not_selected";
  activationStatus: LmsProviderReadinessStatus;
  validationStatus: LmsProviderValidationStatus;
  circuitState: LmsProviderCircuitState;
  lastSuccessfulSync: string;
  lastFailedSync: string;
  sandboxEvidence: LmsReadinessEvidenceItem[];
  actions: {
    pause: LmsReadinessActionState;
    resume: LmsReadinessActionState;
  };
}

export interface LmsProviderReadinessModel {
  tenantId: string;
  selectedProvider: LmsProvider;
  overallStatus: LmsProviderReadinessStatus;
  summary: {
    configuredProviders: number;
    pausedProviders: number;
    evidenceCompleteProviders: number;
    productionReadyProviders: number;
  };
  providers: LmsProviderReadinessItem[];
  releaseEvidenceReference: string;
  rollbackReference: string;
}

export interface BuildLmsProviderReadinessModelOptions {
  recordedSandboxEvidence?: Partial<Record<Extract<LmsProvider, "moodle" | "canvas">, LmsReadinessEvidenceItem[]>>;
  lastSuccessfulSync?: Partial<Record<Extract<LmsProvider, "moodle" | "canvas">, string>>;
  lastFailedSync?: Partial<Record<Extract<LmsProvider, "moodle" | "canvas">, string>>;
  circuitState?: Partial<Record<Extract<LmsProvider, "moodle" | "canvas">, LmsProviderCircuitState>>;
}

const readRoles = new Set<AcademyRole>(["institution_admin", "dean", "registrar", "academic_admin"]);
const manageRoles = new Set<AcademyRole>(["institution_admin"]);

const providers = [
  { providerId: "moodle" as const, displayName: "Moodle" },
  { providerId: "canvas" as const, displayName: "Canvas" },
];

export function canAccessLmsProviderReadiness(actor: AcademyActor, tenantId: string, access: LmsReadinessAccess) {
  if (actor.tenantId !== tenantId) return false;
  const roles = access === "manage" ? manageRoles : readRoles;
  return actor.roles.some((role) => roles.has(role));
}

export function assertLmsProviderReadinessAccess(actor: AcademyActor, tenantId: string, access: LmsReadinessAccess) {
  if (!canAccessLmsProviderReadiness(actor, tenantId, access)) {
    throw new Error("Forbidden LMS provider readiness access.");
  }
}

function evidenceFor(
  providerId: Extract<LmsProvider, "moodle" | "canvas">,
  options: BuildLmsProviderReadinessModelOptions,
): LmsReadinessEvidenceItem[] {
  const recorded = options.recordedSandboxEvidence?.[providerId];
  if (recorded && recorded.length > 0) return recorded;

  const label = providerId === "moodle" ? "Moodle sandbox validation" : "Canvas sandbox validation";
  const command =
    providerId === "moodle"
      ? "node --import tsx --test src/modules/lms-contract/__tests__/moodle-*.test.ts"
      : "node --import tsx --test src/modules/lms-contract/__tests__/canvas-*.test.ts";

  return [
    {
      label,
      status: "pending",
      reference: `${command}; attach sandbox URL and tenant evidence in docs/releases/2026-06-26-full-lms-integration-readiness.md`,
    },
  ];
}

function statusFor(selectionStatus: LmsSelectionStatus | "not_selected", evidence: LmsReadinessEvidenceItem[]) {
  if (selectionStatus === "not_selected") return "not_selected";
  if (selectionStatus === "paused") return "paused";
  if (selectionStatus !== "active") return "not_configured";
  return evidence.every((item) => item.status === "recorded") ? "production_ready" : "active";
}

function validationStatusFor(selectionStatus: LmsSelectionStatus | "not_selected", evidence: LmsReadinessEvidenceItem[]) {
  if (selectionStatus === "not_selected" || selectionStatus === "not_needed") return "not_configured";
  if (selectionStatus !== "active") return "not_configured";
  return evidence.every((item) => item.status === "recorded") ? "validated" : "sandbox_evidence_pending";
}

function actionState(
  enabled: boolean,
  adminCanManage: boolean,
  enabledReason: string,
): LmsReadinessActionState {
  if (!adminCanManage) {
    return {
      enabled: false,
      reason: "Only an institution administrator can pause or resume LMS providers.",
    };
  }

  return {
    enabled,
    reason: enabled ? enabledReason : "Action is not available for the current provider state.",
  };
}

export function buildLmsProviderReadinessModel(
  profile: InstitutionProfile,
  actor: AcademyActor,
  options: BuildLmsProviderReadinessModelOptions = {},
): LmsProviderReadinessModel {
  assertLmsProviderReadinessAccess(actor, profile.tenantId, "read");
  const adminCanManage = canAccessLmsProviderReadiness(actor, profile.tenantId, "manage");

  const readinessProviders = providers.map((provider): LmsProviderReadinessItem => {
    const selected = profile.lmsPreference.provider === provider.providerId;
    const selectionStatus = selected ? profile.lmsPreference.selectionStatus : "not_selected";
    const sandboxEvidence = evidenceFor(provider.providerId, options);
    const activationStatus = statusFor(selectionStatus, sandboxEvidence);

    return {
      providerId: provider.providerId,
      displayName: provider.displayName,
      selectionStatus,
      activationStatus,
      validationStatus: validationStatusFor(selectionStatus, sandboxEvidence),
      circuitState: options.circuitState?.[provider.providerId] ?? (selected ? "closed" : "unknown"),
      lastSuccessfulSync: options.lastSuccessfulSync?.[provider.providerId] ?? "No live sync recorded",
      lastFailedSync: options.lastFailedSync?.[provider.providerId] ?? "No live failure recorded",
      sandboxEvidence,
      actions: {
        pause: actionState(activationStatus === "active" || activationStatus === "production_ready", adminCanManage, `Pause ${provider.displayName} worker execution.`),
        resume: actionState(activationStatus === "paused", adminCanManage, `Resume ${provider.displayName} after validation.`),
      },
    };
  });

  const configuredProviders = readinessProviders.filter((provider) => provider.activationStatus === "active" || provider.activationStatus === "production_ready").length;
  const pausedProviders = readinessProviders.filter((provider) => provider.activationStatus === "paused").length;
  const evidenceCompleteProviders = readinessProviders.filter((provider) => provider.validationStatus === "validated").length;
  const productionReadyProviders = readinessProviders.filter((provider) => provider.activationStatus === "production_ready").length;

  return {
    tenantId: profile.tenantId,
    selectedProvider: profile.lmsPreference.provider,
    overallStatus: productionReadyProviders === 2 ? "production_ready" : "sandbox_evidence_pending",
    summary: {
      configuredProviders,
      pausedProviders,
      evidenceCompleteProviders,
      productionReadyProviders,
    },
    providers: readinessProviders,
    releaseEvidenceReference: "docs/releases/2026-06-26-full-lms-integration-readiness.md",
    rollbackReference: "docs/runbooks/provider-activation.md#lms-rollback",
  };
}
