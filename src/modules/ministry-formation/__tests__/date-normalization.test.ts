import { test } from "node:test";
import assert from "node:assert/strict";
import { toDateString, toIsoString } from "@/modules/ministry-formation/service";

// Regression test for a real bug found via live browser testing: `pg` returns `date` and
// `timestamptz` columns as JS Date objects, not strings, but this module's row types declare
// them `string` and client components render them directly into JSX. Passing a raw Date
// through crashed the formation detail page with "Objects are not valid as a React child
// (found: [object Date])" the moment a real Postgres row (not a mock) reached the page —
// mock-DB unit tests never caught this because mocks hand back whatever string literal the
// test wrote, never a real Date instance.

test("toDateString converts a real Date (as pg returns for `date` columns) to a plain YYYY-MM-DD string", () => {
  const pgDate = new Date("2026-01-15T00:00:00.000Z");
  assert.equal(toDateString(pgDate), "2026-01-15");
});

test("toDateString passes an already-string value through unchanged", () => {
  assert.equal(toDateString("2026-01-15"), "2026-01-15");
});

test("toIsoString converts a real Date (as pg returns for `timestamptz` columns) to an ISO string", () => {
  const pgTimestamp = new Date("2026-09-14T22:02:33.379Z");
  assert.equal(toIsoString(pgTimestamp), "2026-09-14T22:02:33.379Z");
});

test("toIsoString passes an already-string value through unchanged", () => {
  assert.equal(toIsoString("2026-09-14T22:02:33.379Z"), "2026-09-14T22:02:33.379Z");
});
