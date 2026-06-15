import { getDatabasePool } from "@/lib/database";
import {
  AcademyIdentityRecord,
  PlatformSessionRepository,
} from "@/modules/academy-auth/session-resolver";
import { AcademyRole, PlatformRole } from "@/modules/academy-auth/policy";

interface IdentityRow {
  external_subject: string;
  person_id: string;
  tenant_id: string;
  roles: string[];
}

interface PlatformRoleRow {
  role: string;
}

interface IdentityQuery {
  query(
    text: string,
    values: unknown[],
  ): Promise<{ rows: IdentityRow[] | PlatformRoleRow[] }>;
}

const academyRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "admissions",
  "applicant",
  "advisor",
  "faculty",
  "teacher",
  "professor",
  "student",
  "guardian",
]);

const platformRoles = new Set<PlatformRole>([
  "platform_staff",
  "platform_admin",
]);

function parseRoles(values: string[]): AcademyRole[] {
  return values.filter((value): value is AcademyRole =>
    academyRoles.has(value as AcademyRole),
  );
}

function parsePlatformRoles(values: string[]) {
  return values.filter((value): value is PlatformRole =>
    platformRoles.has(value as PlatformRole),
  );
}

export class PostgresAcademyIdentityRepository
  implements PlatformSessionRepository
{
  constructor(private readonly database: IdentityQuery = getDatabasePool()) {}

  async findActiveIdentities(
    externalSubject: string,
    asOf: string,
  ): Promise<AcademyIdentityRecord[]> {
    const result = await this.database.query(
      `select
         account.external_subject,
         account.person_id,
         account.tenant_id,
         array_agg(distinct assignment.role) filter (where assignment.role is not null) as roles
       from academy_account_links account
       join academy_people person
         on person.id = account.person_id
        and person.tenant_id = account.tenant_id
        and person.person_status = 'active'
       left join academy_person_role_assignments assignment
         on assignment.person_id = account.person_id
        and assignment.tenant_id = account.tenant_id
        and assignment.status = 'active'
        and (assignment.starts_on is null or assignment.starts_on <= $2::timestamptz::date)
        and (assignment.ends_on is null or assignment.ends_on >= $2::timestamptz::date)
       where account.provider = 'supabase'
         and account.external_subject = $1
         and account.status = 'active'
       group by account.external_subject, account.person_id, account.tenant_id
       order by account.tenant_id`,
      [externalSubject, asOf],
    );

    return (result.rows as IdentityRow[]).map((row) => ({
      externalSubject: row.external_subject,
      personId: row.person_id,
      tenantId: row.tenant_id,
      roles: parseRoles(row.roles ?? []),
    }));
  }

  async findPlatformRoles(
    externalSubject: string,
    asOf: string,
  ): Promise<PlatformRole[]> {
    try {
      const result = await this.database.query(
        `select distinct assignment.role
         from academy_account_links account
         join academy_platform_role_assignments assignment
           on assignment.external_subject = account.external_subject
          and assignment.status = 'active'
          and (assignment.starts_on is null or assignment.starts_on <= $2::timestamptz::date)
          and (assignment.ends_on is null or assignment.ends_on >= $2::timestamptz::date)
         where account.provider = 'supabase'
           and account.external_subject = $1
           and account.status = 'active'`,
        [externalSubject, asOf],
      );

      return parsePlatformRoles(
        (result.rows as PlatformRoleRow[]).map((row) => row.role),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("academy_platform_role_assignments")) {
        return [];
      }
      throw error;
    }
  }
}
