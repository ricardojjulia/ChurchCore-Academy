import assert from "node:assert/strict";
import test from "node:test";
import { getVisibleGradebookColumns } from "@/components/academy/gradebook/ColumnVisibilityConfig";

test("gradebook column visibility hides behavioral signals from students", () => {
  assert.deepEqual(getVisibleGradebookColumns("student"), [
    "assignment",
    "status",
    "grade",
    "sensitivity",
  ]);
});

test("gradebook column visibility exposes operational columns to staff tiers", () => {
  assert.ok(getVisibleGradebookColumns("instructor").includes("behavioralSignal"));
  assert.ok(getVisibleGradebookColumns("admin").includes("behavioralSignal"));
});
