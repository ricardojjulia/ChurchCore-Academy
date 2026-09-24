import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import * as calendar from "@/modules/academic-calendar/mutations";

// Regression: calendar mutations had no role check, so a signed-in student could create and
// delete academic years, terms, and periods (found by the e2e surface probe). Every mutation
// must reject non-administrators before it touches the database.

const actor = (roles: AcademyRole[]): AcademyActor => ({ userId: "u1", tenantId: "tenant-1", roles });
const untouchedDb = {
  async query(): Promise<never> {
    throw new Error("database must not be reached before the role check");
  },
};
const db = untouchedDb as never;

const mutations: [string, (a: AcademyActor) => Promise<unknown>][] = [
  ["createAcademicYear", (a) => calendar.createAcademicYear(a, {} as never, db)],
  ["updateAcademicYear", (a) => calendar.updateAcademicYear(a, "y1", {} as never, db)],
  ["deleteAcademicYear", (a) => calendar.deleteAcademicYear(a, "y1", db)],
  ["archiveAcademicYear", (a) => calendar.archiveAcademicYear(a, "y1", db)],
  ["createTerm", (a) => calendar.createTerm(a, {} as never, db)],
  ["updateTerm", (a) => (calendar.updateTerm as (...args: unknown[]) => Promise<unknown>)(a, "t1", {}, db)],
  ["closeTerm", (a) => (calendar.closeTerm as (...args: unknown[]) => Promise<unknown>)(a, "t1", db)],
  ["deleteTerm", (a) => calendar.deleteTerm(a, "t1", db)],
  ["archiveTerm", (a) => (calendar.archiveTerm as (...args: unknown[]) => Promise<unknown>)(a, "t1", db)],
  ["createPeriod", (a) => calendar.createPeriod(a, {} as never, db)],
  ["updatePeriod", (a) => (calendar.updatePeriod as (...args: unknown[]) => Promise<unknown>)(a, "p1", {}, db)],
  ["deletePeriod", (a) => calendar.deletePeriod(a, "p1", db)],
  ["archivePeriod", (a) => (calendar.archivePeriod as (...args: unknown[]) => Promise<unknown>)(a, "p1", db)],
  ["transitionTermState", (a) => (calendar.transitionTermState as (...args: unknown[]) => Promise<unknown>)(a, "t1", "active", db)],
  ["transitionPeriodState", (a) => (calendar.transitionPeriodState as (...args: unknown[]) => Promise<unknown>)(a, "p1", "active", db)],
];

for (const role of ["student", "guardian", "faculty", "finance", "admissions", "advisor"] as AcademyRole[]) {
  test(`every calendar mutation rejects the ${role} role before touching the database`, async () => {
    for (const [name, call] of mutations) {
      await assert.rejects(call(actor([role])), AcademyAuthorizationError, `${name} as ${role}`);
    }
  });
}

test("calendar administrators pass the role check", () => {
  for (const role of ["institution_admin", "registrar", "academic_admin", "dean"] as AcademyRole[]) {
    assert.doesNotThrow(() => calendar.assertCalendarAdmin(actor([role])), role);
  }
});
