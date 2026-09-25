import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import * as catalog from "@/modules/course-catalog/mutations";

// Regression: course-catalog mutation functions had no role check of their own. Every one must
// reject non-administrators before it touches the database, whatever route calls it.

const actor = (roles: AcademyRole[]): AcademyActor => ({ userId: "u1", tenantId: "tenant-1", roles });
const db = {
  async query(): Promise<never> {
    throw new Error("database must not be reached before the role check");
  },
} as never;

const mutations: [string, (a: AcademyActor) => Promise<unknown>][] = [
  ["createCourse", (a) => catalog.createCourse(a, {} as never, db)],
  ["updateCourse", (a) => (catalog.updateCourse as (...args: unknown[]) => Promise<unknown>)(a, "c1", {}, db)],
  ["archiveCourse", (a) => (catalog.archiveCourse as (...args: unknown[]) => Promise<unknown>)(a, "c1", db)],
  ["activateCourse", (a) => catalog.activateCourse(a, "c1", db)],
  ["createSection", (a) => (catalog.createSection as (...args: unknown[]) => Promise<unknown>)(a, {}, db)],
  ["updateSection", (a) => (catalog.updateSection as (...args: unknown[]) => Promise<unknown>)(a, "s1", {}, db)],
  ["assignInstructor", (a) => (catalog.assignInstructor as (...args: unknown[]) => Promise<unknown>)(a, "s1", "p1", db)],
  ["deleteSection", (a) => catalog.deleteSection(a, "s1", db)],
];

for (const role of ["student", "guardian", "faculty", "finance", "admissions"] as AcademyRole[]) {
  test(`every catalog mutation rejects the ${role} role before touching the database`, async () => {
    for (const [name, call] of mutations) {
      await assert.rejects(call(actor([role])), AcademyAuthorizationError, `${name} as ${role}`);
    }
  });
}

test("the course DELETE route checks the catalog admin role itself", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile("src/app/api/academy/courses/[id]/route.ts", "utf8");
  const deleteHandler = source.slice(source.indexOf("export async function DELETE"));
  assert.match(deleteHandler, /assertCatalogAdmin\(actor\);[\s\S]*delete from academy_courses/);
});
