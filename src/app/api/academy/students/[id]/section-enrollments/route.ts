import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  PostgresStudentSectionEnrollmentRepository,
  type StudentSectionEnrollmentDatabase,
} from "@/modules/student-section-enrollments/postgres-repository";
import { StudentSectionEnrollmentService } from "@/modules/student-section-enrollments/service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const service = new StudentSectionEnrollmentService(
        new PostgresStudentSectionEnrollmentRepository(
          asAcademyDatabase<StudentSectionEnrollmentDatabase>(client),
        ),
      );
      const sections = await service.listAvailableSections(actor, id);
      return { sections };
    });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const service = new StudentSectionEnrollmentService(
        new PostgresStudentSectionEnrollmentRepository(
          asAcademyDatabase<StudentSectionEnrollmentDatabase>(client),
        ),
      );
      const enrollment = await service.assignSection(actor, {
        studentProfileId: id,
        courseSectionId: typeof body.courseSectionId === "string" ? body.courseSectionId : "",
      });
      return { enrollment };
    });
  });
}
