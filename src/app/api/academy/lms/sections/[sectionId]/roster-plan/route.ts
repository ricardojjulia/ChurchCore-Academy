import { randomUUID } from "node:crypto";
import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, type AcademyQueryClient } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { AcademyConfigRepository } from "@/modules/academy-config/postgres-repository";
import { buildLmsRosterSyncPlanPayload } from "@/app/api/academy/lms/contract/route";
import {
  buildRosterIdempotencyKey,
  buildRosterSyncPlanInputFromSource,
  PostgresLmsRosterSourceRepository,
  type LmsRosterSourceDatabase,
} from "@/modules/lms-roster-source";

type ConfigDatabase = ConstructorParameters<typeof AcademyConfigRepository>[0];

function correlationId(headers: Headers) {
  const existing = headers.get("x-correlation-id")?.trim();
  return existing || `corr-lms-roster-source-${randomUUID()}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const requestCorrelationId = correlationId(request.headers);

  return handleApi(async () => {
    const { sectionId } = await params;
    if (!sectionId || sectionId.trim().length === 0) {
      throw new Error("sectionId is required.");
    }

    const { actor } = await resolveAcademyActorFromSession(request);

    return withCapabilityContext(actor, async (client: AcademyQueryClient) => {
      const rosterRepository = new PostgresLmsRosterSourceRepository(
        asAcademyDatabase<LmsRosterSourceDatabase>(client),
      );
      const source = await rosterRepository.fetchSectionRosterSource(actor.tenantId, sectionId);
      const input = buildRosterSyncPlanInputFromSource(source, buildRosterIdempotencyKey(sectionId));
      const payload = await buildLmsRosterSyncPlanPayload(
        new AcademyConfigRepository(asAcademyDatabase<ConfigDatabase>(client)),
        actor,
        actor.tenantId,
        requestCorrelationId,
        input,
      );

      return {
        ...payload,
        section: {
          id: source.id,
          sectionCode: source.sectionCode,
          courseCode: source.courseCode,
          courseTitle: source.courseTitle,
          academicPeriodName: source.academicPeriodName,
        },
        roster: {
          instructorCount: input.instructorPersonIds.length,
          studentCount: input.studentPersonIds.length,
          activeCount: Object.values(input.enrollmentStates).filter((state) => state === "active").length,
          completedCount: Object.values(input.enrollmentStates).filter((state) => state === "completed").length,
          withdrawnCount: Object.values(input.enrollmentStates).filter((state) => state === "withdrawn").length,
        },
      };
    });
  }, {
    operation: "lms.roster_source_plan",
    correlationId: requestCorrelationId,
  });
}
