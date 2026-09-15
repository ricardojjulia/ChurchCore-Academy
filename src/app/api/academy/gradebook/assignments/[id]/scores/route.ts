import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  upsertSubmissionScore,
  GradeDeadlineError,
  type AssignmentDatabase,
} from "@/modules/grading-records/assignment-service";

/**
 * PUT /api/academy/gradebook/assignments/[id]/scores
 *
 * Upserts a submission score for a learner on the given assignment.
 * Returns a 422 if the grade submission deadline has passed.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id: assignmentId } = await params;

    if (!assignmentId?.trim()) throw new Error("Assignment id is required.");

    const body = (await request.json()) as Record<string, unknown>;

    const learnerPersonId =
      typeof body.learnerPersonId === "string" && body.learnerPersonId.trim()
        ? body.learnerPersonId.trim()
        : null;

    if (!learnerPersonId) throw new Error("learnerPersonId is required.");

    const score =
      body.score === null
        ? null
        : typeof body.score === "number"
          ? body.score
          : body.score !== undefined
            ? Number(body.score)
            : null;

    try {
      return await withAcademyDatabaseContext(actor, async (client) => {
        const db = asAcademyDatabase<AssignmentDatabase>(client);
        return upsertSubmissionScore(db, actor, {
          assignmentId,
          learnerPersonId,
          score,
        });
      });
    } catch (err) {
      if (err instanceof GradeDeadlineError) {
        // Re-throw with a message that handleApi maps to 400
        throw new Error(err.message);
      }
      throw err;
    }
  });
}
