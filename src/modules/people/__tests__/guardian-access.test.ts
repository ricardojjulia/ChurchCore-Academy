import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyQueryClient } from "@/lib/academy-database-context";
import {
  fetchGuardianStudentSummary,
  getLinkedStudentsForGuardian,
  setFerpaRestriction,
} from "@/modules/people/guardian-access";
import type { AcademyActor } from "@/modules/academy-auth/policy";

const TENANT = "tenant-1";
const GUARDIAN_ID = "guardian-person-1";
const STUDENT_ID = "student-person-1";

function buildDb(overrides: Partial<{
  ferpaRestricted: boolean;
  ferpaRights: boolean;
  linked: boolean;
  studentExists: boolean;
}> = {}): AcademyQueryClient {
  const opts = { ferpaRestricted: false, ferpaRights: true, linked: true, studentExists: true, ...overrides };
  return {
    async query(text: string, values?: unknown[]) {
      // UPDATE must be checked before SELECT to avoid related_person_id in WHERE matching SELECT
      if (text.toLowerCase().startsWith("update academy_student_relationships")) {
        return { rowCount: opts.linked ? 1 : 0, rows: [] };
      }
      if (text.includes("academy_student_relationships") && text.includes("related_person_id")) {
        assert.match(text, /related_person_id\s*=\s*\$2/i);
        assert.deepEqual(values?.slice(0, 3), [TENANT, GUARDIAN_ID, STUDENT_ID]);
        if (!opts.linked) return { rows: [] };
        return { rows: [{ ferpa_restricted: opts.ferpaRestricted, ferpa_rights: opts.ferpaRights }] };
      }
      if (text.includes("academy_student_relationships") && text.includes("student_person_id")) {
        return { rowCount: opts.linked ? 1 : 0, rows: [] };
      }
      if (text.includes("academy_people") && text.includes("enrollment_status")) {
        if (!opts.studentExists) return { rows: [] };
        return {
          rows: [{
            person_id: STUDENT_ID,
            display_name: "Alex Student",
            enrollment_status: "enrolled",
            currency: "USD",
          }],
        };
      }
      if (text.includes("academy_attendance_records")) {
        return {
          rows: [{
            section_id: "section-1",
            section_name: "THEO 101 A",
            present_count: "8",
            absent_count: "2",
            late_count: "1",
            recent_absence_dates: ["2026-06-01"],
          }],
        };
      }
      if (text.includes("academy_gradebook_records")) {
        return {
          rows: [{
            term_name: "Fall 2026",
            cumulative_gpa: "3.5",
            course_code: "THEO101",
            course_title: "Introduction to Theology",
            grade: "A",
          }],
        };
      }
      if (text.includes("balance_cents")) {
        return { rows: [{ balance_cents: "50000" }] };
      }
      if (text.includes("update academy_student_relationships")) {
        return { rowCount: opts.linked ? 1 : 0, rows: [] };
      }
      return { rows: [] };
    },
    release() {},
  } as unknown as AcademyQueryClient;
}

test("fetchGuardianStudentSummary: returns student view for linked guardian", async () => {
  const db = buildDb();
  const result = await fetchGuardianStudentSummary(GUARDIAN_ID, STUDENT_ID, TENANT, db);
  assert.ok(result !== null);
  assert.equal(result.studentName, "Alex Student");
  assert.equal(result.enrollmentStatus, "enrolled");
  assert.ok(Array.isArray(result.attendance));
  assert.ok(result.grades);
});

test("fetchGuardianStudentSummary: no advisorNotes field in result", async () => {
  const db = buildDb();
  const result = await fetchGuardianStudentSummary(GUARDIAN_ID, STUDENT_ID, TENANT, db);
  assert.ok(result !== null);
  assert.equal("advisorNotes" in result, false);
});

test("fetchGuardianStudentSummary: no suggestions field in result", async () => {
  const db = buildDb();
  const result = await fetchGuardianStudentSummary(GUARDIAN_ID, STUDENT_ID, TENANT, db);
  assert.ok(result !== null);
  assert.equal("suggestions" in result, false);
});

test("fetchGuardianStudentSummary: returns null when FERPA restricted", async () => {
  const db = buildDb({ ferpaRestricted: true });
  const result = await fetchGuardianStudentSummary(GUARDIAN_ID, STUDENT_ID, TENANT, db);
  assert.equal(result, null);
});

test("fetchGuardianStudentSummary: limited FERPA rights returns attendance only", async () => {
  const db = buildDb({ ferpaRights: false });
  const result = await fetchGuardianStudentSummary(GUARDIAN_ID, STUDENT_ID, TENANT, db);

  assert.ok(result !== null);
  assert.ok(result.attendance.length > 0);
  assert.equal(result.balanceCents, null);
  assert.equal(result.grades, null);
  assert.equal("advisorNotes" in result, false);
  assert.equal("ministryFormation" in result, false);
});

test("fetchGuardianStudentSummary: throws when guardian is not linked", async () => {
  const db = buildDb({ linked: false });
  await assert.rejects(
    () => fetchGuardianStudentSummary(GUARDIAN_ID, STUDENT_ID, TENANT, db),
    /Guardian is not linked to this student/,
  );
});

test("setFerpaRestriction: sets restriction for admin actor", async () => {
  const adminActor: AcademyActor = { userId: "admin-1", tenantId: TENANT, roles: ["institution_admin"] };
  const db = buildDb({ linked: true });
  await assert.doesNotReject(() =>
    setFerpaRestriction(adminActor, {
      studentPersonId: STUDENT_ID,
      guardianPersonId: GUARDIAN_ID,
      ferpaRestricted: true,
    }, db),
  );
});

test("setFerpaRestriction: throws for unauthorized role", async () => {
  const studentActor: AcademyActor = { userId: "student-1", tenantId: TENANT, roles: ["student"] };
  const db = buildDb();
  await assert.rejects(
    () => setFerpaRestriction(studentActor, {
      studentPersonId: STUDENT_ID,
      guardianPersonId: GUARDIAN_ID,
      ferpaRestricted: true,
    }, db),
    /institution_admin or registrar/,
  );
});

test("getLinkedStudentsForGuardian: returns linked students", async () => {
  const db: AcademyQueryClient = {
    async query(text: string) {
      if (text.includes("academy_student_relationships")) {
        return {
          rows: [{
            student_person_id: STUDENT_ID,
            student_name: "Alex Student",
            ferpa_restricted: false,
          }],
        };
      }
      return { rows: [] };
    },
    release() {},
  } as unknown as AcademyQueryClient;

  const result = await getLinkedStudentsForGuardian(GUARDIAN_ID, TENANT, db);
  assert.equal(result.length, 1);
  assert.equal(result[0].studentPersonId, STUDENT_ID);
  assert.equal(result[0].ferpaRestricted, false);
});
