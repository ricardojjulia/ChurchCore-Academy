import assert from "node:assert/strict";
import test from "node:test";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";

test("fetchSuggestions reads tenant-scoped ShepherdAI suggestions", async () => {
  const calls: { sql: string; params: unknown[] | undefined }[] = [];
  const repository = new ShepherdAiPostgresRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: [
          {
            id: "suggestion-1",
            tenant_id: "tenant-shepherd",
            product_area: "academy",
            workflow_type: "academic",
            workflow_code: "calendar_setup_review",
            entity_type: "institution",
            entity_id: "tenant-shepherd",
            title: "Calendar setup review",
            summary: "Review calendar setup gaps.",
            confidence_score: 92,
            urgency: "high",
            suggested_actions: JSON.stringify([]),
            explanation_json: JSON.stringify({ detected: [], whySurfaced: [], sourceSignalCategories: ["institutional-setup-signals"], limitations: [] }),
            boundary_note: "Human review required.",
            message_draft: null,
            status: "suggested",
            generated_at: new Date("2026-06-12T00:00:00.000Z"),
          },
        ],
      };
    },
  });

  const suggestions = await repository.fetchSuggestions("tenant-shepherd");

  assert.equal(suggestions.length, 1);
  assert.match(calls[0].sql, /where tenant_id = \$1/i);
  assert.deepEqual(calls[0].params, ["tenant-shepherd"]);
});

test("updateSuggestionStatus scopes suggestion mutations by tenant", async () => {
  const calls: { sql: string; params: unknown[] | undefined }[] = [];
  const repository = new ShepherdAiPostgresRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return { rowCount: 1, rows: [] };
    },
  });

  await repository.updateSuggestionStatus("tenant-shepherd", "suggestion-1", "dismissed");

  assert.match(calls[0].sql, /where id = \$1 and tenant_id = \$2/i);
  assert.deepEqual(calls[0].params, ["suggestion-1", "tenant-shepherd", "dismissed"]);
});

test("fetchWorkflowActions and feedback scope joins to tenant workflows", async () => {
  const calls: { sql: string; params: unknown[] | undefined }[] = [];
  const repository = new ShepherdAiPostgresRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes("workflow_actions")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "action-1",
              workflow_id: "workflow-1",
              action_type: "promote",
              action_payload_json: JSON.stringify({ suggestionId: "suggestion-1" }),
              status: "logged",
              created_at: new Date("2026-06-12T00:00:00.000Z"),
            },
          ],
        };
      }

      return {
        rowCount: 1,
        rows: [
          {
            id: "feedback-1",
            workflow_id: "workflow-1",
            user_id: "user-1",
            feedback_type: "accepted",
            notes: "Useful.",
            created_at: new Date("2026-06-12T00:00:00.000Z"),
          },
        ],
      };
    },
  });

  const actions = await repository.fetchWorkflowActions("tenant-shepherd");
  const feedback = await repository.fetchWorkflowFeedback("tenant-shepherd");

  assert.equal(actions.length, 1);
  assert.equal(feedback.length, 1);
  assert.match(calls[0].sql, /inner join workflows/i);
  assert.match(calls[0].sql, /where workflows\.tenant_id = \$1/i);
  assert.match(calls[1].sql, /inner join workflows/i);
  assert.match(calls[1].sql, /where workflows\.tenant_id = \$1/i);
  assert.deepEqual(calls[0].params, ["tenant-shepherd"]);
  assert.deepEqual(calls[1].params, ["tenant-shepherd"]);
});