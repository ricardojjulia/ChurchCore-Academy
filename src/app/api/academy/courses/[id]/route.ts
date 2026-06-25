import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  updateCourse,
  archiveCourse,
  type UpdateCourseInput,
} from "@/modules/course-catalog/mutations";
import type { CourseDuration } from "@/modules/course-catalog/types";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    const input: UpdateCourseInput = {};

    if (typeof body.code === "string") input.code = body.code;
    if (typeof body.title === "string") input.title = body.title;
    if (typeof body.description === "string") input.description = body.description;
    if (typeof body.courseType === "string") input.courseType = body.courseType as never;
    if (typeof body.courseLevel === "string") input.courseLevel = body.courseLevel as never;
    if (typeof body.recordType === "string") input.recordType = body.recordType as never;
    if (typeof body.defaultDuration === "object") input.defaultDuration = body.defaultDuration as CourseDuration;
    if (typeof body.defaultCredits === "number") input.defaultCredits = body.defaultCredits;
    if (typeof body.defaultClockHours === "number") input.defaultClockHours = body.defaultClockHours;
    if (typeof body.defaultCompetencySetId === "string") input.defaultCompetencySetId = body.defaultCompetencySetId;
    if (typeof body.owningSubdivisionId === "string") input.owningSubdivisionId = body.owningSubdivisionId;
    if (typeof body.gradeBandSubdivisionId === "string") input.gradeBandSubdivisionId = body.gradeBandSubdivisionId;

    return withAcademyDatabaseContext(actor, async (client) => {
      return updateCourse(actor, id, input, asAcademyDatabase<Queryable>(client));
    });
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await context.params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      return archiveCourse(actor, id, asAcademyDatabase<Queryable>(client));
    });
  });
}
