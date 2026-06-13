import assert from "node:assert/strict";
import test from "node:test";
import { loadProtectedAcademyDataset } from "@/modules/academy-data/server-dataset";
import { academyDataset } from "@/modules/academy-data/mock-data";

test("loads server data for the verified actor tenant", async () => {
  const requestedActors: string[] = [];
  const result = await loadProtectedAcademyDataset({
    resolveActor: async () => ({
      userId: "person-1",
      tenantId: "tenant-1",
      roles: ["registrar"],
    }),
    loadDataset: async (actor) => {
      requestedActors.push(`${actor.userId}:${actor.tenantId}`);
      return { ...academyDataset, tenantId: actor.tenantId };
    },
  });

  assert.equal(result.actor.tenantId, "tenant-1");
  assert.equal(result.dataset.tenantId, "tenant-1");
  assert.deepEqual(requestedActors, ["person-1:tenant-1"]);
});

test("does not replace persistence failures with seeded data", async () => {
  await assert.rejects(
    () =>
      loadProtectedAcademyDataset({
        resolveActor: async () => ({
          userId: "person-1",
          tenantId: "tenant-1",
          roles: ["registrar"],
        }),
        loadDataset: async () => {
          throw new Error("database unavailable");
        },
      }),
    /database unavailable/,
  );
});
