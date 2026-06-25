/**
 * Assignment Grades API Routes — ADR-0054
 *
 * POST /api/academy/sections/[id]/assignments/[assignmentId]/grades — bulk grade entry
 * GET /api/academy/sections/[id]/assignments/[assignmentId]/grades — get grades
 */

import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  bulkGradeAssignment,
  getAssignmentGrades,
  type AssignmentGradingDatabase,
  type BulkGradeInput,
} from "@/modules/grading-records/assignment-grading-service";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; assignmentId: string }> }
) {
  return handleApi(async () => {
    const { assignmentId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    // Validate grades array
    if (!Array.isArray(body.grades)) {
      throw new Error("Grades must be an array.");
    }

    const grades: BulkGradeInput[] = body.grades.map((g: unknown) => {
      if (typeof g !== "object" || g === null) {
        throw new Error("Each grade must be an object.");
      }
      const grade = g as Record<string, unknown>;

      if (typeof grade.studentRegistrationId !== "string") {
        throw new Error("Student registration ID is required.");
      }

      const bulkGrade: BulkGradeInput = {
        studentRegistrationId: grade.studentRegistrationId,
      };

      if (typeof grade.gradePoints === "number") {
        bulkGrade.gradePoints = grade.gradePoints;
      }
      if (typeof grade.passFailResult === "string") {
        if (!["pass", "fail"].includes(grade.passFailResult)) {
          throw new Error("Pass/fail result must be 'pass' or 'fail'.");
        }
        bulkGrade.passFailResult = grade.passFailResult as "pass" | "fail";
      }

      return bulkGrade;
    });

    return withAcademyDatabaseContext(actor, async (client) => {
      await bulkGradeAssignment(
        asAcademyDatabase<AssignmentGradingDatabase>(client),
        actor,
        assignmentId,
        grades
      );
      return { success: true, gradesEntered: grades.length };
    });
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; assignmentId: string }> }
) {
  return handleApi(async () => {
    const { assignmentId } = await context.params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      return getAssignmentGrades(
        asAcademyDatabase<AssignmentGradingDatabase>(client),
        actor,
        assignmentId
      );
    });
  });
}
