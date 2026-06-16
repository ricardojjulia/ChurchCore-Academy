import assert from "node:assert/strict";
import test from "node:test";
import { academyDataset } from "@/modules/academy-data/mock-data";
import {
  buildStudentPwaSourceFromDataset,
  loadStudentPwaPageModel,
} from "@/modules/student-pwa/server-read-model";

test("builds a released Student PWA source from the Academy dataset", () => {
  const source = buildStudentPwaSourceFromDataset(academyDataset, "person-lena-rivera");

  assert.equal(source.tenantId, "cca-main");
  assert.equal(source.people.institutionProfile.tenantId, "cca-main");
  assert.ok(source.courses.length >= 1);
  assert.ok(source.schedule.length >= 1);
  assert.ok(source.progress.length >= 1);
  assert.ok(source.documents.length >= 1);
  assert.equal(source.courses.every((item) => item.releaseStatus === "released"), true);
});

test("loads the Student PWA page model for a signed-in student actor", async () => {
  const result = await loadStudentPwaPageModel({
    loadProtectedDataset: async () => ({
      actor: {
        userId: "person-lena-rivera",
        tenantId: "cca-main",
        roles: ["student"],
      },
      dataset: academyDataset,
    }),
  });

  assert.equal(result.student.displayName, "Lena Rivera");
  assert.ok(result.courses.length >= 1);
  assert.ok(result.schedule.length >= 1);
  assert.ok(result.progress.length >= 1);
  assert.ok(result.documents.length >= 1);
});
