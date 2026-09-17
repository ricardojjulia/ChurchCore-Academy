/**
 * Section Final Grades API Route — ADR-0054 §3
 *
 * GET  /api/academy/sections/[id]/final-grades — final-grade submission status per registration
 * POST /api/academy/sections/[id]/final-grades — submit a student's official final grade for
 *   this section (submitDraftFinalGrade); also marks their registration "completed", making it
 *   eligible for the registrar's existing transcript-entry promotion flow.
 */

import { handleApi, jsonError } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  getSectionFinalGradeStatus,
  submitDraftFinalGrade,
  type AssignmentDatabase,
} from "@/modules/grading-records/assignment-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id: sectionId } = await context.params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      return getSectionFinalGradeStatus(
        asAcademyDatabase<AssignmentDatabase>(client),
        actor,
        sectionId,
      );
    });
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id: sectionId } = await context.params;
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = await request.json() as Record<string, unknown>;

    const learnerPersonId = typeof body.learnerPersonId === "string" ? body.learnerPersonId : null;
    const letterGrade = typeof body.letterGrade === "string" ? body.letterGrade.trim() : null;
    const isPassing = typeof body.isPassing === "boolean" ? body.isPassing : null;

    if (!learnerPersonId || !letterGrade || isPassing === null) {
      return jsonError("learnerPersonId, letterGrade, and isPassing are required.", 400);
    }

    return withAcademyDatabaseContext(actor, async (client) => {
      return submitDraftFinalGrade(
        asAcademyDatabase<AssignmentDatabase>(client),
        actor,
        sectionId,
        learnerPersonId,
        letterGrade,
        isPassing,
      );
    });
  });
}
