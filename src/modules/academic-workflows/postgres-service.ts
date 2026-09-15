import { getDatabasePool } from "@/lib/database";
import { ShepherdAiSuggestion, WorkflowFeedbackRecord, WorkflowRecord } from "@/modules/shepherd-ai/types";

interface DatabaseRow {
  [key: string]: unknown;
}

export interface AcademicWorkflowsDatabase {
  query(sql: string, params?: unknown[]): Promise<{ rowCount: number; rows: DatabaseRow[] }>;
}

function nowIso() {
  return new Date().toISOString();
}

export class AcademicWorkflowsPostgresService {
  constructor(
    private readonly database: AcademicWorkflowsDatabase = getDatabasePool(),
    private readonly managesTransactions = true,
  ) {}

  async promoteSuggestion(tenantId: string, suggestionId: string, ownerUserId: string, assignedToUserId?: string, dueAt?: string) {
    const suggestionResult = await this.database.query("select * from ai_suggestions where id = $1 and tenant_id = $2", [suggestionId, tenantId]);

    if (suggestionResult.rowCount === 0) {
      throw new Error(`Suggestion ${suggestionId} was not found.`);
    }

    const suggestion = suggestionResult.rows[0] as SuggestionRow;
    if (suggestion.tenant_id !== tenantId) {
      throw new Error("Forbidden ShepherdAI access.");
    }

    const workflow: WorkflowRecord = {
      id: `workflow-${suggestion.id}`,
      tenantId: suggestion.tenant_id,
      suggestionId: suggestion.id,
      workflowType: "academic",
      workflowCode: suggestion.workflow_code,
      ownerUserId,
      assignedToUserId,
      status: assignedToUserId ? "assigned" : "open",
      dueAt,
      createdAt: nowIso(),
    };

    if (this.managesTransactions) {
      await this.database.query("begin");
    }
    try {
      await this.database.query(
        `insert into workflows (
           id, tenant_id, suggestion_id, workflow_type, workflow_code, owner_user_id, assigned_to_user_id, status, due_at, completed_at, created_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, null, $10)
         on conflict (id) do update
         set owner_user_id = excluded.owner_user_id,
             assigned_to_user_id = excluded.assigned_to_user_id,
             status = excluded.status,
             due_at = excluded.due_at
         returning *`,
        [
          workflow.id,
          workflow.tenantId,
          workflow.suggestionId,
          workflow.workflowType,
          workflow.workflowCode,
          workflow.ownerUserId,
          workflow.assignedToUserId ?? null,
          workflow.status,
          workflow.dueAt ?? null,
          workflow.createdAt,
        ],
      );
      await this.database.query(
        "update ai_suggestions set status = 'promoted_to_workflow' where id = $1 and tenant_id = $2",
        [suggestionId, tenantId],
      );
      await this.database.query(
        `insert into workflow_actions (id, workflow_id, action_type, action_payload_json, status, created_at)
         values ($1, $2, 'promote', $3::jsonb, 'logged', $4)
         on conflict (id) do nothing`,
        [`action-${workflow.id}-promote-${Date.now()}`, workflow.id, JSON.stringify({ suggestionId }), workflow.createdAt],
      );
      if (this.managesTransactions) {
        await this.database.query("commit");
      }
    } catch (error) {
      if (this.managesTransactions) {
        await this.database.query("rollback");
      }
      throw error;
    }

    return workflow;
  }

  async dismissSuggestion(tenantId: string, suggestionId: string, note?: string) {
    const result = await this.database.query(
      `update ai_suggestions
       set status = 'dismissed', dismiss_note = $3
       where id = $1 and tenant_id = $2
       returning id, status`,
      [suggestionId, tenantId, note ?? null],
    );

    if (result.rowCount === 0) {
      throw new Error(`Suggestion ${suggestionId} was not found.`);
    }

    const row = result.rows[0] as SuggestionStatusRow;
    return {
      id: row.id,
      status: row.status,
    };
  }

  async deferSuggestion(tenantId: string, suggestionId: string, reason?: string) {
    void reason;
    return this.updateSuggestionStatus(tenantId, suggestionId, "deferred");
  }

  async snoozeSuggestion(tenantId: string, suggestionId: string, snoozeUntil: string) {
    const result = await this.database.query(
      `update ai_suggestions
       set status = 'deferred', snooze_until = $3::timestamptz
       where id = $1 and tenant_id = $2
       returning id, status`,
      [suggestionId, tenantId, snoozeUntil],
    );

    if (result.rowCount === 0) {
      throw new Error(`Suggestion ${suggestionId} was not found.`);
    }

    const row = result.rows[0] as SuggestionStatusRow;
    return {
      id: row.id,
      status: row.status,
    };
  }

  async assignWorkflow(tenantId: string, workflowId: string, assignedToUserId: string) {
    const result = await this.database.query(
      `update workflows
       set assigned_to_user_id = $2,
           status = 'assigned'
       where id = $1 and tenant_id = $3
       returning *`,
      [workflowId, assignedToUserId, tenantId],
    );

    if (result.rowCount === 0) {
      throw new Error(`Workflow ${workflowId} was not found.`);
    }

    await this.logWorkflowEvent(workflowId, "assign", { assignedToUserId });
    return mapWorkflow(result.rows[0] as WorkflowRow);
  }

  async completeWorkflow(tenantId: string, workflowId: string) {
    const completedAt = nowIso();
    const result = await this.database.query(
      `update workflows
       set status = 'completed',
           completed_at = $2
       where id = $1 and tenant_id = $3
       returning *`,
      [workflowId, completedAt, tenantId],
    );

    if (result.rowCount === 0) {
      throw new Error(`Workflow ${workflowId} was not found.`);
    }

    await this.logWorkflowEvent(workflowId, "complete", {});
    return mapWorkflow(result.rows[0] as WorkflowRow);
  }

  async deferWorkflow(tenantId: string, workflowId: string, reason?: string) {
    const result = await this.database.query(
      `update workflows
       set status = 'deferred'
       where id = $1 and tenant_id = $2
       returning *`,
      [workflowId, tenantId],
    );

    if (result.rowCount === 0) {
      throw new Error(`Workflow ${workflowId} was not found.`);
    }

    await this.logWorkflowEvent(workflowId, "defer", { reason: reason ?? null });
    return mapWorkflow(result.rows[0] as WorkflowRow);
  }

  async recordFeedback(tenantId: string, workflowId: string, userId: string, feedbackType: string, notes?: string) {
    const workflowExists = await this.database.query("select id from workflows where id = $1 and tenant_id = $2", [workflowId, tenantId]);
    if (workflowExists.rowCount === 0) {
      throw new Error(`Workflow ${workflowId} was not found.`);
    }

    const id = `feedback-${workflowId}-${feedbackType}-${Date.now()}`;
    const result = await this.database.query(
      `insert into workflow_feedback (id, workflow_id, user_id, feedback_type, notes, created_at)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [id, workflowId, userId, feedbackType, notes ?? null, nowIso()],
    );
    const row = result.rows[0] as WorkflowFeedbackRow;

    return {
      id: row.id,
      workflowId: row.workflow_id,
      userId: row.user_id,
      feedbackType: row.feedback_type,
      notes: row.notes ?? undefined,
      createdAt: row.created_at.toISOString(),
    } satisfies WorkflowFeedbackRecord;
  }

  private async logWorkflowEvent(workflowId: string, actionType: "assign" | "complete" | "defer", payload: Record<string, unknown>) {
    await this.database.query(
      `insert into workflow_actions (id, workflow_id, action_type, action_payload_json, status, created_at)
       values ($1, $2, $3, $4::jsonb, 'logged', $5)`,
      [`action-${workflowId}-${actionType}-${Date.now()}`, workflowId, actionType, JSON.stringify(payload), nowIso()],
    );
  }

  private async updateSuggestionStatus(
    tenantId: string,
    suggestionId: string,
    status: "dismissed" | "deferred",
  ): Promise<Pick<ShepherdAiSuggestion, "id" | "status">> {
    const result = await this.database.query(
      `update ai_suggestions
       set status = $3
       where id = $1 and tenant_id = $2
       returning id, status`,
      [suggestionId, tenantId, status],
    );

    if (result.rowCount === 0) {
      throw new Error(`Suggestion ${suggestionId} was not found.`);
    }

    const row = result.rows[0] as SuggestionStatusRow;
    return {
      id: row.id,
      status: row.status,
    };
  }
}

type SuggestionRow = {
  id: string;
  tenant_id: string;
  workflow_code: WorkflowRecord["workflowCode"];
};

type SuggestionStatusRow = {
  id: string;
  status: ShepherdAiSuggestion["status"];
};

type WorkflowFeedbackRow = {
  id: string;
  workflow_id: string;
  user_id: string;
  feedback_type: WorkflowFeedbackRecord["feedbackType"];
  notes: string | null;
  created_at: Date;
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

function mapWorkflow(row: WorkflowRow): WorkflowRecord {
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
}
