import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  PostgresStudentProgramMembershipRepository,
  type StudentProgramMembershipDatabase,
} from "@/modules/student-program-memberships/postgres-repository";
import { StudentProgramMembershipService } from "@/modules/student-program-memberships/service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const service = new StudentProgramMembershipService(
        new PostgresStudentProgramMembershipRepository(
          asAcademyDatabase<StudentProgramMembershipDatabase>(client),
        ),
      );
      const memberships = await service.listMemberships(actor, id);
      return { memberships };
    });
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const service = new StudentProgramMembershipService(
        new PostgresStudentProgramMembershipRepository(
          asAcademyDatabase<StudentProgramMembershipDatabase>(client),
        ),
      );
      const membership = await service.setActiveMembership(actor, {
        studentProfileId: id,
        academicProgramId: typeof body.academicProgramId === "string" ? body.academicProgramId : "",
        catalogAcademicYearId: typeof body.catalogAcademicYearId === "string" ? body.catalogAcademicYearId : "",
        startedOn: typeof body.startedOn === "string" ? body.startedOn : undefined,
      });
      return { membership };
    });
  });
}
