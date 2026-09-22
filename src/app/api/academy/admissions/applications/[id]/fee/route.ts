import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability, AcademyActor } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import { PostgresApplicationFeeRepository } from "@/modules/admissions/application-fee-repository";
import { ApplicationFeeService } from "@/modules/admissions/application-fee-service";
import { ApplicationFeeCharge } from "@/modules/admissions/application-fee-types";

type RouteContext = { params: Promise<{ id: string }> };

interface DatabaseClient {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

interface FindFeeChargeDependencies {
  resolveActor(request: Request): Promise<AcademyActor>;
  findFeeCharge(
    actor: AcademyActor,
    applicationId: string,
  ): Promise<ApplicationFeeCharge | undefined>;
}

const defaultDependencies: FindFeeChargeDependencies = {
  resolveActor: async (request) =>
    (await resolveAcademyActorFromSession(request)).actor,
  findFeeCharge: async (actor, applicationId) =>
    withCapabilityContext(actor, async (client, capabilities) => {
      assertCapability(capabilities, "admissionsWorkflows");

      const feeRepo = new PostgresApplicationFeeRepository(
        asAcademyDatabase<DatabaseClient>(client),
      );
      const feeService = new ApplicationFeeService(feeRepo);

      return feeService.findFeeCharge(actor, applicationId);
    }),
};

export async function GET(request: Request, context: RouteContext) {
  return getFeeChargeRequest(request, context);
}

export async function getFeeChargeRequest(
  request: Request,
  context: RouteContext,
  dependencies: FindFeeChargeDependencies = defaultDependencies,
) {
  return handleApi(async () => {
    const actor = await dependencies.resolveActor(request);
    const { id: applicationId } = await context.params;
    const feeCharge = await dependencies.findFeeCharge(actor, applicationId);

    if (!feeCharge) {
      // Most applications have no fee charge at all (their program has no fee
      // configured) — this is the expected, common case, not an error. The
      // admin UI reads this 404 as "no fee record" and renders nothing rather
      // than showing an error state.
      throw new Error("Application fee charge was not found.");
    }

    return { feeCharge };
  });
}
