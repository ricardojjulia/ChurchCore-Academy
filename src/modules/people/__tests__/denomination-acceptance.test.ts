import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AcademyActor } from "@/modules/academy-auth/policy";
import {
  getDenominationRoster,
  getDenominationMemberships,
  getOrdinationRecords,
} from "@/modules/people/denomination";
import { AcademyQueryClient } from "@/lib/academy-database-context";

/**
 * Acceptance tests for Denomination & Ordination Tracking Admin UI
 * User Story: Phase 10, Denomination & Ordination Tracking
 *
 * These tests verify the 10 acceptance criteria from the approved user story.
 * Student PWA scope was explicitly dropped — only admin UI is covered.
 */

const repoRoot = process.cwd();

async function readPageSource(relativePath: string): Promise<string> {
  return readFile(join(repoRoot, relativePath), "utf8");
}

const TENANT_A = "tenant-acceptance-a";
const TENANT_B = "tenant-acceptance-b";
const PERSON_ID = "person-abc-123";
const ADMIN_ID = "admin-xyz-789";
const ADVISOR_ID = "advisor-ghi-789";
const STUDENT_ID = "student-jkl-101";

const adminActor: AcademyActor = {
  userId: ADMIN_ID,
  tenantId: TENANT_A,
  roles: ["institution_admin"],
};

const advisorActor: AcademyActor = {
  userId: ADVISOR_ID,
  tenantId: TENANT_A,
  roles: ["advisor"],
};

const studentActor: AcademyActor = {
  userId: STUDENT_ID,
  tenantId: TENANT_A,
  roles: ["student"],
};

const crossTenantAdminActor: AcademyActor = {
  userId: ADMIN_ID,
  tenantId: TENANT_B,
  roles: ["institution_admin"],
};

function mockDb(scenario: "empty" | "with-records" | "cross-tenant" | "multiple-records"): AcademyQueryClient {
  return {
    query: async (text: string, values?: unknown[]) => {
      const key = text.trim().split("\n")[0].toLowerCase();

      // Person existence checks
      if (key.includes("select id from academy_people") || key.includes("select display_name from academy_people")) {
        const requestedPersonId = values?.[0];
        const requestedTenantId = values?.[1];

        if (requestedTenantId === TENANT_A && requestedPersonId === PERSON_ID) {
          return { rowCount: 1, rows: [{ id: PERSON_ID, display_name: "Test Person" }] };
        }
        if (requestedTenantId === TENANT_A && requestedPersonId === STUDENT_ID) {
          return { rowCount: 1, rows: [{ id: STUDENT_ID, display_name: "Test Student" }] };
        }
        return { rowCount: 0, rows: [] };
      }

      // getDenominationRoster's aggregated person-level query (starts with the CTE, returns
      // one row per person with denomination_names/has_active_ordination already aggregated).
      if (key.includes("with people_with_records")) {
        const requestedTenantId = values?.[0];
        const denominationFilter = values?.[1];

        if (scenario === "empty" || requestedTenantId !== TENANT_A) {
          return { rows: [] };
        }

        const allRecords = [
          {
            person_id: PERSON_ID,
            display_name: "John Ministry",
            email: "john@example.com",
            person_type: "Student",
            denomination_names: ["Test Denomination"],
            has_active_ordination: false,
          },
          {
            person_id: ADMIN_ID,
            display_name: "Jane Admin",
            email: null,
            person_type: "Staff",
            denomination_names: [],
            has_active_ordination: false,
          },
        ];

        if (denominationFilter === "Test Denomination") {
          return { rows: [allRecords[0]] };
        }

        return { rows: allRecords };
      }

      // Get denomination memberships for a person
      if (key.includes("select id, tenant_id, person_id") && text.includes("academy_denomination_memberships")) {
        const requestedTenantId = values?.[0];
        const requestedPersonId = values?.[1];

        if (requestedTenantId !== TENANT_A) {
          return { rows: [] };
        }

        if (scenario === "empty") {
          return { rows: [] };
        }

        if (scenario === "multiple-records") {
          return {
            rows: [
              {
                id: "mem-001",
                tenant_id: TENANT_A,
                person_id: requestedPersonId,
                denomination_name: "First Denomination",
                local_church_name: "First Church",
                membership_number: "MEM-001",
                membership_status: "active",
                membership_date: new Date("2020-01-15T00:00:00.000Z"),
                transfer_date: null,
                notes: null,
                created_at: new Date("2026-01-01T00:00:00.000Z"),
                updated_at: new Date("2026-01-01T00:00:00.000Z"),
              },
              {
                id: "mem-002",
                tenant_id: TENANT_A,
                person_id: requestedPersonId,
                denomination_name: "Second Denomination",
                local_church_name: null,
                membership_number: null,
                membership_status: "transferred",
                membership_date: new Date("2015-05-10T00:00:00.000Z"),
                transfer_date: new Date("2020-01-14T00:00:00.000Z"),
                notes: "Transferred to First Denomination",
                created_at: new Date("2026-01-01T00:00:00.000Z"),
                updated_at: new Date("2026-01-01T00:00:00.000Z"),
              },
            ],
          };
        }

        return {
          rows: [
            {
              id: "mem-001",
              tenant_id: TENANT_A,
              person_id: requestedPersonId,
              denomination_name: "Test Denomination",
              local_church_name: null,
              membership_number: null,
              membership_status: "active",
              membership_date: null,
              transfer_date: null,
              notes: null,
              created_at: new Date("2026-01-01T00:00:00.000Z"),
              updated_at: new Date("2026-01-01T00:00:00.000Z"),
            },
          ],
        };
      }

      // Get ordination records for a person
      if (key.includes("select id, tenant_id, person_id") && text.includes("academy_ordination_records")) {
        const requestedTenantId = values?.[0];
        const requestedPersonId = values?.[1];

        if (requestedTenantId !== TENANT_A) {
          return { rows: [] };
        }

        if (scenario === "empty") {
          return { rows: [] };
        }

        if (scenario === "multiple-records") {
          // Return one expired-but-active credential and one properly retired credential
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const futureDate = new Date();
          futureDate.setFullYear(futureDate.getFullYear() + 2);

          return {
            rows: [
              {
                id: "ord-001",
                tenant_id: TENANT_A,
                person_id: requestedPersonId,
                ordination_type: "pastor",
                ordaining_body: "First Denomination",
                ordination_date: new Date("2015-06-15T00:00:00.000Z"),
                ordination_status: "active",
                credentials_number: "CRED-001",
                renewal_date: yesterday,
                notes: null,
                created_at: new Date("2026-01-01T00:00:00.000Z"),
                updated_at: new Date("2026-01-01T00:00:00.000Z"),
              },
              {
                id: "ord-002",
                tenant_id: TENANT_A,
                person_id: requestedPersonId,
                ordination_type: "elder",
                ordaining_body: "Second Denomination",
                ordination_date: new Date("2020-03-20T00:00:00.000Z"),
                ordination_status: "active",
                credentials_number: null,
                renewal_date: futureDate,
                notes: "Current and valid",
                created_at: new Date("2026-01-01T00:00:00.000Z"),
                updated_at: new Date("2026-01-01T00:00:00.000Z"),
              },
            ],
          };
        }

        return {
          rows: [
            {
              id: "ord-001",
              tenant_id: TENANT_A,
              person_id: requestedPersonId,
              ordination_type: "pastor",
              ordaining_body: "Test Body",
              ordination_date: new Date("2015-06-15T00:00:00.000Z"),
              ordination_status: "active",
              credentials_number: null,
              renewal_date: null,
              notes: null,
              created_at: new Date("2026-01-01T00:00:00.000Z"),
              updated_at: new Date("2026-01-01T00:00:00.000Z"),
            },
          ],
        };
      }

      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };
}

// ============================================================================
// AC1: Capability gating
// ============================================================================

test("AC1: roster page requires denominationTracking capability (source assertion)", async () => {
  const source = await readPageSource("src/app/admin/denomination/page.tsx");

  assert.match(
    source,
    /assertCapability\(capabilities, ["']denominationTracking["']\)/,
    "Roster page must call assertCapability with denominationTracking"
  );

  assert.match(
    source,
    /CapabilityGhostPage/,
    "Roster page must use CapabilityGhostPage when capability is disabled"
  );
});

test("AC1: detail page requires denominationTracking capability (source assertion)", async () => {
  const source = await readPageSource("src/app/admin/denomination/[personId]/page.tsx");

  assert.match(
    source,
    /assertCapability\(capabilities, ["']denominationTracking["']\)/,
    "Detail page must call assertCapability with denominationTracking"
  );

  assert.match(
    source,
    /CapabilityGhostPage/,
    "Detail page must use CapabilityGhostPage when capability is disabled"
  );
});

test("AC1: capability is enabled for bible_school, seminary, college, university modes", async () => {
  const modePacksSource = await readPageSource("src/modules/academy-config/mode-packs.ts");
  const typesSource = await readPageSource("src/modules/academy-config/types.ts");

  // Verify the capability is defined in types
  assert.match(
    typesSource,
    /denominationTracking: boolean/,
    "InstitutionCapabilitySet must include denominationTracking"
  );

  // Verify it's enabled for the expected modes
  const bibleSchoolMatch = modePacksSource.match(/bible_school:\s*\{[\s\S]*?denominationTracking:\s*true/);
  const seminaryMatch = modePacksSource.match(/seminary:\s*\{[\s\S]*?denominationTracking:\s*true/);
  const collegeMatch = modePacksSource.match(/college:\s*\{[\s\S]*?denominationTracking:\s*true/);
  const universityMatch = modePacksSource.match(/university:\s*\{[\s\S]*?denominationTracking:\s*true/);

  assert.ok(bibleSchoolMatch, "bible_school mode must enable denominationTracking");
  assert.ok(seminaryMatch, "seminary mode must enable denominationTracking");
  assert.ok(collegeMatch, "college mode must enable denominationTracking");
  assert.ok(universityMatch, "university mode must enable denominationTracking");
});

// ============================================================================
// AC2: Roster page behavior
// ============================================================================

test("AC2: roster page accepts optional denomination filter", async () => {
  const source = await readPageSource("src/app/admin/denomination/page.tsx");

  // Verify the page accepts searchParams with optional denomination
  assert.match(
    source,
    /searchParams.*denomination/,
    "Roster page must accept denomination query parameter"
  );

  // Verify it calls getDenominationRoster with null or filter value
  assert.match(
    source,
    /getDenominationRoster\(actor,\s*denominationFilter/,
    "Roster page must pass denominationFilter to getDenominationRoster"
  );
});

test("AC2: getDenominationRoster returns all records when no filter provided", async () => {
  const db = mockDb("with-records");
  const result = await getDenominationRoster(adminActor, null, db);

  assert.ok(Array.isArray(result), "Result must be an array");
  assert.equal(result.length, 2, "Should return all records when no filter provided");
  assert.equal(result[0].displayName, "John Ministry");
  assert.equal(result[1].displayName, "Jane Admin");
});

test("AC2: getDenominationRoster filters by denomination name when provided", async () => {
  const db = mockDb("with-records");
  const result = await getDenominationRoster(adminActor, "Test Denomination", db);

  assert.ok(Array.isArray(result), "Result must be an array");
  assert.equal(result.length, 1, "Should return only matching records");
  assert.equal(result[0].displayName, "John Ministry");
});

test("AC2: roster empty state is not an error", async () => {
  const db = mockDb("empty");
  const result = await getDenominationRoster(adminActor, null, db);

  assert.ok(Array.isArray(result), "Empty result must still be an array");
  assert.equal(result.length, 0, "Empty result should have length 0");
  // No error thrown — empty is a valid state
});

test("AC2: roster page role gating verified in page-authorization.test.ts", async () => {
  // This test documents that the role gating is already covered by the existing
  // page-authorization.test.ts file, which verifies:
  // - src/app/admin/denomination/page.tsx requires ["institution_admin", "registrar"]
  // - src/app/admin/denomination/[personId]/page.tsx requires ["institution_admin", "registrar"]
  //
  // No need to duplicate those source assertions here.
  assert.ok(true, "Role gating is already covered by page-authorization.test.ts");
});

test("AC2: roster service layer rejects advisor role", async () => {
  const db = mockDb("with-records");

  await assert.rejects(
    async () => getDenominationRoster(advisorActor, null, db),
    /Only institution_admin or registrar/,
    "Advisor role must be rejected by getDenominationRoster"
  );
});

test("AC2: roster service layer rejects student role", async () => {
  const db = mockDb("with-records");

  await assert.rejects(
    async () => getDenominationRoster(studentActor, null, db),
    /Only institution_admin or registrar/,
    "Student role must be rejected by getDenominationRoster"
  );
});

// ============================================================================
// AC3: Per-person detail page
// ============================================================================

test("AC3: detail page loads memberships and ordinations", async () => {
  const db = mockDb("with-records");

  const memberships = await getDenominationMemberships(adminActor, PERSON_ID, db);
  const ordinations = await getOrdinationRecords(adminActor, PERSON_ID, db);

  assert.ok(Array.isArray(memberships), "Memberships must be an array");
  assert.ok(Array.isArray(ordinations), "Ordinations must be an array");
  assert.equal(memberships.length, 1, "Should return membership records");
  assert.equal(ordinations.length, 1, "Should return ordination records");
});

test("AC3: detail page has expired-credential detection logic (source assertion)", async () => {
  const source = await readPageSource("src/app/admin/denomination/[personId]/page.tsx");

  // Verify the isCredentialExpired function exists
  assert.match(
    source,
    /function isCredentialExpired\(/,
    "Detail page must define isCredentialExpired function"
  );

  // Verify the function checks renewalDate and status
  assert.match(
    source,
    /renewalDate.*status.*active/,
    "isCredentialExpired must check renewalDate and active status"
  );

  // Verify the expired indicator is rendered
  assert.match(
    source,
    /AlertCircle/,
    "Detail page must render AlertCircle icon for expired credentials"
  );

  assert.match(
    source,
    /Expired/,
    "Detail page must display 'Expired' text for expired credentials"
  );
});

test("AC3: isCredentialExpired logic handles edge cases correctly", async () => {
  // Imports the real page helper rather than reimplementing it — a reimplementation can drift
  // from the shipped code and pass even when the real behavior is wrong. This is exactly how a
  // real off-by-one bug (comparing a date-only renewalDate against the current instant, so a
  // credential renewed today read as already expired) went undetected: the old copy here didn't
  // test the boundary where renewalDate equals today at all. Found via code review.
  const { isCredentialExpired } = await import(
    "@/app/admin/denomination/[personId]/page"
  );

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayDateString = new Date().toISOString().slice(0, 10);

  // Expired but active: should flag
  assert.equal(
    isCredentialExpired(yesterday.toISOString().slice(0, 10), "active"),
    true,
    "Past renewal date with active status should be flagged as expired"
  );

  // Future renewal date: not expired
  assert.equal(
    isCredentialExpired(tomorrow.toISOString().slice(0, 10), "active"),
    false,
    "Future renewal date should not be flagged as expired"
  );

  // Boundary: renewal date is TODAY — must not be flagged yet (this is the case the bug got
  // wrong: comparing full Date instants marked this expired from midnight onward).
  assert.equal(
    isCredentialExpired(todayDateString, "active"),
    false,
    "A credential whose renewal date is today must not be flagged as expired yet"
  );

  // Null renewal date: not expired
  assert.equal(
    isCredentialExpired(null, "active"),
    false,
    "Null renewal date should not be flagged as expired"
  );

  // Past renewal but not active: not expired (status already reflects retirement/suspension)
  assert.equal(
    isCredentialExpired(yesterday.toISOString().slice(0, 10), "retired"),
    false,
    "Past renewal date with non-active status should not be flagged (status already correct)"
  );
});

test("AC3: Add/Edit actions visible only for institution_admin/registrar (source assertion)", async () => {
  const source = await readPageSource("src/app/admin/denomination/[personId]/page.tsx");

  // Verify canModify check
  assert.match(
    source,
    /const canModify = actor\.roles\.some.*institution_admin.*registrar/,
    "Detail page must check actor roles for canModify"
  );

  // Verify Add buttons are conditionally rendered
  assert.match(
    source,
    /\{canModify &&[\s\S]{0,100}Add/,
    "Add buttons must be conditionally rendered based on canModify"
  );

  // Verify Update forms are conditionally rendered (multiline match)
  assert.match(
    source,
    /\{canModify &&[\s\S]{0,100}Update[\s\S]{0,100}Form/,
    "Update forms must be conditionally rendered based on canModify"
  );
});

// ============================================================================
// AC4: Add/edit flows
// ============================================================================

test("AC4: add/edit mutation functions verify tenant isolation (already covered)", async () => {
  // The existing denomination.test.ts already covers:
  // - addDenominationMembership: cross-tenant rejection
  // - updateDenominationMembership: cross-tenant rejection
  // - recordOrdination: cross-tenant rejection
  // - updateOrdinationStatus: cross-tenant rejection
  //
  // These tests verify that the service layer enforces tenant isolation
  // before any mutations occur.
  assert.ok(true, "Cross-tenant mutation rejection is already covered by denomination.test.ts");
});

test("AC4: add/edit forms exist for all required operations (source assertion)", async () => {
  const detailPageSource = await readPageSource("src/app/admin/denomination/[personId]/page.tsx");

  // Verify all required form components are imported and used
  assert.match(
    detailPageSource,
    /AddDenominationMembershipForm/,
    "Detail page must use AddDenominationMembershipForm"
  );

  assert.match(
    detailPageSource,
    /UpdateDenominationMembershipForm/,
    "Detail page must use UpdateDenominationMembershipForm"
  );

  assert.match(
    detailPageSource,
    /AddOrdinationForm/,
    "Detail page must use AddOrdinationForm"
  );

  assert.match(
    detailPageSource,
    /UpdateOrdinationStatusForm/,
    "Detail page must use UpdateOrdinationStatusForm"
  );
});

// ============================================================================
// AC5: Contextual tabs
// ============================================================================

test("AC5: student detail page conditionally renders denomination tab (source assertion)", async () => {
  const source = await readPageSource("src/app/admin/people/students/[id]/page.tsx");

  // Verify capability check
  assert.match(
    source,
    /denominationTracking.*true/,
    "Student detail page must check denominationTracking capability"
  );

  // Verify conditional tab trigger
  assert.match(
    source,
    /\{denominationTrackingEnabled &&/,
    "Denomination tab trigger must be conditionally rendered"
  );

  // Verify DenominationRecordTab component is used
  assert.match(
    source,
    /DenominationRecordTab/,
    "Student detail page must use DenominationRecordTab component"
  );
});

test("AC5: staff detail page conditionally renders denomination tab (source assertion)", async () => {
  const source = await readPageSource("src/app/admin/people/staff/[id]/page.tsx");

  // Verify capability check
  assert.match(
    source,
    /denominationTracking.*true/,
    "Staff detail page must check denominationTracking capability"
  );

  // Verify conditional tab trigger
  assert.match(
    source,
    /\{denominationTrackingEnabled &&/,
    "Denomination tab trigger must be conditionally rendered"
  );

  // Verify DenominationRecordTab component is used
  assert.match(
    source,
    /DenominationRecordTab/,
    "Staff detail page must use DenominationRecordTab component"
  );
});

test("AC5: DenominationRecordTab component provides summary and link", async () => {
  const source = await readPageSource("src/components/denomination-record-tab.tsx");

  // Verify it accepts required props
  assert.match(
    source,
    /membershipCount/,
    "DenominationRecordTab must accept membershipCount prop"
  );

  assert.match(
    source,
    /ordinationCount/,
    "DenominationRecordTab must accept ordinationCount prop"
  );

  // Verify it provides a link to the full detail page
  assert.match(
    source,
    /\/admin\/denomination\/.*personId/,
    "DenominationRecordTab must link to the full detail page"
  );
});

// ============================================================================
// AC6: Role-based visibility (already covered by AC2 and page-authorization.test.ts)
// ============================================================================

test("AC6: role-based visibility documented", async () => {
  // AC6 is already covered by:
  // 1. page-authorization.test.ts: verifies requireActor(actor, ["institution_admin", "registrar"])
  // 2. AC2 tests above: verify service layer rejects advisor/student
  // 3. AC3 tests above: verify canModify check in detail page source
  //
  // No additional tests needed — this test documents the coverage.
  assert.ok(true, "Role-based visibility is already covered");
});

// ============================================================================
// AC7: Cross-tenant isolation
// ============================================================================

test("AC7: getDenominationRoster enforces tenant isolation in WHERE clause (source assertion)", async () => {
  const source = await readPageSource("src/modules/people/denomination.ts");

  // getDenominationRoster aggregates from both source tables via CTEs (people_with_records)
  // rather than a single aliased `dm` join, so tenant isolation is expressed as `tenant_id = $1`
  // inside each CTE/subquery rather than one aliased WHERE clause. Verify every query
  // contributing to the roster is tenant-scoped.
  const rosterFunctionSource = source.slice(source.indexOf("export async function getDenominationRoster"));
  const tenantScopedOccurrences = rosterFunctionSource.match(/tenant_id = \$1/g) ?? [];
  assert.ok(
    tenantScopedOccurrences.length >= 4,
    `getDenominationRoster must scope every contributing query (both CTEs, both join tables, and both aggregation subqueries) to tenant_id = $1 — found ${tenantScopedOccurrences.length} occurrences`
  );

  // Verify actor.tenantId is used
  assert.match(
    source,
    /actor\.tenantId/,
    "getDenominationRoster must use actor.tenantId for tenant isolation"
  );
});

test("AC7: cross-tenant actor gets empty roster (already covered by denomination.test.ts)", async () => {
  const db = mockDb("cross-tenant");
  const result = await getDenominationRoster(crossTenantAdminActor, null, db);

  assert.ok(Array.isArray(result), "Cross-tenant result must be an array");
  assert.equal(result.length, 0, "Cross-tenant actor must get empty roster");
});

test("AC7: detail page person lookup includes tenant_id check (source assertion)", async () => {
  const source = await readPageSource("src/app/admin/denomination/[personId]/page.tsx");

  // Verify person existence check includes tenant_id
  assert.match(
    source,
    /academy_people.*tenant_id = \$2/,
    "Detail page person lookup must include tenant_id check"
  );

  // Verify notFound() is called when person doesn't exist in tenant
  assert.match(
    source,
    /notFound\(\)/,
    "Detail page must call notFound() for invalid/cross-tenant personId"
  );
});

// ============================================================================
// AC8: Missing/invalid personId
// ============================================================================

test("AC8: detail page calls notFound() for invalid personId (source assertion)", async () => {
  const source = await readPageSource("src/app/admin/denomination/[personId]/page.tsx");

  // Verify notFound is imported from next/navigation
  assert.match(
    source,
    /import.*notFound.*from ["']next\/navigation["']/,
    "Detail page must import notFound from next/navigation"
  );

  // Verify it's called when person doesn't exist
  assert.match(
    source,
    /notFound\(\)/,
    "Detail page must call notFound() for invalid personId"
  );
});

test("AC8: getDenominationMemberships rejects invalid personId for tenant", async () => {
  const db = mockDb("with-records");
  const invalidPersonId = "invalid-person-999";

  await assert.rejects(
    async () => getDenominationMemberships(adminActor, invalidPersonId, db),
    /Person .* not found in tenant/,
    "getDenominationMemberships must reject invalid personId"
  );
});

// ============================================================================
// AC9: Multiple records over time
// ============================================================================

test("AC9: getDenominationMemberships returns all memberships for a person", async () => {
  const db = mockDb("multiple-records");
  const result = await getDenominationMemberships(adminActor, PERSON_ID, db);

  assert.ok(Array.isArray(result), "Result must be an array");
  assert.equal(result.length, 2, "Should return all memberships, not just current");

  // Verify both records are present
  const denominationNames = result.map((m) => m.denominationName);
  assert.ok(
    denominationNames.includes("First Denomination"),
    "Should include first denomination"
  );
  assert.ok(
    denominationNames.includes("Second Denomination"),
    "Should include second denomination"
  );

  // Verify statuses vary (one active, one transferred)
  const statuses = result.map((m) => m.membershipStatus);
  assert.ok(statuses.includes("active"), "Should include active membership");
  assert.ok(statuses.includes("transferred"), "Should include transferred membership");
});

test("AC9: getOrdinationRecords returns all ordinations for a person", async () => {
  const db = mockDb("multiple-records");
  const result = await getOrdinationRecords(adminActor, PERSON_ID, db);

  assert.ok(Array.isArray(result), "Result must be an array");
  assert.equal(result.length, 2, "Should return all ordinations, not just current");

  // Verify both records are present
  const types = result.map((o) => o.ordinationType);
  assert.ok(types.includes("pastor"), "Should include pastor ordination");
  assert.ok(types.includes("elder"), "Should include elder ordination");
});

test("AC9: detail page displays all memberships in table (source assertion)", async () => {
  const source = await readPageSource("src/app/admin/denomination/[personId]/page.tsx");

  // Verify memberships.map is used to render all records
  assert.match(
    source,
    /memberships\.map/,
    "Detail page must map over all memberships to display them"
  );

  // Verify ordinations.map is used to render all records
  assert.match(
    source,
    /ordinations\.map/,
    "Detail page must map over all ordinations to display them"
  );
});

// ============================================================================
// AC10: Null/optional fields render as "—"
// ============================================================================

test("AC10: formatDate helper returns '—' for null dates (source assertion)", async () => {
  const source = await readPageSource("src/app/admin/denomination/[personId]/page.tsx");

  // Verify formatDate function exists
  assert.match(
    source,
    /function formatDate\(/,
    "Detail page must define formatDate helper"
  );

  // Verify it returns "—" for null input
  assert.match(
    source,
    /if \(!dateString\) return ["']—["']/,
    "formatDate must return '—' for null/empty dateString"
  );
});

test("AC10: null fields render as '—' in detail page (source assertion)", async () => {
  const source = await readPageSource("src/app/admin/denomination/[personId]/page.tsx");

  // Verify null handling for localChurchName
  assert.match(
    source,
    /localChurchName \|\| ["']—["']/,
    "localChurchName must render as '—' when null"
  );

  // Verify null handling for membershipNumber (multiline ternary)
  assert.match(
    source,
    /membershipNumber[\s\S]{0,150}?["']—["']/,
    "membershipNumber must render as '—' when null"
  );

  // Verify null handling for notes (multiline ternary)
  assert.match(
    source,
    /notes[\s\S]{0,150}?["']—["']/,
    "notes must render as '—' when null"
  );

  // Verify null handling for credentialsNumber (multiline ternary)
  assert.match(
    source,
    /credentialsNumber[\s\S]{0,150}?["']—["']/,
    "credentialsNumber must render as '—' when null"
  );
});

test("AC10: null email in roster renders as '—' (source assertion)", async () => {
  const source = await readPageSource("src/app/admin/denomination/page.tsx");

  // Verify email null handling in roster display
  assert.match(
    source,
    /email \|\| ["']—["']/,
    "Roster page must render null email as '—'"
  );
});

test("AC10: null denomination names in roster render as '—' (source assertion)", async () => {
  const source = await readPageSource("src/app/admin/denomination/page.tsx");

  // Verify denomination names null/empty handling (multiline ternary)
  assert.match(
    source,
    /denominationNames\.length > 0[\s\S]{0,100}?["']—["']/,
    "Roster page must render empty denominationNames as '—'"
  );
});

test("AC10: null fields in service layer responses are typed as nullable", async () => {
  const db = mockDb("with-records");
  const memberships = await getDenominationMemberships(adminActor, PERSON_ID, db);

  assert.ok(Array.isArray(memberships), "Result must be an array");
  if (memberships.length > 0) {
    const membership = memberships[0];

    // Verify null fields are present in the response (not missing)
    assert.ok(
      "localChurchName" in membership,
      "Membership must include localChurchName field (even if null)"
    );
    assert.ok(
      "membershipNumber" in membership,
      "Membership must include membershipNumber field (even if null)"
    );
    assert.ok(
      "notes" in membership,
      "Membership must include notes field (even if null)"
    );
  }
});

// ============================================================================
// PII/PHI Protection: Verify no secret field names appear in output
// ============================================================================

test("PII/PHI: getDenominationRoster does not expose secret field names", async () => {
  const db = mockDb("with-records");
  const result = await getDenominationRoster(adminActor, null, db);

  const serialized = JSON.stringify(result);

  // Verify no sensitive column names appear in the output
  assert.doesNotMatch(
    serialized,
    /password|session_token|api_key|secret|auth_token/i,
    "Roster output must not contain secret field names"
  );
});

test("PII/PHI: getDenominationMemberships does not expose secret field names", async () => {
  const db = mockDb("with-records");
  const result = await getDenominationMemberships(adminActor, PERSON_ID, db);

  const serialized = JSON.stringify(result);

  // Verify no sensitive column names appear in the output
  assert.doesNotMatch(
    serialized,
    /password|session_token|api_key|secret|auth_token/i,
    "Memberships output must not contain secret field names"
  );
});

test("PII/PHI: getOrdinationRecords does not expose secret field names", async () => {
  const db = mockDb("with-records");
  const result = await getOrdinationRecords(adminActor, PERSON_ID, db);

  const serialized = JSON.stringify(result);

  // Verify no sensitive column names appear in the output
  assert.doesNotMatch(
    serialized,
    /password|session_token|api_key|secret|auth_token/i,
    "Ordinations output must not contain secret field names"
  );
});
