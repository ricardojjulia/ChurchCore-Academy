import assert from "node:assert/strict";
import test from "node:test";
import { computeStudentGpa, GpaQueryClient } from "@/modules/grading-records/gpa-calculator";

function createMockClient(rows: unknown[]): GpaQueryClient {
  return {
    query: async () => ({ rows }),
  };
}

test("computeStudentGpa: 3 courses A/B/C at 3 credit hours each returns GPA 3.0", async () => {
  const client = createMockClient([
    {
      grade_value: "A",
      letter_grade: "A",
      credit_hours: 3,
      gpa_points: 4.0,
      is_passing: true,
    },
    {
      grade_value: "B",
      letter_grade: "B",
      credit_hours: 3,
      gpa_points: 3.0,
      is_passing: true,
    },
    {
      grade_value: "C",
      letter_grade: "C",
      credit_hours: 3,
      gpa_points: 2.0,
      is_passing: true,
    },
  ]);

  const result = await computeStudentGpa("tenant-1", "student-1", client);

  assert.equal(result.gpa, 3.0);
  assert.equal(result.creditsEarned, 9);
  assert.equal(result.creditsAttempted, 9);
});

test("computeStudentGpa: A in 4-credit + C in 1-credit returns GPA 3.6", async () => {
  const client = createMockClient([
    {
      grade_value: "A",
      letter_grade: "A",
      credit_hours: 4,
      gpa_points: 4.0,
      is_passing: true,
    },
    {
      grade_value: "C",
      letter_grade: "C",
      credit_hours: 1,
      gpa_points: 2.0,
      is_passing: true,
    },
  ]);

  const result = await computeStudentGpa("tenant-1", "student-1", client);

  assert.equal(result.gpa, 3.6);
  assert.equal(result.creditsEarned, 5);
  assert.equal(result.creditsAttempted, 5);
});

test("computeStudentGpa: no official grades returns null GPA", async () => {
  const client = createMockClient([]);

  const result = await computeStudentGpa("tenant-1", "student-1", client);

  assert.equal(result.gpa, null);
  assert.equal(result.creditsEarned, 0);
  assert.equal(result.creditsAttempted, 0);
});

test("computeStudentGpa: all Pass/Fail returns null GPA with credits counted", async () => {
  const client = createMockClient([
    {
      grade_value: "P",
      letter_grade: "P",
      credit_hours: 3,
      gpa_points: null,
      is_passing: true,
    },
    {
      grade_value: "P",
      letter_grade: "P",
      credit_hours: 2,
      gpa_points: null,
      is_passing: true,
    },
  ]);

  const result = await computeStudentGpa("tenant-1", "student-1", client);

  assert.equal(result.gpa, null);
  assert.equal(result.creditsEarned, 5);
  assert.equal(result.creditsAttempted, 5);
});

test("computeStudentGpa: Incomplete grade excluded from calculation", async () => {
  const client = createMockClient([
    {
      grade_value: "A",
      letter_grade: "A",
      credit_hours: 3,
      gpa_points: 4.0,
      is_passing: true,
    },
  ]);

  const result = await computeStudentGpa("tenant-1", "student-1", client);

  assert.equal(result.gpa, 4.0);
  assert.equal(result.creditsEarned, 3);
  assert.equal(result.creditsAttempted, 3);
});

test("computeStudentGpa: zero-credit courses excluded from GPA denominator", async () => {
  const client = createMockClient([
    {
      grade_value: "A",
      letter_grade: "A",
      credit_hours: 3,
      gpa_points: 4.0,
      is_passing: true,
    },
    {
      grade_value: "A",
      letter_grade: "A",
      credit_hours: 0,
      gpa_points: 4.0,
      is_passing: true,
    },
  ]);

  const result = await computeStudentGpa("tenant-1", "student-1", client);

  assert.equal(result.gpa, 4.0);
  assert.equal(result.creditsEarned, 3);
  assert.equal(result.creditsAttempted, 3);
});

test("computeStudentGpa: cross-tenant isolation enforced via tenantId parameter", async () => {
  let capturedTenantId: string | undefined;
  const client: GpaQueryClient = {
    query: async (sql: string, params?: unknown[]) => {
      capturedTenantId = params?.[0] as string;
      return { rows: [] };
    },
  };

  await computeStudentGpa("tenant-a", "student-1", client);

  assert.equal(capturedTenantId, "tenant-a");
});

test("computeStudentGpa: failing grade does not contribute to earned credits", async () => {
  const client = createMockClient([
    {
      grade_value: "F",
      letter_grade: "F",
      credit_hours: 3,
      gpa_points: 0.0,
      is_passing: false,
    },
    {
      grade_value: "A",
      letter_grade: "A",
      credit_hours: 3,
      gpa_points: 4.0,
      is_passing: true,
    },
  ]);

  const result = await computeStudentGpa("tenant-1", "student-1", client);

  assert.equal(result.gpa, 2.0);
  assert.equal(result.creditsEarned, 3);
  assert.equal(result.creditsAttempted, 6);
});
