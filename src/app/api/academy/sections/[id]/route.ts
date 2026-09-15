import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  updateSection,
  deleteSection,
  type UpdateSectionInput,
} from "@/modules/course-catalog/mutations";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    const input: UpdateSectionInput = {};

    if (typeof body.titleOverride === "string") input.titleOverride = body.titleOverride;
    if (typeof body.deliveryMode === "string") input.deliveryMode = body.deliveryMode as never;
    if (typeof body.schedulePattern === "string") input.schedulePattern = body.schedulePattern;
    if (typeof body.capacity === "number") input.capacity = body.capacity;
    if (typeof body.primaryInstructorRole === "string") input.primaryInstructorRole = body.primaryInstructorRole as never;
    if (typeof body.primaryInstructorId === "string") input.primaryInstructorId = body.primaryInstructorId;

    return withAcademyDatabaseContext(actor, async (client) => {
      return updateSection(actor, id, input, asAcademyDatabase<Queryable>(client));
    });
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      await deleteSection(actor, id, asAcademyDatabase<Queryable>(client));
      return { success: true };
    });
  });
}
