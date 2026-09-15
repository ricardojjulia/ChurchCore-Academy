import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import {
  addDenominationMembership,
  updateDenominationMembership,
  getDenominationMemberships,
  recordOrdination,
  updateOrdinationStatus,
  getOrdinationRecords,
  getDenominationRoster,
} from "@/modules/people/denomination";
import { AcademyQueryClient } from "@/lib/academy-database-context";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const PERSON_ID = "person-123";
const ADMIN_ID = "admin-456";
const STUDENT_ID = "student-789";
const MEMBERSHIP_ID = "membership-001";
const ORDINATION_ID = "ordination-001";

const adminActor: AcademyActor = {
  userId: ADMIN_ID,
  tenantId: TENANT_A,
  roles: ["institution_admin"],
};

const registrarActor: AcademyActor = {
  userId: ADMIN_ID,
  tenantId: TENANT_A,
  roles: ["registrar"],
};

const studentActor: AcademyActor = {
  userId: STUDENT_ID,
  tenantId: TENANT_A,
  roles: ["student"],
};

const crossTenantActor: AcademyActor = {
  userId: ADMIN_ID,
  tenantId: TENANT_B,
  roles: ["institution_admin"],
};

function mockDb(queryResults: Record<string, unknown>): AcademyQueryClient {
  return {
    query: async (text: string, values?: unknown[]) => {
      const key = text.trim().split("\n")[0].toLowerCase();

      if (key.includes("select id from academy_people")) {
        if (values?.[0] === PERSON_ID && values?.[1] === TENANT_A) {
          return { rowCount: 1, rows: [{ id: PERSON_ID }] };
        }
        if (values?.[0] === STUDENT_ID && values?.[1] === TENANT_A) {
          return { rowCount: 1, rows: [{ id: STUDENT_ID }] };
        }
        return { rowCount: 0, rows: [] };
      }

      if (key.includes("select id from academy_denomination_memberships")) {
        if (values?.[0] === MEMBERSHIP_ID && values?.[1] === TENANT_A) {
          return { rowCount: 1, rows: [{ id: MEMBERSHIP_ID }] };
        }
        return { rowCount: 0, rows: [] };
      }

      if (key.includes("select id from academy_ordination_records")) {
        if (values?.[0] === ORDINATION_ID && values?.[1] === TENANT_A) {
          return { rowCount: 1, rows: [{ id: ORDINATION_ID }] };
        }
        return { rowCount: 0, rows: [] };
      }

      // Row shapes below use real snake_case Postgres column names, not camelCase — this is
      // what `pg` actually returns. An earlier version of this mock returned pre-shaped
      // camelCase objects, which masked a real bug: every module function cast raw rows
      // directly to the camelCase TypeScript types with no actual field mapping, so every
      // camelCase field was `undefined` at runtime despite the database holding correct data.
      // Found via live browser testing. Some dates are real Date objects here (as `pg` returns
      // for `date`/`timestamptz` columns) to also exercise the module's Date normalization.
      if (key.includes("insert into academy_denomination_memberships")) {
        return {
          rows: [
            {
              id: MEMBERSHIP_ID,
              tenant_id: values?.[0] || TENANT_A,
              person_id: values?.[1] || PERSON_ID,
              denomination_name: values?.[2] || "Test Denomination",
              local_church_name: values?.[3] || null,
              membership_number: values?.[4] || null,
              membership_status: values?.[5] || "active",
              membership_date: values?.[6] || null,
              transfer_date: null,
              notes: null,
              created_at: new Date("2026-06-24T00:00:00.000Z"),
              updated_at: new Date("2026-06-24T00:00:00.000Z"),
            },
          ],
        };
      }

      if (key.includes("update academy_denomination_memberships")) {
        return {
          rows: [
            {
              id: MEMBERSHIP_ID,
              tenant_id: TENANT_A,
              person_id: PERSON_ID,
              denomination_name: "Test Denomination",
              local_church_name: null,
              membership_number: null,
              membership_status: "transferred",
              membership_date: null,
              transfer_date: "2026-06-01",
              notes: "Test note",
              created_at: new Date("2026-06-24T00:00:00.000Z"),
              updated_at: new Date("2026-06-24T00:00:00.000Z"),
            },
          ],
        };
      }

      if (key.includes("select id, tenant_id, person_id")) {
        if (text.includes("academy_denomination_memberships")) {
          // Return data for the specific person being queried
          const queriedPersonId = values?.[1];
          return {
            rows: [
              {
                id: MEMBERSHIP_ID,
                tenant_id: TENANT_A,
                person_id: queriedPersonId || PERSON_ID,
                denomination_name: "Test Denomination",
                local_church_name: "Local Church",
                membership_number: "MEM-001",
                membership_status: "active",
                membership_date: new Date("2020-01-01T00:00:00.000Z"),
                transfer_date: null,
                notes: null,
                created_at: new Date("2026-06-24T00:00:00.000Z"),
                updated_at: new Date("2026-06-24T00:00:00.000Z"),
              },
            ],
          };
        }
        if (text.includes("academy_ordination_records")) {
          // Return data for the specific person being queried
          const queriedPersonId = values?.[1];
          return {
            rows: [
              {
                id: ORDINATION_ID,
                tenant_id: TENANT_A,
                person_id: queriedPersonId || PERSON_ID,
                ordination_type: "pastor",
                ordaining_body: "Test Body",
                ordination_date: new Date("2015-05-15T00:00:00.000Z"),
                ordination_status: "active",
                credentials_number: "CRED-001",
                renewal_date: new Date("2025-05-15T00:00:00.000Z"),
                notes: null,
                created_at: new Date("2026-06-24T00:00:00.000Z"),
                updated_at: new Date("2026-06-24T00:00:00.000Z"),
              },
            ],
          };
        }
      }

      if (key.includes("insert into academy_ordination_records")) {
        return {
          rows: [
            {
              id: ORDINATION_ID,
              tenant_id: values?.[0] || TENANT_A,
              person_id: values?.[1] || PERSON_ID,
              ordination_type: values?.[2] || "pastor",
              ordaining_body: values?.[3] || "Test Body",
              ordination_date: values?.[4] || "2015-05-15",
              ordination_status: values?.[5] || "active",
              credentials_number: values?.[6] || null,
              renewal_date: values?.[7] || null,
              notes: null,
              created_at: new Date("2026-06-24T00:00:00.000Z"),
              updated_at: new Date("2026-06-24T00:00:00.000Z"),
            },
          ],
        };
      }

      if (key.includes("update academy_ordination_records")) {
        return {
          rows: [
            {
              id: ORDINATION_ID,
              tenant_id: TENANT_A,
              person_id: PERSON_ID,
              ordination_type: "pastor",
              ordaining_body: "Test Body",
              ordination_date: new Date("2015-05-15T00:00:00.000Z"),
              ordination_status: "retired",
              credentials_number: "CRED-001",
              renewal_date: new Date("2025-05-15T00:00:00.000Z"),
              notes: null,
              created_at: new Date("2026-06-24T00:00:00.000Z"),
              updated_at: new Date("2026-06-24T00:00:00.000Z"),
            },
          ],
        };
      }

      if (key.includes("select") && text.includes("academy_denomination_memberships dm")) {
        // Check if filtering by denomination or returning all
        const tenantId = values?.[0];
        const denominationName = values?.[1];

        if (tenantId === TENANT_A) {
          const baseRows = [
            {
              person_id: PERSON_ID,
              display_name: "John Doe",
              email: "john@example.com",
              membership_status: "active",
              membership_date: "2020-01-01",
              local_church_name: "Local Church",
            },
            {
              person_id: ADMIN_ID,
              display_name: "Jane Admin",
              email: "jane@example.com",
              membership_status: "active",
              membership_date: "2021-05-15",
              local_church_name: "Another Church",
            },
          ];

          // If no denomination filter (values.length === 1), return all
          if (!denominationName) {
            return { rows: baseRows };
          }

          // Otherwise filter by denomination name
          if (denominationName === "Test Denomination") {
            return { rows: [baseRows[0]] };
          }
          if (denominationName === "Another Denomination") {
            return { rows: [baseRows[1]] };
          }

          return { rows: [] };
        }

        // Cross-tenant returns nothing
        return { rows: [] };
      }

      return queryResults[key] ?? { rows: [], rowCount: 0 };
    },
    release: () => {},
  };
}

test("addDenominationMembership: success for registrar", async () => {
  const db = mockDb({});
  const result = await addDenominationMembership(
    registrarActor,
    {
      personId: PERSON_ID,
      denominationName: "Test Denomination",
      membershipStatus: "active",
    },
    db,
  );

  assert.equal(result.denominationName, "Test Denomination");
  assert.equal(result.membershipStatus, "active");
  assert.equal(result.tenantId, TENANT_A);
});

test("addDenominationMembership: rejects unauthorized role", async () => {
  const db = mockDb({});
  const advisorActor: AcademyActor = {
    userId: "advisor-001",
    tenantId: TENANT_A,
    roles: ["advisor"],
  };

  await assert.rejects(
    async () =>
      addDenominationMembership(
        advisorActor,
        {
          personId: PERSON_ID,
          denominationName: "Test Denomination",
          membershipStatus: "active",
        },
        db,
      ),
    /Only institution_admin or registrar/,
  );
});

test("addDenominationMembership: cross-tenant rejection", async () => {
  const db = mockDb({});

  await assert.rejects(
    async () =>
      addDenominationMembership(
        crossTenantActor,
        {
          personId: PERSON_ID,
          denominationName: "Test Denomination",
          membershipStatus: "active",
        },
        db,
      ),
    /Person .* not found in tenant/,
  );
});

test("recordOrdination: success", async () => {
  const db = mockDb({});
  const result = await recordOrdination(
    adminActor,
    {
      personId: PERSON_ID,
      ordinationType: "pastor",
      ordainingBody: "Test Body",
      ordinationDate: "2015-05-15",
      ordinationStatus: "active",
    },
    db,
  );

  assert.equal(result.ordinationType, "pastor");
  assert.equal(result.ordinationStatus, "active");
  assert.equal(result.tenantId, TENANT_A);
});

test("recordOrdination: rejects student role", async () => {
  const db = mockDb({});

  await assert.rejects(
    async () =>
      recordOrdination(
        studentActor,
        {
          personId: PERSON_ID,
          ordinationType: "pastor",
          ordainingBody: "Test Body",
          ordinationDate: "2015-05-15",
          ordinationStatus: "active",
        },
        db,
      ),
    /Only institution_admin or registrar/,
  );
});

test("getDenominationMemberships: student reads own", async () => {
  const db = mockDb({});
  const result = await getDenominationMemberships(studentActor, STUDENT_ID, db);

  assert.ok(Array.isArray(result));
  assert.equal(result.length, 1);
  assert.equal(result[0].membershipStatus, "active");
});

test("getDenominationMemberships: student rejected for another person's records", async () => {
  const db = mockDb({});

  await assert.rejects(
    async () => getDenominationMemberships(studentActor, PERSON_ID, db),
    /Students can only access their own denomination records/,
  );
});

test("getDenominationRoster: admin sees all matching", async () => {
  const db = mockDb({});
  const result = await getDenominationRoster(adminActor, "Test Denomination", db);

  assert.ok(Array.isArray(result));
  assert.equal(result.length, 1);
  assert.equal(result[0].displayName, "John Doe");
});

test("getDenominationRoster: student rejected", async () => {
  const db = mockDb({});

  await assert.rejects(
    async () => getDenominationRoster(studentActor, "Test Denomination", db),
    /Only institution_admin or registrar/,
  );
});

test("updateOrdinationStatus: success", async () => {
  const db = mockDb({});
  const result = await updateOrdinationStatus(adminActor, ORDINATION_ID, "retired", db);

  assert.equal(result.ordinationStatus, "retired");
  assert.equal(result.tenantId, TENANT_A);
});

test("updateOrdinationStatus: throws if ordination not found in tenant", async () => {
  const db = mockDb({});

  await assert.rejects(
    async () => updateOrdinationStatus(crossTenantActor, ORDINATION_ID, "retired", db),
    /Ordination .* not found in tenant/,
  );
});

test("getOrdinationRecords: admin can read any person", async () => {
  const db = mockDb({});
  const result = await getOrdinationRecords(adminActor, PERSON_ID, db);

  assert.ok(Array.isArray(result));
  assert.equal(result.length, 1);
  assert.equal(result[0].ordinationType, "pastor");
});

test("updateDenominationMembership: success", async () => {
  const db = mockDb({});
  const result = await updateDenominationMembership(
    adminActor,
    MEMBERSHIP_ID,
    {
      membershipStatus: "transferred",
      transferDate: "2026-06-01",
      notes: "Test note",
    },
    db,
  );

  assert.equal(result.membershipStatus, "transferred");
  assert.equal(result.transferDate, "2026-06-01");
  assert.equal(result.notes, "Test note");
});

test("updateDenominationMembership: cross-tenant rejection", async () => {
  const db = mockDb({});

  await assert.rejects(
    async () =>
      updateDenominationMembership(
        crossTenantActor,
        MEMBERSHIP_ID,
        { membershipStatus: "transferred" },
        db,
      ),
    /Membership .* not found in tenant/,
  );
});

test("getDenominationRoster: returns all records when no denomination filter provided", async () => {
  const db = mockDb({});
  const result = await getDenominationRoster(adminActor, null, db);

  assert.ok(Array.isArray(result));
  assert.equal(result.length, 2);
  assert.equal(result[0].displayName, "John Doe");
  assert.equal(result[1].displayName, "Jane Admin");
});

test("getDenominationRoster: cross-tenant rejection for no-filter case", async () => {
  const db = mockDb({});
  const result = await getDenominationRoster(crossTenantActor, null, db);

  // Cross-tenant actor should get empty results (not data from TENANT_A)
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

// Regression test for a real, previously-shipped bug found via live browser testing: every
// write/read function in this module cast raw Postgres rows (snake_case columns, and real
// Date objects for date/timestamptz columns) directly to the camelCase TypeScript interfaces
// via `as { rows: DenominationMembershipRecord[] }`, with no actual field mapping. TypeScript's
// `as` only changes what the compiler assumes about the shape — the runtime object still had
// snake_case keys, so every camelCase field read as `undefined`. The database held correct
// data the whole time; only the UI (and any other consumer) ever saw blank fields. This test
// feeds a raw snake_case row with real Date objects, exactly as `pg` returns, and asserts every
// camelCase field on the returned record is populated and correctly typed.
test("addDenominationMembership: maps a raw snake_case pg row (with real Date objects) to the typed camelCase record", async () => {
  const rawRow = {
    id: "mem-raw-001",
    tenant_id: TENANT_A,
    person_id: PERSON_ID,
    denomination_name: "Raw Row Fellowship",
    local_church_name: "Raw Row Church",
    membership_number: "RAW-001",
    membership_status: "active",
    membership_date: new Date("2020-01-15T00:00:00.000Z"),
    transfer_date: null,
    notes: "raw row note",
    created_at: new Date("2026-06-24T00:00:00.000Z"),
    updated_at: new Date("2026-06-24T00:00:00.000Z"),
  };

  const db: AcademyQueryClient = {
    query: async (text: string, values?: unknown[]) => {
      const key = text.trim().split("\n")[0].toLowerCase();
      if (key.includes("select id from academy_people")) {
        return { rowCount: 1, rows: [{ id: values?.[0] }] };
      }
      if (key.includes("insert into academy_denomination_memberships")) {
        return { rows: [rawRow] };
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };

  const result = await addDenominationMembership(
    adminActor,
    { personId: PERSON_ID, denominationName: "Raw Row Fellowship", membershipStatus: "active" },
    db,
  );

  assert.equal(result.denominationName, "Raw Row Fellowship", "denominationName must not be undefined");
  assert.equal(result.localChurchName, "Raw Row Church");
  assert.equal(result.membershipNumber, "RAW-001");
  assert.equal(result.membershipStatus, "active");
  assert.equal(result.membershipDate, "2020-01-15", "a real Date object must normalize to a plain date string");
  assert.equal(result.transferDate, null);
  assert.equal(result.notes, "raw row note");
  assert.equal(result.createdAt, "2026-06-24T00:00:00.000Z", "a real Date object must normalize to an ISO string");
  assert.equal(typeof result.createdAt, "string");
});
