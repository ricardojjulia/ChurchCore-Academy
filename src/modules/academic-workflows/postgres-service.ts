import { getDatabasePool } from "@/lib/database";
import { WorkflowRecord } from "@/modules/shepherd-ai/types";

function nowIso() {
  return new Date().toISOString();
}

export class AcademicWorkflowsPostgresService {
  async promoteSuggestion(suggestionId: string, ownerUserId: string, assignedToUserId?: string, dueAt?: string) {
    const pool = getDatabasePool();
    const suggestionResult = await pool.query("select * from ai_suggestions where id = $1", [suggestionId]);

    if (suggestionResult.rowCount === 0) {
      throw new Error(`Suggestion ${suggestionId} was not found.`);
    }

    const suggestion = suggestionResult.rows[0];
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

    await pool.query("begin");
    try {
      await pool.query(
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
      await pool.query("update ai_suggestions set status = 'promoted_to_workflow' where id = $1", [suggestionId]);
      await pool.query(
        `insert into workflow_actions (id, workflow_id, action_type, action_payload_json, status, created_at)
         values ($1, $2, 'promote', $3::jsonb, 'logged', $4)
         on conflict (id) do nothing`,
        [`action-${workflow.id}-promote-${Date.now()}`, workflow.id, JSON.stringify({ suggestionId }), workflow.createdAt],
      );
      await pool.query("commit");
    } catch (error) {
      await pool.query("rollback");
      throw error;
    }

    return workflow;
  }

  async dismissSuggestion(suggestionId: string, note?: string) {
    void note;
    return this.updateSuggestionStatus(suggestionId, "dismissed");
  }

  async deferSuggestion(suggestionId: string, reason?: string) {
    void reason;
    return this.updateSuggestionStatus(suggestionId, "deferred");
  }

  async assignWorkflow(workflowId: string, assignedToUserId: string) {
    const pool = getDatabasePool();
    const result = await pool.query(
      `update workflows
       set assigned_to_user_id = $2,
           status = 'assigned'
       where id = $1
       returning *`,
      [workflowId, assignedToUserId],
    );

    if (result.rowCount === 0) {
      throw new Error(`Workflow ${workflowId} was not found.`);
    }

    await this.logWorkflowEvent(workflowId, "assign", { assignedToUserId });
    return mapWorkflow(result.rows[0]);
  }

  async completeWorkflow(workflowId: string) {
    const pool = getDatabasePool();
    const completedAt = nowIso();
    const result = await pool.query(
      `update workflows
       set status = 'completed',
           completed_at = $2
       where id = $1
       returning *`,
      [workflowId, completedAt],
    );

    if (result.rowCount === 0) {
      throw new Error(`Workflow ${workflowId} was not found.`);
    }

    await this.logWorkflowEvent(workflowId, "complete", {});
    return mapWorkflow(result.rows[0]);
  }

  async deferWorkflow(workflowId: string, reason?: string) {
    const pool = getDatabasePool();
    const result = await pool.query(
      `update workflows
       set status = 'deferred'
       where id = $1
       returning *`,
      [workflowId],
    );

    if (result.rowCount === 0) {
      throw new Error(`Workflow ${workflowId} was not found.`);
    }

    await this.logWorkflowEvent(workflowId, "defer", { reason: reason ?? null });
    return mapWorkflow(result.rows[0]);
  }

  async recordFeedback(workflowId: string, userId: string, feedbackType: string, notes?: string) {
    const pool = getDatabasePool();
    const workflowExists = await pool.query("select id from workflows where id = $1", [workflowId]);
    if (workflowExists.rowCount === 0) {
      throw new Error(`Workflow ${workflowId} was not found.`);
    }

    const id = `feedback-${workflowId}-${feedbackType}-${Date.now()}`;
    const result = await pool.query(
      `insert into workflow_feedback (id, workflow_id, user_id, feedback_type, notes, created_at)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [id, workflowId, userId, feedbackType, notes ?? null, nowIso()],
    );

    return {
      id: result.rows[0].id,
      workflowId: result.rows[0].workflow_id,
      userId: result.rows[0].user_id,
      feedbackType: result.rows[0].feedback_type,
      notes: result.rows[0].notes ?? undefined,
      createdAt: result.rows[0].created_at.toISOString(),
    };
  }

  private async logWorkflowEvent(workflowId: string, actionType: "assign" | "complete" | "defer", payload: Record<string, unknown>) {
    const pool = getDatabasePool();
    await pool.query(
      `insert into workflow_actions (id, workflow_id, action_type, action_payload_json, status, created_at)
       values ($1, $2, $3, $4::jsonb, 'logged', $5)`,
      [`action-${workflowId}-${actionType}-${Date.now()}`, workflowId, actionType, JSON.stringify(payload), nowIso()],
    );
  }

  private async updateSuggestionStatus(suggestionId: string, status: "dismissed" | "deferred") {
    const pool = getDatabasePool();
    const result = await pool.query(
      `update ai_suggestions
       set status = $2
       where id = $1
       returning id, status`,
      [suggestionId, status],
    );

    if (result.rowCount === 0) {
      throw new Error(`Suggestion ${suggestionId} was not found.`);
    }

    return result.rows[0];
  }
}

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
