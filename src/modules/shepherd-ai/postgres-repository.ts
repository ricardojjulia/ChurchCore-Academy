import { getDatabasePool } from "@/lib/database";
import { AiSignalRecord, ShepherdAiSuggestion, WorkflowActionRecord, WorkflowFeedbackRecord, WorkflowRecord } from "@/modules/shepherd-ai/types";

interface DatabaseRow {
  [key: string]: unknown;
}

export interface ShepherdAiDatabase {
  query(sql: string, params?: unknown[]): Promise<{ rowCount: number; rows: DatabaseRow[] }>;
}

function parseJson<T>(value: unknown) {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }
  return value as T;
}

export class ShepherdAiPostgresRepository {
  constructor(private readonly database: ShepherdAiDatabase = getDatabasePool()) {}

  async saveSignals(signals: AiSignalRecord[]) {
    for (const signal of signals) {
      await this.database.query(
        `insert into ai_signals (
           id, tenant_id, product_area, entity_type, entity_id, signal_type, signal_value, signal_window, signal_payload_json, detected_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
         on conflict (id) do update
         set tenant_id = excluded.tenant_id,
             product_area = excluded.product_area,
             entity_type = excluded.entity_type,
             entity_id = excluded.entity_id,
             signal_type = excluded.signal_type,
             signal_value = excluded.signal_value,
             signal_window = excluded.signal_window,
             signal_payload_json = excluded.signal_payload_json,
             detected_at = excluded.detected_at`,
        [
          signal.id,
          signal.tenantId,
          signal.productArea,
          signal.entityType,
          signal.entityId,
          signal.signalType,
          signal.signalValue,
          signal.signalWindow,
          JSON.stringify(signal.signalPayloadJson),
          signal.detectedAt,
        ],
      );
    }
  }

  async saveSuggestions(suggestions: ShepherdAiSuggestion[]) {
    for (const suggestion of suggestions) {
      await this.database.query(
        `insert into ai_suggestions (
           id, tenant_id, product_area, workflow_type, workflow_code, entity_type, entity_id, title, summary,
           confidence_score, urgency, suggested_actions, explanation_json, boundary_note, message_draft, status, generated_at
         )
         values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16, $17
         )
         on conflict (id) do update
         set tenant_id = excluded.tenant_id,
             product_area = excluded.product_area,
             workflow_type = excluded.workflow_type,
             workflow_code = excluded.workflow_code,
             entity_type = excluded.entity_type,
             entity_id = excluded.entity_id,
             title = excluded.title,
             summary = excluded.summary,
             confidence_score = excluded.confidence_score,
             urgency = excluded.urgency,
             suggested_actions = excluded.suggested_actions,
             explanation_json = excluded.explanation_json,
             boundary_note = excluded.boundary_note,
             message_draft = excluded.message_draft,
             generated_at = excluded.generated_at`,
        [
          suggestion.id,
          suggestion.tenantId,
          suggestion.productArea,
          suggestion.workflowType,
          suggestion.workflowCode,
          suggestion.entityType,
          suggestion.entityId,
          suggestion.title,
          suggestion.summary,
          suggestion.confidenceScore,
          suggestion.urgency,
          JSON.stringify(suggestion.suggestedActions),
          JSON.stringify(suggestion.explanation),
          suggestion.boundaryNote,
          suggestion.messageDraft ?? null,
          suggestion.status,
          suggestion.generatedAt,
        ],
      );
    }
  }

  async upsertWorkflow(workflow: WorkflowRecord) {
    await this.database.query(
      `insert into workflows (
         id, tenant_id, suggestion_id, workflow_type, workflow_code, owner_user_id, assigned_to_user_id, status, due_at, completed_at, created_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (id) do update
       set tenant_id = excluded.tenant_id,
           suggestion_id = excluded.suggestion_id,
           workflow_type = excluded.workflow_type,
           workflow_code = excluded.workflow_code,
           owner_user_id = excluded.owner_user_id,
           assigned_to_user_id = excluded.assigned_to_user_id,
           status = excluded.status,
           due_at = excluded.due_at,
           completed_at = excluded.completed_at,
           created_at = excluded.created_at`,
      [
        workflow.id,
        workflow.tenantId,
        workflow.suggestionId ?? null,
        workflow.workflowType,
        workflow.workflowCode,
        workflow.ownerUserId,
        workflow.assignedToUserId ?? null,
        workflow.status,
        workflow.dueAt ?? null,
        workflow.completedAt ?? null,
        workflow.createdAt,
      ],
    );
  }

  async insertWorkflowAction(action: WorkflowActionRecord) {
    await this.database.query(
      `insert into workflow_actions (id, workflow_id, action_type, action_payload_json, status, created_at)
       values ($1, $2, $3, $4::jsonb, $5, $6)
       on conflict (id) do nothing`,
      [action.id, action.workflowId, action.actionType, JSON.stringify(action.actionPayloadJson), action.status, action.createdAt],
    );
  }

  async insertWorkflowFeedback(feedback: WorkflowFeedbackRecord) {
    await this.database.query(
      `insert into workflow_feedback (id, workflow_id, user_id, feedback_type, notes, created_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update
       set notes = excluded.notes, created_at = excluded.created_at`,
      [feedback.id, feedback.workflowId, feedback.userId, feedback.feedbackType, feedback.notes ?? null, feedback.createdAt],
    );
  }

  async updateSuggestionStatus(tenantId: string, suggestionId: string, status: ShepherdAiSuggestion["status"]) {
    await this.database.query("update ai_suggestions set status = $3 where id = $1 and tenant_id = $2", [suggestionId, tenantId, status]);
  }

  async fetchSignals(tenantId: string) {
    const result = await this.database.query(
      "select * from ai_signals where tenant_id = $1 order by detected_at desc, id asc",
      [tenantId],
    );
    return result.rows.map(
      (rawRow): AiSignalRecord => {
        const row = rawRow as SignalRow;
        return {
          id: row.id,
          tenantId: row.tenant_id,
          productArea: row.product_area,
          entityType: row.entity_type,
          entityId: row.entity_id,
          signalType: row.signal_type,
          signalValue: Number(row.signal_value),
          signalWindow: row.signal_window,
          signalPayloadJson: parseJson<Record<string, unknown>>(row.signal_payload_json),
          detectedAt: row.detected_at.toISOString(),
        };
      },
    );
  }

  async fetchSuggestions(tenantId: string) {
    const result = await this.database.query(
      "select * from ai_suggestions where tenant_id = $1 order by generated_at desc, confidence_score desc",
      [tenantId],
    );
    return result.rows.map(
      (rawRow): ShepherdAiSuggestion => {
        const row = rawRow as SuggestionRow;
        return {
          id: row.id,
          tenantId: row.tenant_id,
          productArea: row.product_area,
          workflowType: row.workflow_type,
          workflowCode: row.workflow_code,
          entityType: row.entity_type,
          entityId: row.entity_id,
          title: row.title,
          summary: row.summary,
          confidenceScore: row.confidence_score,
          urgency: row.urgency,
          suggestedActions: parseJson<ShepherdAiSuggestion["suggestedActions"]>(row.suggested_actions),
          explanation: parseJson<ShepherdAiSuggestion["explanation"]>(row.explanation_json),
          boundaryNote: row.boundary_note,
          messageDraft: row.message_draft ?? undefined,
          status: row.status,
          generatedAt: row.generated_at.toISOString(),
        };
      },
    );
  }

  async fetchWorkflows(tenantId: string) {
    const result = await this.database.query(
      "select * from workflows where tenant_id = $1 order by created_at desc, id asc",
      [tenantId],
    );
    return result.rows.map(
      (rawRow): WorkflowRecord => {
        const row = rawRow as WorkflowRow;
        return {
          id: row.id,
          tenantId: row.tenant_id,
          suggestionId: row.suggestion_id ?? undefined,
          workflowType: row.workflow_type,
          workflowCode: row.workflow_code,
          ownerUserId: row.owner_user_id,
          assignedToUserId: row.assigned_to_user_id ?? undefined,
          status: row.status,
          dueAt: row.due_at?.toISOString(),
          completedAt: row.completed_at?.toISOString(),
          createdAt: row.created_at.toISOString(),
        };
      },
    );
  }

  async fetchWorkflowActions(tenantId: string) {
    const result = await this.database.query(
      `select workflow_actions.*
       from workflow_actions
       inner join workflows on workflows.id = workflow_actions.workflow_id
       where workflows.tenant_id = $1
       order by workflow_actions.created_at asc, workflow_actions.id asc`,
      [tenantId],
    );
    return result.rows.map(
      (rawRow): WorkflowActionRecord => {
        const row = rawRow as WorkflowActionRow;
        return {
          id: row.id,
          workflowId: row.workflow_id,
          actionType: row.action_type,
          actionPayloadJson: parseJson<Record<string, unknown>>(row.action_payload_json),
          status: row.status,
          createdAt: row.created_at.toISOString(),
        };
      },
    );
  }

  async fetchWorkflowFeedback(tenantId: string) {
    const result = await this.database.query(
      `select workflow_feedback.*
       from workflow_feedback
       inner join workflows on workflows.id = workflow_feedback.workflow_id
       where workflows.tenant_id = $1
       order by workflow_feedback.created_at asc, workflow_feedback.id asc`,
      [tenantId],
    );
    return result.rows.map(
      (rawRow): WorkflowFeedbackRecord => {
        const row = rawRow as WorkflowFeedbackRow;
        return {
          id: row.id,
          workflowId: row.workflow_id,
          userId: row.user_id,
          feedbackType: row.feedback_type,
          notes: row.notes ?? undefined,
          createdAt: row.created_at.toISOString(),
        };
      },
    );
  }
}

type SignalRow = {
  id: string;
  tenant_id: string;
  product_area: AiSignalRecord["productArea"];
  entity_type: AiSignalRecord["entityType"];
  entity_id: string;
  signal_type: AiSignalRecord["signalType"];
  signal_value: number | string;
  signal_window: string;
  signal_payload_json: unknown;
  detected_at: Date;
};

type SuggestionRow = {
  id: string;
  tenant_id: string;
  product_area: ShepherdAiSuggestion["productArea"];
  workflow_type: ShepherdAiSuggestion["workflowType"];
  workflow_code: ShepherdAiSuggestion["workflowCode"];
  entity_type: ShepherdAiSuggestion["entityType"];
  entity_id: string;
  title: string;
  summary: string;
  confidence_score: number;
  urgency: ShepherdAiSuggestion["urgency"];
  suggested_actions: unknown;
  explanation_json: unknown;
  boundary_note: string;
  message_draft: string | null;
  status: ShepherdAiSuggestion["status"];
  generated_at: Date;
};

type WorkflowRow = {
  id: string;
  tenant_id: string;
  suggestion_id: string | null;
  workflow_type: WorkflowRecord["workflowType"];
  workflow_code: WorkflowRecord["workflowCode"];
  owner_user_id: string;
  assigned_to_user_id: string | null;
  status: WorkflowRecord["status"];
  due_at?: Date | null;
  completed_at?: Date | null;
  created_at: Date;
};

type WorkflowActionRow = {
  id: string;
  workflow_id: string;
  action_type: WorkflowActionRecord["actionType"];
  action_payload_json: unknown;
  status: WorkflowActionRecord["status"];
  created_at: Date;
};

type WorkflowFeedbackRow = {
  id: string;
  workflow_id: string;
  user_id: string;
  feedback_type: WorkflowFeedbackRecord["feedbackType"];
  notes: string | null;
  created_at: Date;
};
