import assert from "node:assert/strict";
import test from "node:test";
import { academyDataset } from "@/modules/academy-data/mock-data";
import { AcademyDataset } from "@/modules/academy-data/types";
import { AcademicConcernScorer } from "@/modules/shepherd-ai/academic-concern-scorer";
import { ContextBuilder } from "@/modules/shepherd-ai/context-builder";
import { SignalAggregator } from "@/modules/shepherd-ai/signal-aggregator";
import { WorkflowRecommender } from "@/modules/shepherd-ai/workflow-recommender";
import { InMemoryAcademicWorkflowRepository } from "@/modules/academic-workflows/repository";
import { AcademicWorkflowsService } from "@/modules/academic-workflows/service";
import { aggregateAndEvaluateAcademy } from "@/modules/shepherd-ai/evaluate-for-academy";
import { runAcademicWorkflowEvaluationJob } from "@/modules/scheduled-jobs/evaluate-academic-workflows";

/**
 * Acceptance Test Suite: ShepherdAI Calendar-Gap Recommendations
 *
 * User Story: As an academic_admin, I want ShepherdAI to flag academic calendar
 * setup gaps as a suggested workflow, so that I can complete calendar
 * configuration before the institution relies on it.
 *
 * Acceptance Criteria:
 * 1. ShepherdAI creates a calendar-setup suggestion when required calendar data
 *    is missing or internally inconsistent, using only Academy-owned calendar
 *    and institution profile data.
 * 2. The recommendation is deterministic and explainable, and the reason text
 *    names the specific missing or inconsistent calendar items.
 * 3. The calendar settings validation/review surface stays read-only and remains
 *    the authoritative place to inspect calendar completeness.
 * 4. The suggestion appears in the existing workflow queue and is reviewable
 *    without exposing spiritual, LMS, Care, or Ops data.
 * 5. Only Academy admin users for the tenant can see or act on the suggestion.
 * 6. Promotion to a workflow is the handoff boundary; the system does not
 *    auto-apply calendar changes.
 * 7. If the calendar is complete and consistent, no calendar-setup suggestion
 *    is created.
 * 8. If required data is missing, the system returns a safe, tenant-scoped
 *    explanation rather than a generic error or any cross-tenant data.
 */

test("AC1: Calendar-setup suggestion is created when academic year dates are invalid", () => {
  // Invalid academic year: ends before it starts
  const datasetWithInvalidYear: AcademyDataset = {
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

  const { signals, suggestions } = aggregateAndEvaluateAcademy(datasetWithInvalidYear);

  const calendarSignal = signals.find((s) => s.signalType === "calendar_setup_incomplete_or_inconsistent");
  const calendarSuggestion = suggestions.find((s) => s.workflowCode === "calendar_setup_review");

  assert.ok(calendarSignal, "should create calendar setup signal");
  assert.ok(calendarSuggestion, "should create calendar setup suggestion");
  assert.equal(calendarSuggestion?.entityType, "institution", "should target institution entity");
  assert.equal(calendarSuggestion?.entityId, "cca-main", "should use tenant ID as entity ID");
});

test("AC1: Calendar-setup suggestion is created when period dates are invalid", () => {
  // Invalid period: ends before it starts
  const datasetWithInvalidPeriod: AcademyDataset = {
    ...academyDataset,
    academicCalendar: {
      ...academyDataset.academicCalendar,
      periods: [
        {
          id: "period-invalid",
          tenantId: "cca-main",
          academicYearId: "year-2026",
          name: "Spring (Invalid)",
          code: "SPRING",
          periodType: "term",
          sequence: 1,
          status: "active",
          startsOn: "2026-05-15",
          endsOn: "2026-05-01",
          parentPeriodId: undefined,
          createdAt: "2026-04-23T09:00:00.000Z",
          updatedAt: "2026-04-23T09:00:00.000Z",
        },
      ],
    },
  };

  const { suggestions } = aggregateAndEvaluateAcademy(datasetWithInvalidPeriod);
  const calendarSuggestion = suggestions.find((s) => s.workflowCode === "calendar_setup_review");

  assert.ok(calendarSuggestion, "should create suggestion for invalid period dates");
});

test("AC1: Calendar-setup suggestion is created when enrollment window configuration is invalid", () => {
  // Enrollment window that closes before it opens
  const datasetWithInvalidEnrollmentWindow: AcademyDataset = {
    ...academyDataset,
    academicCalendar: {
      ...academyDataset.academicCalendar,
      enrollmentWindows: [
        {
          id: "window-invalid",
          tenantId: "cca-main",
          academicPeriodId: "period-spring-2026",
          windowType: "registration",
          opensAt: "2026-04-15T00:00:00.000Z",
          closesAt: "2026-04-10T00:00:00.000Z",
          createdAt: "2026-04-23T09:00:00.000Z",
          updatedAt: "2026-04-23T09:00:00.000Z",
        },
      ],
    },
  };

  const { suggestions } = aggregateAndEvaluateAcademy(datasetWithInvalidEnrollmentWindow);
  const calendarSuggestion = suggestions.find((s) => s.workflowCode === "calendar_setup_review");

  assert.ok(calendarSuggestion, "should create suggestion for invalid enrollment window");
});

test("AC1: Calendar-setup suggestion uses only Academy-owned data", () => {
  const datasetWithInvalidYear: AcademyDataset = {
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

  const { signals } = aggregateAndEvaluateAcademy(datasetWithInvalidYear);
  const calendarSignal = signals.find((s) => s.signalType === "calendar_setup_incomplete_or_inconsistent");

  assert.ok(calendarSignal);
  const payload = calendarSignal?.signalPayloadJson;
  const payloadJson = JSON.stringify(payload);

  // Verify no LMS provider names or canonical secret fields in payload
  assert.doesNotMatch(payloadJson, /moodle_url|canvas_token|blackboard_key|accessToken|credentialSecret|rawProviderPayload|clientSecret|sharedSecret/i, "should not expose LMS provider secrets or canonical secret fields");
  // Verify no Care/Ops specific data
  assert.doesNotMatch(payloadJson, /care_session_id|therapy_notes/i, "should not reference Care data");
  assert.doesNotMatch(payloadJson, /billing_record|payment_token/i, "should not reference Ops data");
});

test("AC2: Calendar-setup recommendation is deterministic", () => {
  const datasetWithInvalidYear: AcademyDataset = {
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

  // Generate recommendations twice
  const result1 = aggregateAndEvaluateAcademy(datasetWithInvalidYear);
  const result2 = aggregateAndEvaluateAcademy(datasetWithInvalidYear);

  const suggestion1 = result1.suggestions.find((s) => s.workflowCode === "calendar_setup_review");
  const suggestion2 = result2.suggestions.find((s) => s.workflowCode === "calendar_setup_review");

  assert.ok(suggestion1);
  assert.ok(suggestion2);
  assert.equal(suggestion1.confidenceScore, suggestion2.confidenceScore, "confidence score should be deterministic");
  assert.equal(suggestion1.urgency, suggestion2.urgency, "urgency should be deterministic");
  assert.equal(suggestion1.title, suggestion2.title, "title should be deterministic");
  assert.equal(suggestion1.summary, suggestion2.summary, "summary should be deterministic");
});

test("AC2: Calendar-setup recommendation includes explainable reason text", () => {
  const datasetWithInvalidYear: AcademyDataset = {
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

  const { signals } = aggregateAndEvaluateAcademy(datasetWithInvalidYear);
  const calendarSignal = signals.find((s) => s.signalType === "calendar_setup_incomplete_or_inconsistent");

  assert.ok(calendarSignal);
  const errors = calendarSignal?.signalPayloadJson?.validationErrors as string[];
  assert.ok(Array.isArray(errors), "payload should include validationErrors array");
  assert.ok(errors.length > 0, "should list specific validation errors");
  assert.ok(
    errors.some((e) => e.includes("year") || e.includes("end") || e.includes("start")),
    "errors should name the specific issue",
  );
});

test("AC2: Recommendation includes suggested actions and explanation", () => {
  const datasetWithInvalidYear: AcademyDataset = {
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

  const { suggestions } = aggregateAndEvaluateAcademy(datasetWithInvalidYear);
  const suggestion = suggestions.find((s) => s.workflowCode === "calendar_setup_review");

  assert.ok(suggestion);
  assert.ok(suggestion.suggestedActions.length > 0, "should include suggested actions");
  assert.ok(suggestion.suggestedActions.some((a) => a.label.toLowerCase().includes("validation")), "should suggest validation review");
  assert.ok(suggestion.explanation, "should include explanation object");
  assert.ok(suggestion.explanation.detected.length > 0, "explanation should include what was detected");
  assert.ok(suggestion.explanation.whySurfaced.length > 0, "explanation should include why it surfaced");
});

test("AC3: Calendar settings validation surface is not modified by suggestion", () => {
  const datasetWithInvalidYear: AcademyDataset = {
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

  const { suggestions } = aggregateAndEvaluateAcademy(datasetWithInvalidYear);
  const suggestion = suggestions.find((s) => s.workflowCode === "calendar_setup_review");

  assert.ok(suggestion);
  // Verify suggestion does not attempt to modify the calendar
  assert.ok(!suggestion.suggestedActions.some((a) => a.label.toLowerCase().includes("auto-fix")), "should not auto-fix");
  assert.ok(!suggestion.suggestedActions.some((a) => a.label.toLowerCase().includes("apply")), "should not apply changes");
  assert.ok(suggestion.boundaryNote.includes("administrative setup completion"), "should clarify this is setup, not change");
});

test("AC4: Calendar-setup suggestion appears in workflow queue", () => {
  const datasetWithInvalidYear: AcademyDataset = {
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

  const repository = new InMemoryAcademicWorkflowRepository();
  const { suggestions } = aggregateAndEvaluateAcademy(datasetWithInvalidYear);
  repository.seedSuggestions(suggestions);

  const queue = repository.getQueue();

  const calendarItem = queue.find(
    (item) => item.kind === "suggestion" && item.workflowCode === "calendar_setup_review",
  );
  assert.ok(calendarItem, "calendar-setup suggestion should appear in queue");
  assert.equal(calendarItem?.status, "suggested", "should be in suggested status");
  assert.equal(calendarItem?.entityType, "institution", "should target institution");
});

test("AC4: Suggestion is reviewable without provider secrets or restricted data", () => {
  const datasetWithInvalidYear: AcademyDataset = {
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

  const { suggestions } = aggregateAndEvaluateAcademy(datasetWithInvalidYear);
  const suggestion = suggestions.find((s) => s.workflowCode === "calendar_setup_review");

  assert.ok(suggestion);
  const suggestionJson = JSON.stringify(suggestion);

  // Verify no secrets or restricted data exposure
  assert.doesNotMatch(suggestionJson, /moodle_url|canvas_token|provider_key|api_secret|accessToken|credentialSecret|rawProviderPayload|clientSecret|sharedSecret/i, "should not expose provider secrets or canonical secret fields");
  assert.doesNotMatch(suggestionJson, /care_session_id|counseling_record_id/i, "should not expose Care data");
  assert.doesNotMatch(suggestionJson, /billing_account|payment_method|invoice/i, "should not expose Ops financial data");
});

test("AC5: Suggestions are tenant-scoped", () => {
  const datasetWithInvalidYear: AcademyDataset = {
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

  const { suggestions } = aggregateAndEvaluateAcademy(datasetWithInvalidYear);
  const calendarSuggestion = suggestions.find((s) => s.workflowCode === "calendar_setup_review");

  assert.ok(calendarSuggestion);
  assert.equal(calendarSuggestion.tenantId, "cca-main", "suggestion must be tenant-scoped");
});

test("AC6: Promotion to workflow is the handoff boundary; no auto-apply", async () => {
  const datasetWithInvalidYear: AcademyDataset = {
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

  const result = await runAcademicWorkflowEvaluationJob("cca-main", datasetWithInvalidYear);
  const { suggestions, repository } = result;

  const calendarSuggestion = suggestions.find((s) => s.workflowCode === "calendar_setup_review");
  assert.ok(calendarSuggestion);

  // The calendar suggestion should NOT be automatically promoted to workflow
  const calendarWorkflow = repository.workflows.find(
    (w) => w.suggestionId === calendarSuggestion.id,
  );
  assert.equal(calendarWorkflow, undefined, "calendar suggestion should NOT be auto-promoted");

  // Verify it remains in suggested state
  const calendarSuggestionInRepo = repository.suggestions.find(
    (s) => s.id === calendarSuggestion.id,
  );
  assert.equal(calendarSuggestionInRepo?.status, "suggested", "should remain in suggested state");
});

test("AC6: Suggested actions require human review", () => {
  const datasetWithInvalidYear: AcademyDataset = {
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

  const { suggestions } = aggregateAndEvaluateAcademy(datasetWithInvalidYear);
  const calendarSuggestion = suggestions.find((s) => s.workflowCode === "calendar_setup_review");

  assert.ok(calendarSuggestion);
  for (const action of calendarSuggestion.suggestedActions) {
    assert.equal(action.requiresHumanReview, true, "all calendar actions should require human review");
  }
});

test("AC7: No calendar-setup suggestion when calendar is complete", () => {
  const { signals, suggestions } = aggregateAndEvaluateAcademy(academyDataset);

  const calendarSignal = signals.find((s) => s.signalType === "calendar_setup_incomplete_or_inconsistent");
  const calendarSuggestion = suggestions.find((s) => s.workflowCode === "calendar_setup_review");

  assert.equal(calendarSignal, undefined, "should not create signal for valid calendar");
  assert.equal(calendarSuggestion, undefined, "should not create suggestion for valid calendar");
});

test("AC7: Complete calendar produces no calendar signals", () => {
  const signals = new SignalAggregator().evaluate(academyDataset);
  const calendarSignals = signals.filter((s) => s.signalType === "calendar_setup_incomplete_or_inconsistent");

  assert.equal(calendarSignals.length, 0, "valid calendar should produce no signals");
});

test("AC8: Missing calendar data returns safe, tenant-scoped explanation", () => {
  const datasetWithInvalidEnrollmentWindow: AcademyDataset = {
    ...academyDataset,
    academicCalendar: {
      ...academyDataset.academicCalendar,
      enrollmentWindows: [
        {
          id: "window-invalid",
          tenantId: "cca-main",
          academicPeriodId: "period-spring-2026",
          windowType: "registration",
          opensAt: "2026-04-15T00:00:00.000Z",
          closesAt: "2026-04-10T00:00:00.000Z",
          createdAt: "2026-04-23T09:00:00.000Z",
          updatedAt: "2026-04-23T09:00:00.000Z",
        },
      ],
    },
  };

  const { signals, suggestions } = aggregateAndEvaluateAcademy(datasetWithInvalidEnrollmentWindow);
  const calendarSignal = signals.find((s) => s.signalType === "calendar_setup_incomplete_or_inconsistent");
  const calendarSuggestion = suggestions.find((s) => s.workflowCode === "calendar_setup_review");

  assert.ok(calendarSignal, "should detect configuration error");
  assert.ok(calendarSuggestion, "should create suggestion");

  // Explanation should be safe and tenant-scoped
  const explanation = calendarSuggestion.explanation;
  assert.ok(explanation.detected.length > 0, "should include detected issues");
  assert.ok(explanation.whySurfaced.length > 0, "should explain why it surfaced");

  // No generic error messages
  const suggestionJson = JSON.stringify(calendarSuggestion);
  assert.doesNotMatch(suggestionJson, /error occurred|failed to|unable to/i, "should not use error language");
  assert.doesNotMatch(suggestionJson, /database|internal|system/i, "should not expose system details");
});

test("AC8: Cross-tenant data never included in explanation", () => {
  const datasetWithInvalidYear: AcademyDataset = {
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

  const { signals } = aggregateAndEvaluateAcademy(datasetWithInvalidYear);
  const calendarSignal = signals.find((s) => s.signalType === "calendar_setup_incomplete_or_inconsistent");

  assert.ok(calendarSignal);
  assert.equal(calendarSignal.tenantId, "cca-main", "signal must be scoped to tenant");

  const errors = calendarSignal.signalPayloadJson.validationErrors as string[];
  for (const error of errors) {
    // Errors should only reference the tenant-scoped configuration
    assert.doesNotMatch(error, /other tenant|cross.tenant|different institution/i, "should not reference other tenants");
  }
});

test("End-to-end: signal → recommendation → queue → promotion workflow", async () => {
  const datasetWithInvalidYear: AcademyDataset = {
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

  // Step 1: Signal detection
  const signals = new SignalAggregator().evaluate(datasetWithInvalidYear);
  const calendarSignal = signals.find((s) => s.signalType === "calendar_setup_incomplete_or_inconsistent");
  assert.ok(calendarSignal, "Step 1: Signal should be detected");

  // Step 2: Scoring and recommendation
  const score = new AcademicConcernScorer().score(calendarSignal!);
  const context = new ContextBuilder().build(datasetWithInvalidYear, calendarSignal!);
  const suggestion = new WorkflowRecommender().recommend(calendarSignal!, context, score);
  assert.equal(suggestion.workflowCode, "calendar_setup_review", "Step 2: Recommendation should be generated");
  assert.ok(suggestion.suggestedActions.length > 0, "Step 2: Should include suggested actions");

  // Step 3: Queue display
  const repository = new InMemoryAcademicWorkflowRepository();
  repository.seedSuggestions([suggestion]);
  const queue = repository.getQueue();
  const queueItem = queue.find((item) => item.workflowCode === "calendar_setup_review");
  assert.ok(queueItem, "Step 3: Should appear in workflow queue");

  // Step 4: Promotion (manual, not automatic)
  const workflows = new AcademicWorkflowsService(datasetWithInvalidYear, repository);
  const workflow = workflows.createWorkflow({
    suggestionId: suggestion.id,
    ownerUserId: "user-admin",
    assignedToUserId: "user-admin",
    dueAt: "2026-05-01T17:00:00.000Z",
  });
  assert.ok(workflow, "Step 4: Should be able to promote to workflow");
  assert.equal(workflow.workflowCode, "calendar_setup_review", "Step 4: Workflow should preserve workflow code");

  // Step 5: Verify no auto-apply happened
  assert.ok(calendarSignal.signalPayloadJson.validationErrors, "Step 5: Calendar remains in invalid state");
});
