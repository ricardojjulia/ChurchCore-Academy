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

      // Resolve the submission/assignment/learner target and its grading fields before touching
      // academy_gradebook_records at all — this also validates the target exists and belongs to
      // the claimed assignment/learner, same as the previous single-query INSERT's WHERE clause.
      const target = await client.query<{
        tenant_id: string;
        learner_person_id: string;
        max_points: string | number;
        sensitivity_tier: string;
      }>(
        `
          select
            submission.tenant_id,
            submission.learner_person_id,
            assignment.max_points,
            assignment.sensitivity_tier
          from public.academy_gradebook_submissions submission
          join public.academy_gradebook_assignments assignment
            on assignment.tenant_id = submission.tenant_id
           and assignment.id = submission.assignment_id
          where submission.tenant_id = $1
            and submission.id = $2
            and assignment.id = $3
            and submission.learner_person_id = $4
        `,
        [actor.tenantId, parsed.submissionId, parsed.assignmentId, parsed.learnerPersonId],
      );

      const targetRow = target.rows[0];
      if (!targetRow) {
        throw new Error("Gradebook record target not found.");
      }

      // Attempt the first-ever insert for this submission atomically via ON CONFLICT DO NOTHING
      // — if this is genuinely a new record, it wins the race outright against any concurrent
      // first submission for the same (tenant_id, submission_id) and we're done. If it conflicts
      // (a record already exists), fall through to the locked check-then-update path below rather
      // than trusting a value read before the conflict.
      const inserted = await client.query<{ id: string }>(
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
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now()
          )
          on conflict (tenant_id, submission_id) do nothing
          returning id
        `,
        [
          actor.tenantId,
          parsed.submissionId,
          parsed.assignmentId,
          targetRow.learner_person_id,
          actor.userId,
          parsed.pointsEarned,
          targetRow.max_points,
          parsed.letterGrade ?? null,
          parsed.isPassing ?? null,
          parsed.instructorFeedback ?? null,
          targetRow.sensitivity_tier,
        ],
      );

      let recordId: string;
      if (inserted.rows[0]) {
        recordId = inserted.rows[0].id;
      } else {
        // A record already exists — lock it before deciding what to do with it. This serializes
        // against postGradeAction's and overrideGradeAction's own `for update` locks on the same
        // row, closing a race where a stale resubmission could otherwise land between a
        // registrar's concurrent post and its own read of the "old" posting_status, silently
        // reverting work the registrar just completed. Found via PR #126 review.
        const existing = await client.query<{ id: string; posting_status: string }>(
          `
            select id, posting_status
            from public.academy_gradebook_records
            where tenant_id = $1 and submission_id = $2
            for update
          `,
          [actor.tenantId, parsed.submissionId],
        );

        const existingRow = existing.rows[0];
        if (!existingRow) {
          throw new Error("Gradebook record target not found.");
        }

        // Once a record has left "draft" — posted, held, or revoked — submitGradeAction is no
        // longer the right tool to change it. Silently reopening it to draft (the previous
        // behavior) let a stale/direct resubmission clear a registrar-held or -revoked record, or
        // undo a post that had just landed concurrently. Corrections to a non-draft record belong
        // in overrideGradeAction, which faculty already have access to and which carries a
        // required reason and an audit trail. Found via PR #126 review.
        if (existingRow.posting_status !== "draft") {
          throw new Error(
            `Cannot resubmit: this grade is already ${existingRow.posting_status}. Use the grade override workflow to make corrections.`,
          );
        }

        const updated = await client.query<{ id: string }>(
          `
            update public.academy_gradebook_records
            set
              graded_by_person_id = $3,
              points_earned = $4,
              max_points = $5,
              letter_grade = $6,
              is_passing = $7,
              instructor_feedback = $8,
              sensitivity_tier = $9,
              graded_at = now(),
              updated_at = now()
            where tenant_id = $1 and id = $2
            returning id
          `,
          [
            actor.tenantId,
            existingRow.id,
            actor.userId,
            parsed.pointsEarned,
            targetRow.max_points,
            parsed.letterGrade ?? null,
            parsed.isPassing ?? null,
            parsed.instructorFeedback ?? null,
            targetRow.sensitivity_tier,
          ],
        );
        recordId = updated.rows[0]!.id;
      }

      await client.query(
        `
          update public.academy_gradebook_submissions
          set status = 'graded', updated_at = now()
          where tenant_id = $1 and id = $2
        `,
        [actor.tenantId, parsed.submissionId],
      );

      return { gradeRecordId: recordId };
    });

    dependencies.revalidate("/dashboard/faculty/gradebook");
    dependencies.revalidate("/dashboard/student/grades");

    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: toGradebookActionError(error) };
  }
}
