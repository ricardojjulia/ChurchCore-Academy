import assert from "node:assert/strict";
import test from "node:test";
import { runLmsSandboxChecks } from "@/modules/lms-contract/sandbox-check-runner";

test("runLmsSandboxChecks passes evidence and roster checks when inputs exist", () => {
  const results = runLmsSandboxChecks({
    providerId: "canvas",
    recordedEvidence: [
      {
        label: "Canvas sandbox validation",
        status: "recorded",
        reference: "docs/releases/canvas-sandbox.md",
      },
    ],
    rosterEligibleSectionCount: 3,
  });

  assert.deepEqual(results.map((result) => [result.checkKey, result.status]), [
    ["configuration_review", "passed"],
    ["roster_preview", "passed"],
    ["launch_smoke", "skipped"],
  ]);
  assert.equal(results[0]?.reference, "docs/releases/canvas-sandbox.md");
  assert.match(results[1]?.safeSummary ?? "", /3 roster-eligible sections/);
  assert.doesNotMatch(JSON.stringify(results), /accessToken|clientSecret|rawProviderPayload|password/i);
});

test("runLmsSandboxChecks fails configuration and roster checks when inputs are missing", () => {
  const results = runLmsSandboxChecks({
    providerId: "moodle",
    recordedEvidence: [],
    rosterEligibleSectionCount: 0,
  });

  assert.deepEqual(results.map((result) => [result.checkKey, result.status]), [
    ["configuration_review", "failed"],
    ["roster_preview", "failed"],
    ["launch_smoke", "skipped"],
  ]);
  assert.match(results[0]?.safeSummary ?? "", /No recorded Moodle sandbox evidence/);
  assert.match(results[1]?.safeSummary ?? "", /No roster-eligible sections/);
});

test("runLmsSandboxChecks passes launch smoke when a sandbox launch reference is recorded", () => {
  const results = runLmsSandboxChecks({
    providerId: "moodle",
    recordedEvidence: [
      {
        label: "Moodle launch smoke",
        status: "recorded",
        reference: "docs/releases/moodle-launch-smoke.md",
      },
    ],
    rosterEligibleSectionCount: 1,
  });

  const launch = results.find((result) => result.checkKey === "launch_smoke");
  assert.equal(launch?.status, "passed");
  assert.equal(launch?.reference, "docs/releases/moodle-launch-smoke.md");
});
