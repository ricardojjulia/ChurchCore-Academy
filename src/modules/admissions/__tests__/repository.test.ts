import assert from "node:assert/strict";
import test from "node:test";
import {
  mapAdmissionApplicationRow,
  PostgresAdmissionsRepository,
} from "@/modules/admissions/postgres-repository";

test("maps admission application rows and dates", () => {
  const application = mapAdmissionApplicationRow({
    id: "application-1",
    tenant_id: "tenant-1",
    applicant_person_id: "person-1",
    program_id: "program-1",
    application_term_id: null,
    legal_name: "Jordan Rivera",
    preferred_name: null,
    email: "jordan@example.com",
    phone: null,
    status: "submitted",
    submitted_at: new Date("2026-06-13T15:00:00.000Z"),
    decided_at: null,
    decided_by_person_id: null,
    decision_reason: null,
    created_at: new Date("2026-06-13T14:00:00.000Z"),
    updated_at: new Date("2026-06-13T15:00:00.000Z"),
  });

  assert.equal(application.submittedAt, "2026-06-13T15:00:00.000Z");
  assert.equal(application.applicationTermId, undefined);
});

test("repository reads and transitions include tenant predicates", async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const repository = new PostgresAdmissionsRepository({
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      return { rowCount: 0, rows: [] };
    },
  });

  await repository.findById("tenant-1", "application-1");
  await repository.findMutationByIdempotencyKey("tenant-1", "idem-1");
  await repository.list("tenant-1", { status: "submitted" });
  await repository.transition(
    "tenant-1",
    "application-1",
    "draft",
    "submitted",
  );

  for (const call of calls) {
    assert.match(call.sql, /tenant_id/);
  }
  assert.deepEqual(calls[0].values, ["tenant-1", "application-1"]);
  assert.match(calls[1].sql, /application_events/i);
  assert.doesNotMatch(calls[2].sql, /submitted/);
});
