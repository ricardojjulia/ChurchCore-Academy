import type { TranscriptPdfData, TranscriptGradeRow } from "./pdf-generator";

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

  // Fetch immutable transcript snapshots.
  const gradeResult = await client.query(
    `select academic_period_name as term_name,
            course_code,
            course_title,
            credits_earned as credit_hours,
            final_letter_grade as grade,
            gpa_points as quality_points,
            is_passing
       from public.academy_transcript_entries
      where tenant_id = $1
        and student_person_id = $2
      order by posted_at asc, course_code asc`,
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

  const gpaRows = gradeResult.rows.filter((row) => row.quality_points != null);
  const qualityCredits = gpaRows.reduce((total, row) => total + Number(row.credit_hours ?? 0), 0);
  const cumulativeGpa = qualityCredits > 0
    ? Math.round(
      (gpaRows.reduce(
        (total, row) => total + Number(row.quality_points) * Number(row.credit_hours ?? 0),
        0,
      ) / qualityCredits) * 100,
    ) / 100
    : null;
  const creditsEarned = gradeResult.rows
    .filter((row) => Boolean(row.is_passing))
    .reduce((total, row) => total + Number(row.credit_hours ?? 0), 0);

  return {
    institution,
    studentName,
    studentId,
    programName,
    cumulativeGpa,
    creditsEarned,
    issuanceId,
    issuanceDate,
    gradeRows,
  };
}
