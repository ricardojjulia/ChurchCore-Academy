import assert from "node:assert/strict";
import test from "node:test";
import { LearnerIntelligencePostgresRepository } from "@/modules/learner-intelligence/postgres-repository";

test("intervention status update uses the request-owned transaction", async () => {
  const statements: string[] = [];
  const database = {
    async query(sql: string) {
      statements.push(sql.trim().toLowerCase());

      if (sql.includes("select status")) {
        return { rowCount: 1, rows: [{ status: "pending" }] };
      }

      if (sql.includes("update academy_intervention_recommendations")) {
        return {
          rowCount: 1,
          rows: [{
            id: "int-1",
            tenant_id: "tenant-1",
            learner_id: "student-1",
            risk_score: 0.8,
            risk_type: "low_momentum",
            status: "reviewed",
            created_at: "2026-06-14T00:00:00.000Z",
            expires_at: "2026-07-01T00:00:00.000Z",
          }],
        };
      }

      return { rowCount: 1, rows: [] };
    },
  };

  const repository = new LearnerIntelligencePostgresRepository(database);
  await repository.updateInterventionStatus(
    "tenant-1",
    "int-1",
    { status: "reviewed", expectedCurrentStatus: "pending" },
    "staff-1",
  );

  assert.equal(statements.some((statement) => statement === "begin"), false);
  assert.equal(statements.some((statement) => statement === "commit"), false);
  assert.equal(statements.some((statement) => statement === "rollback"), false);
});
