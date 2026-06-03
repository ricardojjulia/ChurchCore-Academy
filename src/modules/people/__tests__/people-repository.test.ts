import assert from "node:assert/strict";
import test from "node:test";
import { AcademyPeopleRepository, mapPeopleRows } from "@/modules/people/postgres-repository";
import { validatePeopleConfiguration } from "@/modules/people/validation";

const now = new Date("2026-06-02T00:00:00.000Z");

const rows = {
  institutionProfile: {
    tenant_id: "tenant-people",
    institution_name: "People Repository Academy",
    legal_name: "People Repository Academy Inc.",
    primary_mode: "childrens_school",
    supported_modes: JSON.stringify(["childrens_school"]),
    operating_rules: JSON.stringify({
      academicYearLabel: "School Year",
      defaultCalendarSystem: "school_year",
      defaultTermStructure: "trimester",
      usesGradeLevels: true,
      usesPrograms: false,
      usesCohorts: false,
      usesCredits: false,
      usesClockHours: false,
      usesGpa: false,
      usesTranscripts: false,
      usesGuardians: true,
      allowsMinors: true,
      defaultInstructionalRoleLabel: "teacher",
      officialRecordName: "progress record",
    }),
    capabilities: JSON.stringify({
      studentPwa: true,
      guardianPortal: true,
      facultyPortal: true,
      registrarWorkflows: true,
      admissionsWorkflows: true,
      transcriptWorkflows: false,
      graduationWorkflows: false,
      lmsLaunch: false,
      lmsRosterSync: false,
      lmsGradeReturn: false,
      shepherdAiRecommendations: true,
    }),
    lms_preference: JSON.stringify({ provider: "none", selectionStatus: "not_needed" }),
    created_at: now,
    updated_at: now,
  },
  student: {
    id: "person-student",
    tenant_id: "tenant-people",
    display_name: "Lena Rivera",
    given_name: "Lena",
    family_name: "Rivera",
    preferred_name: null,
    email: "lena@example.edu",
    phone: null,
    date_of_birth: "2017-04-10",
    person_status: "active",
    created_at: now,
    updated_at: now,
  },
  guardian: {
    id: "person-guardian",
    tenant_id: "tenant-people",
    display_name: "Marisol Rivera",
    given_name: "Marisol",
    family_name: "Rivera",
    preferred_name: null,
    email: "marisol@example.com",
    phone: "555-0101",
    date_of_birth: null,
    person_status: "active",
    created_at: now,
    updated_at: now,
  },
  advisor: {
    id: "person-advisor",
    tenant_id: "tenant-people",
    display_name: "Julian Pace",
    given_name: "Julian",
    family_name: "Pace",
    preferred_name: null,
    email: "julian@example.edu",
    phone: null,
    date_of_birth: null,
    person_status: "active",
    created_at: now,
    updated_at: now,
  },
  roleAssignment: {
    id: "role-student",
    tenant_id: "tenant-people",
    person_id: "person-student",
    role: "student",
    scope_type: "tenant",
    scope_id: null,
    status: "active",
    starts_on: "2026-08-01",
    ends_on: null,
    created_at: now,
    updated_at: now,
  },
  guardianRoleAssignment: {
    id: "role-guardian",
    tenant_id: "tenant-people",
    person_id: "person-guardian",
    role: "guardian",
    scope_type: "student",
    scope_id: "person-student",
    status: "active",
    starts_on: "2026-08-01",
    ends_on: null,
    created_at: now,
    updated_at: now,
  },
  advisorRoleAssignment: {
    id: "role-advisor",
    tenant_id: "tenant-people",
    person_id: "person-advisor",
    role: "advisor",
    scope_type: "tenant",
    scope_id: null,
    status: "active",
    starts_on: "2026-08-01",
    ends_on: null,
    created_at: now,
    updated_at: now,
  },
  studentProfile: {
    id: "student-profile",
    tenant_id: "tenant-people",
    person_id: "person-student",
    student_number: "S-100",
    student_type: "child",
    enrollment_status: "active",
    primary_subdivision_id: "grade-k5",
    grade_band_subdivision_id: "grade-k5",
    program_id: null,
    advisor_person_id: "person-advisor",
    guardian_required: true,
    created_at: now,
    updated_at: now,
  },
  staffProfile: {
    id: "staff-profile",
    tenant_id: "tenant-people",
    person_id: "person-advisor",
    staff_number: "F-100",
    title: "Academic Advisor",
    primary_role: "advisor",
    primary_subdivision_id: null,
    employment_status: "active",
    load_policy: null,
    created_at: now,
    updated_at: now,
  },
  relationship: {
    id: "relationship-guardian",
    tenant_id: "tenant-people",
    student_person_id: "person-student",
    related_person_id: "person-guardian",
    relationship_type: "guardian",
    authority: "academic_decision",
    visibility: "full_guardian",
    status: "active",
    starts_on: "2026-08-01",
    ends_on: null,
    created_at: now,
    updated_at: now,
  },
  accountLink: {
    id: "account-guardian",
    tenant_id: "tenant-people",
    person_id: "person-guardian",
    provider: "supabase_auth",
    external_subject: "auth0|guardian",
    status: "active",
    created_at: now,
    updated_at: now,
  },
};

test("maps people rows into a valid domain configuration", () => {
  const config = mapPeopleRows({
    institutionProfile: rows.institutionProfile,
    people: [rows.student, rows.guardian, rows.advisor],
    roleAssignments: [rows.roleAssignment, rows.guardianRoleAssignment, rows.advisorRoleAssignment],
    studentProfiles: [rows.studentProfile],
    staffProfiles: [rows.staffProfile],
    relationships: [rows.relationship],
    accountLinks: [rows.accountLink],
  });

  assert.equal(config.institutionProfile.tenantId, "tenant-people");
  assert.equal(config.people[0].displayName, "Lena Rivera");
  assert.equal(config.studentProfiles[0].studentType, "child");
  assert.equal(config.relationships[0].visibility, "full_guardian");
  assert.equal(config.accountLinks[0].provider, "supabase_auth");
  assert.deepEqual(validatePeopleConfiguration(config), []);
});

test("fetchPeopleConfiguration reads tenant-scoped people rows", async () => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const repository = new AcademyPeopleRepository({
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes("academy_institution_profiles")) return { rowCount: 1, rows: [rows.institutionProfile] };
      if (sql.includes("academy_people")) return { rowCount: 3, rows: [rows.student, rows.guardian, rows.advisor] };
      if (sql.includes("academy_person_role_assignments")) {
        return { rowCount: 3, rows: [rows.roleAssignment, rows.guardianRoleAssignment, rows.advisorRoleAssignment] };
      }
      if (sql.includes("academy_student_profiles")) return { rowCount: 1, rows: [rows.studentProfile] };
      if (sql.includes("academy_staff_profiles")) return { rowCount: 1, rows: [rows.staffProfile] };
      if (sql.includes("academy_student_relationships")) return { rowCount: 1, rows: [rows.relationship] };
      if (sql.includes("academy_account_links")) return { rowCount: 1, rows: [rows.accountLink] };
      return { rowCount: 0, rows: [] };
    },
  });

  const config = await repository.fetchPeopleConfiguration("tenant-people");

  assert.equal(config.people.length, 3);
  assert.equal(config.roleAssignments.length, 3);
  assert.ok(calls.every((call) => call.sql.match(/tenant_id = \$1/i) || call.sql.includes("academy_institution_profiles")));
  assert.ok(calls.every((call) => call.params[0] === "tenant-people"));
});

test("fetchPeopleConfiguration requires an institution profile", async () => {
  const repository = new AcademyPeopleRepository({
    query: async () => ({ rowCount: 0, rows: [] }),
  });

  await assert.rejects(() => repository.fetchPeopleConfiguration("missing-tenant"), /Institution profile for tenant missing-tenant was not found/);
});
