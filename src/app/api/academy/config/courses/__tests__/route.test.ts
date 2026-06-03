import assert from "node:assert/strict";
import test from "node:test";
import { AcademyActor } from "@/modules/academy-auth/policy";
import { CourseCatalogConfiguration } from "@/modules/course-catalog/types";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { buildCourseCatalogConfigPayload } from "@/app/api/academy/config/courses/route";

function createConfig(): CourseCatalogConfiguration {
  return academyDataset.courseCatalog;
}

const registrar: AcademyActor = {
  userId: "user-registrar",
  tenantId: "cca-main",
  roles: ["registrar"],
};

test("course catalog config payload returns catalog configuration and validation for authorized same-tenant actors", async () => {
  const repository = {
    fetchCourseCatalogConfiguration: async () => createConfig(),
  };

  const payload = await buildCourseCatalogConfigPayload(repository, registrar, "cca-main");

  assert.equal(payload.courseCatalog.catalogProfile.tenantId, "cca-main");
  assert.equal(payload.courseCatalog.courses.length, 4);
  assert.equal(payload.courseCatalog.sections.length, 3);
  assert.deepEqual(payload.validation, []);
});

test("course catalog config payload rejects denied roles before repository access", async () => {
  let repositoryWasCalled = false;
  const repository = {
    fetchCourseCatalogConfiguration: async () => {
      repositoryWasCalled = true;
      return createConfig();
    },
  };

  await assert.rejects(
    () =>
      buildCourseCatalogConfigPayload(
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

test("course catalog config payload rejects cross-tenant reads before repository access", async () => {
  let repositoryWasCalled = false;
  const repository = {
    fetchCourseCatalogConfiguration: async () => {
      repositoryWasCalled = true;
      return createConfig();
    },
  };

  await assert.rejects(
    () =>
      buildCourseCatalogConfigPayload(
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

test("course catalog config payload includes validation warnings from invalid catalog data", async () => {
  const invalidConfig = createConfig();
  invalidConfig.courses = invalidConfig.courses.map((course) =>
    course.id === "course-reading-k5"
      ? {
          ...course,
          gradeBandSubdivisionId: undefined,
        }
      : course,
  );
  const repository = {
    fetchCourseCatalogConfiguration: async () => invalidConfig,
  };

  const payload = await buildCourseCatalogConfigPayload(repository, registrar, "cca-main");

  assert.deepEqual(payload.validation, ["Children's school course course-reading-k5 must reference a grade band subdivision."]);
});
