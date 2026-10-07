import assert from "node:assert/strict";
import test from "node:test";
import { formatScheduleStart } from "@/modules/student-pwa/schedule-format";

test("a term start date shows as that calendar date, not the previous evening", () => {
  assert.equal(formatScheduleStart("2026-08-15T00:00:00.000Z"), "Starts Aug 15, 2026");
});

test("the date does not depend on the server or viewer time zone", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "America/Los_Angeles";
    assert.equal(formatScheduleStart("2026-01-01T00:00:00.000Z"), "Starts Jan 1, 2026");
  } finally {
    process.env.TZ = previous;
  }
});

test("an unparseable value shows a placeholder instead of Invalid Date", () => {
  assert.equal(formatScheduleStart("not-a-date"), "Date pending");
});
