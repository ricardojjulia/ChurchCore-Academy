"use server";

import { defaultGradebookActionDependencies } from "@/lib/actions/gradebook/dependencies";
import { toGradebookActionError } from "@/lib/actions/gradebook/errors";
import type {
  GradebookActionDependencies,
  GradebookActionResult,
} from "@/lib/actions/gradebook/types";
import { assertCanSubmitGradeTarget } from "@/lib/actions/gradebook/authorization";
import { assertGradebookWriteAccess } from "@/lib/gradebook/policy";
import { submitGradeSchema, type SubmitGradeInput } from "@/lib/gradebook/schemas";

export interface SubmitGradeResult {
  gradeRecordId: string;
}

export async function submitGradeAction(
  input: SubmitGradeInput,
  dependencies: GradebookActionDependencies = defaultGradebookActionDependencies,
): Promise<GradebookActionResult<SubmitGradeResult>> {
  try {
    const parsed = submitGradeSchema.parse(input);
    const actor = await dependencies.resolveActor();
    assertGradebookWriteAccess(actor);

    const data = await dependencies.runInDatabaseContext(actor, async (client) => {
      await assertCanSubmitGradeTarget(client, actor, {
        submissionId: parsed.submissionId,
        assignmentId: parsed.assignmentId,
        learnerPersonId: parsed.learnerPersonId,
      });

      const result = await client.query<{ id: string }>(
        `
          insert into public.academy_gradebook_records (
            tenant_id,
            submission_id,
            assignment_id,
            learner_person_id,
            graded_by_person_id,
            points_earned,
            max_points,
            letter_grade,
            is_passing,
            instructor_feedback,
            sensitivity_tier,
            graded_at,
            updated_at
          )
          select
            submission.tenant_id,
            submission.id,
            assignment.id,
            submission.learner_person_id,
            $5,
            $6,
            assignment.max_points,
            $7,
            $8,
            $9,
            $10,
            now(),
            now()
          from public.academy_gradebook_submissions submission
          join public.academy_gradebook_assignments assignment
            on assignment.tenant_id = submission.tenant_id
           and assignment.id = submission.assignment_id
          where submission.tenant_id = $1
            and submission.id = $2
            and assignment.id = $3
            and submission.learner_person_id = $4
          on conflict (tenant_id, submission_id)
          do update set
            graded_by_person_id = excluded.graded_by_person_id,
            points_earned = excluded.points_earned,
            max_points = excluded.max_points,
            letter_grade = excluded.letter_grade,
            is_passing = excluded.is_passing,
            instructor_feedback = excluded.instructor_feedback,
            sensitivity_tier = excluded.sensitivity_tier,
            graded_at = now(),
            updated_at = now()
          returning id
        `,
        [
          actor.tenantId,
          parsed.submissionId,
          parsed.assignmentId,
          parsed.learnerPersonId,
          actor.userId,
          parsed.pointsEarned,
          parsed.letterGrade ?? null,
          parsed.isPassing ?? null,
          parsed.instructorFeedback ?? null,
          parsed.sensitivityTier,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error("Gradebook record target not found.");
      }

      await client.query(
        `
          update public.academy_gradebook_submissions
          set status = 'graded', updated_at = now()
          where tenant_id = $1 and id = $2
        `,
        [actor.tenantId, parsed.submissionId],
      );

      return { gradeRecordId: row.id };
    });

    dependencies.revalidate("/dashboard/faculty/gradebook");
    dependencies.revalidate("/dashboard/student/grades");

    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: toGradebookActionError(error) };
  }
}
