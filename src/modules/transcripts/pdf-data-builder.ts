import type { TranscriptPdfData, TranscriptGradeRow } from "./pdf-generator";
import { computeStudentGpa, type GpaQueryClient } from "@/modules/grading-records/gpa-calculator";

interface TranscriptDataQueryClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

interface BuildTranscriptPdfDataInput {
  tenantId: string;
  studentPersonId: string;
  issuanceId: string;
  issuanceDate: string;
  client: TranscriptDataQueryClient;
}

export async function buildTranscriptPdfData(
  input: BuildTranscriptPdfDataInput,
): Promise<TranscriptPdfData> {
  const { tenantId, studentPersonId, issuanceId, issuanceDate, client } = input;

  // Fetch institution profile
  const institutionResult = await client.query(
    `select tenant_id, institution_name
       from public.academy_institution_profiles
      where tenant_id = $1`,
    [tenantId],
  );

  if (institutionResult.rows.length === 0) {
    throw new Error(`Institution profile for tenant ${tenantId} not found.`);
  }

  const institution = {
    tenantId: String(institutionResult.rows[0].tenant_id),
    institutionName: String(institutionResult.rows[0].institution_name),
  };

  // Fetch student profile
  const studentResult = await client.query(
    `select p.id, p.preferred_name, p.first_name, p.last_name,
            s.student_number, s.program_name
       from public.academy_people p
       join public.academy_students s
         on s.tenant_id = p.tenant_id
        and s.person_id = p.id
      where p.tenant_id = $1
        and p.id = $2`,
    [tenantId, studentPersonId],
  );

  if (studentResult.rows.length === 0) {
    throw new Error(`Student ${studentPersonId} not found in tenant ${tenantId}.`);
  }

  const student = studentResult.rows[0];
  const studentName = student.preferred_name
    ? String(student.preferred_name)
    : `${student.first_name} ${student.last_name}`;
  const studentId = String(student.student_number ?? studentPersonId);
  const programName = String(student.program_name ?? "General Studies");

  // Fetch grade records (only posted, released-to-student records for transcript courses)
  const gradeResult = await client.query(
    `select distinct on (course.id, r.id)
       term.name as term_name,
       course.code as course_code,
       course.title as course_title,
       coalesce(course.default_credits, 0) as credit_hours,
       r.letter_grade as grade,
       e.gpa_points as quality_points
     from public.academy_gradebook_records r
     join public.academy_gradebook_assignments a
       on a.tenant_id = r.tenant_id
      and a.id = r.assignment_id
     join public.academy_courses course
       on course.tenant_id = a.tenant_id
      and course.id = a.course_id
     left join public.academy_terms term
       on term.tenant_id = course.tenant_id
      and term.id = course.term_id
     left join public.academy_gradebook_scales scale
       on scale.tenant_id = a.tenant_id
      and scale.id = a.grading_scale_id
     left join public.academy_gradebook_scale_entries e
       on e.tenant_id = scale.tenant_id
      and e.scale_id = scale.id
      and e.letter_grade = r.letter_grade
     where r.tenant_id = $1
       and r.learner_person_id = $2
       and r.posting_status = 'posted'
       and r.released_to_student_at is not null
       and course.record_type = 'transcript'
       and r.letter_grade is not null
     order by course.id, r.id, r.graded_at desc`,
    [tenantId, studentPersonId],
  );

  const gradeRows: TranscriptGradeRow[] = gradeResult.rows.map((row) => ({
    termName: String(row.term_name ?? "N/A"),
    courseCode: String(row.course_code),
    courseTitle: String(row.course_title),
    creditHours: Number(row.credit_hours),
    grade: String(row.grade),
    qualityPoints: row.quality_points !== null ? Number(row.quality_points) : null,
  }));

  // Compute GPA using the existing calculator
  const gpaResult = await computeStudentGpa(
    tenantId,
    studentPersonId,
    client as GpaQueryClient,
  );

  return {
    institution,
    studentName,
    studentId,
    programName,
    cumulativeGpa: gpaResult.gpa,
    creditsEarned: gpaResult.creditsEarned,
    issuanceId,
    issuanceDate,
    gradeRows,
  };
}
