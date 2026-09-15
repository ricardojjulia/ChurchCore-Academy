import assert from "node:assert/strict";
import test from "node:test";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";

test("promoteSuggestion reads and updates suggestions within the caller tenant", async () => {
  const calls: { sql: string; params: unknown[] | undefined }[] = [];
  const service = new AcademicWorkflowsPostgresService({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });

      if (sql === "begin" || sql === "commit" || sql === "rollback") {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("select * from ai_suggestions")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "suggestion-1",
              tenant_id: "tenant-shepherd",
              workflow_code: "calendar_setup_review",
            },
          ],
        };
      }

      if (sql.includes("insert into workflows")) {
        return { rowCount: 1, rows: [] };
      }

      if (sql.includes("update ai_suggestions set status = 'promoted_to_workflow'")) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 1, rows: [] };
    },
  });

  const workflow = await service.promoteSuggestion("tenant-shepherd", "suggestion-1", "owner-1", "assignee-1");

  assert.equal(workflow.tenantId, "tenant-shepherd");
  assert.match(calls[0].sql, /where id = \$1 and tenant_id = \$2/i);
  assert.deepEqual(calls[0].params, ["suggestion-1", "tenant-shepherd"]);
  const statusUpdate = calls.find((call) => call.sql.includes("update ai_suggestions set status = 'promoted_to_workflow'"));
  assert.ok(statusUpdate);
  assert.deepEqual(statusUpdate?.params, ["suggestion-1", "tenant-shepherd"]);
});

test("promoteSuggestion rejects cross-tenant suggestion access", async () => {
  const service = new AcademicWorkflowsPostgresService({
    query: async (sql: string) => {
      if (sql === "begin" || sql === "commit" || sql === "rollback") {
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    },
  });

  await assert.rejects(
    () => service.promoteSuggestion("tenant-shepherd", "suggestion-1", "owner-1"),
    /Suggestion suggestion-1 was not found./,
  );
});

test("scoped workflow service leaves transaction ownership to the request context", async () => {
  const calls: string[] = [];
  const service = new AcademicWorkflowsPostgresService(
    {
      query: async (sql: string) => {
        calls.push(sql);
        if (sql.includes("select * from ai_suggestions")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: "suggestion-1",
                tenant_id: "tenant-shepherd",
                workflow_code: "calendar_setup_review",
              },
            ],
          };
        }
        return { rowCount: 1, rows: [] };
      },
    },
    false,
  );

  await service.promoteSuggestion(
    "tenant-shepherd",
    "suggestion-1",
    "owner-1",
  );

  assert.equal(calls.includes("begin"), false);
  assert.equal(calls.includes("commit"), false);
  assert.equal(calls.includes("rollback"), false);
});

test("dismissSuggestion and assignWorkflow mutations include tenant filters", async () => {
  const calls: { sql: string; params: unknown[] | undefined }[] = [];
  const service = new AcademicWorkflowsPostgresService({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes("update workflows")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "workflow-1",
              tenant_id: "tenant-shepherd",
              suggestion_id: "suggestion-1",
              workflow_type: "academic",
              workflow_code: "calendar_setup_review",
              owner_user_id: "owner-1",
              assigned_to_user_id: "assignee-1",
              status: "assigned",
              due_at: null,
              completed_at: null,
              created_at: new Date("2026-06-12T00:00:00.000Z"),
            },
          ],
        };
      }

      if (sql.includes("insert into workflow_actions")) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 1, rows: [{ id: "suggestion-1", status: "dismissed" }] };
    },
  });

  await service.dismissSuggestion("tenant-shepherd", "suggestion-1", "done");
  await service.assignWorkflow("tenant-shepherd", "workflow-1", "assignee-1");

  assert.match(calls[0].sql, /where id = \$1 and tenant_id = \$2/i);
  assert.deepEqual(calls[0].params, ["suggestion-1", "tenant-shepherd", "done"]);
  const assignCall = calls.find((call) => call.sql.includes("set assigned_to_user_id = $2"));
  assert.ok(assignCall);
  assert.match(assignCall?.sql ?? "", /where id = \$1 and tenant_id = \$3/i);
  assert.deepEqual(assignCall?.params, ["workflow-1", "assignee-1", "tenant-shepherd"]);
});
