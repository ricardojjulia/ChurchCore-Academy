import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  updateAcademicYear,
  deleteAcademicYear,
  archiveAcademicYear,
  type UpdateAcademicYearInput,
} from "@/modules/academic-calendar/mutations";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      if (body.action === "archive") {
        return archiveAcademicYear(actor, id, asAcademyDatabase<Queryable>(client));
      }

      const input: UpdateAcademicYearInput = {};
      if (typeof body.name === "string") input.name = body.name;
      if (typeof body.code === "string") input.code = body.code;
      if (typeof body.startsOn === "string") input.startsOn = body.startsOn;
      if (typeof body.endsOn === "string") input.endsOn = body.endsOn;

      return updateAcademicYear(actor, id, input, asAcademyDatabase<Queryable>(client));
    });
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      await deleteAcademicYear(actor, id, asAcademyDatabase<Queryable>(client));
      return { success: true };
    });
  });
}
