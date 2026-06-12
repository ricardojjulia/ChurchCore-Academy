import assert from "node:assert/strict";
import test from "node:test";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { AcademyDataset } from "@/modules/academy-data/types";
import { AcademicConcernScorer } from "@/modules/shepherd-ai/academic-concern-scorer";
import { ContextBuilder } from "@/modules/shepherd-ai/context-builder";
import { SignalAggregator } from "@/modules/shepherd-ai/signal-aggregator";
import { WorkflowRecommender } from "@/modules/shepherd-ai/workflow-recommender";

test("scoring remains deterministic and recommendation text stays guarded", () => {
  const signals = new SignalAggregator().evaluate(academyDataset);
  const target = signals.find((signal) => signal.signalType === "credit_progress_gap" && signal.entityId === "stu-daniel-hart");

  assert.ok(target);

  const score = new AcademicConcernScorer().score(target);
  const context = new ContextBuilder().build(academyDataset, target);
  const suggestion = new WorkflowRecommender().recommend(target, context, score);

  assert.equal(suggestion.workflowCode, "academic_standing_or_credit_progress_review");
  assert.equal(suggestion.urgency, "low");
  assert.match(suggestion.summary, /may benefit from advisor review/i);
  assert.match(suggestion.boundaryNote, /does not infer motivation/i);
});

test("calendar setup recommendation maps signal to workflow", () => {
  const datasetWithGap: AcademyDataset = {
    ...academyDataset,
    academicCalendar: {
      ...academyDataset.academicCalendar,
      academicYears: [
        {
          id: "year-invalid",
          tenantId: "cca-main",
          name: "Invalid Year",
          code: "2026",
          startsOn: "2026-12-31",
          endsOn: "2026-01-01",
          status: "active",
          calendarSystem: "rolling_enrollment",
          createdAt: "2026-04-23T09:00:00.000Z",
          updatedAt: "2026-04-23T09:00:00.000Z",
        },
      ],
    },
  };

  const signals = new SignalAggregator().evaluate(datasetWithGap);
  const calendarSignal = signals.find((signal) => signal.signalType === "calendar_setup_incomplete_or_inconsistent");

  assert.ok(calendarSignal, "calendar gap signal should be present");

  const score = new AcademicConcernScorer().score(calendarSignal);
  const context = new ContextBuilder().build(datasetWithGap, calendarSignal);
  const suggestion = new WorkflowRecommender().recommend(calendarSignal, context, score);

  assert.equal(suggestion.workflowCode, "calendar_setup_review");
  assert.match(suggestion.title, /calendar setup review/i);
  assert.match(suggestion.summary, /calendar/i);
  assert.match(suggestion.summary, /configuration/i);
  assert.ok(suggestion.suggestedActions.length > 0, "should have suggested actions");
  assert.ok(
    suggestion.suggestedActions.some((action) => action.label.toLowerCase().includes("validation")),
    "should include validation review action"
  );
});

test("calendar setup suggestion includes explanation and message draft", () => {
  const datasetWithGap: AcademyDataset = {
    ...academyDataset,
    academicCalendar: {
      ...academyDataset.academicCalendar,
      academicYears: [
        {
          id: "year-invalid",
          tenantId: "cca-main",
          name: "Invalid Year",
          code: "2026",
          startsOn: "2026-12-31",
          endsOn: "2026-01-01",
          status: "active",
          calendarSystem: "rolling_enrollment",
          createdAt: "2026-04-23T09:00:00.000Z",
          updatedAt: "2026-04-23T09:00:00.000Z",
        },
      ],
    },
  };

  const signals = new SignalAggregator().evaluate(datasetWithGap);
  const calendarSignal = signals.find((signal) => signal.signalType === "calendar_setup_incomplete_or_inconsistent");

  assert.ok(calendarSignal);

  const score = new AcademicConcernScorer().score(calendarSignal);
  const context = new ContextBuilder().build(datasetWithGap, calendarSignal);
  const suggestion = new WorkflowRecommender().recommend(calendarSignal, context, score);

  assert.ok(suggestion.explanation, "should include explanation");
  assert.ok(suggestion.explanation.detected.length > 0, "explanation should include detected details");
  assert.ok(suggestion.explanation.whySurfaced.length > 0, "explanation should include why surfaced");
  assert.ok(
    suggestion.explanation.detected.some((detail) => /Invalid Year|ends on|starts on|calendar validation detail/i.test(detail)),
    "explanation should include at least one specific calendar validation error",
  );
  assert.ok(suggestion.messageDraft, "should include message draft");
  assert.match(suggestion.messageDraft!, /calendar/i, "message draft should mention calendar");
  assert.match(suggestion.messageDraft!, /configuration gaps/i, "message draft should mention configuration");
});
