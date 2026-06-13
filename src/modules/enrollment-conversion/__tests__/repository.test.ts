import assert from "node:assert/strict";
import test from "node:test";
import { PostgresEnrollmentConversionRepository } from "@/modules/enrollment-conversion/postgres-repository";

test("conversion uses tenant predicates and creates all records in order", async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const database = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      if (/from academy_enrollment_conversion_events/.test(sql)) {
        return { rowCount: 0, rows: [] };
      }
      if (/from academy_admission_applications/.test(sql)) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "application-1",
              applicant_person_id: "person-applicant",
              program_id: "program-1",
              application_term_id: "term-1",
              status: "accepted",
              converted_at: null,
            },
          ],
        };
      }
      if (/academy_student_number_sequences/.test(sql)) {
        return { rowCount: 1, rows: [{ allocated_value: "1" }] };
      }
      if (/insert into academy_student_profiles/.test(sql)) {
        return {
          rowCount: 1,
          rows: [{ id: "profile-1", student_number: "S-000001" }],
        };
      }
      if (/insert into academy_program_enrollments/.test(sql)) {
        return { rowCount: 1, rows: [{ id: "program-enrollment-1" }] };
      }
      if (/insert into academy_period_registrations/.test(sql)) {
        return { rowCount: 1, rows: [{ id: "period-registration-1" }] };
      }
      return { rowCount: 1, rows: [] };
    },
  };

  const repository = new PostgresEnrollmentConversionRepository(database);
  const result = await repository.convert({
    tenantId: "tenant-1",
    applicationId: "application-1",
    actorPersonId: "person-registrar",
    convertedAt: "2026-06-13T16:00:00.000Z",
    correlationId: "correlation-1",
    idempotencyKey: "key-1",
  });

  assert.deepEqual(result, {
    applicationId: "application-1",
    studentProfileId: "profile-1",
    studentNumber: "S-000001",
    programEnrollmentId: "program-enrollment-1",
    periodRegistrationId: "period-registration-1",
    convertedAt: "2026-06-13T16:00:00.000Z",
    idempotencyKey: "key-1",
  });

  const sql = calls.map((call) => call.sql).join("\n");
  assert.match(sql, /for update/i);
  assert.match(sql, /academy_person_role_assignments/i);
  assert.match(sql, /academy_student_profiles/i);
  assert.match(sql, /academy_program_enrollments/i);
  assert.match(sql, /academy_period_registrations/i);
  assert.match(sql, /update academy_admission_applications/i);
  assert.match(sql, /insert into academy_enrollment_conversion_events/i);
  for (const call of calls) {
    if (call.values?.includes("application-1")) {
      assert.ok(call.values.includes("tenant-1"));
    }
  }
});

test("conversion returns an existing same-key event before allocating a number", async () => {
  const calls: string[] = [];
  const repository = new PostgresEnrollmentConversionRepository({
    query: async (sql: string) => {
      calls.push(sql);
      return {
        rowCount: 1,
        rows: [
          {
            application_id: "application-1",
            student_profile_id: "profile-1",
            student_number: "S-000001",
            program_enrollment_id: "program-enrollment-1",
            period_registration_id: "period-registration-1",
            occurred_at: new Date("2026-06-13T16:00:00.000Z"),
            idempotency_key: "key-1",
          },
        ],
      };
    },
  });

  const result = await repository.convert({
    tenantId: "tenant-1",
    applicationId: "application-1",
    actorPersonId: "person-registrar",
    convertedAt: "2026-06-13T16:00:00.000Z",
    correlationId: "correlation-1",
    idempotencyKey: "key-1",
  });

  assert.equal(result.studentNumber, "S-000001");
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0], /student_number_sequences/i);
});
