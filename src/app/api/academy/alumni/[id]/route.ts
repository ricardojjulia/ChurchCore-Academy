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
      const toNullableString = (value: unknown): string | null | undefined =>
        value === undefined ? undefined : value === null ? null : String(value);
      return updateAlumniRecord(
        actor,
        id,
        {
          employer: toNullableString(body.employer),
          jobTitle: toNullableString(body.jobTitle),
          location: toNullableString(body.location),
          status: body.status !== undefined ? (body.status as AlumniStatus) : undefined,
        },
        client,
      );
    });
  });
}
