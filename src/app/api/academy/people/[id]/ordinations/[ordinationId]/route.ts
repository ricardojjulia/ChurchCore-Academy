import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { updateOrdinationStatus } from "@/modules/people/denomination";

type RouteContext = {
  params: Promise<{ id: string; ordinationId: string }>;
};

const VALID_STATUSES = new Set(["active", "revoked", "retired", "suspended"]);

export async function PATCH(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { ordinationId } = await context.params;
    const body = (await request.json()) as { ordinationStatus?: string };

    if (!body.ordinationStatus) {
      throw new Error("ordinationStatus is required.");
    }

    if (!VALID_STATUSES.has(body.ordinationStatus)) {
      throw new Error("Invalid ordinationStatus.");
    }

    return withAcademyDatabaseContext(actor, async (client) => {
      return updateOrdinationStatus(
        actor,
        ordinationId,
        body.ordinationStatus as "active" | "revoked" | "retired" | "suspended",
        client,
      );
    });
  });
}
