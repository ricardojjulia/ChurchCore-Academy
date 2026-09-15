import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { CourseCatalogService } from "@/modules/course-catalog/service";
import {
  AcademyCourseCatalogRepository,
  type CourseCatalogRepository,
} from "@/modules/course-catalog/postgres-repository";
import type { CourseType, CourseLevel, CourseRecordType } from "@/modules/course-catalog/types";

type Queryable = {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
};

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = (await request.json()) as Record<string, unknown>;

    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new AcademyCourseCatalogRepository(asAcademyDatabase<Queryable>(client));
      const service = new CourseCatalogService(repository as CourseCatalogRepository);

      const course = await service.createCourse(actor, {
        code: typeof body.code === "string" ? body.code : "",
        title: typeof body.title === "string" ? body.title : "",
        description: typeof body.description === "string" ? body.description : "",
        courseType: typeof body.courseType === "string" ? body.courseType as CourseType : "bible_course",
        courseLevel: typeof body.courseLevel === "string" ? body.courseLevel as CourseLevel : "undergraduate",
        recordType: typeof body.recordType === "string" ? body.recordType as CourseRecordType : "credit_course",
        defaultCredits: typeof body.defaultCredits === "number" ? body.defaultCredits : undefined,
        defaultClockHours: typeof body.defaultClockHours === "number" ? body.defaultClockHours : undefined,
        owningSubdivisionId: typeof body.owningSubdivisionId === "string" ? body.owningSubdivisionId : undefined,
        prerequisiteIds: Array.isArray(body.prerequisiteIds) ? body.prerequisiteIds.filter((id): id is string => typeof id === "string") : undefined,
      });

      return { course };
    });
  });
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { searchParams } = new URL(request.url);
    const subdivisionId = searchParams.get("subdivisionId") ?? undefined;
    const includeArchived = searchParams.get("includeArchived") === "true";

    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new AcademyCourseCatalogRepository(asAcademyDatabase<Queryable>(client));
      const service = new CourseCatalogService(repository as CourseCatalogRepository);

      const courses = await service.listCourses(actor, {
        subdivisionId,
        includeArchived,
      });

      return { courses };
    });
  });
}
