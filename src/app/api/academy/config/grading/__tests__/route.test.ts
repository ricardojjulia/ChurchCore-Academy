import assert from "node:assert/strict";
import test from "node:test";
import { buildGradingRecordsConfigPayload } from "@/app/api/academy/config/grading/route";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { GradingRecordsConfiguration } from "@/modules/grading-records/types";

function createConfig(): GradingRecordsConfiguration {
  return academyDataset.gradingRecords;
}

const registrar: AcademyActor = {
  userId: "user-registrar",
  tenantId: "cca-main",
  roles: ["registrar"],
};

test("grading records config payload returns grading configuration and validation for authorized same-tenant actors", async () => {
  const repository = {
    fetchGradingRecordsConfiguration: async () => createConfig(),
  };

  const payload = await buildGradingRecordsConfigPayload(repository, registrar, "cca-main");

  assert.equal(payload.gradingRecords.gradingProfile.tenantId, "cca-main");
  assert.equal(payload.gradingRecords.scales.length, 1);
  assert.equal(payload.gradingRecords.ruleSets.length, 1);
  assert.equal(payload.gradingRecords.officialRecordRules.length, 1);
  assert.deepEqual(payload.validation, []);
});

test("grading records config payload rejects denied roles before repository access", async () => {
  let repositoryWasCalled = false;
  const repository = {
    fetchGradingRecordsConfiguration: async () => {
      repositoryWasCalled = true;
      return createConfig();
    },
  };

  await assert.rejects(
    () =>
      buildGradingRecordsConfigPayload(
        repository,
        {
          userId: "user-student",
          tenantId: "cca-main",
          roles: ["student"],
        },
        "cca-main",
      ),
    /Forbidden institution configuration access./,
  );
  assert.equal(repositoryWasCalled, false);
});

test("grading records config payload rejects cross-tenant reads before repository access", async () => {
  let repositoryWasCalled = false;
  const repository = {
    fetchGradingRecordsConfiguration: async () => {
      repositoryWasCalled = true;
      return createConfig();
    },
  };

  await assert.rejects(
    () =>
      buildGradingRecordsConfigPayload(
        repository,
        {
          ...registrar,
          tenantId: "other-tenant",
        },
        "cca-main",
      ),
    /Forbidden institution configuration access./,
  );
  assert.equal(repositoryWasCalled, false);
});

test("grading records config payload includes validation warnings from invalid grading data", async () => {
  const invalidConfig = createConfig();
  invalidConfig.ruleSets = invalidConfig.ruleSets.map((ruleSet) => ({
    ...ruleSet,
    lmsGradeReturnPolicy: "direct_post_to_official_record",
  }));
  const repository = {
    fetchGradingRecordsConfiguration: async () => invalidConfig,
  };

  const payload = await buildGradingRecordsConfigPayload(repository, registrar, "cca-main");

  assert.deepEqual(payload.validation, [
    "Evaluation rule set ruleset-acts-ministry-completion cannot allow LMS grade return to post official records directly.",
  ]);
});
