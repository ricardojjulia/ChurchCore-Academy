/**
 * Assignment API Routes — ADR-0054
 *
 * POST /api/academy/sections/[id]/assignments — create assignment
 * GET /api/academy/sections/[id]/assignments — list assignments
 */

import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  createAssignment,
  getAssignments,
  type AssignmentGradingDatabase,
  type CreateAssignmentInput,
} from "@/modules/grading-records/assignment-grading-service";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApi(async () => {
    const { id: sectionId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    // Validate input
    if (typeof body.title !== "string" || !body.title) {
      throw new Error("Title is required.");
    }
    if (typeof body.maxPoints !== "number" || body.maxPoints <= 0) {
      throw new Error("Max points must be a positive number.");
    }
    if (typeof body.weight !== "number" || body.weight < 0 || body.weight > 100) {
      throw new Error("Weight must be between 0 and 100.");
    }
    if (typeof body.gradingType !== "string" || !["points", "pass_fail", "rubric"].includes(body.gradingType)) {
      throw new Error("Grading type must be 'points', 'pass_fail', or 'rubric'.");
    }

    const input: CreateAssignmentInput = {
      sectionId,
      title: body.title,
      description: typeof body.description === "string" ? body.description : undefined,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
      maxPoints: body.maxPoints,
      weight: body.weight,
      gradingType: body.gradingType as "points" | "pass_fail" | "rubric",
    };

    return withAcademyDatabaseContext(actor, async (client) => {
      return createAssignment(
        asAcademyDatabase<AssignmentGradingDatabase>(client),
        actor,
        input
      );
    });
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApi(async () => {
    const { id: sectionId } = await context.params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      return getAssignments(
        asAcademyDatabase<AssignmentGradingDatabase>(client),
        actor,
        sectionId
      );
    });
  });
}
