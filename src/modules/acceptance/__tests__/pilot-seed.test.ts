import assert from "node:assert/strict";
import test from "node:test";
import {
  assertLocalSeedTarget,
  PILOT_SEED_PLAN,
  runPilotSeed,
  type PilotSeedSteps,
} from "@/modules/acceptance/pilot-seed";

function fakeSteps(sectionStatus: string | null, knownPrograms = ["BTH", "AA-ML", "DEMO-K12-UPP"]) {
  const calls: string[] = [];
  const steps: PilotSeedSteps = {
    async programIdForCode(programCode) {
      return knownPrograms.includes(programCode) ? `id-${programCode}` : null;
    },
    async setMembership(membership, academicProgramId) {
      calls.push(`membership:${membership.studentProfileId}:${academicProgramId}`);
    },
    async ensureSubmittedApplication(application, programId) {
      calls.push(`application:${application.applicantPersonId}:${programId}`);
      return "application-1";
    },
    async sectionStatus(courseSectionId) {
      calls.push(`status:${courseSectionId}`);
      return sectionStatus;
    },
    async openSection(_courseId, courseSectionId) {
      calls.push(`open:${courseSectionId}`);
    },
    async enroll(enrollment) {
      calls.push(`enroll:${enrollment.studentProfileId}`);
    },
  };
  return { steps, calls };
}

test("pilot seed creates memberships, the application, opens the section, then enrolls", async () => {
  const { steps, calls } = fakeSteps("scheduled");
  const summary = await runPilotSeed(steps);

  assert.equal(summary.memberships, PILOT_SEED_PLAN.memberships.length);
  assert.equal(summary.applicationId, "application-1");
  assert.equal(summary.sectionOpened, true);
  assert.ok(calls.indexOf("open:demo-multi-section-algebra") < calls.indexOf("enroll:student-profile-lena"),
    "the section must be open before enrollment");
  assert.ok(calls.indexOf("membership:student-profile-lena:id-DEMO-K12-UPP") < calls.indexOf("enroll:student-profile-lena"),
    "the student needs a program membership before section enrollment");
});

test("pilot seed re-run leaves an already-open section alone", async () => {
  const { steps, calls } = fakeSteps("open");
  const summary = await runPilotSeed(steps);
  assert.equal(summary.sectionOpened, false);
  assert.ok(!calls.some((call) => call.startsWith("open:")));
  assert.ok(calls.includes("enroll:student-profile-lena"));
});

test("pilot seed resolves programs by code, because program ids differ per database", async () => {
  const { steps, calls } = fakeSteps("open");
  await runPilotSeed(steps);
  assert.ok(calls.includes("membership:student-profile-naomi:id-BTH"));
  assert.ok(calls.includes("application:person-maya-bennett:id-BTH"));
});

test("pilot seed writes nothing when a program is missing", async () => {
  const { steps, calls } = fakeSteps("open", ["BTH"]);
  await assert.rejects(runPilotSeed(steps), /Program AA-ML was not found/);
  assert.deepEqual(calls, [], "no membership, application, or enrollment is written before every program resolves");
});

test("pilot seed stops with a fix when the base seed has not run", async () => {
  const { steps, calls } = fakeSteps(null);
  await assert.rejects(runPilotSeed(steps), /Run npm run db:seed:local first/);
  assert.ok(!calls.some((call) => call.startsWith("enroll:")));
});

test("pilot seed only targets a local or private-network database", () => {
  assert.equal(assertLocalSeedTarget("postgresql://postgres:secret@127.0.0.1:56322/postgres").classification, "loopback");
  assert.throws(() => assertLocalSeedTarget("postgresql://postgres:secret@db.example.supabase.co:5432/postgres"), /loopback or a private-network/);
  assert.throws(() => assertLocalSeedTarget(undefined), /DATABASE_URL is required/);
});

test("pilot seed plan stays inside the demo tenant and gives every enrolled student a program", () => {
  assert.equal(PILOT_SEED_PLAN.tenantId, "cca-main");
  const withPrograms = new Set(PILOT_SEED_PLAN.memberships.map((membership) => membership.studentProfileId));
  for (const membership of PILOT_SEED_PLAN.memberships) {
    assert.doesNotMatch(membership.programCode, /^[0-9a-f-]{36}$/, "use program codes, not database-specific ids");
  }
  assert.ok(withPrograms.has(PILOT_SEED_PLAN.enrollment.studentProfileId));
});
