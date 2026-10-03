import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { createOpenRouterClientFromEnv, resolveEvaluationOptionsFromEnv } from "@/lib/ai-gateway";
import { assertPlatformStaffWorkspaceAccess } from "@/modules/academy-auth/policy";
import { resolvePlatformRoles } from "@/modules/academy-auth/platform-request-context";
import { clearAiRouteCache } from "@/modules/ai-gateway/gateway";
import { runModelEvaluation, type EvaluationRunnerDependencies } from "@/modules/ai-gateway/evaluation-runner";
import { PostgresAiGatewayRepository } from "@/modules/ai-gateway/postgres-repository";
import { buildAiModelReport } from "@/modules/ai-gateway/report";
import { AiGatewayRepository, AiGatewayUnavailableError } from "@/modules/ai-gateway/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REPORT_WINDOW_DAYS = 60;

export interface AiModelsRouteDependencies {
  roleResolver: () => Promise<string[]>;
  repository: () => AiGatewayRepository;
  evaluation: () => EvaluationRunnerDependencies;
  env: NodeJS.ProcessEnv;
}

const defaultDependencies: AiModelsRouteDependencies = {
  roleResolver: resolvePlatformRoles,
  repository: () => new PostgresAiGatewayRepository(),
  evaluation: () => ({ client: createOpenRouterClientFromEnv(), repository: new PostgresAiGatewayRepository() }),
  env: process.env,
};

/** Platform staff: current routing, leaderboards, spend, and recent evaluation runs. */
export async function getAiModelsReport(dependencies: AiModelsRouteDependencies = defaultDependencies) {
  try {
    assertPlatformStaffWorkspaceAccess(await dependencies.roleResolver());
  } catch {
    return jsonError("Forbidden platform staff access.", 403);
  }

  try {
    const report = await buildAiModelReport(dependencies.repository(), {
      now: new Date(),
      windowDays: REPORT_WINDOW_DAYS,
    });
    return jsonOk({ report, configured: Boolean(dependencies.env.OPENROUTER_API_KEY) });
  } catch {
    return jsonError("Unable to load AI model report.", 500);
  }
}

/** Platform admins: run one evaluation cycle now instead of waiting for the cron. */
export async function runAiModelEvaluationNow(dependencies: AiModelsRouteDependencies = defaultDependencies) {
  const roles = await dependencies.roleResolver();
  if (!roles.includes("platform_admin")) {
    return jsonError("Forbidden platform admin access.", 403);
  }

  try {
    const summary = await runModelEvaluation(
      dependencies.evaluation(),
      resolveEvaluationOptionsFromEnv(dependencies.env),
    );
    clearAiRouteCache();
    return jsonOk({ summary }, { status: summary.status === "failed" ? 500 : 200 });
  } catch (error) {
    if (error instanceof AiGatewayUnavailableError) {
      return jsonError("OPENROUTER_API_KEY is not configured.", 503);
    }
    return jsonError("Model evaluation failed.", 500);
  }
}

export async function GET() {
  return getAiModelsReport();
}

export async function POST() {
  return runAiModelEvaluationNow();
}
