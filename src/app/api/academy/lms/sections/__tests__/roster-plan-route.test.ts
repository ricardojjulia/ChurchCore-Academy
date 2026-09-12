import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("roster-plan route derives roster from Academy data instead of caller-supplied student ids", () => {
  const source = readFileSync("src/app/api/academy/lms/sections/[sectionId]/roster-plan/route.ts", "utf8");

  assert.match(source, /fetchSectionRosterSource/);
  assert.match(source, /buildRosterSyncPlanInputFromSource/);
  assert.match(source, /buildLmsRosterSyncPlanPayload/);
  assert.doesNotMatch(source, /studentPersonIds\s*=\s*asStringArray/);
  assert.doesNotMatch(source, /payload\.studentPersonIds/);
});

test("roster-plan route uses session auth and capability context without requiring live sync execution", () => {
  const source = readFileSync("src/app/api/academy/lms/sections/[sectionId]/roster-plan/route.ts", "utf8");

  assert.match(source, /withCapabilityContext/);
  assert.match(source, /resolveAcademyActorFromSession/);
  assert.doesNotMatch(source, /resolveLocalBootstrapAcademyActor/);
  assert.doesNotMatch(source, /assertCapability\(capabilities,\s*"lmsRosterSync"\)/);
});

test("OneRoster package route exports canonical CSV package files from Academy roster source", () => {
  const source = readFileSync("src/app/api/academy/lms/sections/[sectionId]/oneroster-package/route.ts", "utf8");

  assert.match(source, /resolveAcademyActorFromSession/);
  assert.match(source, /assertInstitutionConfigAccess\(actor, actor\.tenantId, "admin"\)/);
  assert.match(source, /withCapabilityContext/);
  assert.match(source, /fetchSectionRosterSource/);
  assert.match(source, /buildOneRosterDatasetFromRosterSource/);
  assert.match(source, /buildOneRosterCsvPackage/);
  assert.match(source, /OneRoster/);
  assert.doesNotMatch(source, /resolveLocalBootstrapAcademyActor/);
  assert.doesNotMatch(source, /password|credentialSecret|accessToken|refreshToken|clientSecret|webhookSecret/i);
});

test("tenant OneRoster package route supports admin JSON preview and ZIP download", () => {
  const source = readFileSync("src/app/api/academy/lms/oneroster-package/route.ts", "utf8");

  assert.match(source, /assertInstitutionConfigAccess\(actor, actor\.tenantId, "admin"\)/);
  assert.match(source, /buildAcademyOneRosterExportPackage/);
  assert.match(source, /buildOneRosterZipPackage/);
  assert.match(source, /application\/zip/);
  assert.match(source, /content-disposition/);
  assert.match(source, /fileCount/);
  assert.match(source, /rowCount/);
  assert.doesNotMatch(source, /password|credentialSecret|accessToken|refreshToken|clientSecret|webhookSecret/i);
});

test("tenant OneRoster package route exports the repository-backed shared provider package", () => {
  const source = readFileSync("src/app/api/academy/lms/oneroster-package/route.ts", "utf8");

  assert.match(source, /resolveAcademyActorFromSession/);
  assert.match(source, /withCapabilityContext/);
  assert.match(source, /buildAcademyOneRosterExportPackage/);
  assert.match(source, /AcademyPeopleRepository/);
  assert.match(source, /AcademyCourseCatalogRepository/);
  assert.match(source, /PostgresOneRosterRegistrationRepository/);
  assert.match(source, /churchcore-oneroster-rostering-csv-provider/);
  assert.doesNotMatch(source, /resolveLocalBootstrapAcademyActor/);
  assert.doesNotMatch(source, /password|credentialSecret|accessToken|refreshToken|clientSecret|webhookSecret/i);
});
