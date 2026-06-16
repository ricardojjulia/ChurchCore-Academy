import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { AcademyAuthenticationError } from "@/modules/academy-auth/errors";
import { resolvePlatformSessionForServerComponent } from "@/modules/academy-auth/request-context";
import { ACTIVE_TENANT_COOKIE } from "@/app/api/platform/session/route";
import { PostgresPlatformAdminRepository } from "@/modules/platform-admin/postgres-repository";
import { PlatformAdminService } from "@/modules/platform-admin/service";

interface SelectTenantRouteDependencies {
  resolveSession(preferredTenantId?: string): Promise<{
    externalSubject?: string;
    tenants: Array<{
      tenantId: string;
      roles: string[];
    }>;
    activeTenant?: {
      tenantId: string;
      roles: string[];
    };
  }>;
  saveSelection?(externalSubject: string, tenantId: string): Promise<void>;
}

const dependencies: SelectTenantRouteDependencies = {
  resolveSession: async (preferredTenantId) =>
    resolvePlatformSessionForServerComponent({ preferredTenantId }),
  saveSelection: async (externalSubject, tenantId) =>
    new PlatformAdminService(
      new PostgresPlatformAdminRepository(),
    ).saveActiveTenantSelection({ externalSubject, tenantId }),
};

export async function selectPlatformTenant(
  request: Request,
  routeDependencies: SelectTenantRouteDependencies = dependencies,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Malformed JSON body.", 400);
  }

  if (!body || typeof body !== "object") {
    return jsonError("Invalid tenant selection payload.", 400);
  }

  const payload = body as Record<string, unknown>;
  const tenantId =
    typeof payload.tenantId === "string" ? payload.tenantId.trim() : "";

  if (!tenantId) {
    return jsonError("tenantId is required.", 400);
  }

  try {
    const session = await routeDependencies.resolveSession(tenantId);
    if (!session.tenants.some((tenant) => tenant.tenantId === tenantId)) {
      return jsonError("Forbidden tenant selection.", 403);
    }

    if (!session.activeTenant || session.activeTenant.tenantId !== tenantId) {
      return jsonError("Forbidden tenant selection.", 403);
    }

    if (session.externalSubject && routeDependencies.saveSelection) {
      await routeDependencies.saveSelection(session.externalSubject, tenantId);
    }

    const response = jsonOk({
      activeTenant: session.activeTenant,
      tenants: session.tenants,
    });
    response.cookies.set(ACTIVE_TENANT_COOKIE, tenantId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return response;
  } catch (error) {
    if (error instanceof AcademyAuthenticationError) {
      return jsonError(error.message, 401);
    }

    const message = error instanceof Error ? error.message : "Unexpected API error.";
    if (message.includes("Forbidden")) {
      return jsonError(message, 403);
    }

    if (message.startsWith("Invalid ") || message.includes(" is required")) {
      return jsonError(message, 400);
    }

    return jsonError("Unexpected API error.", 500);
  }
}

export async function POST(request: Request) {
  return selectPlatformTenant(request);
}