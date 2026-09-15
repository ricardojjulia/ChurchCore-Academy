import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  GradebookPostgresRepository,
  type GradebookDatabase,
} from "@/modules/gradebook/postgres-repository";
import { computeStudentGpa } from "@/modules/grading-records/gpa-calculator";
import { evaluateStudentGpaSignal } from "@/modules/shepherd-ai/gpa-drop-evaluator";
import { ShepherdAiPostgresRepository } from "@/modules/shepherd-ai/postgres-repository";

const INSTRUCTOR_ROLES = new Set(["faculty", "teacher", "professor"]);
const ADMIN_ROLES = new Set(["institution_admin", "dean", "registrar", "academic_admin"]);

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const repo = new GradebookPostgresRepository(
        asAcademyDatabase<GradebookDatabase>(client),
      );

      if (actor.roles.some((r) => ADMIN_ROLES.has(r))) {
        return repo.fetchAdminGradebook(actor.tenantId);
      }

      if (actor.roles.some((r) => INSTRUCTOR_ROLES.has(r))) {
        return repo.fetchInstructorGradebook(actor.tenantId, actor.userId);
      }

      if (actor.roles.includes("student")) {
        return repo.fetchLearnerGradebook(actor.tenantId, actor.userId);
      }

      throw new Error("Forbidden: your role does not have gradebook access.");
    });
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);

    if (!actor.roles.some((r) => INSTRUCTOR_ROLES.has(r)) && !actor.roles.some((r) => ADMIN_ROLES.has(r))) {
      throw new Error("Forbidden: only instructors and admins may submit grades.");
    }

    const body = await request.json() as Record<string, unknown>;

    const submissionId = typeof body.submissionId === "string" ? body.submissionId : null;
    const assignmentId = typeof body.assignmentId === "string" ? body.assignmentId : null;
    const learnerPersonId = typeof body.learnerPersonId === "string" ? body.learnerPersonId : null;

    if (!submissionId || !assignmentId || !learnerPersonId) {
      throw new Error("submissionId, assignmentId, and learnerPersonId are required.");
    }

    const pointsEarned = typeof body.pointsEarned === "number" ? body.pointsEarned : null;
    const maxPoints = typeof body.maxPoints === "number" ? body.maxPoints : null;

    if (maxPoints === null || maxPoints <= 0) {
      throw new Error("maxPoints must be a positive number.");
    }

    return withAcademyDatabaseContext(actor, async (client) => {
      const repo = new GradebookPostgresRepository(
        asAcademyDatabase<GradebookDatabase>(client),
      );

      // For instructor actors, verify they own at least one section linked to this assignment.
      // fetchInstructorGradebook already enforces section ownership; here we do a lightweight check.
      if (actor.roles.some((r) => INSTRUCTOR_ROLES.has(r))) {
        const owns = await (client as unknown as { query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }> }).query(
          `select 1
           from public.academy_gradebook_assignments a
           join public.academy_course_sections s
             on s.tenant_id = a.tenant_id
            and s.id = a.section_id
           where a.tenant_id = $1
             and a.id = $2
             and (s.primary_instructor_id = $3 or s.assistant_instructor_ids ? $3)
           limit 1`,
          [actor.tenantId, assignmentId, actor.userId],
        );
        if (owns.rows.length === 0) {
          throw new Error("Forbidden: you do not own the section for this assignment.");
        }
      }

      const gradeRecord = await repo.gradeSubmission({
        tenantId: actor.tenantId,
        submissionId,
        assignmentId,
        learnerPersonId,
        gradedByPersonId: actor.userId,
        pointsEarned,
        maxPoints,
        letterGrade: typeof body.letterGrade === "string" ? body.letterGrade : null,
        isPassing: typeof body.isPassing === "boolean" ? body.isPassing : null,
        instructorFeedback: typeof body.instructorFeedback === "string" ? body.instructorFeedback : null,
        sensitivityTier: typeof body.sensitivityTier === "string" ? body.sensitivityTier : "standard",
      });

      // Compute and update student GPA within the same transaction
      const gpaResult = await computeStudentGpa(
        actor.tenantId,
        learnerPersonId,
        client as unknown as { query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> },
      );

      await (client as unknown as { query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> }).query(
        `update public.academy_student_profiles
         set gpa = $1
         where person_id = $2 and tenant_id = $3`,
        [gpaResult.gpa, learnerPersonId, actor.tenantId],
      );

      return { gradeRecord, learnerPersonId, currentGpa: gpaResult.gpa };
    }).then(async (result) => {
      // Fire ShepherdAI GPA signal evaluation as non-blocking side effect
      setImmediate(async () => {
        try {
          const shepherdRepo = new ShepherdAiPostgresRepository();
          const { actor } = await resolveAcademyActorFromSession(request);

          await withAcademyDatabaseContext(actor, async (client) => {
            // Fetch grading profile to check supportsGpa
            const profileQuery = await (client as unknown as { query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> }).query(
              `select supports_gpa from public.academy_grading_profiles
               where tenant_id = $1`,
              [actor.tenantId],
            );

            const supportsGpa = profileQuery.rows[0] ? Boolean((profileQuery.rows[0] as { supports_gpa: boolean }).supports_gpa) : true;

            // Fetch section name
            const sectionQuery = await (client as unknown as { query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }> }).query(
              `select s.section_code
               from public.academy_course_sections s
               join public.academy_gradebook_assignments a
                 on a.tenant_id = s.tenant_id and a.section_id = s.id
               where a.tenant_id = $1 and a.id = $2`,
              [actor.tenantId, result.gradeRecord.assignmentId],
            );

            const sectionName = sectionQuery.rows[0] ? String((sectionQuery.rows[0] as { section_code: string }).section_code) : "Unknown Section";

            // For now, previousGpa is null (we would need to track this separately)
            const previousGpa = null;
            const onAcademicProbation = false; // Would need to query from academic standing

            await evaluateStudentGpaSignal(
              actor.tenantId,
              result.learnerPersonId,
              result.currentGpa,
              previousGpa,
              sectionName,
              onAcademicProbation,
              supportsGpa,
              shepherdRepo,
            );
          });
        } catch (err) {
          console.error("ShepherdAI GPA signal evaluation failed:", err instanceof Error ? err.message : String(err));
        }
      });

      return result.gradeRecord;
    });
  });
}
