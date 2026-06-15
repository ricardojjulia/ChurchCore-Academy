import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { AcademyAuthenticationError } from "@/modules/academy-auth/errors";
import { resolvePlatformSessionForServerComponent } from "@/modules/academy-auth/request-context";
import { PostgresPlatformAdminRepository } from "@/modules/platform-admin/postgres-repository";
import { PlatformAdminService } from "@/modules/platform-admin/service";

interface CreateTenantRouteDependencies {
  resolveSession(): Promise<{
    externalSubject?: string;
    platformRoles: Array<"platform_staff" | "platform_admin">;
  }>;
  createTenant(input: {
    externalSubject: string;
    platformRoles: Array<"platform_staff" | "platform_admin">;
    tenantId: string;
    displayName: string;
    institutionName?: string;
    legalName?: string;
    primaryMode:
      | "bible_school"
      | "childrens_school"
      | "seminary"
      | "college"
      | "university"
      | "mixed";
    supportedModes?: Array<
      | "bible_school"
      | "childrens_school"
      | "seminary"
      | "college"
      | "university"
      | "mixed"
    >;
    lifecycleStatus?: "demo" | "development" | "trial" | "active" | "suspended" | "archived";
    isDemo?: boolean;
    initialInstitutionAdmin: {
      displayName: string;
      givenName?: string;
      familyName?: string;
      email?: string;
    };
  }): Promise<{
    tenantId: string;
    displayName: string;
    lifecycleStatus: "demo" | "development" | "trial" | "active" | "suspended" | "archived";
    isDemo: boolean;
    provisioningStatus: "ready";
    initialAdminPersonId: string;
  }>;
}

const dependencies: CreateTenantRouteDependencies = {
  resolveSession: async () => resolvePlatformSessionForServerComponent(),
  createTenant: async (input) =>
    new PlatformAdminService(
      new PostgresPlatformAdminRepository(),
    ).createTenant(input),
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
}

export async function createPlatformTenant(
  request: Request,
  routeDependencies: CreateTenantRouteDependencies = dependencies,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Malformed JSON body.", 400);
  }

  if (!body || typeof body !== "object") {
    return jsonError("Invalid tenant creation payload.", 400);
  }

  const payload = body as Record<string, unknown>;

  try {
    const session = await routeDependencies.resolveSession();
    if (!session.externalSubject) {
      throw new AcademyAuthenticationError();
    }

    const tenant = await routeDependencies.createTenant({
      externalSubject: session.externalSubject,
      platformRoles: session.platformRoles,
      tenantId: asString(payload.tenantId),
      displayName: asString(payload.displayName),
      institutionName: asString(payload.institutionName) || undefined,
      legalName: asString(payload.legalName) || undefined,
      primaryMode: asString(payload.primaryMode) as
        | "bible_school"
        | "childrens_school"
        | "seminary"
        | "college"
        | "university"
        | "mixed",
      supportedModes: asStringArray(payload.supportedModes) as
        | Array<
            | "bible_school"
            | "childrens_school"
            | "seminary"
            | "college"
            | "university"
            | "mixed"
          >
        | undefined,
      lifecycleStatus: asString(payload.lifecycleStatus) as
        | "demo"
        | "development"
        | "trial"
        | "active"
        | "suspended"
        | "archived"
        | undefined,
      isDemo: payload.isDemo === true,
      initialInstitutionAdmin:
        payload.initialInstitutionAdmin && typeof payload.initialInstitutionAdmin === "object"
          ? {
              displayName: asString(
                (payload.initialInstitutionAdmin as Record<string, unknown>).displayName,
              ),
              givenName: asString(
                (payload.initialInstitutionAdmin as Record<string, unknown>).givenName,
              ) || undefined,
              familyName: asString(
                (payload.initialInstitutionAdmin as Record<string, unknown>).familyName,
              ) || undefined,
              email: asString(
                (payload.initialInstitutionAdmin as Record<string, unknown>).email,
              ) || undefined,
            }
          : { displayName: "" },
    });

    return jsonOk({ tenant });
  } catch (error) {
    if (error instanceof AcademyAuthenticationError) {
      return jsonError(error.message, 401);
    }

    const message = error instanceof Error ? error.message : "Unexpected API error.";
    if (message.includes("Forbidden")) {
      return jsonError(message, 403);
    }
    if (message.includes("already exists")) {
      return jsonError(message, 409);
    }
    if (message.startsWith("Invalid ") || message.includes(" is required")) {
      return jsonError(message, 400);
    }

    return jsonError("Unexpected API error.", 500);
  }
}

export async function POST(request: Request) {
  return createPlatformTenant(request);
}
