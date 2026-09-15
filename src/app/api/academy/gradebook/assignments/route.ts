import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  createAssignment,
  type AssignmentDatabase,
  type AssignmentType,
} from "@/modules/grading-records/assignment-service";

function stringField(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/**
 * POST /api/academy/gradebook/assignments
 *
 * Creates a new gradebook assignment for a section.
 * Caller must be an instructor assigned to the section (or an admin).
 */
export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = (await request.json()) as Record<string, unknown>;

    const sectionId = stringField(body.sectionId);
    const title = stringField(body.title);
    const assignmentType = stringField(body.assignmentType) as AssignmentType | undefined;

    if (!sectionId) throw new Error("sectionId is required.");
    if (!title) throw new Error("title is required.");
    if (!assignmentType) throw new Error("assignmentType is required.");

    const maxPoints = typeof body.maxPoints === "number" ? body.maxPoints : Number(body.maxPoints);
    if (!Number.isFinite(maxPoints) || maxPoints <= 0) {
      throw new Error("maxPoints must be a positive number.");
    }

    const weight =
      typeof body.weight === "number"
        ? body.weight
        : body.weight !== undefined
          ? Number(body.weight)
          : undefined;

    return withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<AssignmentDatabase>(client);
      return createAssignment(db, actor, {
        sectionId,
        title,
        assignmentType,
        maxPoints,
        weight,
        dueDate: stringField(body.dueDate),
        description: stringField(body.description),
      });
    });
  });
}
