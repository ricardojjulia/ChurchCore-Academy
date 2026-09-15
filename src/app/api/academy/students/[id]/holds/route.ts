import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { addHold, listHolds, type HoldType } from "@/modules/people/student-record-mutations";

type Queryable = {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      return listHolds(actor, id, client as unknown as Queryable, false);
    });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const holdType = typeof body.holdType === "string" ? (body.holdType as HoldType) : undefined;
    const note = typeof body.note === "string" ? body.note : "";

    if (!holdType) {
      throw new Error("holdType is required.");
    }
    if (!note) {
      throw new Error("note is required.");
    }

    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      return addHold(actor, { studentPersonId: id, holdType, note }, client as unknown as Queryable);
    });
  });
}
