import { getDatabasePool } from "@/lib/database";
import {
  AcademyIdentityRecord,
  AcademyIdentityRepository,
} from "@/modules/academy-auth/session-resolver";
import { AcademyRole } from "@/modules/academy-auth/policy";

interface IdentityRow {
  external_subject: string;
  person_id: string;
  tenant_id: string;
  roles: string[];
}

interface IdentityQuery {
  query(
    text: string,
    values: unknown[],
  ): Promise<{ rows: IdentityRow[] }>;
}

const academyRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "admissions",
  "advisor",
  "faculty",
  "teacher",
  "professor",
  "student",
  "guardian",
]);

function parseRoles(values: string[]): AcademyRole[] {
  return values.filter((value): value is AcademyRole =>
    academyRoles.has(value as AcademyRole),
  );
}

export class PostgresAcademyIdentityRepository
  implements AcademyIdentityRepository
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

    return result.rows.map((row) => ({
      externalSubject: row.external_subject,
      personId: row.person_id,
      tenantId: row.tenant_id,
      roles: parseRoles(row.roles ?? []),
    }));
  }
}
