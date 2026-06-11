import assert from "node:assert/strict";
import test from "node:test";
import { filterDemoFeedbackRecords } from "@/modules/demo-feedback/triage";
import { DemoFeedbackStoredRecord } from "@/modules/demo-feedback/types";

const base: DemoFeedbackStoredRecord = {
  id: "a",
  fingerprint: "fp",
  sessionId: "3bf4ca1f-66b0-458f-89a4-bfd74c965cbf",
  route: "/students",
  category: "BUG",
  errorMessage: null,
  note: "note",
  breadcrumbs: ["/"],
  userEmail: "admin@example.com",
  userRole: "platform_staff",
  demoVersion: "dev",
  sessionDurationSeconds: 10,
  hitCount: 1,
  metadata: {},
  processed: false,
  action: null,
  createdAt: "2026-06-11T00:00:00.000Z",
  updatedAt: "2026-06-11T00:00:00.000Z",
};

test("triage filters open and done records", () => {
  const items = [base, { ...base, id: "b", processed: true }];

  assert.equal(filterDemoFeedbackRecords(items, { status: "open" }).length, 1);
  assert.equal(filterDemoFeedbackRecords(items, { status: "done" }).length, 1);
  assert.equal(filterDemoFeedbackRecords(items, { status: "all" }).length, 2);
});

test("triage filters by category, identity, and date", () => {
  const items = [
    base,
    {
      ...base,
      id: "b",
      category: "ERROR",
      userEmail: "anon@example.com",
      userRole: "observer",
      createdAt: "2026-04-11T00:00:00.000Z",
      updatedAt: "2026-04-11T00:00:00.000Z",
    },
  ];

  assert.equal(filterDemoFeedbackRecords(items, { category: "ERROR" }).length, 1);
  assert.equal(filterDemoFeedbackRecords(items, { identity: "platform" }).length, 1);
  assert.equal(filterDemoFeedbackRecords(items, { from: "2026-06-01T00:00:00.000Z" }).length, 1);
});
