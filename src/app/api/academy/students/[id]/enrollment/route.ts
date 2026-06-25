import { handleApi } from "@/app/api/academy/api-utils";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { withAcademyDatabaseContext } from "@/lib/academy-database-context";
import {
  updateEnrollmentStatus,
  updateStudentEnrollmentFields,
  type RegistrarEnrollmentUpdate,
} from "@/modules/people/student-record-mutations";
import type { StudentEnrollmentStatus } from "@/modules/people/types";

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
    const { actor } = await resolveAcademyActorFromSession(request);

    // Check if this is an enrollment status update (requires newStatus and reason)
    if ("newStatus" in body && "reason" in body) {
      const newStatus = body.newStatus as StudentEnrollmentStatus;
      const reason = typeof body.reason === "string" ? body.reason : "";

      if (!reason) {
        throw new Error("Reason is required for enrollment status changes.");
      }

      await withAcademyDatabaseContext(actor, async (client) => {
        await updateEnrollmentStatus(
          actor,
          { studentPersonId: id, newStatus, reason },
          client as unknown as Queryable,
        );
      });

      return { success: true };
    }

    // Otherwise, handle enrollment field updates (programId, advisorPersonId)
    const reason = typeof body.reason === "string" ? body.reason : "";

    if (!reason) {
      throw new Error("Reason is required for enrollment field changes.");
    }

    const updates: RegistrarEnrollmentUpdate = {};

    if ("programId" in body) {
      updates.programId = body.programId === null ? null : String(body.programId);
    }

    if ("advisorPersonId" in body) {
      updates.advisorPersonId = body.advisorPersonId === null ? null : String(body.advisorPersonId);
    }

    await withAcademyDatabaseContext(actor, async (client) => {
      await updateStudentEnrollmentFields(actor, id, updates, reason, client as unknown as Queryable);
    });

    return { success: true };
  });
}
