import { test } from "node:test";
import assert from "node:assert/strict";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type {
  AlumniDatabase,
  AlumniRecord,
  GivingRecord,
} from "@/modules/people/alumni";
import {
  getAlumniRoster,
  getGivingSummary,
  recordGift,
  markGiftAcknowledged,
} from "@/modules/people/alumni";

// Acceptance tests for Alumni & Giving Admin UI feature (ADMIN-ONLY, GRADUATED-STUDENTS-ONLY scope).
//
// These tests verify the 13 acceptance criteria defined in the approved user story against the
// built implementation.

const institutionAdmin: AcademyActor = {
  userId: "person-inst-admin",
  tenantId: "tenant-1",
  roles: ["institution_admin"],
};

const academicAdmin: AcademyActor = {
  userId: "person-academic-admin",
  tenantId: "tenant-1",
  roles: ["academic_admin"],
};

const registrar: AcademyActor = {
  userId: "person-registrar",
  tenantId: "tenant-1",
  roles: ["registrar"],
};

const alumniRelations: AcademyActor = {
  userId: "person-alumni-relations",
  tenantId: "tenant-1",
  roles: ["alumni_relations"],
};

const dean: AcademyActor = {
  userId: "person-dean",
  tenantId: "tenant-1",
  roles: ["dean"],
};

const crossTenantActor: AcademyActor = {
  userId: "person-other",
  tenantId: "tenant-2",
  roles: ["institution_admin"],
};

function mockAlumni(overrides: Partial<AlumniRecord> = {}): AlumniRecord {
  return {
    id: "alumni-1",
    tenantId: "tenant-1",
    personId: "person-graduate-1",
    graduationYear: 2023,
    degreeEarned: "Master of Divinity",
    programId: null,
    employer: "First Baptist Church",
    jobTitle: "Senior Pastor",
    location: "Nashville, TN",
    contactPreferences: {},
    status: "active",
    createdAt: "2026-06-24T09:00:00Z",
    updatedAt: "2026-06-24T09:00:00Z",
    ...overrides,
  };
}

function mockGift(overrides: Partial<GivingRecord> = {}): GivingRecord {
  return {
    id: "gift-1",
    tenantId: "tenant-1",
    alumniPersonId: "person-graduate-1",
    giftAmountCents: 10000,
    giftDate: "2026-06-01",
    giftType: "one_time",
    fundDesignation: "General Fund",
    acknowledgmentSentAt: null,
    notes: null,
    createdAt: "2026-06-24T09:00:00Z",
    ...overrides,
  };
}

// alumniToRow helper removed (not needed for acceptance tests; existing alumni.test.ts uses it)

function giftToRow(g: GivingRecord): Record<string, unknown> {
  return {
    id: g.id,
    tenant_id: g.tenantId,
    alumni_person_id: g.alumniPersonId,
    gift_amount_cents: g.giftAmountCents,
    gift_date: new Date(g.giftDate),
    gift_type: g.giftType,
    fund_designation: g.fundDesignation,
    acknowledgment_sent_at: g.acknowledgmentSentAt ? new Date(g.acknowledgmentSentAt) : null,
    notes: g.notes,
    created_at: new Date(g.createdAt),
  };
}

function createMockDb(alumni: AlumniRecord[] = [], gifts: GivingRecord[] = []): AlumniDatabase {
  const storedAlumni = [...alumni];
  const storedGifts = [...gifts];

  return {
    query: async (sql: string, values?: unknown[]) => {
      const sqlLower = sql.toLowerCase();

      // getGivingSummary
      if (sqlLower.includes("count(distinct alumni_person_id)")) {
        const tenantId = values?.[0];
        const tenantGifts = storedGifts.filter((g) => g.tenantId === tenantId);
        const uniqueDonors = new Set(tenantGifts.map((g) => g.alumniPersonId)).size;
        const total = tenantGifts.reduce((sum, g) => sum + g.giftAmountCents, 0);
        const largest = tenantGifts.reduce((max, g) => Math.max(max, g.giftAmountCents), 0);
        return {
          rowCount: 1,
          rows: [
            {
              total_donors: uniqueDonors,
              total_gifts: tenantGifts.length,
              total_amount_cents: total,
              average_gift_cents: tenantGifts.length > 0 ? total / tenantGifts.length : 0,
              largest_gift_cents: largest,
            },
          ],
        };
      }

      // getAlumniRoster (with aggregated gift stats via subquery)
      if (sqlLower.includes("from academy_alumni_records aa") && sqlLower.includes("join academy_people p")) {
        const tenantId = values?.[0];
        let filtered = storedAlumni.filter((a) => a.tenantId === tenantId);

        // Apply graduation year filter if present
        const hasYearFilter = values && values.length > 1 && typeof values[1] === "number";
        if (hasYearFilter) {
          const yearFilter = values[1] as number;
          filtered = filtered.filter((a) => a.graduationYear === yearFilter);
        }

        // Apply status filter if present
        const hasStatusFilter =
          values &&
          values.length > 1 &&
          typeof values[values.length - 1] === "string" &&
          ["active", "lost_contact", "deceased"].includes(values[values.length - 1] as string);
        if (hasStatusFilter) {
          const statusFilter = values[values.length - 1] as string;
          filtered = filtered.filter((a) => a.status === statusFilter);
        }

        return {
          rowCount: null,
          rows: filtered.map((a) => {
            const personGifts = storedGifts.filter((g) => g.alumniPersonId === a.personId);
            const giftCount = personGifts.length;
            const totalGivenCents = personGifts.reduce((sum, g) => sum + g.giftAmountCents, 0);
            const lastGiftDate =
              personGifts.length > 0
                ? new Date(Math.max(...personGifts.map((g) => new Date(g.giftDate).getTime())))
                : null;

            return {
              person_id: a.personId,
              display_name: `Person ${a.personId}`,
              email: `${a.personId}@example.com`,
              graduation_year: a.graduationYear,
              degree_earned: a.degreeEarned,
              employer: a.employer,
              status: a.status,
              gift_count: giftCount,
              total_given_cents: totalGivenCents,
              last_gift_date: lastGiftDate,
            };
          }),
        };
      }

      // recordGift
      if (sqlLower.includes("insert into academy_giving_records")) {
        const newGift = mockGift({
          id: `gift-${storedGifts.length + 1}`,
          tenantId: String(values?.[0] ?? "tenant-1"),
          alumniPersonId: String(values?.[1] ?? "person-1"),
          giftAmountCents: Number(values?.[2] ?? 0),
          giftDate: String(values?.[3] ?? "2026-01-01"),
          giftType: (values?.[4] as GivingRecord["giftType"]) ?? "one_time",
          fundDesignation: values?.[5] ? String(values[5]) : null,
          notes: values?.[6] ? String(values[6]) : null,
        });
        storedGifts.push(newGift);
        return { rowCount: 1, rows: [giftToRow(newGift)] };
      }

      // markGiftAcknowledged
      if (sqlLower.includes("update academy_giving_records") && sqlLower.includes("acknowledgment_sent_at")) {
        const tenantId = values?.[0];
        const giftId = values?.[1];
        const idx = storedGifts.findIndex((g) => g.tenantId === tenantId && g.id === giftId);
        if (idx < 0) return { rowCount: 0, rows: [] };
        const updated = { ...storedGifts[idx]!, acknowledgmentSentAt: new Date().toISOString() };
        storedGifts[idx] = updated;
        return { rowCount: 1, rows: [giftToRow(updated)] };
      }

      return { rowCount: 0, rows: [] };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Criterion 1: Roster page shows summary cards only to stricter role set
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("CRITERION 1 — getGivingSummary enforces the stricter role gate (institution_admin, academic_admin, registrar ONLY, not alumni_relations)", async () => {
  const db = createMockDb([], [mockGift()]);

  // Alumni relations should be rejected
  await assert.rejects(
    () => getGivingSummary(alumniRelations, db),
    { name: "AcademyAuthorizationError" },
    "alumni_relations must be rejected by getGivingSummary"
  );

  // Institution admin should succeed
  const summary1 = await getGivingSummary(institutionAdmin, db);
  assert.ok(summary1);

  // Academic admin should succeed
  const summary2 = await getGivingSummary(academicAdmin, db);
  assert.ok(summary2);

  // Registrar should succeed
  const summary3 = await getGivingSummary(registrar, db);
  assert.ok(summary3);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Criterion 5: Currency handling (integer cents storage, dollars display)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("CRITERION 5 — recordGift stores giftAmountCents as integer cents, not dollars", async () => {
  const db = createMockDb([mockAlumni()]);

  const gift = await recordGift(
    institutionAdmin,
    {
      alumniPersonId: "person-graduate-1",
      giftAmountCents: 123456, // $1,234.56 in cents
      giftDate: "2026-06-01",
    },
    db
  );

  assert.equal(gift.giftAmountCents, 123456, "must store as integer cents, not dollars");
  assert.equal(typeof gift.giftAmountCents, "number");
});

test("CRITERION 5 — recordGift rejects non-integer giftAmountCents", async () => {
  const db = createMockDb([mockAlumni()]);

  // Float cents should be rejected
  await assert.rejects(
    () =>
      recordGift(
        institutionAdmin,
        {
          alumniPersonId: "person-1",
          giftAmountCents: 100.5, // float
          giftDate: "2026-06-01",
        },
        db
      ),
    /must be a positive integer/,
    "float giftAmountCents must be rejected"
  );

  // Negative cents should be rejected
  await assert.rejects(
    () =>
      recordGift(
        institutionAdmin,
        {
          alumniPersonId: "person-1",
          giftAmountCents: -100,
          giftDate: "2026-06-01",
        },
        db
      ),
    /must be a positive integer/,
    "negative giftAmountCents must be rejected"
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Criterion 6: Roster aggregation is a single query (N+1 prevention)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("CRITERION 6 — getAlumniRoster returns correct aggregated gift stats in a single query", async () => {
  const alumni = [
    mockAlumni({ id: "a-1", personId: "person-1", graduationYear: 2023 }),
    mockAlumni({ id: "a-2", personId: "person-2", graduationYear: 2022 }),
  ];
  const gifts = [
    mockGift({ id: "g-1", alumniPersonId: "person-1", giftAmountCents: 10000, giftDate: "2026-01-01" }),
    mockGift({ id: "g-2", alumniPersonId: "person-1", giftAmountCents: 5000, giftDate: "2026-02-01" }),
    mockGift({ id: "g-3", alumniPersonId: "person-2", giftAmountCents: 20000, giftDate: "2026-03-01" }),
  ];
  const db = createMockDb(alumni, gifts);

  const roster = await getAlumniRoster(institutionAdmin, {}, db);

  assert.equal(roster.length, 2, "must return one row per person, not one row per gift");

  const person1Entry = roster.find((r) => r.personId === "person-1");
  assert.ok(person1Entry);
  assert.equal(person1Entry.giftCount, 2, "must sum gifts per person");
  assert.equal(person1Entry.totalGivenCents, 15000, "must sum gift amounts per person");

  const person2Entry = roster.find((r) => r.personId === "person-2");
  assert.ok(person2Entry);
  assert.equal(person2Entry.giftCount, 1);
  assert.equal(person2Entry.totalGivenCents, 20000);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Criterion 7: Cross-tenant isolation
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("CRITERION 7 — getAlumniRoster enforces cross-tenant isolation", async () => {
  const alumni = [mockAlumni({ tenantId: "tenant-1" })];
  const gifts = [mockGift({ tenantId: "tenant-1" })];
  const db = createMockDb(alumni, gifts);

  const roster = await getAlumniRoster(crossTenantActor, {}, db);
  assert.equal(roster.length, 0, "cross-tenant actor must see empty roster");
});

test("CRITERION 7 — getGivingSummary enforces cross-tenant isolation", async () => {
  const gifts = [mockGift({ tenantId: "tenant-1" })];
  const db = createMockDb([], gifts);

  const summary = await getGivingSummary(crossTenantActor, db);
  assert.equal(summary.totalDonors, 0, "cross-tenant actor must see empty summary");
  assert.equal(summary.totalGifts, 0);
  assert.equal(summary.totalAmountCents, 0);
});

test("CRITERION 7 — markGiftAcknowledged rejects cross-tenant access", async () => {
  const gifts = [mockGift({ id: "gift-1", tenantId: "tenant-1" })];
  const db = createMockDb([], gifts);

  await assert.rejects(
    () => markGiftAcknowledged(crossTenantActor, "gift-1", db),
    /not found or access denied/,
    "cross-tenant actor must be rejected"
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Criterion 9: Person with zero gifts shows 0/empty state, not an error
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("CRITERION 9 — getAlumniRoster includes alumni with zero gifts (not an error)", async () => {
  const alumni = [
    mockAlumni({ id: "a-1", personId: "person-1" }),
    mockAlumni({ id: "a-2", personId: "person-2" }),
  ];
  const gifts = [mockGift({ id: "g-1", alumniPersonId: "person-1", giftAmountCents: 10000 })];
  const db = createMockDb(alumni, gifts);

  const roster = await getAlumniRoster(institutionAdmin, {}, db);

  assert.equal(roster.length, 2, "must include alumni with zero gifts");

  const zeroGiftPerson = roster.find((r) => r.personId === "person-2");
  assert.ok(zeroGiftPerson);
  assert.equal(zeroGiftPerson.giftCount, 0, "must show 0 gifts, not throw");
  assert.equal(zeroGiftPerson.totalGivenCents, 0);
  assert.equal(zeroGiftPerson.lastGiftDate, null, "must show null last gift date, not throw");
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Criterion 10: Person with multiple gifts shows ONE row with summed totals
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("CRITERION 10 — getAlumniRoster shows ONE row with correctly summed totals for person with multiple gifts", async () => {
  const alumni = [mockAlumni({ id: "a-1", personId: "person-1" })];
  const gifts = [
    mockGift({ id: "g-1", alumniPersonId: "person-1", giftAmountCents: 10000, giftDate: "2026-01-01" }),
    mockGift({ id: "g-2", alumniPersonId: "person-1", giftAmountCents: 5000, giftDate: "2026-02-01" }),
    mockGift({ id: "g-3", alumniPersonId: "person-1", giftAmountCents: 15000, giftDate: "2026-03-01" }),
  ];
  const db = createMockDb(alumni, gifts);

  const roster = await getAlumniRoster(institutionAdmin, {}, db);

  assert.equal(roster.length, 1, "must return ONE row per person, not one row per gift");

  const entry = roster[0];
  assert.ok(entry);
  assert.equal(entry.personId, "person-1");
  assert.equal(entry.giftCount, 3, "must sum all gifts");
  assert.equal(entry.totalGivenCents, 30000, "must sum all gift amounts");
  assert.equal(entry.lastGiftDate, "2026-03-01", "must show most recent gift date");
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Criterion 11: Empty giving summary (zero gifts in tenant) returns all-zero summary, not an error
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("CRITERION 11 — getGivingSummary returns an all-zero summary when no gifts exist, not an error", async () => {
  const db = createMockDb([], []); // no alumni, no gifts

  const summary = await getGivingSummary(institutionAdmin, db);

  assert.ok(summary, "must return a summary object, not throw");
  assert.equal(summary.totalDonors, 0);
  assert.equal(summary.totalGifts, 0);
  assert.equal(summary.totalAmountCents, 0);
  assert.equal(summary.averageGiftCents, 0);
  assert.equal(summary.largestGiftCents, 0);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Criterion 12: Date fields correctly serialized (timestamptz as ISO, date as plain date string)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("CRITERION 12 — recordGift serializes giftDate (date-only) and createdAt (timestamptz) correctly", async () => {
  const rawRow = {
    id: "gift-raw-001",
    tenant_id: "tenant-1",
    alumni_person_id: "person-1",
    gift_amount_cents: 50000,
    gift_date: new Date("2026-05-15T00:00:00.000Z"), // date column
    gift_type: "one_time",
    fund_designation: "Scholarship",
    acknowledgment_sent_at: new Date("2026-05-20T14:30:00.000Z"), // timestamptz
    notes: "Test gift",
    created_at: new Date("2026-05-15T12:00:00.000Z"), // timestamptz
  };

  const db: AlumniDatabase = {
    query: async (sql: string) => {
      if (sql.toLowerCase().includes("insert into academy_giving_records")) {
        return { rowCount: 1, rows: [rawRow] };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  const result = await recordGift(
    institutionAdmin,
    { alumniPersonId: "person-1", giftAmountCents: 50000, giftDate: "2026-05-15" },
    db
  );

  // giftDate (date-only column) must be serialized as plain date string
  assert.equal(result.giftDate, "2026-05-15", "giftDate must be a plain date string (YYYY-MM-DD)");
  assert.equal(typeof result.giftDate, "string");
  assert.doesNotMatch(
    result.giftDate,
    /T|Z/,
    "giftDate must not contain time or timezone information (not ISO timestamp)"
  );

  // createdAt (timestamptz column) must be serialized as ISO string
  assert.equal(
    result.createdAt,
    "2026-05-15T12:00:00.000Z",
    "createdAt must be an ISO 8601 timestamp string"
  );
  assert.equal(typeof result.createdAt, "string");
  assert.match(result.createdAt, /T.*Z/, "createdAt must be an ISO timestamp with time and timezone");

  // acknowledgmentSentAt (timestamptz, nullable) must be serialized as ISO string or null
  assert.equal(
    result.acknowledgmentSentAt,
    "2026-05-20T14:30:00.000Z",
    "acknowledgmentSentAt must be an ISO 8601 timestamp string when present"
  );
  assert.equal(typeof result.acknowledgmentSentAt, "string");
  assert.match(
    result.acknowledgmentSentAt,
    /T.*Z/,
    "acknowledgmentSentAt must be an ISO timestamp with time and timezone"
  );
});

test("CRITERION 12 — getAlumniRoster serializes lastGiftDate (date-only) correctly", async () => {
  const alumni = [mockAlumni({ id: "a-1", personId: "person-1" })];
  const gifts = [mockGift({ id: "g-1", alumniPersonId: "person-1", giftDate: "2026-06-15" })];
  const db = createMockDb(alumni, gifts);

  const roster = await getAlumniRoster(institutionAdmin, {}, db);

  const entry = roster[0];
  assert.ok(entry);
  assert.equal(typeof entry.lastGiftDate, "string", "lastGiftDate must be a string");
  assert.equal(entry.lastGiftDate, "2026-06-15", "lastGiftDate must be a plain date string (YYYY-MM-DD)");
  assert.doesNotMatch(
    entry.lastGiftDate,
    /T|Z/,
    "lastGiftDate must not contain time or timezone information"
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Additional verification: markGiftAcknowledged correctly sets acknowledgmentSentAt
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("CRITERION 12 — markGiftAcknowledged sets acknowledgmentSentAt as ISO string (timestamptz)", async () => {
  const gift = mockGift({ id: "gift-1", acknowledgmentSentAt: null });
  const db = createMockDb([], [gift]);

  const result = await markGiftAcknowledged(institutionAdmin, "gift-1", db);

  assert.ok(result.acknowledgmentSentAt !== null, "acknowledgmentSentAt must be set");
  assert.equal(typeof result.acknowledgmentSentAt, "string", "must be a string, not a Date object");
  assert.match(
    result.acknowledgmentSentAt,
    /T.*Z/,
    "acknowledgmentSentAt must be an ISO timestamp with time and timezone"
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Verification: Role-specific access (alumni_relations can access roster/history but NOT summary)
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("VERIFICATION — alumni_relations can access getAlumniRoster (read-level access)", async () => {
  const alumni = [mockAlumni()];
  const db = createMockDb(alumni, []);

  const roster = await getAlumniRoster(alumniRelations, {}, db);
  assert.ok(roster);
  assert.equal(roster.length, 1);
});

test("VERIFICATION — alumni_relations CANNOT access getGivingSummary (stricter gate)", async () => {
  const db = createMockDb([], [mockGift()]);

  await assert.rejects(
    () => getGivingSummary(alumniRelations, db),
    { name: "AcademyAuthorizationError" },
    "alumni_relations must be rejected by getGivingSummary"
  );
});

test("VERIFICATION — dean (authorized for student detail page) CANNOT access alumni functions", async () => {
  const db = createMockDb([mockAlumni()], []);

  await assert.rejects(
    () => getAlumniRoster(dean, {}, db),
    { name: "AcademyAuthorizationError" },
    "dean must be rejected by getAlumniRoster"
  );

  await assert.rejects(
    () => getGivingSummary(dean, db),
    { name: "AcademyAuthorizationError" },
    "dean must be rejected by getGivingSummary"
  );
});
