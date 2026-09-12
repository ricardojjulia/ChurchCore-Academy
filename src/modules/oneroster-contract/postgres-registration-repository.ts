import { getDatabasePool } from "@/lib/database";

export interface OneRosterSectionRegistrationSource {
  id: string;
  tenantId: string;
  studentProfileId: string;
  studentPersonId: string;
  courseSectionId: string;
  status: string;
  registeredAt: string;
  updatedAt: string;
}

export interface OneRosterRegistrationRepository {
  listSectionRegistrations(tenantId: string): Promise<OneRosterSectionRegistrationSource[]>;
}

interface QueryResult {
  rows: Record<string, unknown>[];
}

export interface OneRosterRegistrationDatabase {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}

function timestampString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapRegistration(row: Record<string, unknown>): OneRosterSectionRegistrationSource {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentProfileId: String(row.student_profile_id),
    studentPersonId: String(row.student_person_id),
    courseSectionId: String(row.course_section_id),
    status: String(row.status),
    registeredAt: timestampString(row.registered_at),
    updatedAt: timestampString(row.updated_at),
  };
}

export class PostgresOneRosterRegistrationRepository implements OneRosterRegistrationRepository {
  constructor(private readonly database: OneRosterRegistrationDatabase = getDatabasePool() as OneRosterRegistrationDatabase) {}

  async listSectionRegistrations(tenantId: string): Promise<OneRosterSectionRegistrationSource[]> {
    const result = await this.database.query(
      `select id, tenant_id, student_profile_id, student_person_id, course_section_id,
              status, registered_at, updated_at
         from academy_course_section_registrations
        where tenant_id = $1
          and status in ('registered', 'pending_confirmation', 'withdrawn', 'completed')
        order by registered_at asc, id asc`,
      [tenantId],
    );
    return result.rows.map(mapRegistration);
  }
}
