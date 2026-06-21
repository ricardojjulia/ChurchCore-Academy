"use server";

import { defaultGradebookActionDependencies } from "@/lib/actions/gradebook/dependencies";
import { toGradebookActionError } from "@/lib/actions/gradebook/errors";
import type {
  GradebookActionDependencies,
  GradebookActionResult,
} from "@/lib/actions/gradebook/types";
import { assertGradebookAdminAccess } from "@/lib/gradebook/policy";
import { postGradeSchema, type PostGradeInput } from "@/lib/gradebook/schemas";

interface CurrentGradePostingRecord {
  id: string;
  posting_status: string;
}

export interface PostGradeResult {
  gradeRecordId: string;
  postingStatus: "posted";
  auditWritten: true;
}

export async function postGradeAction(
  input: PostGradeInput,
  dependencies: GradebookActionDependencies = defaultGradebookActionDependencies,
): Promise<GradebookActionResult<PostGradeResult>> {
  try {
    const parsed = postGradeSchema.parse(input);
    const actor = await dependencies.resolveActor();
    assertGradebookAdminAccess(actor);

    const data = await dependencies.runInDatabaseContext(actor, async (client) => {
      const existing = await client.query<CurrentGradePostingRecord>(
        `
          select id, posting_status
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
            posting_status = 'posted',
            posted_at = now(),
            posted_by_person_id = $3,
            released_to_student_at = case when $4::boolean then now() else released_to_student_at end,
            updated_at = now()
          where tenant_id = $1 and id = $2
        `,
        [
          actor.tenantId,
          parsed.gradeRecordId,
          actor.userId,
          parsed.releaseToStudent,
        ],
      );

      await client.query(
        `
          insert into public.academy_gradebook_posting_events (
            tenant_id,
            grade_record_id,
            actor_person_id,
            event_type,
            previous_status,
            new_status,
            reason,
            redacted_metadata
          ) values (
            $1,
            $2,
            $3,
            'posted',
            $4,
            'posted',
            $5,
            $6::jsonb
          )
        `,
        [
          actor.tenantId,
          parsed.gradeRecordId,
          actor.userId,
          current.posting_status,
          parsed.reason,
          JSON.stringify({ releaseToStudent: parsed.releaseToStudent }),
        ],
      );

      return {
        gradeRecordId: parsed.gradeRecordId,
        postingStatus: "posted" as const,
        auditWritten: true as const,
      };
    });

    dependencies.revalidate("/dashboard/admin/gradebook");
    dependencies.revalidate("/dashboard/faculty/gradebook");
    dependencies.revalidate("/dashboard/student/grades");

    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: toGradebookActionError(error) };
  }
}
