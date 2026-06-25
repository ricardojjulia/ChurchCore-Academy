import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import {
  addAdvisorNote,
  listAdvisorNotes,
} from "@/modules/people/student-record-mutations";

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
      return listAdvisorNotes(actor, id, client as unknown as Queryable);
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
    const noteText = typeof body.noteText === "string" ? body.noteText : "";

    if (!noteText) {
      throw new Error("noteText is required.");
    }

    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      return addAdvisorNote(actor, { studentPersonId: id, noteText }, client as unknown as Queryable);
    });
  });
}
