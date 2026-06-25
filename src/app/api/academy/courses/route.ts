import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  createCourse,
  type CreateCourseInput,
} from "@/modules/course-catalog/mutations";
import type { CourseDuration } from "@/modules/course-catalog/types";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    if (typeof body.code !== "string" || !body.code) {
      throw new Error("Course code is required.");
    }
    if (typeof body.title !== "string" || !body.title) {
      throw new Error("Course title is required.");
    }
    if (typeof body.description !== "string" || !body.description) {
      throw new Error("Course description is required.");
    }
    if (typeof body.courseType !== "string" || !body.courseType) {
      throw new Error("Course type is required.");
    }
    if (typeof body.courseLevel !== "string" || !body.courseLevel) {
      throw new Error("Course level is required.");
    }
    if (typeof body.recordType !== "string" || !body.recordType) {
      throw new Error("Record type is required.");
    }
    if (typeof body.defaultDuration !== "object" || !body.defaultDuration) {
      throw new Error("Default duration is required.");
    }

    const input: CreateCourseInput = {
      code: body.code,
      title: body.title,
      description: body.description,
      courseType: body.courseType as never,
      courseLevel: body.courseLevel as never,
      recordType: body.recordType as never,
      defaultDuration: body.defaultDuration as CourseDuration,
      defaultCredits: typeof body.defaultCredits === "number" ? body.defaultCredits : undefined,
      defaultClockHours: typeof body.defaultClockHours === "number" ? body.defaultClockHours : undefined,
      defaultCompetencySetId: typeof body.defaultCompetencySetId === "string" ? body.defaultCompetencySetId : undefined,
      owningSubdivisionId: typeof body.owningSubdivisionId === "string" ? body.owningSubdivisionId : undefined,
      gradeBandSubdivisionId: typeof body.gradeBandSubdivisionId === "string" ? body.gradeBandSubdivisionId : undefined,
    };

    return withAcademyDatabaseContext(actor, async (client) => {
      return createCourse(actor, input, asAcademyDatabase<Queryable>(client));
    });
  });
}
