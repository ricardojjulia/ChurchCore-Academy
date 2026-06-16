import type { AcademyActor } from "@/modules/academy-auth/policy";
import type { GradebookQueryClient } from "@/lib/actions/gradebook/types";

const gradebookAdminRoles = new Set([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
]);

function hasAdminGradebookAccess(actor: AcademyActor) {
  return actor.roles.some((role) => gradebookAdminRoles.has(role));
}

export async function assertCanSubmitGradeTarget(
  client: GradebookQueryClient,
  actor: AcademyActor,
  input: {
    submissionId: string;
    assignmentId: string;
    learnerPersonId: string;
  },
) {
  const result = await client.query<{ can_write: boolean }>(
    `
      select true as can_write
      from public.academy_gradebook_submissions submission
      join public.academy_gradebook_assignments assignment
        on assignment.tenant_id = submission.tenant_id
       and assignment.id = submission.assignment_id
      left join public.academy_course_sections section
        on section.tenant_id = assignment.tenant_id
       and section.id = assignment.section_id
      where submission.tenant_id = $1
        and submission.id = $2
        and assignment.id = $3
        and submission.learner_person_id = $4
        and (
          $6::boolean = true
          or section.primary_instructor_id = $5
          or section.assistant_instructor_ids ? $5
        )
      limit 1
    `,
    [
      actor.tenantId,
      input.submissionId,
      input.assignmentId,
      input.learnerPersonId,
      actor.userId,
      hasAdminGradebookAccess(actor),
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Forbidden gradebook write access.");
  }
}

export async function assertCanOverrideGradeTarget(
  client: GradebookQueryClient,
  actor: AcademyActor,
  input: { gradeRecordId: string },
) {
  const result = await client.query<{ can_write: boolean }>(
    `
      select true as can_write
      from public.academy_gradebook_records record
      join public.academy_gradebook_assignments assignment
        on assignment.tenant_id = record.tenant_id
       and assignment.id = record.assignment_id
      left join public.academy_course_sections section
        on section.tenant_id = assignment.tenant_id
       and section.id = assignment.section_id
      where record.tenant_id = $1
        and record.id = $2
        and (
          $4::boolean = true
          or section.primary_instructor_id = $3
          or section.assistant_instructor_ids ? $3
        )
      limit 1
    `,
    [
      actor.tenantId,
      input.gradeRecordId,
      actor.userId,
      hasAdminGradebookAccess(actor),
    ],
  );

  if (!result.rows[0]) {
    throw new Error("Forbidden gradebook override access.");
  }
}
