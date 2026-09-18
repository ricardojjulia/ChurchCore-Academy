import assert from "node:assert/strict";
import test from "node:test";
import { buildOneRosterZipPackage } from "../zip";
import { buildOneRosterCsvPackage } from "../exporter";
import { buildSharedAcademyOneRosterFixturePackage } from "../conformance-fixture";

test("ZIP output is byte-identical for an unchanged package", async () => {
  const csv = await buildSharedAcademyOneRosterFixturePackage();
  assert.deepEqual(await buildOneRosterZipPackage(csv), await buildOneRosterZipPackage(csv));
});

test("expanded package limit rejects before compression", async () => {
  await assert.rejects(buildOneRosterZipPackage({ files: [{ filename: "users.csv", text: "a".repeat(50 * 1024 * 1024 + 1) }] }), /Invalid OneRoster package size/);
});

test("bulk cannot be emitted with delta row semantics", () => {
  assert.throws(() => buildOneRosterCsvPackage({ orgs: [], users: [], roles: [], academicSessions: [], courses: [], classes: [], enrollments: [] }, { generatedAt: new Date().toISOString(), mode: "bulk" }), /Only delta/);
});
