import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  createSection,
  type CreateSectionInput,
} from "@/modules/course-catalog/mutations";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    if (typeof body.courseId !== "string" || !body.courseId) {
      throw new Error("Course ID is required.");
    }
    if (typeof body.academicYearId !== "string" || !body.academicYearId) {
      throw new Error("Academic year ID is required.");
    }
    if (typeof body.academicPeriodId !== "string" || !body.academicPeriodId) {
      throw new Error("Academic period ID is required.");
    }
    if (typeof body.sectionCode !== "string" || !body.sectionCode) {
      throw new Error("Section code is required.");
    }
    if (typeof body.deliveryMode !== "string" || !body.deliveryMode) {
      throw new Error("Delivery mode is required.");
    }
    if (typeof body.primaryInstructorRole !== "string" || !body.primaryInstructorRole) {
      throw new Error("Primary instructor role is required.");
    }

    const input: CreateSectionInput = {
      courseId: body.courseId,
      academicYearId: body.academicYearId,
      academicPeriodId: body.academicPeriodId,
      sectionCode: body.sectionCode,
      deliveryMode: body.deliveryMode as never,
      primaryInstructorRole: body.primaryInstructorRole as never,
      subdivisionId: typeof body.subdivisionId === "string" ? body.subdivisionId : undefined,
      titleOverride: typeof body.titleOverride === "string" ? body.titleOverride : undefined,
      schedulePattern: typeof body.schedulePattern === "string" ? body.schedulePattern : undefined,
      capacity: typeof body.capacity === "number" ? body.capacity : undefined,
      primaryInstructorId: typeof body.primaryInstructorId === "string" ? body.primaryInstructorId : undefined,
    };

    return withAcademyDatabaseContext(actor, async (client) => {
      return createSection(actor, input, asAcademyDatabase<Queryable>(client));
    });
  });
}
