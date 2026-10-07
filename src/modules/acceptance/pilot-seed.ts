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

export interface PilotSeedPlan {
  tenantId: string;
  memberships: PilotMembership[];
  application: PilotApplication;
  enrollment: PilotSectionEnrollment;
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
  enrollment: {
    studentProfileId: "student-profile-lena",
    courseId: "demo-multi-course-algebra",
    courseSectionId: "demo-multi-section-algebra",
  },
};

/** The operations the runner needs; the script wires them to the real module services. */
export interface PilotSeedSteps {
  /** The program's id in this database, or null when the base seed has no such program. */
  programIdForCode(programCode: string): Promise<string | null>;
  setMembership(membership: PilotMembership, academicProgramId: string): Promise<void>;
  /** Creates (idempotently) and submits the application; returns its id. */
  ensureSubmittedApplication(application: PilotApplication, programId: string): Promise<string>;
  sectionStatus(courseSectionId: string): Promise<string | null>;
  openSection(courseId: string, courseSectionId: string): Promise<void>;
  enroll(enrollment: PilotSectionEnrollment): Promise<void>;
}

export interface PilotSeedSummary {
  memberships: number;
  applicationId: string;
  sectionOpened: boolean;
  enrolledStudentProfileId: string;
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

  const status = await steps.sectionStatus(plan.enrollment.courseSectionId);
  if (status === null) {
    throw new Error(`Section ${plan.enrollment.courseSectionId} was not found. Run npm run db:seed:local first.`);
  }
  const sectionOpened = status !== "open" && status !== "in_progress";
  if (sectionOpened) {
    await steps.openSection(plan.enrollment.courseId, plan.enrollment.courseSectionId);
  }
  await steps.enroll(plan.enrollment);

  return {
    memberships: plan.memberships.length,
    applicationId,
    sectionOpened,
    enrolledStudentProfileId: plan.enrollment.studentProfileId,
  };
}

/** Refuses any database that is not loopback or private-network, before anything is written. */
export function assertLocalSeedTarget(databaseUrl: string | undefined) {
  if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is required.");
  return assessPilotEndpoint("DATABASE_URL", databaseUrl);
}
