import assert from "node:assert/strict";
import test from "node:test";
import { growthFrameFilter } from "@/lib/gradebook/growthFrameFilter";

test("growthFrameFilter returns student-safe grade display without raw scores", () => {
  const result = growthFrameFilter({
    assignmentTitle: "Romans Reflection",
    percentage: 84.4,
    letterGrade: "B",
    isPassing: true,
    instructorFeedback: "Strong reflection with room to sharpen citations.",
    sensitivityTier: "standard",
  });

  assert.equal(result.assignmentTitle, "Romans Reflection");
  assert.equal(result.displayPercentage, "84% complete");
  assert.equal(result.primaryLabel, "On track");
  assert.equal(result.showRawScore, false);
});

test("growthFrameFilter prevents ministry-failure language on pastoral grade data", () => {
  const result = growthFrameFilter({
    assignmentTitle: "Pastoral Practicum",
    percentage: 58,
    letterGrade: "F",
    isPassing: false,
    instructorFeedback: "This is not called and deficient ministry failure language.",
    sensitivityTier: "pastoral",
  });

  assert.equal(result.primaryLabel, "Pastoral formation review");
  assert.match(result.contextStatement, /does not determine calling, worth, or ministry fit/i);
  assert.doesNotMatch(result.feedbackDisplay ?? "", /failure|not called|deficient/i);
  assert.match(result.feedbackDisplay ?? "", /growth area|discernment area|developing/i);
});
