import { handleApi } from "@/app/api/academy/api-utils";
import { resolvePlatformSessionForServerComponent } from "@/modules/academy-auth/request-context";
import { PlatformSessionRepository } from "@/modules/academy-auth/session-resolver";

export const ACTIVE_TENANT_COOKIE = "academy_active_tenant";

function readPreferredTenantId(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieValue = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACTIVE_TENANT_COOKIE}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  return (
    request.headers.get("x-academy-tenant-id")?.trim() ||
    (cookieValue ? decodeURIComponent(cookieValue) : undefined)
  );
}

interface PlatformSessionRouteDependencies {
  resolveSession(preferredTenantId?: string): Promise<{
    platformRoles: string[];
    tenants: Array<{
      personId: string;
      tenantId: string;
      roles: string[];
    }>;
    activeTenant: {
      personId: string;
      tenantId: string;
      roles: string[];
    };
  }>;
}

const dependencies: PlatformSessionRouteDependencies = {
  resolveSession: async (preferredTenantId) =>
    resolvePlatformSessionForServerComponent({
      preferredTenantId,
      platformSessionRepository: undefined as PlatformSessionRepository | undefined,
    }),
};

export async function getPlatformSession(
  request: Request,
  routeDependencies: PlatformSessionRouteDependencies = dependencies,
) {
  return handleApi(async () => {
    const preferredTenantId = readPreferredTenantId(request);
    const session = await routeDependencies.resolveSession(preferredTenantId);

    return {
      platformRoles: session.platformRoles,
      activeTenant: session.activeTenant,
      tenants: session.tenants,
    };
  });
}

export async function GET(request: Request) {
  return getPlatformSession(request);
}