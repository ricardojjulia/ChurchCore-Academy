import assert from "node:assert/strict";
import test from "node:test";
import { PostgresEnrollmentAgreementRepository } from "@/modules/admissions/enrollment-agreement-repository";

interface MockDatabase {
  queries: Array<{ sql: string; values?: unknown[] }>;
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function createMockDatabase(): MockDatabase {
  const db: MockDatabase = {
    queries: [],
    async query(sql: string, values?: unknown[]) {
      db.queries.push({ sql, values });

      // Mock find by application
      if (sql.includes("select * from academy_enrollment_agreement_signatures") && sql.includes("where")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "agreement-1",
              tenant_id: "tenant-a",
              application_id: "app-1",
              status: "pending",
              agreement_text_hash: null,
              signed_by_person_id: null,
              signed_at: null,
              redacted_ip_address: null,
              created_at: new Date("2026-01-01T00:00:00Z"),
              updated_at: new Date("2026-01-01T00:00:00Z"),
            },
          ],
        };
      }

      // Mock create (insert)
      if (sql.includes("insert into academy_enrollment_agreement_signatures")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "agreement-1",
              tenant_id: "tenant-a",
              application_id: "app-1",
              status: "pending",
              agreement_text_hash: null,
              signed_by_person_id: null,
              signed_at: null,
              redacted_ip_address: null,
              created_at: new Date("2026-01-01T00:00:00Z"),
              updated_at: new Date("2026-01-01T00:00:00Z"),
            },
          ],
        };
      }

      // Mock sign (update)
      if (sql.includes("update academy_enrollment_agreement_signatures") && sql.includes("signed")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "agreement-1",
              tenant_id: "tenant-a",
              application_id: "app-1",
              status: "signed",
              agreement_text_hash: "abc123hash",
              signed_by_person_id: "person-1",
              signed_at: new Date("2026-01-02T10:00:00Z"),
              redacted_ip_address: "192.168.1.0",
              created_at: new Date("2026-01-01T00:00:00Z"),
              updated_at: new Date("2026-01-02T10:00:00Z"),
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    },
  };

  return db;
}

test("PostgresEnrollmentAgreementRepository.findByApplication - success", async () => {
  const db = createMockDatabase();
  const repo = new PostgresEnrollmentAgreementRepository(db);

  const result = await repo.findByApplication("tenant-a", "app-1");

  assert.ok(result);
  assert.equal(result.status, "pending");
  assert.equal(result.applicationId, "app-1");
});

test("PostgresEnrollmentAgreementRepository.create - success", async () => {
  const db = createMockDatabase();
  const repo = new PostgresEnrollmentAgreementRepository(db);

  const result = await repo.create({
    tenantId: "tenant-a",
    applicationId: "app-1",
  });

  assert.ok(result);
  assert.equal(result.status, "pending");
  assert.equal(result.tenantId, "tenant-a");
  assert.equal(result.applicationId, "app-1");

  // Verify query was made
  assert.ok(db.queries.some((q) => q.sql.includes("insert into academy_enrollment_agreement_signatures")));
});

test("PostgresEnrollmentAgreementRepository.sign - success", async () => {
  const db = createMockDatabase();
  const repo = new PostgresEnrollmentAgreementRepository(db);

  const result = await repo.sign({
    tenantId: "tenant-a",
    applicationId: "app-1",
    applicantPersonId: "person-1",
    agreementTextHash: "abc123hash",
    redactedIpAddress: "192.168.1.0",
  });

  assert.ok(result);
  assert.equal(result.status, "signed");
  assert.equal(result.signedByPersonId, "person-1");
  assert.equal(result.agreementTextHash, "abc123hash");
  assert.equal(result.redactedIpAddress, "192.168.1.0");
});

test("PostgresEnrollmentAgreementRepository.sign - null IP is allowed", async () => {
  const db: MockDatabase = {
    queries: [],
    async query(sql: string, values?: unknown[]) {
      db.queries.push({ sql, values });

      if (sql.includes("update academy_enrollment_agreement_signatures") && sql.includes("signed")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "agreement-1",
              tenant_id: "tenant-a",
              application_id: "app-1",
              status: "signed",
              agreement_text_hash: "abc123hash",
              signed_by_person_id: "person-1",
              signed_at: new Date("2026-01-02T10:00:00Z"),
              redacted_ip_address: null, // IP was null
              created_at: new Date("2026-01-01T00:00:00Z"),
              updated_at: new Date("2026-01-02T10:00:00Z"),
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    },
  };

  const repo = new PostgresEnrollmentAgreementRepository(db);

  const result = await repo.sign({
    tenantId: "tenant-a",
    applicationId: "app-1",
    applicantPersonId: "person-1",
    agreementTextHash: "abc123hash",
    redactedIpAddress: null, // Explicitly null
  });

  assert.ok(result);
  assert.equal(result.status, "signed");
  assert.equal(result.redactedIpAddress, undefined); // Mapped to undefined

  // Verify the null was passed in the query
  const updateQuery = db.queries.find((q) => q.sql.includes("update"));
  assert.ok(updateQuery);
  assert.ok(updateQuery.values);
  assert.ok(updateQuery.values.includes(null), "Null IP should be passed to database");
});

test("PostgresEnrollmentAgreementRepository.create - idempotent on conflict", async () => {
  const db: MockDatabase = {
    queries: [],
    async query(sql: string, values?: unknown[]) {
      db.queries.push({ sql, values });

      // Simulate conflict (no row returned from insert)
      if (sql.includes("insert into academy_enrollment_agreement_signatures")) {
        return { rowCount: 0, rows: [] };
      }

      // Mock find by application (called when insert returns no rows)
      if (sql.includes("select * from academy_enrollment_agreement_signatures")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "agreement-1",
              tenant_id: "tenant-a",
              application_id: "app-1",
              status: "pending",
              agreement_text_hash: null,
              signed_by_person_id: null,
              signed_at: null,
              redacted_ip_address: null,
              created_at: new Date("2026-01-01T00:00:00Z"),
              updated_at: new Date("2026-01-01T00:00:00Z"),
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    },
  };

  const repo = new PostgresEnrollmentAgreementRepository(db);

  const result = await repo.create({
    tenantId: "tenant-a",
    applicationId: "app-1",
  });

  assert.ok(result);
  assert.equal(result.status, "pending");

  // Should have made both insert and select queries
  assert.ok(db.queries.some((q) => q.sql.includes("insert")));
  assert.ok(db.queries.some((q) => q.sql.includes("select")));
});

test("PostgresEnrollmentAgreementRepository - no raw IP in any query", async () => {
  const db = createMockDatabase();
  const repo = new PostgresEnrollmentAgreementRepository(db);

  await repo.sign({
    tenantId: "tenant-a",
    applicationId: "app-1",
    applicantPersonId: "person-1",
    agreementTextHash: "abc123hash",
    redactedIpAddress: "192.168.1.0",
  });

  // Verify no query contains what looks like a raw IP (ending in non-zero)
  for (const q of db.queries) {
    const valuesStr = JSON.stringify(q.values ?? []);
    assert.doesNotMatch(
      valuesStr,
      /\d+\.\d+\.\d+\.[1-9]\d*/,
      "Query values must not contain IPs with non-zero last octet",
    );
  }
});
