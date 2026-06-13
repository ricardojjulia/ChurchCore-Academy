import assert from "node:assert/strict";
import test from "node:test";
import {
  loadRuntimeAcademyDataset,
  resolveAcademyRuntimeMode,
} from "@/modules/academy-data/runtime-dataset";
import { academyDataset } from "@/modules/academy-data/mock-data";

test("production runtime requires persistent database configuration", () => {
  assert.throws(
    () => resolveAcademyRuntimeMode({ NODE_ENV: "production" }),
    /DATABASE_URL is required/,
  );
});

test("explicit non-production demo mode may use the seeded demo dataset", async () => {
  const result = await loadRuntimeAcademyDataset("cca-main", {
    environment: {
      NODE_ENV: "development",
      DEMO_MODE_ENABLED: "true",
    },
  });

  assert.equal(result, academyDataset);
});

test("persistent database failures propagate instead of falling back to mock data", async () => {
  await assert.rejects(
    () =>
      loadRuntimeAcademyDataset("tenant-1", {
        environment: {
          NODE_ENV: "production",
          DATABASE_URL: "postgres://configured",
        },
        repository: {
          loadDataset: async () => {
            throw new Error("database unavailable");
          },
        },
      }),
    /database unavailable/,
  );
});

test("unit tests can inject a dataset explicitly", async () => {
  const result = await loadRuntimeAcademyDataset("cca-main", {
    dataset: academyDataset,
    environment: { NODE_ENV: "test" },
  });

  assert.equal(result, academyDataset);
});
