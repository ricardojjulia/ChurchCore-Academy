import { test } from "node:test";
import assert from "node:assert/strict";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import type {
  AlumniDatabase,
  AlumniRecord,
  DonorCampaign,
  GivingRecord,
} from "@/modules/people/alumni";
import {
  createDonorCampaign,
  createAlumniRecord,
  listDonorCampaigns,
  listAlumni,
  updateAlumniRecord,
  recordGift,
  getAlumniGivingHistory,
  getGivingSummary,
  markGiftAcknowledged,
  getAlumniRoster,
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
    donorCampaignId: null,
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

function mockCampaign(overrides: Partial<DonorCampaign> = {}): DonorCampaign {
  return {
    id: "campaign-1",
    tenantId: "tenant-1",
    name: "Scholarship Sunday",
    fundDesignation: "Scholarship Fund",
    goalAmountCents: 100000,
    startsOn: "2026-09-01",
    endsOn: "2026-12-31",
    status: "active",
    description: "Scholarship gifts",
    createdByPersonId: "person-admin",
    createdAt: "2026-09-28T09:00:00Z",
    updatedAt: "2026-09-28T09:00:00Z",
    ...overrides,
  };
}

// Mock DB helpers now return real Date objects for date/timestamp columns (as `pg` actually does)
// rather than pre-formatted strings, so the tests actually exercise the date serialization bug fix.
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
    created_at: new Date(a.createdAt),
    updated_at: new Date(a.updatedAt),
  };
}

function giftToRow(g: GivingRecord): Record<string, unknown> {
  return {
    id: g.id,
    tenant_id: g.tenantId,
    alumni_person_id: g.alumniPersonId,
    donor_campaign_id: g.donorCampaignId,
    gift_amount_cents: g.giftAmountCents,
    gift_date: new Date(g.giftDate),
    gift_type: g.giftType,
    fund_designation: g.fundDesignation,
    acknowledgment_sent_at: g.acknowledgmentSentAt ? new Date(g.acknowledgmentSentAt) : null,
    notes: g.notes,
    created_at: new Date(g.createdAt),
  };
}

function campaignToRow(c: DonorCampaign): Record<string, unknown> {
  return {
    id: c.id,
    tenant_id: c.tenantId,
    name: c.name,
    fund_designation: c.fundDesignation,
    goal_amount_cents: c.goalAmountCents,
    starts_on: c.startsOn ? new Date(c.startsOn) : null,
    ends_on: c.endsOn ? new Date(c.endsOn) : null,
    status: c.status,
    description: c.description,
    created_by_person_id: c.createdByPersonId,
    created_at: new Date(c.createdAt),
    updated_at: new Date(c.updatedAt),
  };
}

function createMockDb(
  alumni: AlumniRecord[] = [],
  gifts: GivingRecord[] = [],
  campaigns: DonorCampaign[] = [],
  options: { nonGraduatedPersonIds?: Set<string>; unknownPersonIds?: Set<string> } = {},
): AlumniDatabase {
  const storedAlumni = [...alumni];
  const storedGifts = [...gifts];
  const storedCampaigns = [...campaigns];
  const nonGraduatedPersonIds = options.nonGraduatedPersonIds ?? new Set<string>();
  const unknownPersonIds = options.unknownPersonIds ?? new Set<string>();

  return {
    query: async (sql: string, values?: unknown[]) => {
      const sqlLower = sql.toLowerCase();

      // createAlumniRecord's tenant + graduated-status check — defaults to "found and
      // graduated" for any personId not explicitly configured otherwise, so existing tests
      // that don't care about this check keep passing.
      if (sqlLower.includes("join academy_student_profiles sp") && sqlLower.includes("enrollment_status")) {
        const personId = String(values?.[0]);
        const tenantId = values?.[1];
        if (tenantId !== "tenant-1" || unknownPersonIds.has(personId)) {
          return { rowCount: 0, rows: [] };
        }
        const enrollmentStatus = nonGraduatedPersonIds.has(personId) ? "enrolled" : "graduated";
        return { rowCount: 1, rows: [{ enrollment_status: enrollmentStatus }] };
      }

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
          donorCampaignId: values?.[2] ? String(values[2]) : null,
          giftAmountCents: Number(values?.[3] ?? 0),
          giftDate: String(values?.[4] ?? "2026-01-01"),
          giftType: (values?.[5] as GivingRecord["giftType"]) ?? "one_time",
          fundDesignation: values?.[6] ? String(values[6]) : null,
          notes: values?.[7] ? String(values[7]) : null,
        });
        storedGifts.push(newGift);
        return { rowCount: 1, rows: [giftToRow(newGift)] };
      }

      if (sqlLower.includes("insert into academy_donor_campaigns")) {
        const newCampaign = mockCampaign({
          id: `campaign-${storedCampaigns.length + 1}`,
          tenantId: String(values?.[0] ?? "tenant-1"),
          name: String(values?.[1] ?? "Campaign"),
          fundDesignation: String(values?.[2] ?? "General Fund"),
          goalAmountCents: Number(values?.[3] ?? 100),
          startsOn: values?.[4] ? String(values[4]) : null,
          endsOn: values?.[5] ? String(values[5]) : null,
          status: (values?.[6] as DonorCampaign["status"]) ?? "planned",
          description: values?.[7] ? String(values[7]) : null,
          createdByPersonId: values?.[8] ? String(values[8]) : null,
        });
        storedCampaigns.push(newCampaign);
        return { rowCount: 1, rows: [campaignToRow(newCampaign)] };
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

      if (sqlLower.includes("update academy_giving_records") && sqlLower.includes("acknowledgment_sent_at")) {
        const tenantId = values?.[0];
        const giftId = values?.[1];
        const idx = storedGifts.findIndex(g => g.tenantId === tenantId && g.id === giftId);
        if (idx < 0) return { rowCount: 0, rows: [] };
        const updated = { ...storedGifts[idx]!, acknowledgmentSentAt: new Date().toISOString() };
        storedGifts[idx] = updated;
        return { rowCount: 1, rows: [giftToRow(updated)] };
      }

      if (sqlLower.includes("from academy_alumni_records aa") && sqlLower.includes("join academy_people p")) {
        const tenantId = values?.[0];
        let filtered = storedAlumni.filter(a => a.tenantId === tenantId);

        // Apply graduation year filter if present
        const hasYearFilter = values && values.length > 1 && typeof values[1] === "number";
        if (hasYearFilter) {
          const yearFilter = values[1] as number;
          filtered = filtered.filter(a => a.graduationYear === yearFilter);
        }

        // Apply status filter if present
        const hasStatusFilter = values && values.length > 1 && typeof values[values.length - 1] === "string" &&
          ["active", "lost_contact", "deceased"].includes(values[values.length - 1] as string);
        if (hasStatusFilter) {
          const statusFilter = values[values.length - 1] as string;
          filtered = filtered.filter(a => a.status === statusFilter);
        }

        return {
          rowCount: null,
          rows: filtered.map(a => {
            const personGifts = storedGifts.filter(g => g.alumniPersonId === a.personId);
            const giftCount = personGifts.length;
            const totalGivenCents = personGifts.reduce((sum, g) => sum + g.giftAmountCents, 0);
            const lastGiftDate = personGifts.length > 0
              ? new Date(Math.max(...personGifts.map(g => new Date(g.giftDate).getTime())))
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

      if (sqlLower.includes("from academy_donor_campaigns dc")) {
        const tenantId = values?.[0];
        const statusFilter = values?.[1] ? String(values[1]) : undefined;
        let filtered = storedCampaigns.filter(c => c.tenantId === tenantId);
        if (statusFilter) filtered = filtered.filter(c => c.status === statusFilter);

        return {
          rowCount: null,
          rows: filtered.map(c => {
            const campaignGifts = storedGifts.filter(g =>
              g.tenantId === c.tenantId &&
              (g.donorCampaignId === c.id || (!g.donorCampaignId && g.fundDesignation === c.fundDesignation))
            );
            return {
              ...campaignToRow(c),
              gift_count: campaignGifts.length,
              donor_count: new Set(campaignGifts.map(g => g.alumniPersonId)).size,
              total_given_cents: campaignGifts.reduce((sum, g) => sum + g.giftAmountCents, 0),
              last_gift_date: campaignGifts.length > 0
                ? new Date(Math.max(...campaignGifts.map(g => new Date(g.giftDate).getTime())))
                : null,
            };
          }),
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

// Regression tests for a real bug found via code review: the module had no foreign key and no
// application-level check tying academy_alumni_records.person_id to a real, in-tenant,
// graduated student — createAlumniRecord would silently succeed for a nonexistent person, a
// person in a different tenant, or a current student/staff member. The UI's own 404/graduated
// check on the detail page is not a substitute for this: the module function is the actual
// security and data-integrity boundary, reachable directly via the API.

test("createAlumniRecord — rejects a person who is not a graduated student", async () => {
  const db = createMockDb([], [], [], { nonGraduatedPersonIds: new Set(["person-enrolled-1"]) });
  await assert.rejects(
    () => createAlumniRecord(
      adminActor,
      { personId: "person-enrolled-1", graduationYear: 2026, degreeEarned: "BA" },
      db,
    ),
    /Alumni records can only be created for graduated students/,
  );
});

test("createAlumniRecord — rejects a person not found in the tenant", async () => {
  const db = createMockDb([], [], [], { unknownPersonIds: new Set(["person-ghost"]) });
  await assert.rejects(
    () => createAlumniRecord(
      adminActor,
      { personId: "person-ghost", graduationYear: 2023, degreeEarned: "BA" },
      db,
    ),
    { name: "AcademyAuthorizationError" },
  );
});

test("createAlumniRecord — rejects a person belonging to a different tenant", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => createAlumniRecord(
      crossTenantActor,
      { personId: "person-grad-1", graduationYear: 2023, degreeEarned: "BA" },
      db,
    ),
    { name: "AcademyAuthorizationError" },
  );
});

test("createAlumniRecord — succeeds for a graduated student in the actor's tenant", async () => {
  const db = createMockDb();
  const alumni = await createAlumniRecord(
    adminActor,
    { personId: "person-grad-2", graduationYear: 2024, degreeEarned: "BTh" },
    db,
  );
  assert.equal(alumni.tenantId, "tenant-1");
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

test("recordGift — links gift to donor campaign", async () => {
  const db = createMockDb([mockAlumni()], [], [mockCampaign({ id: "campaign-scholarship" })]);

  const gift = await recordGift(
    adminActor,
    {
      alumniPersonId: "person-graduate-1",
      donorCampaignId: "campaign-scholarship",
      giftAmountCents: 25000,
      giftDate: "2026-06-01",
      fundDesignation: "Scholarship Fund",
    },
    db,
  );

  assert.equal(gift.donorCampaignId, "campaign-scholarship");
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

test("createDonorCampaign — creates a tenant-scoped campaign", async () => {
  const db = createMockDb();

  const campaign = await createDonorCampaign(
    alumniStaffActor,
    {
      name: "Scholarship Sunday",
      fundDesignation: "Scholarship Fund",
      goalAmountCents: 250000,
      startsOn: "2026-09-01",
      endsOn: "2026-12-31",
      status: "active",
    },
    db,
  );

  assert.equal(campaign.tenantId, "tenant-1");
  assert.equal(campaign.name, "Scholarship Sunday");
  assert.equal(campaign.goalAmountCents, 250000);
  assert.equal(campaign.status, "active");
});

test("createDonorCampaign — rejects invalid goal and date order", async () => {
  const db = createMockDb();

  await assert.rejects(
    () => createDonorCampaign(
      adminActor,
      { name: "Bad Goal", fundDesignation: "General", goalAmountCents: 0 },
      db,
    ),
    /goalAmountCents must be a positive integer/,
  );

  await assert.rejects(
    () => createDonorCampaign(
      adminActor,
      {
        name: "Bad Dates",
        fundDesignation: "General",
        goalAmountCents: 1000,
        startsOn: "2026-12-31",
        endsOn: "2026-01-01",
      },
      db,
    ),
    /endsOn must be on or after startsOn/,
  );
});

test("createDonorCampaign — rejects student", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => createDonorCampaign(
      studentActor,
      { name: "Student Campaign", fundDesignation: "General", goalAmountCents: 1000 },
      db,
    ),
    { name: "AcademyAuthorizationError" },
  );
});

test("listDonorCampaigns — includes direct and legacy fund-designation gifts", async () => {
  const campaign = mockCampaign({ id: "campaign-scholarship", fundDesignation: "Scholarship Fund", goalAmountCents: 100000 });
  const gifts = [
    mockGift({ id: "gift-direct", alumniPersonId: "person-1", donorCampaignId: "campaign-scholarship", giftAmountCents: 20000, giftDate: "2026-09-15" }),
    mockGift({ id: "gift-legacy", alumniPersonId: "person-2", donorCampaignId: null, fundDesignation: "Scholarship Fund", giftAmountCents: 30000, giftDate: "2026-09-20" }),
    mockGift({ id: "gift-other", alumniPersonId: "person-3", donorCampaignId: null, fundDesignation: "Building Fund", giftAmountCents: 40000 }),
  ];
  const db = createMockDb([], gifts, [campaign]);

  const campaigns = await listDonorCampaigns(adminActor, {}, db);

  assert.equal(campaigns.length, 1);
  assert.equal(campaigns[0].giftCount, 2);
  assert.equal(campaigns[0].donorCount, 2);
  assert.equal(campaigns[0].totalGivenCents, 50000);
  assert.equal(campaigns[0].progressPercent, 50);
  assert.equal(campaigns[0].lastGiftDate, "2026-09-20");
});

test("listDonorCampaigns — filters by status and tenant", async () => {
  const db = createMockDb([], [], [
    mockCampaign({ id: "campaign-active", status: "active" }),
    mockCampaign({ id: "campaign-planned", status: "planned" }),
    mockCampaign({ id: "campaign-other-tenant", tenantId: "tenant-2", status: "active" }),
  ]);

  const campaigns = await listDonorCampaigns(adminActor, { status: "active" }, db);

  assert.equal(campaigns.length, 1);
  assert.equal(campaigns[0].id, "campaign-active");
});

test("listDonorCampaigns — rejects student", async () => {
  const db = createMockDb([], [], [mockCampaign()]);
  await assert.rejects(
    () => listDonorCampaigns(studentActor, {}, db),
    { name: "AcademyAuthorizationError" },
  );
});

test("markGiftAcknowledged — success", async () => {
  const gift = mockGift({ id: "gift-1", acknowledgmentSentAt: null });
  const db = createMockDb([], [gift]);

  const result = await markGiftAcknowledged(adminActor, "gift-1", db);

  assert.ok(result.acknowledgmentSentAt !== null);
  assert.equal(typeof result.acknowledgmentSentAt, "string");
});

test("markGiftAcknowledged — rejects student", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => markGiftAcknowledged(studentActor, "gift-1", db),
    { name: "AcademyAuthorizationError" },
  );
});

test("markGiftAcknowledged — cross-tenant rejection", async () => {
  const gift = mockGift({ id: "gift-1", tenantId: "tenant-1" });
  const db = createMockDb([], [gift]);

  await assert.rejects(
    () => markGiftAcknowledged(crossTenantActor, "gift-1", db),
    /not found or access denied/,
  );
});

test("getAlumniRoster — returns aggregated gift stats per person", async () => {
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

  const roster = await getAlumniRoster(adminActor, {}, db);

  assert.equal(roster.length, 2);

  const person1Entry = roster.find(r => r.personId === "person-1");
  assert.ok(person1Entry);
  assert.equal(person1Entry.giftCount, 2);
  assert.equal(person1Entry.totalGivenCents, 15000);
  assert.equal(person1Entry.lastGiftDate, "2026-02-01");

  const person2Entry = roster.find(r => r.personId === "person-2");
  assert.ok(person2Entry);
  assert.equal(person2Entry.giftCount, 1);
  assert.equal(person2Entry.totalGivenCents, 20000);
  assert.equal(person2Entry.lastGiftDate, "2026-03-01");
});

test("getAlumniRoster — includes alumni with zero gifts", async () => {
  const alumni = [
    mockAlumni({ id: "a-1", personId: "person-1" }),
    mockAlumni({ id: "a-2", personId: "person-2" }),
  ];
  const gifts = [
    mockGift({ id: "g-1", alumniPersonId: "person-1", giftAmountCents: 10000 }),
  ];
  const db = createMockDb(alumni, gifts);

  const roster = await getAlumniRoster(adminActor, {}, db);

  assert.equal(roster.length, 2);

  const person2Entry = roster.find(r => r.personId === "person-2");
  assert.ok(person2Entry);
  assert.equal(person2Entry.giftCount, 0);
  assert.equal(person2Entry.totalGivenCents, 0);
  assert.equal(person2Entry.lastGiftDate, null);
});

test("getAlumniRoster — filters by graduation year", async () => {
  const alumni = [
    mockAlumni({ id: "a-1", personId: "person-1", graduationYear: 2022 }),
    mockAlumni({ id: "a-2", personId: "person-2", graduationYear: 2023 }),
  ];
  const db = createMockDb(alumni, []);

  const roster = await getAlumniRoster(adminActor, { graduationYear: 2022 }, db);

  assert.equal(roster.length, 1);
  assert.equal(roster[0].graduationYear, 2022);
});

test("getAlumniRoster — filters by status", async () => {
  const alumni = [
    mockAlumni({ id: "a-1", personId: "person-1", status: "active" }),
    mockAlumni({ id: "a-2", personId: "person-2", status: "lost_contact" }),
  ];
  const db = createMockDb(alumni, []);

  const roster = await getAlumniRoster(adminActor, { status: "active" }, db);

  assert.equal(roster.length, 1);
  assert.equal(roster[0].status, "active");
});

test("getAlumniRoster — cross-tenant sees empty roster", async () => {
  const alumni = [mockAlumni()];
  const db = createMockDb(alumni, []);

  const roster = await getAlumniRoster(crossTenantActor, {}, db);

  assert.equal(roster.length, 0);
});

test("getAlumniRoster — rejects student", async () => {
  const db = createMockDb();
  await assert.rejects(
    () => getAlumniRoster(studentActor, {}, db),
    { name: "AcademyAuthorizationError" },
  );
});

test("createAlumniRecord — maps a raw snake_case pg row (with real Date objects) to typed camelCase", async () => {
  const rawRow = {
    id: "alumni-raw-001",
    tenant_id: "tenant-1",
    person_id: "person-raw-1",
    graduation_year: 2021,
    degree_earned: "Master of Theology",
    program_id: null,
    employer: "Test Church",
    job_title: "Pastor",
    location: "Test City",
    contact_preferences: JSON.stringify({}),
    status: "active",
    created_at: new Date("2026-06-24T10:00:00.000Z"),
    updated_at: new Date("2026-06-24T10:00:00.000Z"),
  };

  const db: AlumniDatabase = {
    query: async (sql: string) => {
      const sqlLower = sql.toLowerCase();
      if (sqlLower.includes("join academy_student_profiles sp") && sqlLower.includes("enrollment_status")) {
        return { rowCount: 1, rows: [{ enrollment_status: "graduated" }] };
      }
      if (sqlLower.includes("insert into academy_alumni_records")) {
        return { rowCount: 1, rows: [rawRow] };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  const result = await createAlumniRecord(
    adminActor,
    { personId: "person-raw-1", graduationYear: 2021, degreeEarned: "Master of Theology" },
    db,
  );

  assert.equal(result.degreeEarned, "Master of Theology", "degreeEarned must not be undefined");
  assert.equal(result.employer, "Test Church");
  assert.equal(result.graduationYear, 2021);
  assert.equal(result.createdAt, "2026-06-24T10:00:00.000Z", "real Date object must normalize to ISO string");
  assert.equal(result.updatedAt, "2026-06-24T10:00:00.000Z", "real Date object must normalize to ISO string");
  assert.equal(typeof result.createdAt, "string");
  assert.equal(typeof result.updatedAt, "string");
});

test("recordGift — maps a raw snake_case pg row (with real Date objects) to typed camelCase", async () => {
  const rawRow = {
    id: "gift-raw-001",
    tenant_id: "tenant-1",
    alumni_person_id: "person-1",
    gift_amount_cents: 50000,
    gift_date: new Date("2026-05-15T00:00:00.000Z"),
    gift_type: "one_time",
    fund_designation: "Scholarship",
    acknowledgment_sent_at: new Date("2026-05-20T14:30:00.000Z"),
    notes: "Test gift",
    created_at: new Date("2026-05-15T12:00:00.000Z"),
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
    adminActor,
    { alumniPersonId: "person-1", giftAmountCents: 50000, giftDate: "2026-05-15" },
    db,
  );

  assert.equal(result.giftAmountCents, 50000);
  assert.equal(result.giftDate, "2026-05-15", "real Date object for date column must normalize to plain date string");
  assert.equal(result.acknowledgmentSentAt, "2026-05-20T14:30:00.000Z", "real Date object for timestamptz must normalize to ISO string");
  assert.equal(result.createdAt, "2026-05-15T12:00:00.000Z", "real Date object for timestamptz must normalize to ISO string");
  assert.equal(typeof result.giftDate, "string");
  assert.equal(typeof result.createdAt, "string");
});
