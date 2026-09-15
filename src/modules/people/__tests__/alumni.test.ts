import { test } from "node:test";
import assert from "node:assert/strict";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type {
  AlumniDatabase,
  AlumniRecord,
  GivingRecord,
} from "@/modules/people/alumni";
import {
  createAlumniRecord,
  listAlumni,
  updateAlumniRecord,
  recordGift,
  getAlumniGivingHistory,
  getGivingSummary,
} from "@/modules/people/alumni";

const adminActor: AcademyActor = {
  userId: "person-admin",
  tenantId: "tenant-1",
  roles: ["institution_admin"],
};

const alumniStaffActor: AcademyActor = {
  userId: "person-alumni-staff",
  tenantId: "tenant-1",
  roles: ["alumni_relations"],
};

const studentActor: AcademyActor = {
  userId: "person-student",
  tenantId: "tenant-1",
  roles: ["student"],
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

function alumniToRow(a: AlumniRecord): Record<string, unknown> {
  return {
    id: a.id,
    tenant_id: a.tenantId,
    person_id: a.personId,
    graduation_year: a.graduationYear,
    degree_earned: a.degreeEarned,
    program_id: a.programId,
    employer: a.employer,
    job_title: a.jobTitle,
    location: a.location,
    contact_preferences: JSON.stringify(a.contactPreferences),
    status: a.status,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}

function giftToRow(g: GivingRecord): Record<string, unknown> {
  return {
    id: g.id,
    tenant_id: g.tenantId,
    alumni_person_id: g.alumniPersonId,
    gift_amount_cents: g.giftAmountCents,
    gift_date: g.giftDate,
    gift_type: g.giftType,
    fund_designation: g.fundDesignation,
    acknowledgment_sent_at: g.acknowledgmentSentAt,
    notes: g.notes,
    created_at: g.createdAt,
  };
}

function createMockDb(alumni: AlumniRecord[] = [], gifts: GivingRecord[] = []): AlumniDatabase {
  const storedAlumni = [...alumni];
  const storedGifts = [...gifts];

  return {
    query: async (sql: string, values?: unknown[]) => {
      const sqlLower = sql.toLowerCase();

      if (sqlLower.includes("insert into academy_alumni_records")) {
        const newAlumni = mockAlumni({
          id: `alumni-${storedAlumni.length + 1}`,
          tenantId: String(values?.[0] ?? "tenant-1"),
          personId: String(values?.[1] ?? "person-1"),
          graduationYear: Number(values?.[2] ?? 2023),
          degreeEarned: String(values?.[3] ?? "MDiv"),
          programId: values?.[4] ? String(values[4]) : null,
          employer: values?.[5] ? String(values[5]) : null,
          jobTitle: values?.[6] ? String(values[6]) : null,
          location: values?.[7] ? String(values[7]) : null,
        });
        storedAlumni.push(newAlumni);
        return { rowCount: 1, rows: [alumniToRow(newAlumni)] };
      }

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

      if (sqlLower.includes("select * from academy_alumni_records") && sqlLower.includes("order by")) {
        const tenantId = values?.[0];
        const hasYear = sqlLower.includes("graduation_year = $");
        const hasStatus = sqlLower.includes("status = $");

        let yearFilter: number | undefined;
        let statusFilter: string | undefined;
        if (hasYear && hasStatus) {
          yearFilter = Number(values?.[1]);
          statusFilter = String(values?.[2]);
        } else if (hasYear) {
          yearFilter = Number(values?.[1]);
        } else if (hasStatus) {
          statusFilter = String(values?.[1]);
        }

        let filtered = storedAlumni.filter(a => a.tenantId === tenantId);
        if (yearFilter !== undefined) filtered = filtered.filter(a => a.graduationYear === yearFilter);
        if (statusFilter) filtered = filtered.filter(a => a.status === statusFilter);
        return { rowCount: null, rows: filtered.map(alumniToRow) };
      }

      if (sqlLower.includes("update academy_alumni_records")) {
        const tenantId = values?.[values.length - 2];
        const alumniId = values?.[values.length - 1];
        const idx = storedAlumni.findIndex(a => a.tenantId === tenantId && a.id === alumniId);
        if (idx < 0) return { rowCount: 0, rows: [] };
        const updated = { ...storedAlumni[idx]!, updatedAt: new Date().toISOString() };
        storedAlumni[idx] = updated;
        return { rowCount: 1, rows: [alumniToRow(updated)] };
      }

      if (sqlLower.includes("select * from academy_giving_records")) {
        const tenantId = values?.[0];
        const alumniPersonId = values?.[1];
        return {
          rowCount: null,
          rows: storedGifts
            .filter(g => g.tenantId === tenantId && g.alumniPersonId === alumniPersonId)
            .map(giftToRow),
        };
      }

      if (sqlLower.includes("count(distinct alumni_person_id)")) {
        const tenantId = values?.[0];
        const tenantGifts = storedGifts.filter(g => g.tenantId === tenantId);
        const uniqueDonors = new Set(tenantGifts.map(g => g.alumniPersonId)).size;
        const total = tenantGifts.reduce((sum, g) => sum + g.giftAmountCents, 0);
        const largest = tenantGifts.reduce((max, g) => Math.max(max, g.giftAmountCents), 0);
        return {
          rowCount: 1,
          rows: [{
            total_donors: uniqueDonors,
            total_gifts: tenantGifts.length,
            total_amount_cents: total,
            average_gift_cents: tenantGifts.length > 0 ? total / tenantGifts.length : 0,
            largest_gift_cents: largest,
          }],
        };
      }

      return { rowCount: 0, rows: [] };
    },
  };
}

test("createAlumniRecord — success", async () => {
  const db = createMockDb();

  const alumni = await createAlumniRecord(
    adminActor,
    {
      personId: "person-grad-1",
      graduationYear: 2023,
      degreeEarned: "Master of Divinity",
      employer: "First Baptist Church",
    },
    db,
  );

  assert.equal(alumni.tenantId, "tenant-1");
  assert.equal(alumni.degreeEarned, "Master of Divinity");
  assert.equal(alumni.graduationYear, 2023);
  assert.equal(alumni.status, "active");
});

test("createAlumniRecord — rejects student", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => createAlumniRecord(studentActor, { personId: "p-1", graduationYear: 2023, degreeEarned: "BA" }, db),
    { name: "AcademyAuthorizationError" },
  );
});

test("createAlumniRecord — rejects invalid graduationYear", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => createAlumniRecord(adminActor, { personId: "p-1", graduationYear: 99, degreeEarned: "BA" }, db),
    /graduationYear must be a valid 4-digit year/,
  );
});

test("listAlumni — returns all active alumni for tenant", async () => {
  const db = createMockDb([
    mockAlumni({ id: "a-1", status: "active", graduationYear: 2022 }),
    mockAlumni({ id: "a-2", status: "active", graduationYear: 2023 }),
    mockAlumni({ id: "a-3", status: "lost_contact", graduationYear: 2021 }),
  ]);

  const all = await listAlumni(adminActor, {}, db);
  assert.equal(all.length, 3);
});

test("listAlumni — filters by graduation year", async () => {
  const db = createMockDb([
    mockAlumni({ id: "a-1", graduationYear: 2022 }),
    mockAlumni({ id: "a-2", graduationYear: 2023 }),
  ]);

  const result = await listAlumni(adminActor, { graduationYear: 2022 }, db);
  assert.equal(result.length, 1);
  assert.equal(result[0].graduationYear, 2022);
});

test("listAlumni — cross-tenant sees empty list", async () => {
  const db = createMockDb([mockAlumni()]);
  const result = await listAlumni(crossTenantActor, {}, db);
  assert.equal(result.length, 0);
});

test("listAlumni — rejects student", async () => {
  const db = createMockDb();
  await assert.rejects(() => listAlumni(studentActor, {}, db), { name: "AcademyAuthorizationError" });
});

test("updateAlumniRecord — updates employer and job title", async () => {
  const db = createMockDb([mockAlumni({ id: "alumni-1" })]);

  const updated = await updateAlumniRecord(
    alumniStaffActor,
    "alumni-1",
    { employer: "New Hope Church", jobTitle: "Worship Pastor" },
    db,
  );

  assert.ok(updated);
});

test("updateAlumniRecord — throws for unknown record", async () => {
  const db = createMockDb([]);
  await assert.rejects(
    () => updateAlumniRecord(adminActor, "nonexistent", { employer: "Test" }, db),
    /not found or access denied/,
  );
});

test("recordGift — success", async () => {
  const db = createMockDb([mockAlumni()]);

  const gift = await recordGift(
    adminActor,
    {
      alumniPersonId: "person-graduate-1",
      giftAmountCents: 25000,
      giftDate: "2026-06-01",
      fundDesignation: "Scholarship Fund",
    },
    db,
  );

  assert.equal(gift.giftAmountCents, 25000);
  assert.equal(gift.giftType, "one_time");
  assert.equal(gift.fundDesignation, "Scholarship Fund");
});

test("recordGift — rejects zero amount", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => recordGift(adminActor, { alumniPersonId: "p-1", giftAmountCents: 0, giftDate: "2026-06-01" }, db),
    /must be a positive integer/,
  );
});

test("recordGift — rejects student", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => recordGift(studentActor, { alumniPersonId: "p-1", giftAmountCents: 100, giftDate: "2026-06-01" }, db),
    { name: "AcademyAuthorizationError" },
  );
});

test("getAlumniGivingHistory — returns gifts for alumni", async () => {
  const gifts = [
    mockGift({ id: "g-1", giftAmountCents: 10000 }),
    mockGift({ id: "g-2", giftAmountCents: 5000 }),
  ];
  const db = createMockDb([], gifts);

  const history = await getAlumniGivingHistory(adminActor, "person-graduate-1", db);
  assert.equal(history.length, 2);
});

test("getGivingSummary — aggregates giving data", async () => {
  const gifts = [
    mockGift({ id: "g-1", alumniPersonId: "person-1", giftAmountCents: 10000 }),
    mockGift({ id: "g-2", alumniPersonId: "person-2", giftAmountCents: 5000 }),
    mockGift({ id: "g-3", alumniPersonId: "person-1", giftAmountCents: 15000 }),
  ];
  const db = createMockDb([], gifts);

  const summary = await getGivingSummary(adminActor, db);
  assert.equal(summary.totalDonors, 2);
  assert.equal(summary.totalGifts, 3);
  assert.equal(summary.totalAmountCents, 30000);
  assert.equal(summary.largestGiftCents, 15000);
});

test("getGivingSummary — rejects non-admin", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => getGivingSummary(alumniStaffActor, db),
    { name: "AcademyAuthorizationError" },
  );
});
