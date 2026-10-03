import { getDatabasePool } from "@/lib/database";
import {
  AiEvaluationRunSummary,
  AiGatewayRepository,
  AiGatewayUsageRecord,
  AiModelEvaluationRecord,
  AiModelSelection,
  AiTaskKind,
  isAiTaskKind,
} from "@/modules/ai-gateway/types";

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

/** A pg Pool: a transaction must run on one checked-out client, not across pooled queries. */
interface TransactionalPool extends Queryable {
  connect(): Promise<Queryable & { release(): void }>;
}

function asIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

function mapSelection(row: Record<string, unknown>): AiModelSelection | undefined {
  if (!isAiTaskKind(row.task_kind)) return undefined;
  return {
    taskKind: row.task_kind,
    modelId: String(row.model_id),
    fallbackModelIds: Array.isArray(row.fallback_model_ids) ? row.fallback_model_ids.map(String) : [],
    fitScore: row.fit_score === null ? null : asNumber(row.fit_score),
    reason: String(row.reason),
    runId: row.run_id === null ? null : String(row.run_id),
    selectedAt: asIso(row.selected_at),
  };
}

function mapEvaluation(row: Record<string, unknown>, taskKind: AiTaskKind): AiModelEvaluationRecord {
  return {
    runId: String(row.run_id),
    taskKind,
    caseId: String(row.case_id),
    modelId: String(row.model_id),
    status: row.status === "graded" ? "graded" : "failed",
    qualityScore: asNumber(row.quality_score),
    judgeScore: asNumber(row.judge_score),
    deterministicScore: asNumber(row.deterministic_score),
    latencyMs: asNumber(row.latency_ms),
    promptTokens: asNumber(row.prompt_tokens),
    completionTokens: asNumber(row.completion_tokens),
    costUsd: asNumber(row.cost_usd),
    graderModelId: String(row.grader_model_id),
    graderRationale: String(row.grader_rationale),
    outputExcerpt: String(row.output_excerpt),
    evaluatedAt: asIso(row.evaluated_at),
  };
}

/** Platform-level persistence (no tenant data), so it uses the service pool like demo-feedback. */
export class PostgresAiGatewayRepository implements AiGatewayRepository {
  constructor(private readonly pool: TransactionalPool = getDatabasePool()) {}

  async listCurrentSelections() {
    const result = await this.pool.query(
      `select distinct on (task_kind) task_kind, model_id, fallback_model_ids, fit_score, reason, run_id, selected_at
         from academy_ai_model_selections
        order by task_kind, selected_at desc`,
    );
    return result.rows.flatMap((row) => mapSelection(row) ?? []);
  }

  private async insertSelection(db: Queryable, selection: AiModelSelection) {
    await db.query(
      `insert into academy_ai_model_selections
         (task_kind, model_id, fallback_model_ids, fit_score, reason, run_id, selected_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        selection.taskKind,
        selection.modelId,
        selection.fallbackModelIds,
        selection.fitScore,
        selection.reason,
        selection.runId,
        selection.selectedAt,
      ],
    );
  }

  async listEvaluationsSince(taskKind: AiTaskKind, since: string) {
    const result = await this.pool.query(
      `select run_id, case_id, model_id, status, quality_score, judge_score, deterministic_score, latency_ms,
              prompt_tokens, completion_tokens, cost_usd, grader_model_id, grader_rationale, output_excerpt,
              evaluated_at
         from academy_ai_model_evaluations
        where task_kind = $1 and evaluated_at >= $2
        order by evaluated_at desc`,
      [taskKind, since],
    );
    return result.rows.map((row) => mapEvaluation(row, taskKind));
  }

  private async insertEvaluations(db: Queryable, records: AiModelEvaluationRecord[]) {
    for (const record of records) {
      await db.query(
        `insert into academy_ai_model_evaluations
           (run_id, task_kind, case_id, model_id, status, quality_score, judge_score, deterministic_score,
            latency_ms, prompt_tokens, completion_tokens, cost_usd, grader_model_id, grader_rationale,
            output_excerpt, evaluated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         on conflict (run_id, task_kind, case_id, model_id) do nothing`,
        [
          record.runId,
          record.taskKind,
          record.caseId,
          record.modelId,
          record.status,
          record.qualityScore,
          record.judgeScore,
          record.deterministicScore,
          Math.round(record.latencyMs),
          record.promptTokens,
          record.completionTokens,
          record.costUsd,
          record.graderModelId,
          record.graderRationale,
          record.outputExcerpt,
          record.evaluatedAt,
        ],
      );
    }
  }

  async finalizeRun(summary: AiEvaluationRunSummary, evaluations: AiModelEvaluationRecord[], selections: AiModelSelection[]) {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await this.insertRun(client, summary);
      await this.insertEvaluations(client, evaluations);
      for (const selection of selections) await this.insertSelection(client, selection);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertRun(db: Queryable, summary: AiEvaluationRunSummary) {
    await db.query(
      `insert into academy_ai_evaluation_runs
         (run_id, started_at, finished_at, status, spent_usd, evaluated_model_count, selection_changes)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        summary.runId,
        summary.startedAt,
        summary.finishedAt,
        summary.status,
        summary.spentUsd,
        summary.evaluatedModelCount,
        JSON.stringify(summary.selectionChanges),
      ],
    );
  }

  async acquireEvaluationLease(holderId: string, now: string, expiresAt: string) {
    // One row is the lease. A holder takes it when it is absent or expired; the conditional upsert
    // is atomic, so two concurrent runs can never both win.
    const result = await this.pool.query(
      `insert into academy_ai_evaluation_lease (lease_key, holder_id, acquired_at, expires_at)
       values ('model_evaluation', $1, $2, $3)
       on conflict (lease_key) do update
         set holder_id = excluded.holder_id, acquired_at = excluded.acquired_at, expires_at = excluded.expires_at
         where academy_ai_evaluation_lease.expires_at <= excluded.acquired_at
       returning holder_id`,
      [holderId, now, expiresAt],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async releaseEvaluationLease(holderId: string) {
    await this.pool.query(
      `delete from academy_ai_evaluation_lease where lease_key = 'model_evaluation' and holder_id = $1`,
      [holderId],
    );
  }

  async listRecentRuns(limit: number) {
    const result = await this.pool.query(
      `select run_id, started_at, finished_at, status, spent_usd, evaluated_model_count, selection_changes
         from academy_ai_evaluation_runs
        order by started_at desc
        limit $1`,
      [limit],
    );
    return result.rows.map((row): AiEvaluationRunSummary => ({
      runId: String(row.run_id),
      startedAt: asIso(row.started_at),
      finishedAt: asIso(row.finished_at),
      status: String(row.status) as AiEvaluationRunSummary["status"],
      spentUsd: asNumber(row.spent_usd),
      evaluatedModelCount: asNumber(row.evaluated_model_count),
      selectionChanges: Array.isArray(row.selection_changes)
        ? (row.selection_changes as AiEvaluationRunSummary["selectionChanges"])
        : [],
    }));
  }

  async recordUsage(record: AiGatewayUsageRecord) {
    await this.pool.query(
      `insert into academy_ai_gateway_usage
         (id, task_kind, model_id, prompt_tokens, completion_tokens, cost_usd, latency_ms, status, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (id) do nothing`,
      [
        record.id,
        record.taskKind,
        record.modelId,
        record.promptTokens,
        record.completionTokens,
        record.costUsd,
        Math.round(record.latencyMs),
        record.status,
        record.createdAt,
      ],
    );
  }

  async summarizeUsageSince(since: string) {
    const result = await this.pool.query(
      `select task_kind, model_id, count(*)::int as request_count, coalesce(sum(cost_usd), 0) as cost_usd
         from academy_ai_gateway_usage
        where created_at >= $1
        group by task_kind, model_id
        order by cost_usd desc`,
      [since],
    );
    return result.rows.flatMap((row) =>
      isAiTaskKind(row.task_kind)
        ? [{
            taskKind: row.task_kind,
            modelId: String(row.model_id),
            requestCount: asNumber(row.request_count),
            costUsd: asNumber(row.cost_usd),
          }]
        : [],
    );
  }
}
