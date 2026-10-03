import { timingSafeEqual } from "node:crypto";
import { createOpenRouterClientFromEnv, resolveEvaluationOptionsFromEnv } from "@/lib/ai-gateway";
import { runModelEvaluation, type EvaluationRunnerDependencies } from "@/modules/ai-gateway/evaluation-runner";
import { PostgresAiGatewayRepository } from "@/modules/ai-gateway/postgres-repository";
import { AiEvaluationInProgressError, AiGatewayUnavailableError } from "@/modules/ai-gateway/types";

// Vercel Cron: re-scores OpenRouter models against each Academy ask on a rolling basis and
// updates which model serves each one. Each run is capped by AI_EVAL_RUN_BUDGET_USD.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorizedCron(request: Request, secret: string | undefined) {
  if (!secret) return false;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function handleModelEvaluationCron(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
  dependencies?: () => EvaluationRunnerDependencies,
) {
  if (!isAuthorizedCron(request, env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resolved = dependencies
      ? dependencies()
      : { client: createOpenRouterClientFromEnv(env), repository: new PostgresAiGatewayRepository() };
    const summary = await runModelEvaluation(resolved, resolveEvaluationOptionsFromEnv(env));
    return Response.json(summary, { status: summary.status === "failed" ? 500 : 200 });
  } catch (error) {
    if (error instanceof AiGatewayUnavailableError) {
      return Response.json({ status: "disabled" });
    }
    if (error instanceof AiEvaluationInProgressError) {
      // An admin-triggered run holds the lease; this tick has nothing to add.
      return Response.json({ status: "skipped", reason: "evaluation_in_progress" });
    }
    return Response.json({ error: "Model evaluation failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleModelEvaluationCron(request);
}
