export interface GpaResult {
  gpa: number | null;
  creditsEarned: number;
  creditsAttempted: number;
}

export interface GpaQueryClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

interface GradeRecordRow {
  grade_value: string | null;
  letter_grade: string | null;
  credit_hours: number;
  gpa_points: number | null;
  is_passing: boolean | null;
}

export async function computeStudentGpa(
  tenantId: string,
  studentId: string,
  client: GpaQueryClient,
): Promise<GpaResult> {
  const result = await client.query(
    `
      select distinct on (course.id, r.id)
        r.letter_grade as grade_value,
        r.letter_grade,
        coalesce(course.default_credits, 0) as credit_hours,
        e.gpa_points,
        r.is_passing
      from public.academy_gradebook_records r
      join public.academy_gradebook_assignments a
        on a.tenant_id = r.tenant_id
       and a.id = r.assignment_id
      join public.academy_courses course
        on course.tenant_id = a.tenant_id
       and course.id = a.course_id
      left join public.academy_gradebook_scales scale
        on scale.tenant_id = a.tenant_id
       and scale.id = a.grading_scale_id
      left join public.academy_gradebook_scale_entries e
        on e.tenant_id = scale.tenant_id
       and e.scale_id = scale.id
       and e.letter_grade = r.letter_grade
      where r.tenant_id = $1
        and r.learner_person_id = $2
        and r.letter_grade is not null
        and r.letter_grade != 'I'
      order by course.id, r.id, r.graded_at desc
    `,
    [tenantId, studentId],
  );

  let qualityPoints = 0;
  let gpaCredits = 0;
  let creditsEarned = 0;
  let creditsAttempted = 0;

  for (const rawRow of result.rows) {
    const row = rawRow as GradeRecordRow;
    const creditHours = Number(row.credit_hours);
    const gradeValue = row.grade_value ?? row.letter_grade ?? "";

    creditsAttempted += creditHours;

    if (row.is_passing || gradeValue === "P") {
      creditsEarned += creditHours;
    }

    // Only include in GPA if it has quality points and is not Pass/Fail
    if (
      gradeValue !== "P" &&
      gradeValue !== "I" &&
      row.gpa_points !== null &&
      creditHours > 0
    ) {
      qualityPoints += Number(row.gpa_points) * creditHours;
      gpaCredits += creditHours;
    }
  }

  if (gpaCredits === 0) {
    return { gpa: null, creditsEarned, creditsAttempted };
  }

  const gpa = Math.round((qualityPoints / gpaCredits) * 100) / 100;
  return { gpa, creditsEarned, creditsAttempted };
}
