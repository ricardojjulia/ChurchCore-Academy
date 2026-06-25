import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { updateCampus, type CampusDatabase } from "@/modules/academy-config/campuses";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    return withAcademyDatabaseContext(actor, (client) =>
      updateCampus(
        actor,
        id,
        {
          name: body.name !== undefined ? String(body.name) : undefined,
          address: body.address !== undefined ? String(body.address) : undefined,
          city: body.city !== undefined ? String(body.city) : undefined,
          state: body.state !== undefined ? String(body.state) : undefined,
          country: body.country !== undefined ? String(body.country) : undefined,
          isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
        },
        asAcademyDatabase<CampusDatabase>(client),
      ),
    );
  });
}
