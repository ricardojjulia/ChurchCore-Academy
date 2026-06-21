import { getDatabasePool } from "@/lib/database";
import type {
  AttendanceRecord,
  AttendanceRepository,
  RecordAttendanceInput,
} from "./types";

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface AttendanceDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function mapRow(row: Record<string, unknown>): AttendanceRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    courseSectionId: String(row.course_section_id),
    studentPersonId: String(row.student_person_id),
    sessionDate: String(row.session_date).slice(0, 10),
    status: String(row.status) as AttendanceRecord["status"],
    recordedAt: row.recorded_at instanceof Date
      ? row.recorded_at.toISOString()
      : String(row.recorded_at),
    recordedByPersonId: String(row.recorded_by_person_id),
    note: row.note != null ? String(row.note) : undefined,
  };
}

export class PostgresAttendanceRepository implements AttendanceRepository {
  constructor(
    private readonly database: AttendanceDatabase = getDatabasePool() as AttendanceDatabase,
  ) {}

  async upsert(input: RecordAttendanceInput): Promise<AttendanceRecord> {
    const result = await this.database.query(
      `insert into academy_attendance_records (
         tenant_id,
         course_section_id,
         student_person_id,
         session_date,
         status,
         recorded_by_person_id,
         note,
         recorded_at
       ) values ($1, $2, $3, $4::date, $5, $6, $7, now())
       on conflict (tenant_id, course_section_id, student_person_id, session_date)
       do update set
         status = excluded.status,
         recorded_by_person_id = excluded.recorded_by_person_id,
         note = excluded.note,
         recorded_at = now()
       returning
         id,
         tenant_id,
         course_section_id,
         student_person_id,
         session_date,
         status,
         recorded_at,
         recorded_by_person_id,
         note`,
      [
        input.tenantId,
        input.courseSectionId,
        input.studentPersonId,
        input.sessionDate,
        input.status,
        input.recordedByPersonId,
        input.note ?? null,
      ],
    );

    if (!result.rows[0]) {
      throw new Error("Attendance record upsert failed.");
    }

    return mapRow(result.rows[0]);
  }

  async canRecordSectionAttendance(input: {
    tenantId: string;
    courseSectionId: string;
    actorPersonId: string;
    hasAdminAccess: boolean;
  }): Promise<boolean> {
    const result = await this.database.query(
      `select true as can_record
         from academy_course_sections section
        where section.tenant_id = $1
          and section.id = $2
          and (
            $4::boolean = true
            or section.primary_instructor_id = $3
            or section.assistant_instructor_ids ? $3
          )
        limit 1`,
      [
        input.tenantId,
        input.courseSectionId,
        input.actorPersonId,
        input.hasAdminAccess,
      ],
    );

    return Boolean(result.rows[0]);
  }

  async isStudentActivelyRegistered(input: {
    tenantId: string;
    courseSectionId: string;
    studentPersonId: string;
  }): Promise<boolean> {
    const result = await this.database.query(
      `select true as registered
         from academy_course_section_registrations registration
        where registration.tenant_id = $1
          and registration.course_section_id = $2
          and registration.student_person_id = $3
          and registration.status in ('pending_confirmation', 'registered')
        limit 1`,
      [input.tenantId, input.courseSectionId, input.studentPersonId],
    );

    return Boolean(result.rows[0]);
  }

  async listBySection(
    tenantId: string,
    courseSectionId: string,
    sessionDate?: string,
  ): Promise<AttendanceRecord[]> {
    const values: unknown[] = [tenantId, courseSectionId];
    const dateClause = sessionDate ? " and session_date = $3::date" : "";
    if (sessionDate) values.push(sessionDate);

    const result = await this.database.query(
      `select id, tenant_id, course_section_id, student_person_id, session_date,
              status, recorded_at, recorded_by_person_id, note
         from academy_attendance_records
        where tenant_id = $1 and course_section_id = $2${dateClause}
        order by session_date desc, recorded_at desc`,
      values,
    );

    return result.rows.map(mapRow);
  }

  async listByStudent(
    tenantId: string,
    studentPersonId: string,
  ): Promise<AttendanceRecord[]> {
    const result = await this.database.query(
      `select id, tenant_id, course_section_id, student_person_id, session_date,
              status, recorded_at, recorded_by_person_id, note
         from academy_attendance_records
        where tenant_id = $1 and student_person_id = $2
        order by session_date desc, recorded_at desc
        limit 90`,
      [tenantId, studentPersonId],
    );

    return result.rows.map(mapRow);
  }
}
