/**
 * Assignment Grading Service Tests — ADR-0054
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  createAssignment,
  updateAssignment,
  bulkGradeAssignment,
  computeSectionGrades,
  getAssignments,
  getAssignmentGrades,
  AssignmentValidationError,
  AssignmentLockedError,
  type AssignmentGradingDatabase,
  type CreateAssignmentInput,
  type BulkGradeInput,
} from "../assignment-grading-service";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";

// ---------------------------------------------------------------------------
// Mock database
// ---------------------------------------------------------------------------

function createMockDb(queryResponses: Record<string, unknown>[]): AssignmentGradingDatabase {
  let callCount = 0;
  return {
    query: mock.fn(async () => {
      const response = queryResponses[callCount] ?? { rows: [] };
      callCount++;
      return response as { rows: Record<string, unknown>[] };
    }),
  };
}

function createRecordingDb(queryResponses: Record<string, unknown>[]) {
  let callCount = 0;
  const calls: { sql: string; params?: unknown[] }[] = [];
  const db: AssignmentGradingDatabase = {
    query: mock.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      const response = queryResponses[callCount] ?? { rows: [] };
      callCount++;
      return response as { rows: Record<string, unknown>[] };
    }),
  };
  return { db, calls };
}

// ---------------------------------------------------------------------------
// Mock actor
// ---------------------------------------------------------------------------

const mockFacultyActor: AcademyActor = {
  userId: "faculty-123",
  tenantId: "tenant-main",
  roles: ["faculty"],
  email: "faculty@example.org",
};


const mockOtherTenantActor: AcademyActor = {
  userId: "faculty-999",
  tenantId: "tenant-other",
  roles: ["faculty"],
  email: "other@example.org",
};

const mockStudentActor: AcademyActor = {
  userId: "student-789",
  tenantId: "tenant-main",
  roles: ["student"],
  email: "student@example.org",
};

// ---------------------------------------------------------------------------
// createAssignment tests
// ---------------------------------------------------------------------------

void describe("createAssignment", () => {
  void it("success: creates assignment when weight sum is valid", async () => {
    const input: CreateAssignmentInput = {
      sectionId: "section-1",
      title: "Midterm Exam",
      maxPoints: 100,
      weight: 30,
      gradingType: "points",
    };

    const db = createMockDb([
      // section check
      { rows: [{ course_id: "course-1" }] },
      // instructor check
      { rows: [{ id: "1" }] },
      // weight sum check
      { rows: [{ total_weight: 50 }] }, // existing total is 50
      // insert assignment
      {
        rows: [
          {
            id: "assignment-1",
            tenant_id: "tenant-main",
            course_id: "course-1",
            section_id: "section-1",
            created_by_person_id: "faculty-123",
            title: "Midterm Exam",
            description: null,
            max_points: 100,
            weight: 30,
            grading_type: "points",
            due_date: null,
            locked: false,
            created_at: "2026-06-25T12:00:00Z",
            updated_at: "2026-06-25T12:00:00Z",
          },
        ],
      },
    ]);

    const result = await createAssignment(db, mockFacultyActor, input);

    assert.equal(result.title, "Midterm Exam");
    assert.equal(result.weight, 30);
    assert.equal(result.locked, false);
  });

  void it("rejection: weight sum would exceed 100", async () => {
    const input: CreateAssignmentInput = {
      sectionId: "section-1",
      title: "Final Exam",
      maxPoints: 100,
      weight: 60,
      gradingType: "points",
    };

    const db = createMockDb([
      // section check
      { rows: [{ course_id: "course-1" }] },
      // instructor check
      { rows: [{ id: "1" }] },
      // weight sum check - already at 80
      { rows: [{ total_weight: 80 }] },
    ]);

    await assert.rejects(
      async () => createAssignment(db, mockFacultyActor, input),
      (error: Error) => {
        assert.ok(error instanceof AssignmentValidationError);
        assert.match(error.message, /Weight sum would exceed 100/);
        return true;
      }
    );
  });

  void it("rejection: cross-tenant section", async () => {
    const input: CreateAssignmentInput = {
      sectionId: "section-other",
      title: "Test",
      maxPoints: 100,
      weight: 20,
      gradingType: "points",
    };

    const db = createMockDb([
      // section check - not found in actor's tenant
      { rows: [] },
    ]);

    await assert.rejects(
      async () => createAssignment(db, mockFacultyActor, input),
      (error: Error) => {
        assert.ok(error instanceof AcademyAuthorizationError);
        assert.match(error.message, /not found or does not belong/);
        return true;
      }
    );
  });

  void it("rejection: student cannot create assignment", async () => {
    const input: CreateAssignmentInput = {
      sectionId: "section-1",
      title: "Test",
      maxPoints: 100,
      weight: 20,
      gradingType: "points",
    };

    const db = createMockDb([]);

    await assert.rejects(
      async () => createAssignment(db, mockStudentActor, input),
      (error: Error) => {
        assert.ok(error instanceof AcademyAuthorizationError);
        assert.match(error.message, /Only faculty and admins/);
        return true;
      }
    );
  });

  void it("rejection: non-instructor faculty forbidden", async () => {
    const input: CreateAssignmentInput = {
      sectionId: "section-1",
      title: "Test",
      maxPoints: 100,
      weight: 20,
      gradingType: "points",
    };

    const db = createMockDb([
      // section check
      { rows: [{ course_id: "course-1" }] },
      // instructor check - faculty is NOT instructor for this section
      { rows: [] },
    ]);

    await assert.rejects(
      async () => createAssignment(db, mockFacultyActor, input),
      (error: Error) => {
        assert.ok(error instanceof AcademyAuthorizationError);
        assert.match(error.message, /not assigned as an instructor/);
        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// updateAssignment tests
// ---------------------------------------------------------------------------

void describe("updateAssignment", () => {
  void it("success: updates title and description when not locked", async () => {
    const db = createMockDb([
      // assignment check
      { rows: [{ section_id: "section-1", locked: false }] },
      // instructor check
      { rows: [{ id: "1" }] },
      // update
      {
        rows: [
          {
            id: "assignment-1",
            tenant_id: "tenant-main",
            course_id: "course-1",
            section_id: "section-1",
            created_by_person_id: "faculty-123",
            title: "Updated Title",
            description: "New description",
            max_points: 100,
            weight: 30,
            grading_type: "points",
            due_date: null,
            locked: false,
            created_at: "2026-06-25T12:00:00Z",
            updated_at: "2026-06-25T13:00:00Z",
          },
        ],
      },
    ]);

    const result = await updateAssignment(db, mockFacultyActor, "assignment-1", {
      title: "Updated Title",
      description: "New description",
    });

    assert.equal(result.title, "Updated Title");
    assert.equal(result.description, "New description");
  });

  void it("rejection: cannot change max_points when locked", async () => {
    const db = createMockDb([
      // assignment check - locked=true
      { rows: [{ section_id: "section-1", locked: true }] },
      // instructor check
      { rows: [{ id: "1" }] },
    ]);

    await assert.rejects(
      async () =>
        updateAssignment(db, mockFacultyActor, "assignment-1", {
          maxPoints: 150,
        }),
      (error: Error) => {
        assert.ok(error instanceof AssignmentLockedError);
        assert.match(error.message, /Assignment is locked/);
        return true;
      }
    );
  });

  void it("rejection: cannot change weight when locked", async () => {
    const db = createMockDb([
      // assignment check - locked=true
      { rows: [{ section_id: "section-1", locked: true }] },
      // instructor check
      { rows: [{ id: "1" }] },
    ]);

    await assert.rejects(
      async () =>
        updateAssignment(db, mockFacultyActor, "assignment-1", {
          weight: 40,
        }),
      (error: Error) => {
        assert.ok(error instanceof AssignmentLockedError);
        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// bulkGradeAssignment tests
// ---------------------------------------------------------------------------

void describe("bulkGradeAssignment", () => {
  void it("success: bulk grades assignment and locks it", async () => {
    const grades: BulkGradeInput[] = [
      { studentRegistrationId: "reg-1", gradePoints: 85 },
      { studentRegistrationId: "reg-2", gradePoints: 92 },
    ];

    const db = createMockDb([
      // assignment check
      { rows: [{ section_id: "section-1" }] },
      // instructor check
      { rows: [{ id: "1" }] },
      // registration check for reg-1
      { rows: [{ person_id: "student-1", section_id: "section-1" }] },
      // upsert grade for reg-1
      { rows: [] },
      // registration check for reg-2
      { rows: [{ person_id: "student-2", section_id: "section-1" }] },
      // upsert grade for reg-2
      { rows: [] },
      // lock assignment
      { rows: [] },
    ]);

    await bulkGradeAssignment(db, mockFacultyActor, "assignment-1", grades);

    // No error means success
    assert.ok(true);
  });

  void it("uses current registration and submission schema for bulk grade entry", async () => {
    const { db, calls } = createRecordingDb([
      // assignment check
      { rows: [{ section_id: "section-1" }] },
      // instructor check
      { rows: [{ id: "1" }] },
      // registration check
      { rows: [{ student_person_id: "student-1", course_section_id: "section-1" }] },
      // upsert submission
      { rows: [] },
      // lock assignment
      { rows: [] },
    ]);

    await bulkGradeAssignment(db, mockFacultyActor, "assignment-1", [
      { studentRegistrationId: "reg-1", gradePoints: 88 },
    ]);

    const registrationSql = calls.find((call) => call.sql.includes("academy_course_section_registrations"))?.sql ?? "";
    assert.match(registrationSql, /student_person_id/);
    assert.match(registrationSql, /course_section_id/);
    assert.doesNotMatch(registrationSql, /r\.person_id/);
    assert.doesNotMatch(registrationSql, /r\.section_id/);

    const submissionSql = calls.find((call) => call.sql.includes("academy_gradebook_submissions"))?.sql ?? "";
    assert.match(submissionSql, /status = 'graded'/);
    assert.match(submissionSql, /grade_points/);
    assert.match(submissionSql, /graded_by/);
  });

  void it("rejection: student registration not in section", async () => {
    const grades: BulkGradeInput[] = [
      { studentRegistrationId: "reg-invalid", gradePoints: 85 },
    ];

    const db = createMockDb([
      // assignment check
      { rows: [{ section_id: "section-1" }] },
      // instructor check
      { rows: [{ id: "1" }] },
      // registration check - not found
      { rows: [] },
    ]);

    await assert.rejects(
      async () => bulkGradeAssignment(db, mockFacultyActor, "assignment-1", grades),
      (error: Error) => {
        assert.ok(error instanceof AssignmentValidationError);
        assert.match(error.message, /not found in this section/);
        return true;
      }
    );
  });

  void it("rejection: cross-tenant assignment", async () => {
    const grades: BulkGradeInput[] = [
      { studentRegistrationId: "reg-1", gradePoints: 85 },
    ];

    const db = createMockDb([
      // assignment check - not found in other tenant
      { rows: [] },
    ]);

    await assert.rejects(
      async () => bulkGradeAssignment(db, mockOtherTenantActor, "assignment-1", grades),
      (error: Error) => {
        assert.ok(error instanceof AcademyAuthorizationError);
        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// computeSectionGrades tests
// ---------------------------------------------------------------------------

void describe("computeSectionGrades", () => {
  void it("success: computes weighted percentage correctly", async () => {
    const db = createMockDb([
      // section check
      { rows: [{ id: "section-1" }] },
      // instructor check
      { rows: [{ id: "1" }] },
      // compute grades query
      {
        rows: [
          {
            student_registration_id: "reg-1",
            learner_person_id: "student-1",
            weighted_sum: 2700, // (85/100 * 30) + (90/100 * 60) = 25.5 + 54 = 79.5 * 100 = 7950? Let's use 2700 = 27
            total_weight_graded: 90, // 30 + 60
          },
          {
            student_registration_id: "reg-2",
            learner_person_id: "student-2",
            weighted_sum: 3200, // 32
            total_weight_graded: 80,
          },
        ],
      },
    ]);

    const result = await computeSectionGrades(db, mockFacultyActor, "section-1");

    assert.equal(result.length, 2);
    assert.equal(result[0].studentRegistrationId, "reg-1");
    assert.equal(result[0].weightedPercentage, 30); // 2700 / 90
    assert.equal(result[0].totalWeightUsed, 90);
  });

  void it("rejection: cross-tenant section", async () => {
    const db = createMockDb([
      // section check - not found
      { rows: [] },
    ]);

    await assert.rejects(
      async () => computeSectionGrades(db, mockOtherTenantActor, "section-1"),
      (error: Error) => {
        assert.ok(error instanceof AcademyAuthorizationError);
        return true;
      }
    );
  });

  void it("rejection: non-instructor faculty forbidden", async () => {
    const db = createMockDb([
      // section check
      { rows: [{ id: "section-1" }] },
      // instructor check - not instructor
      { rows: [] },
    ]);

    await assert.rejects(
      async () => computeSectionGrades(db, mockFacultyActor, "section-1"),
      (error: Error) => {
        assert.ok(error instanceof AcademyAuthorizationError);
        assert.match(error.message, /not assigned as an instructor/);
        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// getAssignments tests
// ---------------------------------------------------------------------------

void describe("getAssignments", () => {
  void it("success: returns assignments for section", async () => {
    const db = createMockDb([
      // section check
      { rows: [{ id: "section-1" }] },
      // get assignments
      {
        rows: [
          {
            id: "assignment-1",
            tenant_id: "tenant-main",
            course_id: "course-1",
            section_id: "section-1",
            created_by_person_id: "faculty-123",
            title: "Midterm",
            description: null,
            max_points: 100,
            weight: 30,
            grading_type: "points",
            due_date: "2026-07-01T00:00:00Z",
            locked: false,
            created_at: "2026-06-25T12:00:00Z",
            updated_at: "2026-06-25T12:00:00Z",
          },
        ],
      },
    ]);

    const result = await getAssignments(db, mockFacultyActor, "section-1");

    assert.equal(result.length, 1);
    assert.equal(result[0].title, "Midterm");
  });
});

// ---------------------------------------------------------------------------
// getAssignmentGrades tests
// ---------------------------------------------------------------------------

void describe("getAssignmentGrades", () => {
  void it("success: returns grades for assignment", async () => {
    const db = createMockDb([
      // assignment check
      { rows: [{ section_id: "section-1" }] },
      // get grades
      {
        rows: [
          {
            id: "sub-1",
            tenant_id: "tenant-main",
            assignment_id: "assignment-1",
            learner_person_id: "student-1",
            grade_points: 85,
            pass_fail_result: null,
            submitted_at: "2026-06-24T10:00:00Z",
            graded_at: "2026-06-25T09:00:00Z",
            graded_by: "faculty-123",
            student_registration_id: "reg-1",
          },
        ],
      },
    ]);

    const result = await getAssignmentGrades(db, mockFacultyActor, "assignment-1");

    assert.equal(result.length, 1);
    assert.equal(result[0].gradePoints, 85);
    assert.equal(result[0].learnerPersonId, "student-1");
  });
});
