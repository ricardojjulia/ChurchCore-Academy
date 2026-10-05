import assert from "node:assert/strict";
import test from "node:test";
import {
  HQ_COUNCIL_REVIEW_PROMPT,
  HQ_GOVERNANCE_CONTEXT,
} from "@/modules/hq/governance-policy";

test("HQ governance keeps specialists advisory and Academy authoritative", () => {
  assert.match(HQ_GOVERNANCE_CONTEXT, /specialists are advisory/i);
  assert.match(HQ_GOVERNANCE_CONTEXT, /cannot approve, ratify, merge, deploy/i);
  assert.match(HQ_GOVERNANCE_CONTEXT, /docs\/development-guide\.md is the canonical/i);
  assert.match(HQ_GOVERNANCE_CONTEXT, /Academy is the academic system of record/i);
  assert.match(HQ_GOVERNANCE_CONTEXT, /LMS runtime code belongs outside this repository/i);
});

test("HQ Council reviews use canonical lenses and evidence-aware outcomes", () => {
  for (const lens of [
    "Product and SIS",
    "Architecture and data",
    "UX and accessibility",
    "Security and privacy",
    "Competitive readiness",
    "Testing Council",
  ]) {
    assert.match(HQ_COUNCIL_REVIEW_PROMPT, new RegExp(lens, "i"));
  }

  for (const outcome of [
    "READY",
    "READY WITH REQUIRED CHANGES",
    "NOT READY",
    "BLOCKED ON OWNER DECISION",
  ]) {
    assert.match(HQ_COUNCIL_REVIEW_PROMPT, new RegExp(outcome));
  }

  assert.match(HQ_COUNCIL_REVIEW_PROMPT, /Do not simulate votes or claim ratification/i);
  assert.match(HQ_COUNCIL_REVIEW_PROMPT, /Checks that remain unverified/i);
  assert.match(HQ_COUNCIL_REVIEW_PROMPT, /does not replace tests/i);
});
