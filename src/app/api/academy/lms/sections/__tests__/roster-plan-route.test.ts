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
