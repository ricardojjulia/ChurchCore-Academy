import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { archiveTerm } from "@/modules/academic-calendar/mutations";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const result = await archiveTerm(actor, id, asAcademyDatabase<Queryable>(client));

      if (!result.success) {
        const response = new Response(
          JSON.stringify({
            error: "Cannot archive term with active enrollments",
            blockingRecords: result.blockingRecords
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
        return response;
      }

      return { success: true };
    });
  });
}
