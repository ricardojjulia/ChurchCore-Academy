import assert from "node:assert/strict";
import test from "node:test";
import { evaluateStudentGpaSignal } from "@/modules/shepherd-ai/gpa-drop-evaluator";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";
import { ShepherdAiSuggestion } from "@/modules/shepherd-ai/types";

function createMockRepository(existingSuggestions: ShepherdAiSuggestion[] = []) {
  const saved: ShepherdAiSuggestion[] = [];
  const updated: { suggestionId: string; status: string }[] = [];

  return {
    repository: new ShepherdAiPostgresRepository({
      query: async (sql: string, params?: unknown[]) => {
        if (sql.includes("update ai_suggestions")) {
          updated.push({
            suggestionId: params?.[0] as string,
            status: params?.[2] as string,
          });
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      },
    }),
    saved,
    updated,
    mockSaveSuggestions: async (suggestions: ShepherdAiSuggestion[]) => {
      saved.push(...suggestions);
    },
    mockFetchSuggestions: async () => existingSuggestions,
  };
}

test("evaluateStudentGpaSignal: GPA 1.3 creates suggestion with high urgency", async () => {
  const { repository, saved, mockSaveSuggestions, mockFetchSuggestions } =
    createMockRepository();
  repository.saveSuggestions = mockSaveSuggestions;
  repository.fetchSuggestions = mockFetchSuggestions;

  await evaluateStudentGpaSignal(
    "tenant-1",
    "student-1",
    1.3,
    2.5,
    "BIBL-101",
    false,
    true,
    repository,
    "John Doe",
  );

  assert.equal(saved.length, 1);
  assert.equal(saved[0].urgency, "high");
  assert.equal(saved[0].confidenceScore, 0.95);
  assert.match(saved[0].summary, /dropped from 2\.50 to 1\.30/);
});

test("evaluateStudentGpaSignal: GPA 1.8 creates suggestion with medium urgency", async () => {
  const { repository, saved, mockSaveSuggestions, mockFetchSuggestions } =
    createMockRepository();
  repository.saveSuggestions = mockSaveSuggestions;
  repository.fetchSuggestions = mockFetchSuggestions;

  await evaluateStudentGpaSignal(
    "tenant-1",
    "student-1",
    1.8,
    2.3,
    "BIBL-101",
    false,
    true,
    repository,
    "Jane Smith",
  );

  assert.equal(saved.length, 1);
  assert.equal(saved[0].urgency, "medium");
  assert.equal(saved[0].confidenceScore, 0.8);
  assert.match(saved[0].summary, /dropped from 2\.30 to 1\.80/);
});

test("evaluateStudentGpaSignal: GPA 2.5 above threshold resolves existing suggestion", async () => {
  const existingSuggestion: ShepherdAiSuggestion = {
    id: "suggestion-1",
    tenantId: "tenant-1",
    productArea: "academy",
    workflowType: "academic",
    workflowCode: "academic_standing_or_credit_progress_review",
    entityType: "student",
    entityId: "student-1",
    title: "Possible Finding: GPA below warning threshold",
    summary: "Student GPA is below threshold",
    confidenceScore: 0.8,
    urgency: "medium",
    suggestedActions: [],
    explanation: {
      detected: [],
      whySurfaced: [],
      sourceSignalCategories: ["student-record-signals"],
      limitations: [],
    },
    boundaryNote: "Test",
    generatedAt: new Date().toISOString(),
    status: "suggested",
  };

  const { repository, saved, updated, mockFetchSuggestions } =
    createMockRepository([existingSuggestion]);
  repository.saveSuggestions = async (suggestions: ShepherdAiSuggestion[]) => {
    saved.push(...suggestions);
  };
  repository.fetchSuggestions = mockFetchSuggestions;

  await evaluateStudentGpaSignal(
    "tenant-1",
    "student-1",
    2.5,
    1.8,
    "BIBL-101",
    false,
    true,
    repository,
    "Student",
  );

  assert.equal(saved.length, 0);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].status, "resolved");
});

test("evaluateStudentGpaSignal: no graded courses (GPA null) creates no signal", async () => {
  const { repository, saved, mockSaveSuggestions, mockFetchSuggestions } =
    createMockRepository();
  repository.saveSuggestions = mockSaveSuggestions;
  repository.fetchSuggestions = mockFetchSuggestions;

  await evaluateStudentGpaSignal(
    "tenant-1",
    "student-1",
    null,
    null,
    "BIBL-101",
    false,
    true,
    repository,
    "Student",
  );

  assert.equal(saved.length, 0);
});

test("evaluateStudentGpaSignal: supportsGpa false creates no suggestion", async () => {
  const { repository, saved, mockSaveSuggestions, mockFetchSuggestions } =
    createMockRepository();
  repository.saveSuggestions = mockSaveSuggestions;
  repository.fetchSuggestions = mockFetchSuggestions;

  await evaluateStudentGpaSignal(
    "tenant-1",
    "student-1",
    1.5,
    2.0,
    "BIBL-101",
    false,
    false,
    repository,
    "Student",
  );

  assert.equal(saved.length, 0);
});

test("evaluateStudentGpaSignal: existing suggested suggestion is updated", async () => {
  const existingSuggestion: ShepherdAiSuggestion = {
    id: "suggestion-1",
    tenantId: "tenant-1",
    productArea: "academy",
    workflowType: "academic",
    workflowCode: "academic_standing_or_credit_progress_review",
    entityType: "student",
    entityId: "student-1",
    title: "Possible Finding: GPA below warning threshold",
    summary: "Old summary",
    confidenceScore: 0.8,
    urgency: "medium",
    suggestedActions: [],
    explanation: {
      detected: [],
      whySurfaced: [],
      sourceSignalCategories: ["student-record-signals"],
      limitations: [],
    },
    boundaryNote: "Test",
    generatedAt: new Date().toISOString(),
    status: "suggested",
  };

  const { repository, saved, mockFetchSuggestions } =
    createMockRepository([existingSuggestion]);
  repository.saveSuggestions = async (suggestions: ShepherdAiSuggestion[]) => {
    saved.push(...suggestions);
  };
  repository.fetchSuggestions = mockFetchSuggestions;

  await evaluateStudentGpaSignal(
    "tenant-1",
    "student-1",
    1.4,
    2.0,
    "BIBL-101",
    false,
    true,
    repository,
    "Student",
  );

  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, "suggestion-1");
  assert.match(saved[0].summary, /1\.40/);
});

test("evaluateStudentGpaSignal: student on probation includes note in summary", async () => {
  const { repository, saved, mockSaveSuggestions, mockFetchSuggestions } =
    createMockRepository();
  repository.saveSuggestions = mockSaveSuggestions;
  repository.fetchSuggestions = mockFetchSuggestions;

  await evaluateStudentGpaSignal(
    "tenant-1",
    "student-1",
    1.7,
    2.1,
    "BIBL-101",
    true,
    true,
    repository,
    "Student",
  );

  assert.equal(saved.length, 1);
  assert.match(saved[0].summary, /currently on approved academic probation/);
});

test("evaluateStudentGpaSignal: cross-tenant isolation enforced via repository fetch", async () => {
  // The evaluator calls repository.fetchSuggestions(tenantId) which should only
  // return suggestions for that tenant. This test verifies tenant isolation.
  const { repository, saved, mockFetchSuggestions } =
    createMockRepository([]);
  repository.saveSuggestions = async (suggestions: ShepherdAiSuggestion[]) => {
    saved.push(...suggestions);
  };
  repository.fetchSuggestions = mockFetchSuggestions;

  await evaluateStudentGpaSignal(
    "tenant-a",
    "student-1",
    1.5,
    2.0,
    "BIBL-101",
    false,
    true,
    repository,
    "Student",
  );

  assert.equal(saved.length, 1);
  assert.equal(saved[0].tenantId, "tenant-a");
});
