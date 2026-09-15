import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  deleteAssignment,
  type AssignmentDatabase,
} from "@/modules/grading-records/assignment-service";

/**
 * DELETE /api/academy/gradebook/assignments/[id]
 *
 * Deletes an assignment and all its submissions.
 * Caller must be an instructor assigned to the assignment's section (or an admin).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;

    if (!id?.trim()) throw new Error("Assignment id is required.");

    await withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<AssignmentDatabase>(client);
      await deleteAssignment(db, actor, id);
    });

    return { deleted: true, assignmentId: id };
  });
}
