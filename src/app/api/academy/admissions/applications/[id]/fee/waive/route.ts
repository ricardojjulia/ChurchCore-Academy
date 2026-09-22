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

interface WaiveFeeDependencies {
  resolveActor(request: Request): Promise<AcademyActor>;
  waive(
    actor: AcademyActor,
    applicationId: string,
    reason: string,
  ): Promise<ApplicationFeeCharge>;
}

const defaultDependencies: WaiveFeeDependencies = {
  resolveActor: async (request) =>
    (await resolveAcademyActorFromSession(request)).actor,
  waive: async (actor, applicationId, reason) =>
    withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");

      const feeRepo = new PostgresApplicationFeeRepository(
        asAcademyDatabase<DatabaseClient>(client),
      );
      const feeService = new ApplicationFeeService(feeRepo);

      const feeCharge = await feeService.waiveFee(
        actor,
        applicationId,
        reason,
      );

      // See the fee/pay route for why this call is required, not optional: waiving
      // is the only other way to clear a submission blocker outside the applicant's
      // one-shot public form flow, so it must also finalize the submission.
      const publicApplicationService = new PublicApplicationService(
        asAcademyDatabase<DatabaseClient>(client),
      );
      await publicApplicationService.finalizeSubmission(actor.tenantId, applicationId);

      return feeCharge;
    }),
};

export async function POST(request: Request, context: RouteContext) {
  return waiveFeeRequest(request, context);
}

export async function waiveFeeRequest(
  request: Request,
  context: RouteContext,
  dependencies: WaiveFeeDependencies = defaultDependencies,
) {
  return handleApi(async () => {
    const actor = await dependencies.resolveActor(request);
    const { id: applicationId } = await context.params;

    const body = await request.json().catch(() => {
      throw new Error("Malformed JSON body.");
    });

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Request body must be a JSON object.");
    }

    const reason = (body as Record<string, unknown>).reason;
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      throw new Error("Waiver reason is required.");
    }

    const feeCharge = await dependencies.waive(actor, applicationId, reason);
    return { feeCharge };
  });
}
