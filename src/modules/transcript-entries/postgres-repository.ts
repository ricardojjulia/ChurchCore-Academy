import { getDatabasePool } from "@/lib/database";
import type {
  TranscriptEntry,
  TranscriptEntryCandidate,
  TranscriptEntryRepository,
} from "./types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface TranscriptEntryDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function optionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function timestamp(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapEntry(row: Record<string, unknown>): TranscriptEntry {
  return {
    id: String(row.id),
    studentProfileId: String(row.student_profile_id),
    studentPersonId: String(row.student_person_id),
    courseSectionRegistrationId: String(row.course_section_registration_id),
    academicProgramId: String(row.academic_program_id),
    catalogAcademicYearId: String(row.catalog_academic_year_id),
    academicPeriodId: String(row.academic_period_id),
    academicPeriodName: String(row.academic_period_name),
    courseId: String(row.course_id),
    courseCode: String(row.course_code),
    courseTitle: String(row.course_title),
    creditsEarned: Number(row.credits_earned),
    finalLetterGrade: row.final_letter_grade != null ? String(row.final_letter_grade) : undefined,
    finalPercentage: optionalNumber(row.final_percentage),
    gpaPoints: optionalNumber(row.gpa_points),
    isPassing: Boolean(row.is_passing),
    postedAt: timestamp(row.posted_at),
    postedByPersonId: String(row.posted_by_person_id),
  };
}

const ENTRY_SELECT = `
  select id, student_profile_id, student_person_id,
         course_section_registration_id, academic_program_id,
         catalog_academic_year_id, academic_period_id, academic_period_name,
         course_id, course_code, course_title, credits_earned,
         final_letter_grade, final_percentage, gpa_points, is_passing,
         posted_at, posted_by_person_id
    from public.academy_transcript_entries
`;

const CANDIDATE_SELECT = `
  select registration.id as course_section_registration_id,
         registration.student_profile_id,
         registration.student_person_id,
         registration.program_enrollment_id,
         membership.academic_program_id,
         membership.catalog_academic_year_id,
         section.academic_period_id,
         period.name as academic_period_name,
         section.id as course_section_id,
         course.id as course_id,
         course.code as course_code,
         course.title as course_title,
         coalesce(course.default_credits, 0) as credits_earned,
         summary.final_letter_grade,
         summary.final_percentage,
         summary.final_gpa_points,
         coalesce(summary.is_passing, false) as is_passing,
         grade_record.id as source_grade_record_id
    from public.academy_course_section_registrations registration
    join public.academy_course_sections section
      on section.tenant_id = registration.tenant_id
     and section.id = registration.course_section_id
    join public.academy_courses course
      on course.tenant_id = section.tenant_id
     and course.id = section.course_id
     and course.record_type = 'transcript'
    join public.academy_academic_periods period
      on period.tenant_id = section.tenant_id
     and period.id = section.academic_period_id
    join public.academy_program_enrollments membership
      on membership.tenant_id = registration.tenant_id
     and membership.id = registration.program_enrollment_id
     and membership.academic_program_id is not null
     and membership.catalog_academic_year_id is not null
    join public.academy_gradebook_course_summaries summary
      on summary.tenant_id = registration.tenant_id
     and summary.course_id = section.course_id
     and summary.learner_person_id = registration.student_person_id
     and summary.enrollment_id = registration.program_enrollment_id
     and summary.final_letter_grade is not null
    join lateral (
      select record.id
        from public.academy_gradebook_records record
        join public.academy_gradebook_assignments assignment
          on assignment.tenant_id = record.tenant_id
         and assignment.id = record.assignment_id
       where record.tenant_id = registration.tenant_id
         and record.learner_person_id = registration.student_person_id
         and record.posting_status = 'posted'
         and assignment.section_id = registration.course_section_id
       order by record.posted_at desc nulls last, record.graded_at desc
       limit 1
    ) grade_record on true
`;

export class PostgresTranscriptEntryRepository implements TranscriptEntryRepository {
  constructor(
    private readonly database: TranscriptEntryDatabase = getDatabasePool() as TranscriptEntryDatabase,
  ) {}

  async listByStudent(tenantId: string, studentProfileId: string): Promise<TranscriptEntry[]> {
    const result = await this.database.query(
      `${ENTRY_SELECT}
        where tenant_id = $1 and student_profile_id = $2
        order by posted_at desc, course_code asc`,
      [tenantId, studentProfileId],
    );
    return result.rows.map(mapEntry);
  }

  async listCandidates(tenantId: string, studentProfileId: string): Promise<TranscriptEntryCandidate[]> {
    const result = await this.database.query(
      `${CANDIDATE_SELECT}
        where registration.tenant_id = $1
          and registration.student_profile_id = $2
          and registration.status = 'completed'
          and not exists (
            select 1 from public.academy_transcript_entries existing
             where existing.tenant_id = registration.tenant_id
               and existing.course_section_registration_id = registration.id
          )
        order by period.ends_on desc, course.code asc`,
      [tenantId, studentProfileId],
    );
    return result.rows.map((row) => ({
      courseSectionRegistrationId: String(row.course_section_registration_id ?? row.id),
      academicPeriodName: String(row.academic_period_name),
      courseCode: String(row.course_code),
      courseTitle: String(row.course_title),
      creditsEarned: Number(row.credits_earned),
      finalLetterGrade: row.final_letter_grade != null ? String(row.final_letter_grade) : undefined,
      isPassing: Boolean(row.is_passing),
    }));
  }

  async createFromRegistration(
    tenantId: string,
    studentProfileId: string,
    registrationId: string,
    actorPersonId: string,
  ): Promise<TranscriptEntry> {
    const existing = await this.database.query(
      `${ENTRY_SELECT}
        where tenant_id = $1 and course_section_registration_id = $2
        limit 1`,
      [tenantId, registrationId],
    );
    if (existing.rows[0]) return mapEntry(existing.rows[0]);

    const source = await this.database.query(
      `${CANDIDATE_SELECT}
        where registration.tenant_id = $1
          and registration.student_profile_id = $2
          and registration.id = $3
          and registration.status = 'completed'
        for update of registration`,
      [tenantId, studentProfileId, registrationId],
    );
    const row = source.rows[0];
    if (!row) {
      throw new Error("Completed enrollment with a posted final grade was not found.");
    }

    const inserted = await this.database.query(
      `insert into public.academy_transcript_entries (
         tenant_id, student_profile_id, student_person_id,
         program_enrollment_id, course_section_registration_id,
         academic_program_id, catalog_academic_year_id,
         academic_period_id, academic_period_name, course_section_id,
         course_id, course_code, course_title, credits_earned,
         final_letter_grade, final_percentage, gpa_points, is_passing,
         source_grade_record_id, posted_by_person_id
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
       )
       returning id, student_profile_id, student_person_id,
                 course_section_registration_id, academic_program_id,
                 catalog_academic_year_id, academic_period_id, academic_period_name,
                 course_id, course_code, course_title, credits_earned,
                 final_letter_grade, final_percentage, gpa_points, is_passing,
                 posted_at, posted_by_person_id`,
      [
        tenantId,
        String(row.student_profile_id),
        String(row.student_person_id),
        String(row.program_enrollment_id),
        registrationId,
        String(row.academic_program_id),
        String(row.catalog_academic_year_id),
        String(row.academic_period_id),
        String(row.academic_period_name),
        String(row.course_section_id),
        String(row.course_id),
        String(row.course_code),
        String(row.course_title),
        Number(row.credits_earned),
        row.final_letter_grade ?? null,
        row.final_percentage ?? null,
        row.final_gpa_points ?? null,
        Boolean(row.is_passing),
        String(row.source_grade_record_id),
        actorPersonId,
      ],
    );
    const entryRow = inserted.rows[0];
    if (!entryRow) throw new Error("Transcript entry was not created.");

    await this.database.query(
      `insert into public.academy_transcript_entry_events (
         tenant_id, transcript_entry_id, actor_person_id, event_type, reason
       ) values ($1,$2,$3,'posted',$4)`,
      [tenantId, String(entryRow.id), actorPersonId, "Completed course result posted to transcript."],
    );

    return mapEntry(entryRow);
  }
}
