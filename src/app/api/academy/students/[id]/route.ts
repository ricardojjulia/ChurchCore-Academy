import { AcademyDataRepository } from "@/modules/academy-data/postgres-repository";
import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { requireActor } from "@/lib/require-actor";
import { STUDENT_RECORD_ROLES } from "@/modules/people/access-policy";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    // The full student roster is staff-only. Without this check any signed-in user, a student
    // or guardian included, could read every student's record in the institution.
    requireActor(actor, STUDENT_RECORD_ROLES);
    const { id } = await context.params;
    return withAcademyDatabaseContext(actor, async (client) => {
      const dataset = await new AcademyDataRepository(
        asAcademyDatabase(client),
      ).loadDataset(actor.tenantId);
      const student = dataset.students.find((item) => item.id === id);

      if (!student) {
        throw new Error(`Student ${id} was not found.`);
      }

      const program = dataset.programs.find((item) => item.id === student.programId);
      const advisor = dataset.administrators.find((item) => item.id === student.advisorUserId);

      return {
        student,
        program,
        advisor,
      };
    });
  });
}
