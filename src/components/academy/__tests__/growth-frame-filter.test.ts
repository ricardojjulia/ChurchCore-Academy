import assert from "node:assert/strict";
import test from "node:test";
import { filterGrowthFrameText } from "@/components/academy/ai/growth-frame-filter";

test("growth frame filter rewrites defensive language into support language", () => {
  assert.equal(
    filterGrowthFrameText("warning: flagged risk and failure"),
    "attention item: reviewed growth note and learning opportunity",
  );
});
