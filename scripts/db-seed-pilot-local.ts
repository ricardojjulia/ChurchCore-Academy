import { randomUUID } from "node:crypto";
import { createAdmissionsService, createDocumentChecklistService } from "@/app/api/academy/admissions/service-factory";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { closeDatabasePool } from "@/lib/database";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { assertCapability } from "@/modules/academy-auth/policy";
import { assertLocalSeedTarget, runPilotSeed } from "@/modules/acceptance/pilot-seed";
import { normalizeCreateAdmissionApplicationInput } from "@/modules/admissions/validation";
import { AcademyCourseCatalogRepository, type CourseCatalogRepository } from "@/modules/course-catalog/postgres-repository";
import { assignInstructor } from "@/modules/course-catalog/mutations";
import { CourseCatalogService } from "@/modules/course-catalog/service";
import {
  PostgresStudentProgramMembershipRepository,
  type StudentProgramMembershipDatabase,
} from "@/modules/student-program-memberships/postgres-repository";
import { StudentProgramMembershipService } from "@/modules/student-program-memberships/service";
import {
  PostgresStudentSectionEnrollmentRepository,
  type StudentSectionEnrollmentDatabase,
} from "@/modules/student-section-enrollments/postgres-repository";
import { StudentSectionEnrollmentService } from "@/modules/student-section-enrollments/service";

// Same shape the section-status route passes to the course catalog repository.
type Queryable = {
  query(sql: string, params: unknown[]): Promise<{
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }>;
};

// Local pilot data for docs/acceptance/uncoached-pilot-session.md. Run after
// `npm run db:seed:local`. Acts as the seeded demo institution admin through the same services
// the API routes use, inside the same request-scoped database context. Safe to re-run.
const actor: AcademyActor = {
  userId: "person-regina-holt",
  tenantId: "cca-main",
  roles: ["institution_admin"],
};

async function main() {
  const target = assertLocalSeedTarget(process.env.DATABASE_URL);
  console.log(`Seeding pilot data into ${target.classification} database.`);

  const summary = await runPilotSeed({
    programIdForCode: (programCode) =>
      withAcademyDatabaseContext(actor, async (client) => {
        const result = (await client.query(
          "select id from academy_academic_programs where tenant_id = $1 and program_code = $2 and status = 'active'",
          [actor.tenantId, programCode],
        )) as { rows: Array<{ id: string }> };
        return result.rows[0]?.id ?? null;
      }),

    setMembership: (membership, academicProgramId) =>
      withAcademyDatabaseContext(actor, async (client) => {
        const service = new StudentProgramMembershipService(
          new PostgresStudentProgramMembershipRepository(asAcademyDatabase<StudentProgramMembershipDatabase>(client)),
        );
        await service.setActiveMembership(actor, {
          studentProfileId: membership.studentProfileId,
          academicProgramId,
          catalogAcademicYearId: membership.catalogAcademicYearId,
          startedOn: membership.startedOn,
        });
      }),

    ensureSubmittedApplication: (application, programId) =>
      withCapabilityContext(actor, async (client, capabilities) => {
        assertCapability(capabilities, "admissionsWorkflows");
        const admissions = createAdmissionsService(client);
        const input = normalizeCreateAdmissionApplicationInput(
          {
            tenantId: actor.tenantId,
            applicantPersonId: application.applicantPersonId,
            legalName: application.legalName,
            email: application.email,
            programId,
          },
          actor.tenantId,
        );
        const draft = await admissions.createDraft(actor, input, `corr-pilot-seed-${randomUUID()}`, application.idempotencyKey);
        if (draft.status !== "draft") return draft.id;
        const submitted = await admissions.submit(actor, draft.id, `corr-pilot-seed-${randomUUID()}`, `pilot-prep-submit-${draft.id}`);
        // Same checklist snapshot the submit route takes after submitting.
        await createDocumentChecklistService(client).snapshotChecklistForApplication(actor.tenantId, submitted.id, submitted.programId);
        return submitted.id;
      }),

    sectionStatus: (courseSectionId) =>
      withAcademyDatabaseContext(actor, async (client) => {
        const result = (await client.query(
          "select status from academy_course_sections where tenant_id = $1 and id = $2",
          [actor.tenantId, courseSectionId],
        )) as { rows: Array<{ status: string }> };
        return result.rows[0]?.status ?? null;
      }),

    assignInstructor: (assignment) =>
      withAcademyDatabaseContext(actor, async (client) => {
        await assignInstructor(actor, assignment.courseSectionId, assignment.instructorPersonId, asAcademyDatabase<Queryable>(client));
      }),

    openSection: (_courseId, courseSectionId) =>
      withAcademyDatabaseContext(actor, async (client) => {
        const service = new CourseCatalogService(
          new AcademyCourseCatalogRepository(asAcademyDatabase<Queryable>(client)) as CourseCatalogRepository,
        );
        await service.transitionSectionStatus(actor, courseSectionId, "open");
      }),

    enroll: (enrollment) =>
      withAcademyDatabaseContext(actor, async (client) => {
        const service = new StudentSectionEnrollmentService(
          new PostgresStudentSectionEnrollmentRepository(asAcademyDatabase<StudentSectionEnrollmentDatabase>(client)),
        );
        await service.assignSection(actor, {
          studentProfileId: enrollment.studentProfileId,
          courseSectionId: enrollment.courseSectionId,
        });
      }),
  });

  console.log(
    `Pilot data ready: ${summary.memberships} program memberships, application ${summary.applicationId} submitted, ` +
      `${summary.instructorAssignments} instructor assignment(s), ` +
      `sections opened: ${summary.sectionsOpened.length ? summary.sectionsOpened.join(", ") : "none needed"}, ` +
      `enrolled: ${summary.enrolledStudentProfileIds.join(", ")}.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabasePool();
  });
