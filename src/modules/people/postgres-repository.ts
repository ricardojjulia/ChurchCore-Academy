import { getDatabasePool } from "@/lib/database";
import { mapInstitutionProfileRow } from "@/modules/academy-config/postgres-repository";
import {
  AccountLink,
  PeopleConfiguration,
  Person,
  PersonRoleAssignment,
  StaffProfile,
  StudentProfile,
  StudentRelationship,
} from "@/modules/people/types";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function toDateString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value);
}

function optionalString(value: unknown) {
  return value === null || value === undefined ? undefined : String(value);
}

function optionalDateString(value: unknown) {
  return value === null || value === undefined ? undefined : toDateString(value);
}

function mapPersonRow(row: Record<string, unknown>): Person {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    displayName: String(row.display_name),
    givenName: optionalString(row.given_name),
    familyName: optionalString(row.family_name),
    preferredName: optionalString(row.preferred_name),
    email: optionalString(row.email),
    phone: optionalString(row.phone),
    dateOfBirth: optionalDateString(row.date_of_birth),
    personStatus: row.person_status as Person["personStatus"],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapRoleAssignmentRow(row: Record<string, unknown>): PersonRoleAssignment {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    personId: String(row.person_id),
    role: row.role as PersonRoleAssignment["role"],
    scopeType: row.scope_type as PersonRoleAssignment["scopeType"],
    scopeId: optionalString(row.scope_id),
    status: row.status as PersonRoleAssignment["status"],
    startsOn: optionalDateString(row.starts_on),
    endsOn: optionalDateString(row.ends_on),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapStudentProfileRow(row: Record<string, unknown>): StudentProfile {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    personId: String(row.person_id),
    studentNumber: String(row.student_number),
    studentType: row.student_type as StudentProfile["studentType"],
    enrollmentStatus: row.enrollment_status as StudentProfile["enrollmentStatus"],
    primarySubdivisionId: optionalString(row.primary_subdivision_id),
    gradeBandSubdivisionId: optionalString(row.grade_band_subdivision_id),
    programId: optionalString(row.program_id),
    advisorPersonId: optionalString(row.advisor_person_id),
    guardianRequired: Boolean(row.guardian_required),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapStaffProfileRow(row: Record<string, unknown>): StaffProfile {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    personId: String(row.person_id),
    staffNumber: String(row.staff_number),
    title: String(row.title),
    primaryRole: row.primary_role as StaffProfile["primaryRole"],
    primarySubdivisionId: optionalString(row.primary_subdivision_id),
    employmentStatus: row.employment_status as StaffProfile["employmentStatus"],
    loadPolicy: optionalString(row.load_policy),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapRelationshipRow(row: Record<string, unknown>): StudentRelationship {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    studentPersonId: String(row.student_person_id),
    relatedPersonId: String(row.related_person_id),
    relationshipType: row.relationship_type as StudentRelationship["relationshipType"],
    authority: row.authority as StudentRelationship["authority"],
    visibility: row.visibility as StudentRelationship["visibility"],
    status: row.status as StudentRelationship["status"],
    startsOn: optionalDateString(row.starts_on),
    endsOn: optionalDateString(row.ends_on),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapAccountLinkRow(row: Record<string, unknown>): AccountLink {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    personId: String(row.person_id),
    provider: row.provider as AccountLink["provider"],
    externalSubject: String(row.external_subject),
    status: row.status as AccountLink["status"],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export function mapPeopleRows(rows: {
  institutionProfile: Record<string, unknown>;
  people: Record<string, unknown>[];
  roleAssignments: Record<string, unknown>[];
  studentProfiles: Record<string, unknown>[];
  staffProfiles: Record<string, unknown>[];
  relationships: Record<string, unknown>[];
  accountLinks: Record<string, unknown>[];
}): PeopleConfiguration {
  return {
    institutionProfile: mapInstitutionProfileRow(rows.institutionProfile),
    people: rows.people.map(mapPersonRow),
    roleAssignments: rows.roleAssignments.map(mapRoleAssignmentRow),
    studentProfiles: rows.studentProfiles.map(mapStudentProfileRow),
    staffProfiles: rows.staffProfiles.map(mapStaffProfileRow),
    relationships: rows.relationships.map(mapRelationshipRow),
    accountLinks: rows.accountLinks.map(mapAccountLinkRow),
  };
}

export class AcademyPeopleRepository {
  constructor(private readonly pool: Queryable = getDatabasePool()) {}

  async fetchPeopleConfiguration(tenantId: string) {
    const [institutionProfile, people, roleAssignments, studentProfiles, staffProfiles, relationships, accountLinks] = await Promise.all([
      this.pool.query(
        `select tenant_id, institution_name, legal_name, primary_mode, supported_modes, operating_rules,
                capabilities, lms_preference, created_at, updated_at
         from academy_institution_profiles
         where tenant_id = $1`,
        [tenantId],
      ),
      this.pool.query("select * from academy_people where tenant_id = $1 order by display_name asc", [tenantId]),
      this.pool.query("select * from academy_person_role_assignments where tenant_id = $1 order by person_id asc, role asc", [tenantId]),
      this.pool.query("select * from academy_student_profiles where tenant_id = $1 order by student_number asc", [tenantId]),
      this.pool.query("select * from academy_staff_profiles where tenant_id = $1 order by staff_number asc", [tenantId]),
      this.pool.query("select * from academy_student_relationships where tenant_id = $1 order by student_person_id asc, relationship_type asc", [
        tenantId,
      ]),
      this.pool.query("select * from academy_account_links where tenant_id = $1 order by provider asc, external_subject asc", [tenantId]),
    ]);

    if (institutionProfile.rowCount === 0) {
      throw new Error(`Institution profile for tenant ${tenantId} was not found.`);
    }

    return mapPeopleRows({
      institutionProfile: institutionProfile.rows[0],
      people: people.rows,
      roleAssignments: roleAssignments.rows,
      studentProfiles: studentProfiles.rows,
      staffProfiles: staffProfiles.rows,
      relationships: relationships.rows,
      accountLinks: accountLinks.rows,
    });
  }
}
