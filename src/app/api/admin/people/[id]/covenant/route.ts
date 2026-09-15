import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { getCovenantRecord, upsertCovenantRecord } from "@/modules/people/covenant-mutations";
import { CovenantFields } from "@/modules/people/types";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;

    return withAcademyDatabaseContext(actor, async (client) => {
      const record = await getCovenantRecord(
        actor,
        id,
        asAcademyDatabase<Queryable>(client)
      );

      return { record };
    });
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json();
    const { id } = await params;

    return withAcademyDatabaseContext(actor, async (client) => {
      return upsertCovenantRecord(
        actor,
        id,
        body as CovenantFields,
        asAcademyDatabase<Queryable>(client)
      );
    });
  });
}
