import assert from "node:assert/strict";
import test from "node:test";
import {
  PublicApplicationService,
  PublicApplicationValidationError,
  PublicApplicationNotFoundError,
} from "@/modules/admissions/public-application-service";

const TENANT_ID = "tenant-test";
const CLIENT_IP = "127.0.0.1";
const PROGRAM_ID = "program-1";
const PROGRAM_TITLE = "Bachelor of Divinity";

// ---------------------------------------------------------------------------
// Mock DB builder
// ---------------------------------------------------------------------------

interface MockCall {
  sql: string;
  values: unknown[] | undefined;
}

function makeMockDb(overrides: {
  programRows?: Record<string, unknown>[];
  existingAppRows?: Record<string, unknown>[];
  appInsertRow?: Record<string, unknown>;
  statusRows?: Record<string, unknown>[];
  rateLimitRows?: { attempt_count: number }[];
}) {
  const calls: MockCall[] = [];

  const db = {
    calls,
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      const sqlNorm = sql.replace(/\s+/g, " ").trim().toLowerCase();

      // Rate limit delete
      if (sqlNorm.includes("delete from academy_rate_limits")) {
        return { rowCount: 0, rows: [] };
      }
      // Rate limit upsert
      if (sqlNorm.includes("insert into academy_rate_limits")) {
        const row = overrides.rateLimitRows?.shift() ?? { attempt_count: 1 };
        return { rowCount: 1, rows: [row] };
      }
      // Program lookup
      if (sqlNorm.includes("from academy_programs")) {
        const rows = overrides.programRows ?? [
          { id: PROGRAM_ID, title: PROGRAM_TITLE },
        ];
        return { rowCount: rows.length, rows };
      }
      // Status lookup (join with programs via left join) — must check BEFORE existing app lookup
      if (
        sqlNorm.includes("from academy_admission_applications a") &&
        sqlNorm.includes("left join academy_programs p")
      ) {
        const rows = overrides.statusRows ?? [];
        return { rowCount: rows.length, rows };
      }
      // Existing application lookup (by email + program_id)
      if (
        sqlNorm.includes("from academy_admission_applications a") &&
        sqlNorm.includes("a.email = $2")
      ) {
        const rows = overrides.existingAppRows ?? [];
        return { rowCount: rows.length, rows };
      }
      // Person insert
      if (sqlNorm.includes("insert into academy_people")) {
        return { rowCount: 1, rows: [] };
      }
      // Role insert
      if (sqlNorm.includes("insert into academy_person_role_assignments")) {
        return { rowCount: 1, rows: [] };
      }
      // Application insert
      if (sqlNorm.includes("insert into academy_admission_applications")) {
        const row = overrides.appInsertRow ?? {
          id: "app-uuid-1",
          status_token: "status-token-uuid-1",
        };
        return { rowCount: 1, rows: [row] };
      }
      // Application update (status transition)
      if (sqlNorm.includes("update academy_admission_applications")) {
        return { rowCount: 1, rows: [] };
      }
      // Event insert
      if (sqlNorm.includes("insert into academy_admission_application_events")) {
        return { rowCount: 1, rows: [] };
      }
      // Communication message insert
      if (sqlNorm.includes("insert into academy_communication_messages")) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  return db;
}

// ---------------------------------------------------------------------------
// Valid base input
// ---------------------------------------------------------------------------

function validInput() {
  return {
    legalName: "Jordan Rivera",
    email: "jordan@example.com",
    programId: PROGRAM_ID,
    personalStatement:
      "I have felt a calling to serve God through ministry since childhood, and this program will equip me to fulfill that purpose.",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("valid submission: creates person record, application, event; returns applicationId and statusToken", async () => {
  const db = makeMockDb({
    appInsertRow: { id: "app-1", status_token: "tok-1" },
  });

  const service = new PublicApplicationService(db);
  const result = await service.submitPublicApplication(
    validInput(),
    TENANT_ID,
    CLIENT_IP,
  );

  assert.ok(result.applicationId, "applicationId must be non-empty");
  assert.ok(result.statusToken, "statusToken must be non-empty");
  assert.equal(result.applicationId, "app-1");
  assert.equal(result.statusToken, "tok-1");

  // Verify that person, application and event inserts happened
  const sqlCalls = db.calls.map((c) => c.sql.toLowerCase());
  assert.ok(
    sqlCalls.some((s) => s.includes("insert into academy_people")),
    "must create person record",
  );
  assert.ok(
    sqlCalls.some((s) => s.includes("insert into academy_admission_applications")),
    "must insert application",
  );
  assert.ok(
    sqlCalls.some((s) => s.includes("insert into academy_admission_application_events")),
    "must insert event",
  );
});

test("statusToken is non-empty and differs from applicationId", async () => {
  const db = makeMockDb({
    appInsertRow: { id: "app-99", status_token: "tok-99" },
  });

  const service = new PublicApplicationService(db);
  const result = await service.submitPublicApplication(
    validInput(),
    TENANT_ID,
    CLIENT_IP,
  );

  assert.ok(result.statusToken.length > 0, "statusToken must be non-empty");
  assert.notEqual(
    result.applicationId,
    result.statusToken,
    "statusToken must differ from applicationId",
  );
});

test("duplicate email+program: returns existing statusToken, no second record created", async () => {
  const db = makeMockDb({
    existingAppRows: [
      { id: "app-existing", status_token: "tok-existing" },
    ],
  });

  const service = new PublicApplicationService(db);
  const result = await service.submitPublicApplication(
    validInput(),
    TENANT_ID,
    CLIENT_IP,
  );

  assert.equal(result.applicationId, "app-existing");
  assert.equal(result.statusToken, "tok-existing");

  // No person or application insert should have occurred
  const sqlCalls = db.calls.map((c) => c.sql.toLowerCase());
  assert.ok(
    !sqlCalls.some((s) => s.includes("insert into academy_people")),
    "must not create duplicate person",
  );
  assert.ok(
    !sqlCalls.some((s) => s.includes("insert into academy_admission_applications")),
    "must not create duplicate application",
  );
});

test("missing legalName: throws validation error, no DB writes", async () => {
  const db = makeMockDb({});
  const service = new PublicApplicationService(db);

  await assert.rejects(
    () =>
      service.submitPublicApplication(
        { ...validInput(), legalName: "" },
        TENANT_ID,
        CLIENT_IP,
      ),
    (err: unknown) => {
      assert.ok(err instanceof PublicApplicationValidationError, "must be validation error");
      assert.match(err.message, /legalName/i);
      return true;
    },
  );

  // Validation fires before any DB query
  assert.equal(db.calls.length, 0, "no DB calls on validation failure");
});

test("personalStatement < 50 chars: throws validation error", async () => {
  const db = makeMockDb({});
  const service = new PublicApplicationService(db);

  await assert.rejects(
    () =>
      service.submitPublicApplication(
        { ...validInput(), personalStatement: "Too short." },
        TENANT_ID,
        CLIENT_IP,
      ),
    (err: unknown) => {
      assert.ok(err instanceof PublicApplicationValidationError, "must be validation error");
      assert.match(err.message, /at least 50/i);
      return true;
    },
  );

  assert.equal(db.calls.length, 0, "no DB calls on validation failure");
});

test("personalStatement > 3000 chars: throws validation error", async () => {
  const db = makeMockDb({});
  const service = new PublicApplicationService(db);

  await assert.rejects(
    () =>
      service.submitPublicApplication(
        { ...validInput(), personalStatement: "A".repeat(3001) },
        TENANT_ID,
        CLIENT_IP,
      ),
    (err: unknown) => {
      assert.ok(err instanceof PublicApplicationValidationError, "must be validation error");
      assert.match(err.message, /at most 3000/i);
      return true;
    },
  );

  assert.equal(db.calls.length, 0, "no DB calls on validation failure");
});

test("cross-tenant programId: throws validation error", async () => {
  const db = makeMockDb({
    programRows: [], // empty — program not in tenant
  });
  const service = new PublicApplicationService(db);

  await assert.rejects(
    () =>
      service.submitPublicApplication(
        { ...validInput(), programId: "other-tenant-program" },
        TENANT_ID,
        CLIENT_IP,
      ),
    (err: unknown) => {
      assert.ok(err instanceof PublicApplicationValidationError, "must be validation error");
      assert.match(err.message, /does not belong/i);
      return true;
    },
  );
});

test("honeypot populated: returns fake success, zero DB writes", async () => {
  const db = makeMockDb({});
  const service = new PublicApplicationService(db);

  const result = await service.submitPublicApplication(
    { ...validInput(), website: "http://spam.example.com" },
    TENANT_ID,
    CLIENT_IP,
  );

  // Must return something that looks like success
  assert.ok(result.applicationId, "fake applicationId returned");
  assert.ok(result.statusToken, "fake statusToken returned");

  // CRITICAL: zero DB writes
  assert.equal(db.calls.length, 0, "honeypot must produce zero DB calls");
});

test("status lookup: token returns status, submittedAt, programName", async () => {
  const db = makeMockDb({
    statusRows: [
      {
        status: "submitted",
        submitted_at: new Date("2026-06-22T10:00:00.000Z"),
        program_name: PROGRAM_TITLE,
      },
    ],
  });
  const service = new PublicApplicationService(db);

  const result = await service.checkApplicationStatus(TENANT_ID, "tok-check");

  assert.equal(result.status, "submitted");
  assert.ok(result.submittedAt, "submittedAt must be set");
  assert.equal(result.programName, PROGRAM_TITLE);
});

test("unknown status token: throws NotFoundError", async () => {
  const db = makeMockDb({
    statusRows: [],
  });
  const service = new PublicApplicationService(db);

  await assert.rejects(
    () => service.checkApplicationStatus(TENANT_ID, "tok-unknown"),
    (err: unknown) => {
      assert.ok(err instanceof PublicApplicationNotFoundError, "must be NotFoundError");
      assert.match(err.message, /not found/i);
      return true;
    },
  );
});
