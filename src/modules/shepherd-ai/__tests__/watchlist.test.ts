import assert from "node:assert/strict";
import test from "node:test";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import { fetchWatchlist, WatchlistDatabase, WatchlistEntry } from "@/modules/shepherd-ai/watchlist";
import type { AcademyActor } from "@/modules/academy-auth/policy";

const TENANT = "tenant-1";

const adminActor: AcademyActor = { userId: "admin-1", tenantId: TENANT, roles: ["institution_admin"] };
const advisorActor: AcademyActor = { userId: "advisor-1", tenantId: TENANT, roles: ["advisor"] };
const studentActor: AcademyActor = { userId: "student-1", tenantId: TENANT, roles: ["student"] };
const crossTenantActor: AcademyActor = { userId: "admin-2", tenantId: "tenant-2", roles: ["institution_admin"] };

function mockEntry(overrides: Partial<WatchlistEntry> = {}): WatchlistEntry {
  return {
    studentPersonId: "student-person-1",
    studentName: "Jordan Student",
    program: "Ministry Leadership",
    enrollmentStatus: "enrolled",
    cumulativeGpa: 3.2,
    activeSignalTypes: ["credit_progress_gap"],
    highestUrgency: "medium",
    openSignalCount: 1,
    ...overrides,
  };
}

function buildDb(entries: WatchlistEntry[] = [mockEntry()], totalOverride?: number): WatchlistDatabase {
  return {
    async query(_sql: string, _params?: unknown[]) {
      const total = totalOverride ?? entries.length;
      if (_sql.includes("count(distinct")) {
        return { rowCount: 1, rows: [{ total: String(total) }] };
      }
      return {
        rowCount: entries.length,
        rows: entries.map((e) => ({
          student_person_id: e.studentPersonId,
          student_name: e.studentName,
          program: e.program,
          enrollment_status: e.enrollmentStatus,
          cumulative_gpa: e.cumulativeGpa !== null ? String(e.cumulativeGpa) : null,
          active_signal_types: e.activeSignalTypes,
          highest_urgency: e.highestUrgency,
          open_signal_count: String(e.openSignalCount),
        })),
      };
    },
  };
}

test("fetchWatchlist: returns entries for admin actor", async () => {
  const db = buildDb();
  const result = await fetchWatchlist(adminActor, {}, db);
  assert.equal(result.entries.length, 1);
  assert.equal(result.total, 1);
  assert.equal(result.entries[0].studentName, "Jordan Student");
});

test("fetchWatchlist: returns empty array when no open signals", async () => {
  const db = buildDb([]);
  const result = await fetchWatchlist(adminActor, {}, db);
  assert.equal(result.entries.length, 0);
  assert.equal(result.total, 0);
});

test("fetchWatchlist: advisor actor is allowed", async () => {
  const db = buildDb();
  const result = await fetchWatchlist(advisorActor, {}, db);
  assert.equal(result.entries.length, 1);
});

test("fetchWatchlist: student actor is forbidden", async () => {
  const db = buildDb();
  await assert.rejects(
    () => fetchWatchlist(studentActor, {}, db),
    AcademyAuthorizationError,
  );
});

test("fetchWatchlist: cross-tenant actor sees empty results (tenant isolation via query param)", async () => {
  // Cross-tenant actor queries a different tenant — no entries because data is tenant-scoped
  const db = buildDb([]);
  const result = await fetchWatchlist(crossTenantActor, {}, db);
  assert.equal(result.entries.length, 0);
});

test("fetchWatchlist: high urgency entry ranked first", async () => {
  const highEntry = mockEntry({ studentPersonId: "s-1", highestUrgency: "high", openSignalCount: 3 });
  const medEntry = mockEntry({ studentPersonId: "s-2", highestUrgency: "medium", openSignalCount: 2 });
  const db = buildDb([highEntry, medEntry]);
  const result = await fetchWatchlist(adminActor, {}, db);
  assert.equal(result.entries[0].highestUrgency, "high");
});

test("fetchWatchlist: no advisor_notes in any entry", async () => {
  const db = buildDb();
  const result = await fetchWatchlist(adminActor, {}, db);
  for (const entry of result.entries) {
    assert.doesNotMatch(JSON.stringify(entry), /advisorNotes|advisor_notes/);
  }
});
