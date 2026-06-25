import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { listAdvisorNotes } from "@/modules/people/student-record-mutations";

type Queryable = {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
};

/**
 * GET /api/academy/students/[id]/advisor-notes
 * Returns advisor notes for a student.
 * - Staff (advisor/registrar/admin) see all notes
 * - Students see only notes where visible_to_student = true
 * - Guardians are forbidden
 */
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
