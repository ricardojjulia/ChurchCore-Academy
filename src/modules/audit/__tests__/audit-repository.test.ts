import assert from "node:assert/strict";
import test from "node:test";
import {
  PostgresAcademyAuditRepository,
  validateAuditMetadata,
} from "@/modules/audit/postgres-repository";

test("rejects secret-shaped audit metadata", () => {
  assert.throws(
    () => validateAuditMetadata({ accessToken: "secret" }),
    /prohibited key/,
  );
  assert.throws(
    () => validateAuditMetadata({ rawPayload: "{}" }),
    /prohibited key/,
  );
});

test("inserts tenant-scoped append-only audit events", async () => {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const repository = new PostgresAcademyAuditRepository({
    query: async (text, values) => {
      queries.push({ text, values });
      return {
        rows: [
          {
            id: "audit-1",
            occurred_at: new Date("2026-06-13T12:00:00.000Z"),
          },
        ],
      };
    },
  });

  const event = await repository.append({
    tenantId: "tenant-1",
    actorPersonId: "person-1",
    action: "academy.authenticated",
    entityType: "academy_session",
    resultStatus: "success",
    correlationId: "corr-1",
    redactedMetadata: { source: "supabase_session" },
  });

  assert.equal(event.id, "audit-1");
  assert.equal(event.tenantId, "tenant-1");
  assert.match(queries[0].text, /insert into academy_audit_events/i);
  assert.doesNotMatch(JSON.stringify(queries[0].values), /secret|token/i);
});
