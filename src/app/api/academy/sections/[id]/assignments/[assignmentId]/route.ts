/**
 * Individual Assignment API Routes — ADR-0054
 *
 * PATCH /api/academy/sections/[id]/assignments/[assignmentId] — update assignment
 */

import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  updateAssignment,
  type AssignmentGradingDatabase,
  type UpdateAssignmentInput,
} from "@/modules/grading-records/assignment-grading-service";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; assignmentId: string }> }
) {
  return handleApi(async () => {
    const { assignmentId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    const input: UpdateAssignmentInput = {};

    if (typeof body.title === "string") {
      input.title = body.title;
    }
    if (typeof body.description === "string") {
      input.description = body.description;
    }
    if (typeof body.dueDate === "string") {
      input.dueDate = body.dueDate;
    }
    if (typeof body.maxPoints === "number") {
      if (body.maxPoints <= 0) {
        throw new Error("Max points must be positive.");
      }
      input.maxPoints = body.maxPoints;
    }
    if (typeof body.weight === "number") {
      if (body.weight < 0 || body.weight > 100) {
        throw new Error("Weight must be between 0 and 100.");
      }
      input.weight = body.weight;
    }

    return withAcademyDatabaseContext(actor, async (client) => {
      return updateAssignment(
        asAcademyDatabase<AssignmentGradingDatabase>(client),
        actor,
        assignmentId,
        input
      );
    });
  });
}
