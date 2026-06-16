"use server";

import { defaultGradebookActionDependencies } from "@/lib/actions/gradebook/dependencies";
import { toGradebookActionError } from "@/lib/actions/gradebook/errors";
import type {
  GradebookActionDependencies,
  GradebookActionResult,
} from "@/lib/actions/gradebook/types";
import { assertGradebookOverrideAccess } from "@/lib/gradebook/policy";
import { overrideGradeSchema, type OverrideGradeInput } from "@/lib/gradebook/schemas";

interface CurrentGradeRecord {
  id: string;
  points_earned: string | number | null;
  letter_grade: string | null;
  is_passing: boolean | null;
}

export interface OverrideGradeResult {
  gradeRecordId: string;
  auditWritten: true;
}

export async function overrideGradeAction(
  input: OverrideGradeInput,
  dependencies: GradebookActionDependencies = defaultGradebookActionDependencies,
): Promise<GradebookActionResult<OverrideGradeResult>> {
  try {
    const parsed = overrideGradeSchema.parse(input);
    const actor = await dependencies.resolveActor();
    assertGradebookOverrideAccess(actor);

    const data = await dependencies.runInDatabaseContext(actor, async (client) => {
      const existing = await client.query<CurrentGradeRecord>(
        `
          select id, points_earned, letter_grade, is_passing
          from public.academy_gradebook_records
          where tenant_id = $1 and id = $2
          for update
        `,
        [actor.tenantId, parsed.gradeRecordId],
      );

      const current = existing.rows[0];
      if (!current) {
        throw new Error("Gradebook record target not found.");
      }

      await client.query(
        `
          update public.academy_gradebook_records
          set
            points_earned = $3,
            original_points = coalesce(original_points, points_earned),
            is_overridden = true,
            override_reason = $4,
            override_at = now(),
            override_by_person_id = $5,
            updated_at = now()
          where tenant_id = $1 and id = $2
        `,
        [
          actor.tenantId,
          parsed.gradeRecordId,
          parsed.pointsEarned,
          parsed.reason,
          actor.userId,
        ],
      );

      await client.query(
        `
          insert into public.academy_gradebook_override_audit (
            tenant_id,
            grade_record_id,
            overridden_by_person_id,
            override_type,
            previous_value,
            new_value,
            reason
          ) values (
            $1,
            $2,
            $3,
            'assignment_grade',
            $4::jsonb,
            $5::jsonb,
            $6
          )
        `,
        [
          actor.tenantId,
          parsed.gradeRecordId,
          actor.userId,
          JSON.stringify({
            pointsEarned: current.points_earned,
            letterGrade: current.letter_grade,
            isPassing: current.is_passing,
          }),
          JSON.stringify({ pointsEarned: parsed.pointsEarned }),
          parsed.reason,
        ],
      );

      return { gradeRecordId: parsed.gradeRecordId, auditWritten: true as const };
    });

    dependencies.revalidate("/dashboard/admin/gradebook");
    dependencies.revalidate("/dashboard/faculty/gradebook");
    dependencies.revalidate("/dashboard/student/grades");

    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: toGradebookActionError(error) };
  }
}
