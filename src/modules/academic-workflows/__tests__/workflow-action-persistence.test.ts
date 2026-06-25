import assert from "node:assert/strict";
import test from "node:test";
import { AcademicWorkflowsPostgresService } from "@/modules/academic-workflows/postgres-service";

test("dismissSuggestion persists note and sets status to dismissed", async () => {
  const calls: { sql: string; params: unknown[] | undefined }[] = [];
  const service = new AcademicWorkflowsPostgresService({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: [{ id: "suggestion-1", status: "dismissed" }],
      };
    },
  });

  const result = await service.dismissSuggestion("tenant-shepherd", "suggestion-1", "Already handled via manual email");

  assert.equal(result.id, "suggestion-1");
  assert.equal(result.status, "dismissed");
  assert.match(calls[0].sql, /set status = 'dismissed', dismiss_note = \$3/i);
  assert.deepEqual(calls[0].params, ["suggestion-1", "tenant-shepherd", "Already handled via manual email"]);
});

test("dismissSuggestion cross-tenant rejection", async () => {
  const service = new AcademicWorkflowsPostgresService({
    query: async () => {
      return { rowCount: 0, rows: [] };
    },
  });

  await assert.rejects(
    () => service.dismissSuggestion("tenant-a", "suggestion-from-tenant-b", "Not my tenant"),
    /Suggestion suggestion-from-tenant-b was not found./,
  );
});

test("snoozeSuggestion sets status to deferred and stores snooze_until", async () => {
  const calls: { sql: string; params: unknown[] | undefined }[] = [];
  const service = new AcademicWorkflowsPostgresService({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: [{ id: "suggestion-2", status: "deferred" }],
      };
    },
  });

  const snoozeUntil = "2026-06-30T00:00:00.000Z";
  const result = await service.snoozeSuggestion("tenant-shepherd", "suggestion-2", snoozeUntil);

  assert.equal(result.id, "suggestion-2");
  assert.equal(result.status, "deferred");
  assert.match(calls[0].sql, /set status = 'deferred', snooze_until = \$3::timestamptz/i);
  assert.deepEqual(calls[0].params, ["suggestion-2", "tenant-shepherd", snoozeUntil]);
});

test("snoozeSuggestion cross-tenant rejection", async () => {
  const service = new AcademicWorkflowsPostgresService({
    query: async () => {
      return { rowCount: 0, rows: [] };
    },
  });

  await assert.rejects(
    () => service.snoozeSuggestion("tenant-a", "suggestion-from-tenant-b", "2026-06-30T00:00:00.000Z"),
    /Suggestion suggestion-from-tenant-b was not found./,
  );
});

test("dismissSuggestion handles missing note gracefully", async () => {
  const calls: { sql: string; params: unknown[] | undefined }[] = [];
  const service = new AcademicWorkflowsPostgresService({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return {
        rowCount: 1,
        rows: [{ id: "suggestion-3", status: "dismissed" }],
      };
    },
  });

  await service.dismissSuggestion("tenant-shepherd", "suggestion-3");

  assert.match(calls[0].sql, /set status = 'dismissed', dismiss_note = \$3/i);
  assert.deepEqual(calls[0].params, ["suggestion-3", "tenant-shepherd", null]);
});
