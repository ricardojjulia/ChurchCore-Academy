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
  assert.equal(application.programName, undefined);
});

test("maps program_name when the row includes it (list() joins academy_programs)", () => {
  const application = mapAdmissionApplicationRow({
    id: "application-1",
    tenant_id: "tenant-1",
    applicant_person_id: "person-1",
    program_id: "program-1",
    program_name: "Bachelor of Biblical Studies",
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

  assert.equal(application.programName, "Bachelor of Biblical Studies");
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
  // list() must join academy_programs (tenant-scoped) to surface the program's display name —
  // the admissions review UI previously showed the raw programId to staff.
  assert.match(calls[2].sql, /left join academy_programs program/i);
  assert.match(calls[2].sql, /program\.tenant_id = application\.tenant_id/i);
  // Uses program.title, not program.name, to match the existing display-name convention
  // already established in public-application-service.ts's status-lookup query.
  assert.match(calls[2].sql, /program\.title as program_name/i);
});
