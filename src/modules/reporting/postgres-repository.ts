import { getDatabasePool } from "@/lib/database";
import type {
  ReportDataset,
  ReportId,
  ReportRepository,
  ReportRow,
} from "@/modules/reporting/types";

interface QueryResult {
  rows: Record<string, unknown>[];
}

export interface ReportingDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function dateOnly(value: unknown) {
  if (value == null) return "";
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function moneyFromCents(value: unknown) {
  return (Number(value ?? 0) / 100).toFixed(2);
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export class PostgresReportRepository implements ReportRepository {
  constructor(
    private readonly database: ReportingDatabase = getDatabasePool() as ReportingDatabase,
  ) {}

  async readDataset(tenantId: string): Promise<ReportDataset> {
    const enrollment = await this.readEnrollment(tenantId);
    const admissions = await this.readAdmissions(tenantId);
    const attendance = await this.readAttendance(tenantId);
    const grades = await this.readGrades(tenantId);
    const transcripts = await this.readTranscripts(tenantId);
    const billing = await this.readBilling(tenantId);
    const aid = await this.readAid(tenantId);
    const retention = await this.readRetention(tenantId);
    const programCompletion = await this.readProgramCompletion(tenantId);

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      reports: {
        enrollment,
        admissions,
        attendance,
        grades,
        transcripts,
        billing,
        aid,
        retention,
        program_completion: programCompletion,
      } satisfies Record<ReportId, ReportRow[]>,
    };
  }

  private async readEnrollment(tenantId: string): Promise<ReportRow[]> {
    const result = await this.database.query(
      `select
         sp.student_number,
         person.display_name as student_name,
         coalesce(program.name, 'Unassigned') as program,
         sp.enrollment_status,
         coalesce(period.name, '') as active_term,
         0 as credits_earned
       from academy_student_profiles sp
       join academy_people person
         on person.tenant_id = sp.tenant_id
        and person.id = sp.person_id
       left join academy_programs program
         on program.tenant_id = sp.tenant_id
        and program.id = sp.program_id
       left join lateral (
         select ap.name
           from academy_period_registrations pr
           join academy_academic_periods ap
             on ap.tenant_id = pr.tenant_id
            and ap.id = pr.academic_period_id
          where pr.tenant_id = sp.tenant_id
            and pr.student_profile_id = sp.id
            and pr.status = 'registered'
          order by pr.registered_at desc
          limit 1
       ) period on true
       where sp.tenant_id = $1
       order by sp.student_number asc`,
      [tenantId],
    );

    return result.rows.map((row) => ({
      studentNumber: String(row.student_number),
      studentName: String(row.student_name),
      program: String(row.program),
      status: String(row.enrollment_status),
      activeTerm: String(row.active_term ?? ""),
      creditsEarned: Number(row.credits_earned),
    }));
  }

  private async readAdmissions(tenantId: string): Promise<ReportRow[]> {
    const result = await this.database.query(
      `select
         app.id,
         coalesce(app.preferred_name, app.legal_name) as applicant_name,
         app.status,
         coalesce(program.name, 'Unassigned') as program,
         app.submitted_at,
         app.decided_at
       from academy_admission_applications app
       left join academy_programs program
         on program.tenant_id = app.tenant_id
        and program.id = app.program_id
       where app.tenant_id = $1
       order by app.updated_at desc`,
      [tenantId],
    );

    return result.rows.map((row) => ({
      applicationId: String(row.id),
      applicantName: String(row.applicant_name),
      status: String(row.status),
      program: String(row.program),
      submittedAt: dateOnly(row.submitted_at),
      decidedAt: dateOnly(row.decided_at),
    }));
  }

  private async readAttendance(tenantId: string): Promise<ReportRow[]> {
    const result = await this.database.query(
      `select
         section.section_code,
         coalesce(section.title_override, course.title) as section_title,
         person.display_name as student_name,
         count(*) filter (where attendance.status in ('present', 'late')) as present_count,
         count(*) filter (where attendance.status = 'absent') as absent_count,
         count(*) as total_count
       from academy_attendance_records attendance
       join academy_course_sections section
         on section.tenant_id = attendance.tenant_id
        and section.id = attendance.course_section_id
       join academy_courses course
         on course.tenant_id = section.tenant_id
        and course.id = section.course_id
       join academy_people person
         on person.tenant_id = attendance.tenant_id
        and person.id = attendance.student_person_id
       where attendance.tenant_id = $1
       group by section.section_code, section_title, person.display_name
       order by section.section_code asc, person.display_name asc`,
      [tenantId],
    );

    return result.rows.map((row) => {
      const present = Number(row.present_count);
      const absent = Number(row.absent_count);
      const total = Number(row.total_count);
      return {
        sectionCode: String(row.section_code),
        sectionTitle: String(row.section_title),
        studentName: String(row.student_name),
        presentCount: present,
        absentCount: absent,
        attendanceRate: percent(present, total),
      };
    });
  }

  private async readGrades(tenantId: string): Promise<ReportRow[]> {
    const result = await this.database.query(
      `select
         coalesce(course.code, summary.course_id) as section_code,
         coalesce(course.title, summary.course_id) as section_title,
         person.display_name as student_name,
         summary.final_percentage,
         coalesce(summary.academic_standing, 'unposted') as posted_status
       from academy_gradebook_course_summaries summary
       join academy_people person
         on person.tenant_id = summary.tenant_id
        and person.id = summary.learner_person_id
       left join academy_courses course
         on course.tenant_id = summary.tenant_id
        and course.id = summary.course_id
       where summary.tenant_id = $1
       order by section_code asc, person.display_name asc`,
      [tenantId],
    );

    return result.rows.map((row) => ({
      sectionCode: String(row.section_code),
      sectionTitle: String(row.section_title),
      studentName: String(row.student_name),
      finalScore: row.final_percentage != null ? Number(row.final_percentage).toFixed(1) : "",
      postedStatus: String(row.posted_status),
    }));
  }

  private async readTranscripts(tenantId: string): Promise<ReportRow[]> {
    const result = await this.database.query(
      `select
         person.display_name as student_name,
         transcript.status,
         transcript.delivery_method,
         transcript.issued_at,
         case when transcript.status = 'held' then coalesce(transcript.hold_reason, 'held') else 'none' end as hold_status
       from academy_transcript_issuances transcript
       join academy_people person
         on person.tenant_id = transcript.tenant_id
        and person.id = transcript.student_person_id
       where transcript.tenant_id = $1
       order by transcript.requested_at desc`,
      [tenantId],
    );

    return result.rows.map((row) => ({
      studentName: String(row.student_name),
      requestStatus: String(row.status),
      deliveryMethod: String(row.delivery_method),
      issuedAt: dateOnly(row.issued_at),
      holdStatus: String(row.hold_status),
    }));
  }

  private async readBilling(tenantId: string): Promise<ReportRow[]> {
    const result = await this.database.query(
      `select
         person.display_name as student_name,
         ledger.entry_type,
         ledger.amount_cents,
         ledger.description,
         ledger.posted_at
       from academy_billing_ledger_entries ledger
       join academy_people person
         on person.tenant_id = ledger.tenant_id
        and person.id = ledger.student_person_id
       where ledger.tenant_id = $1
       order by ledger.posted_at desc`,
      [tenantId],
    );

    return result.rows.map((row) => ({
      studentName: String(row.student_name),
      entryType: String(row.entry_type),
      amount: moneyFromCents(row.amount_cents),
      description: String(row.description),
      postedAt: dateOnly(row.posted_at),
    }));
  }

  private async readAid(tenantId: string): Promise<ReportRow[]> {
    const result = await this.database.query(
      `select
         person.display_name as student_name,
         pkg.aid_year,
         award.status as award_status,
         award.amount_cents as accepted_amount_cents,
         coalesce(sum(disb.amount_cents) filter (where disb.status = 'posted'), 0) as posted_amount_cents
       from academy_aid_awards award
       join academy_aid_packages pkg
         on pkg.tenant_id = award.tenant_id
        and pkg.id = award.package_id
       join academy_people person
         on person.tenant_id = award.tenant_id
        and person.id = award.student_person_id
       left join academy_aid_disbursements disb
         on disb.tenant_id = award.tenant_id
        and disb.award_id = award.id
       where award.tenant_id = $1
       group by person.display_name, pkg.aid_year, award.status, award.amount_cents, award.created_at
       order by award.created_at desc`,
      [tenantId],
    );

    return result.rows.map((row) => ({
      studentName: String(row.student_name),
      aidYear: String(row.aid_year),
      awardStatus: String(row.award_status),
      acceptedAmount: moneyFromCents(row.accepted_amount_cents),
      postedAmount: moneyFromCents(row.posted_amount_cents),
    }));
  }

  private async readRetention(tenantId: string): Promise<ReportRow[]> {
    const enrollment = await this.readEnrollment(tenantId);
    return enrollment.map((row) => ({
      studentName: row.studentName,
      status: row.status,
      activeTerm: row.activeTerm,
      riskFlag: row.status === "active" && row.activeTerm ? "good_standing" : "review_required",
    }));
  }

  private async readProgramCompletion(tenantId: string): Promise<ReportRow[]> {
    const result = await this.database.query(
      `select
         person.display_name as student_name,
         coalesce(program.name, 'Unassigned') as program,
         0 as credits_earned,
         coalesce(program.required_credits, 0) as required_credits
       from academy_student_profiles sp
       join academy_people person
         on person.tenant_id = sp.tenant_id
        and person.id = sp.person_id
       left join academy_programs program
         on program.tenant_id = sp.tenant_id
        and program.id = sp.program_id
       where sp.tenant_id = $1
       order by person.display_name asc`,
      [tenantId],
    );

    return result.rows.map((row) => {
      const earned = Number(row.credits_earned);
      const required = Number(row.required_credits);
      return {
        studentName: String(row.student_name),
        program: String(row.program),
        creditsEarned: earned,
        requiredCredits: required,
        completionPercent: percent(earned, required),
      };
    });
  }
}
