import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { updateAlumniRecord, type AlumniDatabase, type AlumniStatus } from "@/modules/people/alumni";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    return withAcademyDatabaseContext(actor, (client) =>
      updateAlumniRecord(
        actor,
        id,
        {
          employer: body.employer !== undefined ? String(body.employer) : undefined,
          jobTitle: body.jobTitle !== undefined ? String(body.jobTitle) : undefined,
          location: body.location !== undefined ? String(body.location) : undefined,
          status: body.status !== undefined ? (body.status as AlumniStatus) : undefined,
        },
        asAcademyDatabase<AlumniDatabase>(client),
      ),
    );
  });
}
