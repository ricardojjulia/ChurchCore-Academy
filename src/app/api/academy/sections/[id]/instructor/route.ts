import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assignInstructor } from "@/modules/course-catalog/mutations";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    if (typeof body.instructorPersonId !== "string" || !body.instructorPersonId) {
      throw new Error("Instructor person ID is required.");
    }

    const instructorPersonId = body.instructorPersonId;

    return withAcademyDatabaseContext(actor, async (client) => {
      return assignInstructor(actor, id, instructorPersonId, asAcademyDatabase<Queryable>(client));
    });
  });
}
