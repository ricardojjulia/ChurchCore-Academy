import assert from "node:assert/strict";
import test from "node:test";
import {
  canLearnerViewVisibility,
  isInstructorOnlyVisibility,
  visibilityTierLabel,
} from "@/components/academy/gradebook/visibility-tier";

test("visibility tiers distinguish learner and instructor views", () => {
  assert.equal(isInstructorOnlyVisibility("instructor_only"), true);
  assert.equal(canLearnerViewVisibility("learner_safe"), true);
  assert.equal(visibilityTierLabel("staff_only"), "Staff only");
});
