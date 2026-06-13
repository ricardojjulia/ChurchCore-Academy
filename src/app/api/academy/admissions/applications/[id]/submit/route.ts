import { randomUUID } from "node:crypto";
import { handleApi } from "@/app/api/academy/api-utils";
import { requireIdempotencyKey } from "@/app/api/academy/admissions/request-utils";
import { createAdmissionsService } from "@/app/api/academy/admissions/service-factory";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await context.params;
    const idempotencyKey = requireIdempotencyKey(request.headers);
    const correlationId =
      request.headers.get("x-correlation-id")?.trim() ||
      `corr-admission-${randomUUID()}`;

    return withAcademyDatabaseContext(actor, async (client) => ({
      application: await createAdmissionsService(client).submit(
        actor,
        id,
        correlationId,
        idempotencyKey,
      ),
    }));
  });
}
