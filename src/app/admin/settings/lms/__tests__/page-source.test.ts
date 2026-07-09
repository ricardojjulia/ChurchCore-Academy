import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("LMS settings page renders roster preview from real Academy sections", () => {
  const page = readFileSync("src/app/admin/settings/lms/page.tsx", "utf8");
  const client = readFileSync("src/app/admin/settings/lms/LmsRosterPreviewClient.tsx", "utf8");

  assert.match(page, /LmsRosterPreviewClient/);
  assert.match(page, /listRosterEligibleSections/);
  assert.doesNotMatch(page, /Promise\.all/);
  assert.match(client, /\/api\/academy\/lms\/sections\/\$\{selectedSectionId\}\/roster-plan/);
  assert.match(client, /Preview roster plan/);
  assert.doesNotMatch(client, /accessToken|clientSecret|rawProviderPayload/i);
});
