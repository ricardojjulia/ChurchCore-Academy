import assert from "node:assert/strict";
import test from "node:test";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { loadPeopleReviewModel } from "@/modules/people/review-loader";

test("loads people review data through the configured repository reader", async () => {
  const calls: string[] = [];
  const model = await loadPeopleReviewModel(
    {
      fetchPeopleConfiguration: async (tenantId: string) => {
        calls.push(tenantId);
        return academyDataset.peopleConfiguration;
      },
    },
    "cca-main",
  );

  assert.deepEqual(calls, ["cca-main"]);
  assert.equal(model.summary.tenantId, "cca-main");
  assert.equal(model.metrics.find((metric) => metric.label === "People")?.value, "5");
});
