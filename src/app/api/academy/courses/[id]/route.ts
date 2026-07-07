import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { CourseCatalogService } from "@/modules/course-catalog/service";
import {
  AcademyCourseCatalogRepository,
  type CourseCatalogRepository,
} from "@/modules/course-catalog/postgres-repository";
import type { CourseStatus } from "@/modules/course-catalog/types";
import { AcademyConflictError } from "@/modules/academy-auth/errors";

type Queryable = {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
};

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new AcademyCourseCatalogRepository(asAcademyDatabase<Queryable>(client));
      const service = new CourseCatalogService(repository as CourseCatalogRepository);

      const course = await service.getCourse(actor, id);
      if (!course) {
        throw new Error("Course not found.");
      }

      return { course };
    });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new AcademyCourseCatalogRepository(asAcademyDatabase<Queryable>(client));
      const service = new CourseCatalogService(repository as CourseCatalogRepository);

      const course = await service.updateCourse(actor, id, {
        title: typeof body.title === "string" ? body.title : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        defaultCredits: typeof body.defaultCredits === "number" ? body.defaultCredits : undefined,
        defaultClockHours: typeof body.defaultClockHours === "number" ? body.defaultClockHours : undefined,
        owningSubdivisionId: typeof body.owningSubdivisionId === "string" ? body.owningSubdivisionId : undefined,
        prerequisiteIds: Array.isArray(body.prerequisiteIds) ? body.prerequisiteIds.filter((id): id is string => typeof id === "string") : undefined,
        status: typeof body.status === "string" ? body.status as CourseStatus : undefined,
      });

      return { course };
    });
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const db = asAcademyDatabase<Queryable>(client);

      // Only draft courses with no sections can be deleted
      const course = await db.query(
        `select status from academy_courses where tenant_id = $1 and id = $2`,
        [actor.tenantId, id],
      );

      if (!course.rowCount || course.rowCount === 0) {
        throw new Error("Course not found.");
      }

      if (course.rows[0].status !== "draft") {
        throw new Error("Only draft courses can be deleted. Archive active courses instead.");
      }

      const sections = await db.query(
        `select count(*) as cnt from academy_course_sections where tenant_id = $1 and course_id = $2`,
        [actor.tenantId, id],
      );

      if (Number(sections.rows[0]?.cnt) > 0) {
        throw new AcademyConflictError("Course has sections and cannot be deleted. Archive it instead.");
      }

      await db.query(
        `delete from academy_courses where tenant_id = $1 and id = $2`,
        [actor.tenantId, id],
      );

      return { ok: true };
    });
  });
}
