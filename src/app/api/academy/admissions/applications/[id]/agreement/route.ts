import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability, AcademyActor } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { PostgresEnrollmentAgreementRepository } from "@/modules/admissions/enrollment-agreement-repository";

type RouteContext = { params: Promise<{ id: string }> };

interface DatabaseClient {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

interface FindAgreementDependencies {
  resolveActor(request: Request): Promise<AcademyActor>;
  findAgreement(
    actor: AcademyActor,
    applicationId: string,
  ): Promise<
    | {
        id: string;
        applicationId: string;
        status: string;
        signedByPersonId?: string;
        signedAt?: string;
      }
    | undefined
  >;
}

const defaultDependencies: FindAgreementDependencies = {
  resolveActor: async (request) =>
    (await resolveAcademyActorFromSession(request)).actor,
  findAgreement: async (actor, applicationId) =>
    withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");

      const repo = new PostgresEnrollmentAgreementRepository(
        asAcademyDatabase<DatabaseClient>(client),
      );

      const agreement = await repo.findByApplication(actor.tenantId, applicationId);

      if (!agreement) {
        return undefined;
      }

      // Explicitly exclude agreementTextHash and redactedIpAddress from response
      return {
        id: agreement.id,
        applicationId: agreement.applicationId,
        status: agreement.status,
        signedByPersonId: agreement.signedByPersonId,
        signedAt: agreement.signedAt,
      };
    }),
};

export async function GET(request: Request, context: RouteContext) {
  return getAgreementRequest(request, context);
}

export async function getAgreementRequest(
  request: Request,
  context: RouteContext,
  dependencies: FindAgreementDependencies = defaultDependencies,
) {
  return handleApi(async () => {
    const actor = await dependencies.resolveActor(request);
    const { id: applicationId } = await context.params;
    const agreement = await dependencies.findAgreement(actor, applicationId);

    if (!agreement) {
      throw new Error("Enrollment agreement was not found.");
    }

    return { agreement };
  });
}
