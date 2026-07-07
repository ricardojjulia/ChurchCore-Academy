import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { updatePersonFields, archivePerson, UpdatePersonInput } from "@/modules/people/person-mutations";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();
    const { id } = await params;

    return withAcademyDatabaseContext(actor, async (client) => {
      return updatePersonFields(
        actor,
        id,
        body as UpdatePersonInput,
        asAcademyDatabase<Queryable>(client)
      );
    });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();
    const reason = body.reason as string;
    const { id } = await params;

    if (!reason || reason.trim().length === 0) {
      throw new Error("Reason is required for person archive.");
    }

    await withAcademyDatabaseContext(actor, async (client) => {
      await archivePerson(
        actor,
        id,
        reason,
        asAcademyDatabase<Queryable>(client)
      );
    });

    return { success: true };
  });
}
