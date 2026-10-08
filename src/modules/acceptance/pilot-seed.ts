import { assessPilotEndpoint } from "@/modules/acceptance/pilot-readiness";

// Records the uncoached pilot tasks need on top of `npm run db:seed:local` (2026-10-06 dry run):
// task 2 needs students with programs, task 5 an application awaiting a decision, and task 11 a
// student with a registered course. They are created through the same module services the API
// routes use, never by direct inserts, and only against a local or private-network database.

// Programs are referenced by program code: their ids are generated when the migrations run, so
// they differ on every database.
export interface PilotMembership {
  studentProfileId: string;
  programCode: string;
  catalogAcademicYearId: string;
  startedOn: string;
}

export interface PilotApplication {
  applicantPersonId: string;
  legalName: string;
  email: string;
  programCode: string;
  idempotencyKey: string;
}

export interface PilotSectionEnrollment {
  studentProfileId: string;
  courseId: string;
  courseSectionId: string;
}

export interface PilotInstructorAssignment {
  instructorPersonId: string;
  courseSectionId: string;
}

export interface PilotSeedPlan {
  tenantId: string;
  memberships: PilotMembership[];
  application: PilotApplication;
  /** Given before enrollments, so faculty tasks 8-10 have a section with a roster. */
  instructorAssignments: PilotInstructorAssignment[];
  enrollments: PilotSectionEnrollment[];
}

const BACHELOR_OF_THEOLOGY = "BTH";
const AA_MINISTRY_LEADERSHIP = "AA-ML";
const UPPER_SCHOOL = "DEMO-K12-UPP";

export const PILOT_SEED_PLAN: PilotSeedPlan = {
  tenantId: "cca-main",
  memberships: [
    { studentProfileId: "student-profile-naomi", programCode: BACHELOR_OF_THEOLOGY, catalogAcademicYearId: "year-college-2026-2027", startedOn: "2026-08-24" },
    { studentProfileId: "student-profile-daniel", programCode: BACHELOR_OF_THEOLOGY, catalogAcademicYearId: "year-college-2026-2027", startedOn: "2026-08-24" },
    { studentProfileId: "student-profile-leah", programCode: AA_MINISTRY_LEADERSHIP, catalogAcademicYearId: "year-college-2026-2027", startedOn: "2026-08-24" },
    { studentProfileId: "student-profile-ezra", programCode: AA_MINISTRY_LEADERSHIP, catalogAcademicYearId: "year-college-2026-2027", startedOn: "2026-08-24" },
    { studentProfileId: "student-profile-lena", programCode: UPPER_SCHOOL, catalogAcademicYearId: "year-childrens-2026", startedOn: "2026-08-15" },
    { studentProfileId: "demo-multi-profile-marcus", programCode: UPPER_SCHOOL, catalogAcademicYearId: "year-childrens-2026", startedOn: "2026-08-15" },
  ],
  application: {
    applicantPersonId: "person-maya-bennett",
    legalName: "Maya Bennett",
    email: "maya.bennett@churchcoreacademy.edu",
    programCode: BACHELOR_OF_THEOLOGY,
    idempotencyKey: "pilot-prep-create-maya-bth",
  },
  // The faculty pilot login (Felix Faculty) teaches nothing in the base seed; CAP-490 has no
  // instructor. The teacher login (Sophia Marsh) already teaches Algebra II.
  instructorAssignments: [
    { instructorPersonId: "person-acceptance-faculty", courseSectionId: "sec-cap490" },
  ],
  enrollments: [
    // Task 11: the student login's schedule and courses.
    { studentProfileId: "student-profile-lena", courseId: "demo-multi-course-algebra", courseSectionId: "demo-multi-section-algebra" },
    // Tasks 8-10: a student on the faculty login's roster.
    { studentProfileId: "student-profile-naomi", courseId: "course-cap490", courseSectionId: "sec-cap490" },
  ],
};

/** The operations the runner needs; the script wires them to the real module services. */
export interface PilotSeedSteps {
  /** The program's id in this database, or null when the base seed has no such program. */
  programIdForCode(programCode: string): Promise<string | null>;
  setMembership(membership: PilotMembership, academicProgramId: string): Promise<void>;
  /** Creates (idempotently) and submits the application; returns its id. */
  ensureSubmittedApplication(application: PilotApplication, programId: string): Promise<string>;
  sectionStatus(courseSectionId: string): Promise<string | null>;
  assignInstructor(assignment: PilotInstructorAssignment): Promise<void>;
  openSection(courseId: string, courseSectionId: string): Promise<void>;
  enroll(enrollment: PilotSectionEnrollment): Promise<void>;
}

export interface PilotSeedSummary {
  memberships: number;
  applicationId: string;
  instructorAssignments: number;
  sectionsOpened: string[];
  enrolledStudentProfileIds: string[];
}

export async function runPilotSeed(steps: PilotSeedSteps, plan: PilotSeedPlan = PILOT_SEED_PLAN): Promise<PilotSeedSummary> {
  const programIds = new Map<string, string>();
  for (const code of new Set([...plan.memberships.map((m) => m.programCode), plan.application.programCode])) {
    const id = await steps.programIdForCode(code);
    if (!id) throw new Error(`Program ${code} was not found. Run npm run db:migrate:local and npm run db:seed:local first.`);
    programIds.set(code, id);
  }

  for (const membership of plan.memberships) {
    await steps.setMembership(membership, programIds.get(membership.programCode)!);
  }
  const applicationId = await steps.ensureSubmittedApplication(plan.application, programIds.get(plan.application.programCode)!);

  // Check every section exists before changing any of them.
  const sectionIds = [...new Set([
    ...plan.instructorAssignments.map((a) => a.courseSectionId),
    ...plan.enrollments.map((e) => e.courseSectionId),
  ])];
  const statuses = new Map<string, string>();
  for (const sectionId of sectionIds) {
    const status = await steps.sectionStatus(sectionId);
    if (status === null) throw new Error(`Section ${sectionId} was not found. Run npm run db:seed:local first.`);
    statuses.set(sectionId, status);
  }

  for (const assignment of plan.instructorAssignments) {
    await steps.assignInstructor(assignment);
  }

  const sectionsOpened: string[] = [];
  for (const enrollment of plan.enrollments) {
    const status = statuses.get(enrollment.courseSectionId);
    if (status !== "open" && status !== "in_progress" && !sectionsOpened.includes(enrollment.courseSectionId)) {
      await steps.openSection(enrollment.courseId, enrollment.courseSectionId);
      sectionsOpened.push(enrollment.courseSectionId);
    }
    await steps.enroll(enrollment);
  }

  return {
    memberships: plan.memberships.length,
    applicationId,
    instructorAssignments: plan.instructorAssignments.length,
    sectionsOpened,
    enrolledStudentProfileIds: plan.enrollments.map((e) => e.studentProfileId),
  };
}

/** Refuses any database that is not loopback or private-network, before anything is written. */
export function assertLocalSeedTarget(databaseUrl: string | undefined) {
  if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is required.");
  return assessPilotEndpoint("DATABASE_URL", databaseUrl);
}
