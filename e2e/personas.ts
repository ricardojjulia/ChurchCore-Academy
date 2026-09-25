import type { AcademyRole } from "@/modules/academy-auth/policy";

// Single source of truth for every login the e2e suite uses. `seeded: "migration"` personas come
// from supabase/migrations (the demo + acceptance walkthrough accounts); `seeded: "e2e"` personas
// are created by scripts/e2e/seed.ts so every AcademyRole has a real login in the test database.
// All share one local-only password. Never point the suite at a non-disposable database.
export const E2E_PASSWORD = "ChurchCore2026!";
export const PRIMARY_TENANT_ID = "cca-main";
export const OTHER_TENANT_ID = "e2e-other";

export interface E2EPersona {
  email: string;
  tenantId: string;
  role: AcademyRole;
  personId: string;
  seeded: "migration" | "e2e";
  /** Where a successful login lands. */
  home: "/admin" | "/student" | "/guardian";
}

export const PERSONAS = {
  institutionAdmin: { email: "admin@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "institution_admin", personId: "person-regina-holt", seeded: "migration", home: "/admin" },
  institutionAdmin2: { email: "institution.admin@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "institution_admin", personId: "person-acceptance-admin", seeded: "migration", home: "/admin" },
  registrar: { email: "registrar@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "registrar", personId: "person-acceptance-registrar", seeded: "migration", home: "/admin" },
  faculty: { email: "faculty@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "faculty", personId: "person-acceptance-faculty", seeded: "migration", home: "/admin" },
  teacher: { email: "teacher@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "teacher", personId: "person-sophia-marsh", seeded: "migration", home: "/admin" },
  finance: { email: "finance@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "finance", personId: "person-acceptance-finance", seeded: "migration", home: "/admin" },
  admissions: { email: "admissions@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "admissions", personId: "person-acceptance-admissions", seeded: "migration", home: "/admin" },
  student: { email: "student@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "student", personId: "person-lena-rivera", seeded: "migration", home: "/student" },
  guardian: { email: "guardian@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "guardian", personId: "person-marisol-rivera", seeded: "migration", home: "/guardian" },
  academicAdmin: { email: "academic.admin@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "academic_admin", personId: "person-e2e-academic-admin", seeded: "e2e", home: "/admin" },
  dean: { email: "dean@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "dean", personId: "person-e2e-dean", seeded: "e2e", home: "/admin" },
  advisor: { email: "advisor@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "advisor", personId: "person-e2e-advisor", seeded: "e2e", home: "/admin" },
  professor: { email: "professor@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "professor", personId: "person-e2e-professor", seeded: "e2e", home: "/admin" },
  alumniRelations: { email: "alumni.relations@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "alumni_relations", personId: "person-e2e-alumni-relations", seeded: "e2e", home: "/admin" },
  formationReviewer: { email: "formation.reviewer@churchcore.academy", tenantId: PRIMARY_TENANT_ID, role: "ministry_formation_reviewer", personId: "person-e2e-formation-reviewer", seeded: "e2e", home: "/admin" },
  // Provisioned (with its tenant) by the real platform provisioning path; its person id is generated.
  otherTenantAdmin: { email: "other.admin@e2e.churchcore.invalid", tenantId: OTHER_TENANT_ID, role: "institution_admin", personId: "(provisioned)", seeded: "e2e", home: "/admin" },
} as const satisfies Record<string, E2EPersona>;

export type PersonaKey = keyof typeof PERSONAS;
export const PERSONA_KEYS = Object.keys(PERSONAS) as PersonaKey[];

// Fixed-ID records scripts/e2e/seed.ts creates, used as samples for dynamic routes that have no
// record seeded by migrations.
export const FIXTURE_IDS = {
  inquiryId: "e2e-inquiry-1",
  assignmentId: "00000000-0000-4000-8000-00000000e201",
  sectionId: "demo-multi-section-algebra",
  alumniRecordId: "e2e-alumni-record-1",
  alumniPersonId: "person-e2e-alumnus",
  studentProfileId: "student-profile-lena",
  learnerPersonId: "person-e2e-learner",
  learnerProfileId: "student-profile-e2e-learner",
} as const;
