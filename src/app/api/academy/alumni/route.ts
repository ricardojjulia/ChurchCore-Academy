import { handleApi } from "@/app/api/academy/api-utils";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import {
  createAlumniRecord,
  listAlumni,
  type AlumniStatus,
} from "@/modules/people/alumni";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { searchParams } = new URL(request.url);

    const yearParam = searchParams.get("graduationYear");
    const statusParam = searchParams.get("status");

    const filters: { graduationYear?: number; status?: AlumniStatus } = {};
    if (yearParam) filters.graduationYear = parseInt(yearParam, 10);
    if (statusParam) filters.status = statusParam as AlumniStatus;

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "alumniGiving");
      return listAlumni(actor, filters, client);
    });
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = (await request.json()) as Record<string, unknown>;

    const personId = String(body.personId ?? "").trim();
    const degreeEarned = String(body.degreeEarned ?? "").trim();
    const graduationYear = Number(body.graduationYear);

    if (!personId) throw new Error("personId is required.");
    if (!degreeEarned) throw new Error("degreeEarned is required.");
    if (!graduationYear) throw new Error("graduationYear is required.");

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "alumniGiving");
      return createAlumniRecord(
        actor,
        {
          personId,
          graduationYear,
          degreeEarned,
          programId: body.programId ? String(body.programId) : undefined,
          employer: body.employer ? String(body.employer) : undefined,
          jobTitle: body.jobTitle ? String(body.jobTitle) : undefined,
          location: body.location ? String(body.location) : undefined,
        },
        client,
      );
    });
  });
}
