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
  DenominationMembershipRecord,
  OrdinationRecord,
  DenominationRosterEntry,
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

      if (key.includes("insert into academy_denomination_memberships")) {
        return {
          rows: [
            {
              id: MEMBERSHIP_ID,
              tenantId: values?.[0] || TENANT_A,
              personId: values?.[1] || PERSON_ID,
              denominationName: values?.[2] || "Test Denomination",
              localChurchName: values?.[3] || null,
              membershipNumber: values?.[4] || null,
              membershipStatus: values?.[5] || "active",
              membershipDate: values?.[6] || null,
              transferDate: null,
              notes: null,
              createdAt: "2026-06-24T00:00:00.000Z",
              updatedAt: "2026-06-24T00:00:00.000Z",
            },
          ],
        };
      }

      if (key.includes("update academy_denomination_memberships")) {
        return {
          rows: [
            {
              id: MEMBERSHIP_ID,
              tenantId: TENANT_A,
              personId: PERSON_ID,
              denominationName: "Test Denomination",
              localChurchName: null,
              membershipNumber: null,
              membershipStatus: "transferred",
              membershipDate: null,
              transferDate: "2026-06-01",
              notes: "Test note",
              createdAt: "2026-06-24T00:00:00.000Z",
              updatedAt: "2026-06-24T00:00:00.000Z",
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
                tenantId: TENANT_A,
                personId: queriedPersonId || PERSON_ID,
                denominationName: "Test Denomination",
                localChurchName: "Local Church",
                membershipNumber: "MEM-001",
                membershipStatus: "active",
                membershipDate: "2020-01-01",
                transferDate: null,
                notes: null,
                createdAt: "2026-06-24T00:00:00.000Z",
                updatedAt: "2026-06-24T00:00:00.000Z",
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
                tenantId: TENANT_A,
                personId: queriedPersonId || PERSON_ID,
                ordinationType: "pastor",
                ordainingBody: "Test Body",
                ordinationDate: "2015-05-15",
                ordinationStatus: "active",
                credentialsNumber: "CRED-001",
                renewalDate: "2025-05-15",
                notes: null,
                createdAt: "2026-06-24T00:00:00.000Z",
                updatedAt: "2026-06-24T00:00:00.000Z",
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
              tenantId: values?.[0] || TENANT_A,
              personId: values?.[1] || PERSON_ID,
              ordinationType: values?.[2] || "pastor",
              ordainingBody: values?.[3] || "Test Body",
              ordinationDate: values?.[4] || "2015-05-15",
              ordinationStatus: values?.[5] || "active",
              credentialsNumber: values?.[6] || null,
              renewalDate: values?.[7] || null,
              notes: null,
              createdAt: "2026-06-24T00:00:00.000Z",
              updatedAt: "2026-06-24T00:00:00.000Z",
            },
          ],
        };
      }

      if (key.includes("update academy_ordination_records")) {
        return {
          rows: [
            {
              id: ORDINATION_ID,
              tenantId: TENANT_A,
              personId: PERSON_ID,
              ordinationType: "pastor",
              ordainingBody: "Test Body",
              ordinationDate: "2015-05-15",
              ordinationStatus: "retired",
              credentialsNumber: "CRED-001",
              renewalDate: "2025-05-15",
              notes: null,
              createdAt: "2026-06-24T00:00:00.000Z",
              updatedAt: "2026-06-24T00:00:00.000Z",
            },
          ],
        };
      }

      if (key.includes("select") && text.includes("academy_denomination_memberships dm")) {
        return {
          rows: [
            {
              person_id: PERSON_ID,
              display_name: "John Doe",
              email: "john@example.com",
              membership_status: "active",
              membership_date: "2020-01-01",
              local_church_name: "Local Church",
            },
          ],
        };
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
