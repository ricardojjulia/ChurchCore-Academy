import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { clearHold } from "@/modules/people/student-record-mutations";

type Queryable = {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; holdId: string }> },
) {
  return handleApi(async () => {
    const { holdId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const resolutionNote = typeof body.resolutionNote === "string" ? body.resolutionNote : "";

    if (!resolutionNote) {
      throw new Error("resolutionNote is required.");
    }

    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      return clearHold(actor, { holdId, resolutionNote }, client as unknown as Queryable);
    });
  });
}
