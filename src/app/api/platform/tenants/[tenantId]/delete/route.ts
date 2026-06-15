import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { AcademyAuthenticationError } from "@/modules/academy-auth/errors";
import { resolvePlatformSessionForServerComponent } from "@/modules/academy-auth/request-context";
import { PostgresPlatformAdminRepository } from "@/modules/platform-admin/postgres-repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const resolvedParams = await params;
    const tenantId = resolvedParams.tenantId;

    const session = await resolvePlatformSessionForServerComponent();

    if (!session.platformRoles.includes("platform_admin")) {
      throw new AcademyAuthenticationError(
        "Only platform admins can delete tenants.",
      );
    }

    const repository = new PostgresPlatformAdminRepository();
    await repository.deleteTenant(tenantId);

    return jsonOk({ success: true, tenantId });
  } catch (error) {
    if (error instanceof AcademyAuthenticationError) {
      return jsonError(error.message, 403);
    }

    const message = error instanceof Error ? error.message : "Unable to delete tenant.";
    return jsonError(message, 500);
  }
}
