import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { createCampus, listCampuses, type CampusDatabase } from "@/modules/academy-config/campuses";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    return withAcademyDatabaseContext(actor, (client) =>
      listCampuses(actor, asAcademyDatabase<CampusDatabase>(client), includeInactive),
    );
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = (await request.json()) as Record<string, unknown>;

    const code = String(body.code ?? "").trim();
    const name = String(body.name ?? "").trim();

    if (!code) throw new Error("code is required.");
    if (!name) throw new Error("name is required.");

    return withAcademyDatabaseContext(actor, (client) =>
      createCampus(
        actor,
        {
          code,
          name,
          address: body.address ? String(body.address) : undefined,
          city: body.city ? String(body.city) : undefined,
          state: body.state ? String(body.state) : undefined,
          country: body.country ? String(body.country) : undefined,
        },
        asAcademyDatabase<CampusDatabase>(client),
      ),
    );
  });
}
