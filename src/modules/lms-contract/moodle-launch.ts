import { LmsLaunchRequest, LmsLaunchResponse } from "./contract";
import { ResolvedTenantLmsProvider } from "./tenant-provider-selection";

export type MoodleLaunchMode = "oidc" | "lti";

export interface MoodleLaunchConfiguration {
  tenantId: string;
  launchMode: MoodleLaunchMode;
  launchBaseUrl: string;
  displayLabel?: string;
  expiresInMinutes?: number;
  credentialStatus?: "valid" | "invalid";
  circuitState?: "closed" | "open";
  mappedCourseIds?: string[];
  mappedSectionIds?: string[];
  accessToken?: string;
  refreshToken?: string;
  clientSecret?: string;
  sharedSecret?: string;
  webhookSecret?: string;
  rawProviderPayload?: unknown;
}

export interface CreateMoodleLaunchResponseInput {
  resolvedProvider: ResolvedTenantLmsProvider;
  configuration?: MoodleLaunchConfiguration;
  request: LmsLaunchRequest;
  now?: string;
}

const defaultDisplayLabel = "Moodle";
const defaultExpiresInMinutes = 10;

function auditReference(correlationId: string) {
  return `${correlationId}:moodle:identity_launch`;
}

function unavailable(correlationId: string, reason: string): LmsLaunchResponse {
  return {
    status: "unavailable",
    displayLabel: defaultDisplayLabel,
    unavailableReason: reason,
    auditReference: auditReference(correlationId),
  };
}

function unavailableReason(input: CreateMoodleLaunchResponseInput) {
  const warning = input.resolvedProvider.warnings[0];

  if (!input.resolvedProvider.supports("identity_launch")) {
    return warning ?? "Moodle launch is not active for this tenant.";
  }

  if (input.configuration?.credentialStatus === "invalid") {
    return "Moodle credentials need administrator review before launch.";
  }

  if (input.configuration?.circuitState === "open") {
    return "Moodle is temporarily paused while provider health recovers.";
  }

  if (
    (input.request.courseId &&
      input.configuration?.mappedCourseIds &&
      !input.configuration.mappedCourseIds.includes(input.request.courseId)) ||
    (input.request.sectionId &&
      input.configuration?.mappedSectionIds &&
      !input.configuration.mappedSectionIds.includes(input.request.sectionId))
  ) {
    return "Moodle course mapping is missing for this launch.";
  }

  if (!input.configuration?.launchBaseUrl.trim()) {
    return "Moodle launch is not configured for this tenant.";
  }

  return undefined;
}

function buildLaunchUrl(configuration: MoodleLaunchConfiguration, request: LmsLaunchRequest) {
  const launchUrl = new URL(configuration.launchBaseUrl);
  launchUrl.searchParams.set("mode", configuration.launchMode);
  launchUrl.searchParams.set("state", `${request.tenant.correlationId}:${request.nonce}`);
  launchUrl.searchParams.set("redirect", request.redirectPath);

  if (request.courseId) {
    launchUrl.searchParams.set("course", request.courseId);
  }

  if (request.sectionId) {
    launchUrl.searchParams.set("section", request.sectionId);
  }

  if (request.targetStudentPersonId) {
    launchUrl.searchParams.set("student", request.targetStudentPersonId);
  }

  return launchUrl.toString();
}

function expiresAt(now: string | undefined, expiresInMinutes: number | undefined) {
  const base = now ? new Date(now) : new Date();
  base.setMinutes(base.getMinutes() + (expiresInMinutes ?? defaultExpiresInMinutes));
  return base.toISOString();
}

export function createMoodleLaunchResponse(input: CreateMoodleLaunchResponseInput): LmsLaunchResponse {
  if (input.resolvedProvider.tenant.providerId !== "moodle" || input.request.tenant.providerId !== "moodle") {
    return unavailable(input.request.tenant.correlationId, "Moodle is not selected for this tenant.");
  }

  if (input.resolvedProvider.tenant.tenantId !== input.request.tenant.tenantId) {
    throw new Error("Cannot create Moodle launch response across tenants.");
  }

  if (input.configuration && input.configuration.tenantId !== input.request.tenant.tenantId) {
    throw new Error("Cannot create Moodle launch response across tenants.");
  }

  const reason = unavailableReason(input);

  if (reason || !input.configuration) {
    return unavailable(input.request.tenant.correlationId, reason ?? "Moodle launch is not configured for this tenant.");
  }

  return {
    status: "available",
    displayLabel: input.configuration.displayLabel ?? defaultDisplayLabel,
    launchUrl: buildLaunchUrl(input.configuration, input.request),
    expiresAt: expiresAt(input.now, input.configuration.expiresInMinutes),
    auditReference: auditReference(input.request.tenant.correlationId),
  };
}
