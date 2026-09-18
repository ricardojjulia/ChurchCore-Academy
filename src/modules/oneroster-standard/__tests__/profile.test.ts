import assert from "node:assert/strict";
import test from "node:test";
import {
  churchCoreGradebookReturnCsvFileNames,
  churchCoreOneRosterProfiles,
  churchCoreRosteringCsvFileNames,
  getUnsupportedCsvFilesForProfile,
  isOneRosterCsvFileName,
  oneRosterCsvBindingVersion,
  oneRosterCsvFileNames,
  oneRosterManifestVersion,
  oneRosterSensitiveFieldNames,
  oneRosterServiceIds,
  oneRosterVersion,
  requiresOneRosterIdempotency,
} from "../profile";

test("tracks the current OneRoster versions and service lanes", () => {
  assert.equal(oneRosterVersion, "1.2");
  assert.equal(oneRosterCsvBindingVersion, "1.2.1");
  assert.equal(oneRosterManifestVersion, "1.0");
  assert.deepEqual(oneRosterServiceIds, ["rostering", "gradebook", "resources"]);
});

test("enumerates the official CSV binding vocabulary used for profile checks", () => {
  assert.equal(oneRosterCsvFileNames.length, 22);
  assert.equal(isOneRosterCsvFileName("manifest.csv"), true);
  assert.equal(isOneRosterCsvFileName("users.csv"), true);
  assert.equal(isOneRosterCsvFileName("results.csv"), true);
  assert.equal(isOneRosterCsvFileName("unknown.csv"), false);
});

test("keeps the Academy-to-LMS rostering profile aligned to the current LMS consumer slice", () => {
  assert.deepEqual(churchCoreRosteringCsvFileNames, [
    "manifest.csv",
    "orgs.csv",
    "users.csv",
    "roles.csv",
    "academicSessions.csv",
    "courses.csv",
    "classes.csv",
    "enrollments.csv",
  ]);

  const consumer = churchCoreOneRosterProfiles.find(
    (profile) => profile.id === "churchcore-oneroster-rostering-csv-consumer",
  );
  assert.equal(consumer?.owner, "lms");
  assert.equal(consumer?.implementationStatus, "active");
  assert.deepEqual(consumer?.csvFiles, churchCoreRosteringCsvFileNames);
});

test("defines gradebook return as a separate reviewed-import lane", () => {
  assert.deepEqual(churchCoreGradebookReturnCsvFileNames, [
    "manifest.csv",
    "categories.csv",
    "lineItems.csv",
    "lineItemLearningObjectiveIds.csv",
    "lineItemScoreScales.csv",
    "results.csv",
    "resultLearningObjectiveIds.csv",
    "resultScoreScales.csv",
    "scoreScales.csv",
  ]);

  const gradebookReturn = churchCoreOneRosterProfiles.find(
    (profile) => profile.id === "churchcore-oneroster-gradebook-return",
  );
  assert.equal(gradebookReturn?.direction, "lms_to_academy");
  assert.deepEqual(gradebookReturn?.serviceIds, ["gradebook"]);
  assert.equal(gradebookReturn?.implementationStatus, "planned");
});

test("reports official but unsupported files against a concrete ChurchCore profile", () => {
  assert.deepEqual(
    getUnsupportedCsvFilesForProfile("churchcore-oneroster-rostering-csv-provider", [
      "manifest.csv",
      "users.csv",
      "results.csv",
      "resources.csv",
    ]),
    ["results.csv", "resources.csv"],
  );
});

test("marks sensitive fields for redaction and requires replay protection on CSV profiles", () => {
  assert.ok(oneRosterSensitiveFieldNames.includes("password"));
  assert.ok(oneRosterSensitiveFieldNames.includes("rawProviderPayload"));
  assert.equal(requiresOneRosterIdempotency("churchcore-oneroster-rostering-csv-provider"), true);
  assert.equal(requiresOneRosterIdempotency("churchcore-oneroster-gradebook-return"), true);
  assert.equal(requiresOneRosterIdempotency("churchcore-oneroster-rest"), false);
});
