/**
 * Computed Grades API Route — ADR-0054
 *
 * GET /api/academy/sections/[id]/computed-grades — advisory weighted grades
 */

import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  computeSectionGrades,
  type AssignmentGradingDatabase,
} from "@/modules/grading-records/assignment-grading-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleApi(async () => {
    const { id: sectionId } = await context.params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      return computeSectionGrades(
        asAcademyDatabase<AssignmentGradingDatabase>(client),
        actor,
        sectionId
      );
    });
  });
}
