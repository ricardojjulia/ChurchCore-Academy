import assert from "node:assert/strict";
import test from "node:test";
import { PublicApplicationService } from "@/modules/admissions/public-application-service";
import { PostgresApplicationFeeRepository } from "@/modules/admissions/application-fee-repository";
import { AdmissionsService } from "@/modules/admissions/service";
import { ApplicationFeeRequiredError } from "@/modules/admissions/types";
import type { AcademyActor } from "@/modules/academy-auth/policy";

interface MockDatabase {
  queries: Array<{ sql: string; values?: unknown[] }>;
  query(sql: string, values?: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function createMockDatabase(): MockDatabase {
  const db: MockDatabase = {
    queries: [],
    async query(sql: string, values?: unknown[]) {
      db.queries.push({ sql, values });

      // Mock rate limit check
      if (sql.includes("academy_rate_limits")) {
        if (sql.includes("delete")) return { rowCount: 0, rows: [] };
        if (sql.includes("insert")) return { rowCount: 1, rows: [{ attempt_count: 1 }] };
      }

      // Mock program title query (for validation)
      if (sql.includes("select id, title from academy_programs")) {
        return {
          rowCount: 1,
          rows: [{ id: "prog-1", title: "Master of Divinity" }],
        };
      }

      // Mock program fee query (with fee)
      if (sql.includes("select application_fee_cents")) {
        return {
          rowCount: 1,
          rows: [{
            application_fee_cents: 5000,
            application_fee_currency: "USD",
          }],
        };
      }

      // Mock person insert
      if (sql.includes("insert into academy_people")) {
        return { rowCount: 1, rows: [] };
      }

      // Mock role assignment
      if (sql.includes("academy_person_role_assignments")) {
        return { rowCount: 1, rows: [] };
      }

      // Mock application lookup for finalizeSubmission (must come before the existing-application
      // check below — both queries select an "email" column, but only this one selects
      // applicant_person_id, which is what distinguishes it)
      if (sql.includes("select") && sql.includes("applicant_person_id") && sql.includes("academy_admission_applications")) {
        return {
          rowCount: 1,
          rows: [
            {
              applicant_person_id: "person-1",
              program_id: "prog-1",
              legal_name: "Test Applicant",
              email: "applicant@example.com",
              idempotency_key: "public-apply-person-1",
            },
          ],
        };
      }

      // Mock existing application check (must come before insert check)
      if (sql.includes("select") && sql.includes("academy_admission_applications") && sql.includes("email")) {
        return { rowCount: 0, rows: [] };
      }

      // Mock application insert
      if (sql.includes("insert into academy_admission_applications")) {
        return {
          rowCount: 1,
          rows: [{ id: "app-1", status_token: "token-abc123" }],
        };
      }

      // Mock fee charge insert (idempotent)
      if (sql.includes("insert into academy_application_fee_charges")) {
        return {
          rowCount: 1,
          rows: [{
            id: "fee-1",
            tenant_id: "tenant-a",
            application_id: "app-1",
            fee_type: "application_fee",
            amount_cents: 5000,
            currency: "USD",
            status: "pending",
            created_at: new Date(),
            updated_at: new Date(),
          }],
        };
      }

      // Mock fee status check
      if (sql.includes("select status from academy_application_fee_charges")) {
        return {
          rowCount: 1,
          rows: [{ status: "pending" }],
        };
      }

      // Mock application update (transition to submitted)
      if (sql.includes("update academy_admission_applications") && sql.includes("submitted")) {
        return { rowCount: 1, rows: [] };
      }

      // Mock event insert
      if (sql.includes("academy_admission_application_events")) {
        return { rowCount: 1, rows: [] };
      }

      // Mock document checklist
      if (sql.includes("academy_program_document_requirements")) {
        return { rowCount: 0, rows: [] };
      }

      // Mock communication message
      if (sql.includes("academy_communication_messages")) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    },
  };

  return db;
}

test("Public application with fee - blocks submission when fee pending", async () => {
  const db = createMockDatabase();
  const service = new PublicApplicationService(db);

  const result = await service.submitPublicApplication(
    {
      legalName: "John Doe",
      email: "john@example.com",
      programId: "prog-1",
      personalStatement: "I want to serve the Lord in ministry for many years to come.",
    },
    "tenant-a",
    "127.0.0.1",
  );

  assert.equal(result.applicationId, "app-1");
  assert.equal(result.statusToken, "token-abc123");

  // Verify fee charge was created
  const feeChargeCreated = db.queries.some(
    (q) => q.sql.includes("insert into academy_application_fee_charges"),
  );
  assert.ok(feeChargeCreated, "Fee charge should have been created");

  // Verify application was NOT transitioned to submitted (because fee is pending)
  const transitionQuery = db.queries.find(
    (q) => q.sql.includes("update academy_admission_applications") && q.sql.includes("submitted"),
  );
  assert.equal(transitionQuery, undefined, "Application should NOT be transitioned to submitted when fee is pending");
});

test("Public application without fee - proceeds to submitted", async () => {
  const db = createMockDatabase();

  // Override program query to return no fee
  const originalQuery = db.query.bind(db);
  db.query = async (sql: string, values?: unknown[]) => {
    if (sql.includes("application_fee_cents")) {
      return {
        rowCount: 1,
        rows: [{ application_fee_cents: null, application_fee_currency: "USD" }],
      };
    }
    return originalQuery(sql, values);
  };

  const service = new PublicApplicationService(db);

  const result = await service.submitPublicApplication(
    {
      legalName: "Jane Smith",
      email: "jane@example.com",
      programId: "prog-1",
      personalStatement: "I feel called to theological education and pastoral ministry.",
    },
    "tenant-a",
    "127.0.0.1",
  );

  assert.equal(result.applicationId, "app-1");

  // Verify no fee charge was created
  const feeChargeCreated = db.queries.some(
    (q) => q.sql.includes("insert into academy_application_fee_charges"),
  );
  assert.equal(feeChargeCreated, false, "No fee charge should be created when program has no fee");

  // Verify application WAS transitioned to submitted
  const transitionQuery = db.queries.find(
    (q) => q.sql.includes("update academy_admission_applications") && q.sql.includes("submitted"),
  );
  assert.ok(transitionQuery, "Application should be transitioned to submitted when no fee required");
});

test("AdmissionsService.submit - blocks when fee pending", async () => {
  const mockRepo = {
    findById: async () => ({
      id: "app-1",
      tenantId: "tenant-a",
      applicantPersonId: "person-1",
      programId: "prog-1",
      legalName: "John Doe",
      email: "john@example.com",
      status: "draft" as const,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    }),
    findByIdempotencyKey: async () => undefined,
    findMutationByIdempotencyKey: async () => undefined,
    create: async () => {
      throw new Error("Not implemented");
    },
    transition: async () => undefined,
    appendEvent: async () => {},
    checkApplicationFeeStatus: async () => "pending" as const,
  };

  const mockAudit = {
    append: async () => undefined,
  };

  const service = new AdmissionsService(mockRepo, mockAudit);
  const staffActor: AcademyActor = {
    userId: "staff-1",
    tenantId: "tenant-a",
    roles: ["registrar"],
  };

  await assert.rejects(
    async () => service.submit(staffActor, "app-1", "corr-1", "idem-1"),
    (err: Error) => {
      return err instanceof ApplicationFeeRequiredError;
    },
  );
});

test("AdmissionsService.submit - allows when fee paid", async () => {
  const mockRepo = {
    findById: async () => ({
      id: "app-1",
      tenantId: "tenant-a",
      applicantPersonId: "person-1",
      programId: "prog-1",
      legalName: "John Doe",
      email: "john@example.com",
      status: "draft" as const,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    }),
    findByIdempotencyKey: async () => undefined,
    findMutationByIdempotencyKey: async () => undefined,
    create: async () => {
      throw new Error("Not implemented");
    },
    transition: async () => ({
      id: "app-1",
      tenantId: "tenant-a",
      applicantPersonId: "person-1",
      programId: "prog-1",
      legalName: "John Doe",
      email: "john@example.com",
      status: "submitted" as const,
      submittedAt: "2026-01-02T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    }),
    appendEvent: async () => {},
    checkApplicationFeeStatus: async () => "paid" as const,
  };

  const mockAudit = {
    append: async () => undefined,
  };

  const service = new AdmissionsService(mockRepo, mockAudit);
  const staffActor: AcademyActor = {
    userId: "staff-1",
    tenantId: "tenant-a",
    roles: ["registrar"],
  };

  const result = await service.submit(staffActor, "app-1", "corr-1", "idem-1");
  assert.equal(result.status, "submitted");
});

test("AdmissionsService.submit - allows when fee waived", async () => {
  const mockRepo = {
    findById: async () => ({
      id: "app-1",
      tenantId: "tenant-a",
      applicantPersonId: "person-1",
      programId: "prog-1",
      legalName: "John Doe",
      email: "john@example.com",
      status: "draft" as const,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    }),
    findByIdempotencyKey: async () => undefined,
    findMutationByIdempotencyKey: async () => undefined,
    create: async () => {
      throw new Error("Not implemented");
    },
    transition: async () => ({
      id: "app-1",
      tenantId: "tenant-a",
      applicantPersonId: "person-1",
      programId: "prog-1",
      legalName: "John Doe",
      email: "john@example.com",
      status: "submitted" as const,
      submittedAt: "2026-01-02T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    }),
    appendEvent: async () => {},
    checkApplicationFeeStatus: async () => "waived" as const,
  };

  const mockAudit = {
    append: async () => undefined,
  };

  const service = new AdmissionsService(mockRepo, mockAudit);
  const staffActor: AcademyActor = {
    userId: "staff-1",
    tenantId: "tenant-a",
    roles: ["registrar"],
  };

  const result = await service.submit(staffActor, "app-1", "corr-1", "idem-1");
  assert.equal(result.status, "submitted");
});

test("AdmissionsService.submit - allows when no fee configured", async () => {
  const mockRepo = {
    findById: async () => ({
      id: "app-1",
      tenantId: "tenant-a",
      applicantPersonId: "person-1",
      programId: "prog-1",
      legalName: "John Doe",
      email: "john@example.com",
      status: "draft" as const,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    }),
    findByIdempotencyKey: async () => undefined,
    findMutationByIdempotencyKey: async () => undefined,
    create: async () => {
      throw new Error("Not implemented");
    },
    transition: async () => ({
      id: "app-1",
      tenantId: "tenant-a",
      applicantPersonId: "person-1",
      programId: "prog-1",
      legalName: "John Doe",
      email: "john@example.com",
      status: "submitted" as const,
      submittedAt: "2026-01-02T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    }),
    appendEvent: async () => {},
    checkApplicationFeeStatus: async () => "none" as const,
  };

  const mockAudit = {
    append: async () => undefined,
  };

  const service = new AdmissionsService(mockRepo, mockAudit);
  const staffActor: AcademyActor = {
    userId: "staff-1",
    tenantId: "tenant-a",
    roles: ["registrar"],
  };

  const result = await service.submit(staffActor, "app-1", "corr-1", "idem-1");
  assert.equal(result.status, "submitted");
});

test("ApplicationFeeRepository - no PII leakage in test output", async () => {
  const db = createMockDatabase();
  const repo = new PostgresApplicationFeeRepository(db);

  const result = await repo.create({
    tenantId: "tenant-a",
    applicationId: "app-sensitive",
    feeType: "application_fee",
    amountCents: 5000,
    currency: "USD",
  });

  const serialized = JSON.stringify(result);

  // Verify no email/phone fields leak (application fields, not fee charge fields)
  assert.doesNotMatch(serialized, /email.*@/i);
  assert.doesNotMatch(serialized, /phone.*\d{3}/i);
  assert.doesNotMatch(serialized, /accessToken|credentialSecret|rawProviderPayload/i);
});

// ---------------------------------------------------------------------------
// finalizeSubmission — this is the method the Stripe webhook and the staff
// manual-pay/waive routes call once a fee is resolved. An earlier version of
// the webhook flipped the application's status with a raw SQL UPDATE instead
// of calling this method, which silently skipped the submitted audit event
// and the document-checklist snapshot — leaving the admissions decision gate
// (canAdvanceToDecision) trivially satisfied regardless of the program's real
// document requirements. These tests exist to catch a regression back to that.
// ---------------------------------------------------------------------------

test("finalizeSubmission - runs the full submission side-effect chain, not just the status flip", async () => {
  const db = createMockDatabase();
  const service = new PublicApplicationService(db);

  await service.finalizeSubmission("tenant-a", "app-1");

  const transitioned = db.queries.some(
    (q) => q.sql.includes("update academy_admission_applications") && q.sql.includes("submitted"),
  );
  assert.ok(transitioned, "Application should transition to submitted");

  const auditEventWritten = db.queries.some(
    (q) => q.sql.includes("insert into academy_admission_application_events"),
  );
  assert.ok(
    auditEventWritten,
    "A submitted audit event must be recorded — this is what the raw-SQL webhook bug skipped",
  );

  const checklistSnapshotAttempted = db.queries.some(
    (q) => q.sql.includes("academy_program_document_requirements"),
  );
  assert.ok(
    checklistSnapshotAttempted,
    "Document checklist must be snapshotted on finalize — without it, canAdvanceToDecision " +
      "trivially treats the application as complete regardless of the program's actual requirements",
  );

  const confirmationQueued = db.queries.some(
    (q) => q.sql.includes("academy_communication_messages"),
  );
  assert.ok(confirmationQueued, "Confirmation email should be queued on finalize");
});

test("finalizeSubmission - idempotent, a second call does not re-run side effects", async () => {
  const db = createMockDatabase();
  let transitionCallCount = 0;
  const originalQuery = db.query.bind(db);
  db.query = async (sql: string, values?: unknown[]) => {
    if (sql.includes("update academy_admission_applications") && sql.includes("submitted")) {
      transitionCallCount += 1;
      if (transitionCallCount > 1) {
        // Simulate the application already being submitted on the second call.
        return { rowCount: 0, rows: [] };
      }
    }
    return originalQuery(sql, values);
  };
  const service = new PublicApplicationService(db);

  await service.finalizeSubmission("tenant-a", "app-1");
  const eventsAfterFirst = db.queries.filter(
    (q) => q.sql.includes("insert into academy_admission_application_events"),
  ).length;

  await service.finalizeSubmission("tenant-a", "app-1");
  const eventsAfterSecond = db.queries.filter(
    (q) => q.sql.includes("insert into academy_admission_application_events"),
  ).length;

  assert.equal(eventsAfterFirst, 1);
  assert.equal(
    eventsAfterSecond,
    1,
    "Second call should be a no-op — no duplicate audit event or checklist snapshot, " +
      "since a Stripe webhook retry or a staff action racing the webhook must not double-fire",
  );
});

test("finalizeSubmission - throws for an application that does not exist", async () => {
  const db = createMockDatabase();
  db.query = async () => ({ rowCount: 0, rows: [] });
  const service = new PublicApplicationService(db);

  await assert.rejects(
    () => service.finalizeSubmission("tenant-a", "missing-app"),
    /not found/i,
  );
});
