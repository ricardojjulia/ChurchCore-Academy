import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { AcademyGradingRecordsRepository } from "@/modules/grading-records/postgres-repository";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const body = (await request.json()) as Record<string, unknown>;

    if (!actor.roles.some((role) => ["institution_admin", "academic_admin"].includes(role))) {
      throw new AcademyAuthorizationError("Institution admin or academic admin role required.");
    }

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "competencyNarrativeGrading");
      const repository = new AcademyGradingRecordsRepository(asAcademyDatabase(client));
      return repository.createScaleBand(actor, {
        scaleId: String(body.scaleId),
        label: String(body.label),
        minimumValue: body.minimumValue !== undefined && body.minimumValue !== null ? Number(body.minimumValue) : undefined,
        maximumValue: body.maximumValue !== undefined && body.maximumValue !== null ? Number(body.maximumValue) : undefined,
        gradePoints: body.gradePoints !== undefined && body.gradePoints !== null ? Number(body.gradePoints) : undefined,
        isPassing: Boolean(body.isPassing),
        isCompletion: Boolean(body.isCompletion),
        officialRecordValue: String(body.officialRecordValue),
        sequence: Number(body.sequence),
      });
    });
  });
}
