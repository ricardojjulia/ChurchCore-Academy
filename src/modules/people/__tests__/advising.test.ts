import assert from "node:assert/strict";
import test from "node:test";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { fetchAdvisingWorkspace } from "@/modules/people/advising";

const advisor: AcademyActor = { tenantId: "tenant-a", userId: "advisor-a", roles: ["advisor"] };

test("advisor receives only the caseload bound to their verified person id", async () => {
  const calls: unknown[][] = [];
  const result = await fetchAdvisingWorkspace(advisor, undefined, {
    async query(_sql, values = []) {
      calls.push(values);
      if (calls.length === 1) return { rows: [{ person_id: "advisor-a", display_name: "A. Advisor", advisee_count: 1 }] };
      return { rows: [{ student_profile_id: "profile-a", student_person_id: "student-a", student_name: "Student A", student_number: "S-1", enrollment_status: "active", program_name: "MDiv", gpa: "3.2", risk_tier: "high", composite_score: 78, active_hold_count: 1, open_signal_count: 2, last_advisor_note_at: "2026-09-30T12:00:00Z" }] };
    },
  }, {
    async getProgress() {
      throw new Error("single-student progress lookup must not be used");
    },
    async getProgressForStudents(tenantId, studentProfileIds) {
      assert.deepEqual([tenantId, studentProfileIds], ["tenant-a", ["profile-a"]]);
      return new Map([["profile-a", { studentProfileId: "profile-a", activeProgramMembershipId: "membership-a", academicProgramId: "program-a", catalogAcademicYearId: "year-a", requiredCredits: 90, completedCredits: 30, inProgressCredits: 6, remainingCredits: 60, percentComplete: 33, requirements: [] }]]);
    },
  });
  assert.equal(result.selectedAdvisor?.personId, "advisor-a");
  assert.deepEqual(calls[1], ["tenant-a", "advisor-a"]);
  assert.equal(result.advisees[0].riskTier, "high");
  assert.equal(result.advisees[0].activeHoldCount, 1);
  assert.equal(result.advisees[0].percentComplete, 33);
  assert.equal(result.advisees[0].inProgressCredits, 6);
  assert.deepEqual(calls[0], ["tenant-a", ["advisor", "faculty", "professor", "dean", "academic_admin"], "advisor-a"]);
});

test("advisor cannot request another advisor's caseload", async () => {
  await assert.rejects(
    fetchAdvisingWorkspace(advisor, "advisor-b", { async query() { assert.fail("database reached"); } }),
    /only their own caseload/,
  );
});

test("oversight role can select an active advisor in the same tenant", async () => {
  const actor: AcademyActor = { tenantId: "tenant-a", userId: "registrar-a", roles: ["registrar"] };
  const result = await fetchAdvisingWorkspace(actor, "advisor-b", {
    async query(_sql, values = []) {
      if (Array.isArray(values[1])) {
        return { rows: [{ person_id: "advisor-b", display_name: "B. Advisor", advisee_count: 0 }] };
      }
      assert.deepEqual(values, ["tenant-a", "advisor-b"]);
      return { rows: [] };
    },
  });
  assert.equal(result.oversight, true);
  assert.equal(result.selectedAdvisor?.personId, "advisor-b");
});

test("oversight selection fails closed for an unknown or cross-tenant advisor", async () => {
  const actor: AcademyActor = { tenantId: "tenant-a", userId: "registrar-a", roles: ["registrar"] };
  await assert.rejects(
    fetchAdvisingWorkspace(actor, "tenant-b-advisor", { async query() { return { rows: [] }; } }),
    /not active in this institution/,
  );
});

test("unrelated roles cannot read advising data", async () => {
  await assert.rejects(
    fetchAdvisingWorkspace({ tenantId: "tenant-a", userId: "faculty-a", roles: ["faculty"] }, undefined, { async query() { assert.fail("database reached"); } }),
    /Forbidden advising workspace/,
  );
});
