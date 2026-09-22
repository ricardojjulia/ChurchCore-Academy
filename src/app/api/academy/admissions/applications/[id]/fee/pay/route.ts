import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability, AcademyActor } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { PostgresApplicationFeeRepository } from "@/modules/admissions/application-fee-repository";
import { ApplicationFeeService } from "@/modules/admissions/application-fee-service";
import { ApplicationFeeCharge } from "@/modules/admissions/application-fee-types";
import { PublicApplicationService } from "@/modules/admissions/public-application-service";

type RouteContext = { params: Promise<{ id: string }> };

interface DatabaseClient {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

interface RecordManualPaymentDependencies {
  resolveActor(request: Request): Promise<AcademyActor>;
  recordPayment(
    actor: AcademyActor,
    applicationId: string,
  ): Promise<ApplicationFeeCharge>;
}

const defaultDependencies: RecordManualPaymentDependencies = {
  resolveActor: async (request) =>
    (await resolveAcademyActorFromSession(request)).actor,
  recordPayment: async (actor, applicationId) =>
    withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");

      const feeRepo = new PostgresApplicationFeeRepository(
        asAcademyDatabase<DatabaseClient>(client),
      );
      const feeService = new ApplicationFeeService(feeRepo);

      const feeCharge = await feeService.recordManualPayment(
        actor,
        applicationId,
      );

      // The public apply flow only attempts submission once, at initial form fill —
      // there's no separate applicant-facing "resubmit" step. If staff clear the fee
      // after that, this is the only path back to submitted. Idempotent: no-ops if
      // the application isn't currently in draft (e.g. it was never blocked at all).
      const publicApplicationService = new PublicApplicationService(
        asAcademyDatabase<DatabaseClient>(client),
      );
      await publicApplicationService.finalizeSubmission(actor.tenantId, applicationId);

      return feeCharge;
    }),
};

export async function POST(request: Request, context: RouteContext) {
  return recordManualPaymentRequest(request, context);
}

export async function recordManualPaymentRequest(
  request: Request,
  context: RouteContext,
  dependencies: RecordManualPaymentDependencies = defaultDependencies,
) {
  return handleApi(async () => {
    const actor = await dependencies.resolveActor(request);
    const { id: applicationId } = await context.params;
    const feeCharge = await dependencies.recordPayment(actor, applicationId);
    return { feeCharge };
  });
}
