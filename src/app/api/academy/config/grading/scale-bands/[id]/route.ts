import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { AcademyGradingRecordsRepository } from "@/modules/grading-records/postgres-repository";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    if (!actor.roles.some((role) => ["institution_admin", "academic_admin"].includes(role))) {
      throw new AcademyAuthorizationError("Institution admin or academic admin role required.");
    }

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "competencyNarrativeGrading");
      const repository = new AcademyGradingRecordsRepository(asAcademyDatabase(client));

      const updates: Record<string, unknown> = {};
      if (body.label !== undefined) updates.label = String(body.label);
      if (body.minimumValue !== undefined) {
        updates.minimumValue = body.minimumValue === null ? null : Number(body.minimumValue);
      }
      if (body.maximumValue !== undefined) {
        updates.maximumValue = body.maximumValue === null ? null : Number(body.maximumValue);
      }
      if (body.gradePoints !== undefined) {
        updates.gradePoints = body.gradePoints === null ? null : Number(body.gradePoints);
      }
      if (body.isPassing !== undefined) updates.isPassing = Boolean(body.isPassing);
      if (body.isCompletion !== undefined) updates.isCompletion = Boolean(body.isCompletion);
      if (body.officialRecordValue !== undefined) updates.officialRecordValue = String(body.officialRecordValue);
      if (body.sequence !== undefined) updates.sequence = Number(body.sequence);

      return repository.updateScaleBand(actor, id, updates);
    });
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { id } = await params;

    if (!actor.roles.some((role) => ["institution_admin", "academic_admin"].includes(role))) {
      throw new AcademyAuthorizationError("Institution admin or academic admin role required.");
    }

    return withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "competencyNarrativeGrading");
      const repository = new AcademyGradingRecordsRepository(asAcademyDatabase(client));
      await repository.deleteScaleBand(actor, id);
      return { success: true };
    });
  });
}
