import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { updateEnrollmentStatus } from "@/modules/people/student-record-mutations";
import { StudentEnrollmentStatus } from "@/modules/people/types";

type Queryable = {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const newStatus = typeof body.status === "string" ? (body.status as StudentEnrollmentStatus) : undefined;
    const reason = typeof body.reason === "string" ? body.reason : "";

    if (!newStatus) {
      throw new Error("status is required.");
    }
    if (!reason) {
      throw new Error("reason is required.");
    }

    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      await updateEnrollmentStatus(actor, { studentPersonId: id, newStatus, reason }, client as unknown as Queryable);
      return { success: true, newStatus };
    });
  });
}
