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

test("LMS settings page records sandbox evidence without provider secrets", () => {
  const page = readFileSync("src/app/admin/settings/lms/page.tsx", "utf8");
  const form = readFileSync("src/app/admin/settings/lms/LmsSandboxEvidenceForm.tsx", "utf8");

  assert.match(page, /LmsSandboxEvidenceForm/);
  assert.match(page, /PostgresLmsSandboxEvidenceRepository/);
  assert.match(page, /groupLmsSandboxEvidenceForReadiness/);
  assert.match(form, /record_sandbox_evidence/);
  assert.match(form, /\/api\/academy\/lms\/readiness/);
  assert.doesNotMatch(form, /accessToken|clientSecret|rawProviderPayload/i);
});

test("LMS settings page runs sandbox checks without provider secrets", () => {
  const page = readFileSync("src/app/admin/settings/lms/page.tsx", "utf8");
  const runner = readFileSync("src/app/admin/settings/lms/LmsSandboxCheckRunner.tsx", "utf8");

  assert.match(page, /LmsSandboxCheckRunner/);
  assert.match(page, /PostgresLmsSandboxCheckResultRepository/);
  assert.match(page, /groupLmsSandboxCheckResultsForReadiness/);
  assert.match(page, /sandboxCheckResults/);
  assert.match(runner, /run_sandbox_checks/);
  assert.match(runner, /\/api\/academy\/lms\/readiness/);
  assert.doesNotMatch(runner, /accessToken|clientSecret|rawProviderPayload/i);
});

test("LMS settings page manages activation approval requests without provider secrets", () => {
  const page = readFileSync("src/app/admin/settings/lms/page.tsx", "utf8");
  const actions = readFileSync("src/app/admin/settings/lms/LmsActivationRequestActions.tsx", "utf8");

  assert.match(page, /LmsActivationRequestActions/);
  assert.match(page, /PostgresLmsActivationRequestRepository/);
  assert.match(page, /groupLmsActivationRequestsForReadiness/);
  assert.match(page, /activationRequest/);
  assert.match(actions, /request_activation/);
  assert.match(actions, /approve_activation/);
  assert.match(actions, /reject_activation/);
  assert.match(actions, /\/api\/academy\/lms\/readiness/);
  assert.doesNotMatch(actions, /accessToken|clientSecret|rawProviderPayload/i);
});
