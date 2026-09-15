import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { updateAlumniRecord, type AlumniStatus } from "@/modules/people/alumni";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "alumniGiving");
      return updateAlumniRecord(
        actor,
        id,
        {
          employer: body.employer !== undefined ? String(body.employer) : undefined,
          jobTitle: body.jobTitle !== undefined ? String(body.jobTitle) : undefined,
          location: body.location !== undefined ? String(body.location) : undefined,
          status: body.status !== undefined ? (body.status as AlumniStatus) : undefined,
        },
        client,
      );
    });
  });
}
