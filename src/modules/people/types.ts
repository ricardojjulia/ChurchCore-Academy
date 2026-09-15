import { AcademyRole } from "@/modules/academy-auth/policy";
import { InstitutionProfile } from "@/modules/academy-config/types";

export type PersonStatus = "active" | "inactive" | "invited" | "archived";
export type RoleScopeType = "tenant" | "subdivision" | "course_section" | "student";
export type RoleAssignmentStatus = "active" | "inactive" | "expired";
export type StudentType = "child" | "adult" | "dual_enrollment" | "seminary_student" | "bible_school_student" | "college_student" | "university_student";
export type StudentEnrollmentStatus = "application_started" | "pending" | "admitted" | "active" | "inactive" | "graduated" | "withdrawn";
export type StaffPrimaryRole = Exclude<AcademyRole, "student" | "guardian">;
export type StaffEmploymentStatus = "active" | "inactive" | "adjunct" | "volunteer" | "archived";
export type StudentRelationshipType =
  | "guardian"
  | "parent"
  | "emergency_contact"
  | "pickup_contact"
  | "advisor"
  | "mentor"
  | "field_supervisor"
  | "sponsor"
  | "custom";
export type StudentRelationshipAuthority = "view_only" | "academic_decision" | "registration_decision" | "emergency_contact" | "pickup_authorized" | "none";
export type StudentRelationshipVisibility = "directory_only" | "schedule" | "documents" | "progress" | "grades" | "billing_excluded" | "full_guardian";
export type StudentRelationshipStatus = "active" | "inactive" | "expired";
export type AccountLinkProvider = "supabase_auth" | "moodle" | "canvas" | "external";
export type AccountLinkStatus = "active" | "inactive" | "revoked";

export interface Person {
  id: string;
  tenantId: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  personStatus: PersonStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PersonRoleAssignment {
  id: string;
  tenantId: string;
  personId: string;
  role: AcademyRole;
  scopeType: RoleScopeType;
  scopeId?: string;
  status: RoleAssignmentStatus;
  startsOn?: string;
  endsOn?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfile {
  id: string;
  tenantId: string;
  personId: string;
  studentNumber: string;
  studentType: StudentType;
  enrollmentStatus: StudentEnrollmentStatus;
  primarySubdivisionId?: string;
  gradeBandSubdivisionId?: string;
  programId?: string;
  advisorPersonId?: string;
  guardianRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffProfile {
  id: string;
  tenantId: string;
  personId: string;
  staffNumber: string;
  title: string;
  primaryRole: StaffPrimaryRole;
  primarySubdivisionId?: string;
  employmentStatus: StaffEmploymentStatus;
  loadPolicy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentRelationship {
  id: string;
  tenantId: string;
  studentPersonId: string;
  relatedPersonId: string;
  relationshipType: StudentRelationshipType;
  authority: StudentRelationshipAuthority;
  visibility: StudentRelationshipVisibility;
  status: StudentRelationshipStatus;
  startsOn?: string;
  endsOn?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountLink {
  id: string;
  tenantId: string;
  personId: string;
  provider: AccountLinkProvider;
  externalSubject: string;
  status: AccountLinkStatus;
  credentialSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  password?: string;
  createdAt: string;
  updatedAt: string;
}

export type BaptismForm = 'immersion' | 'sprinkling' | 'pouring' | 'none' | 'unknown';
export type CovenantStatus = 'active' | 'inactive' | 'pending';

export interface CovenantFields {
  faithDecisionDate?: string;       // ISO date
  baptismDate?: string;             // ISO date
  baptismForm?: BaptismForm;
  homeChurch?: string;
  denominationalAffiliation?: string;
  covenantStatus?: CovenantStatus;
  formationTrack?: string;
  congregationMemberSince?: string; // ISO date
  notes?: string;                   // restricted — admin/dean only
}

export interface CovenantRecord {
  id: string;
  tenantId: string;
  personId: string;
  covenantFields: CovenantFields;
  createdAt: string;
  updatedAt: string;
}

export interface PeopleConfiguration {
  institutionProfile: InstitutionProfile;
  people: Person[];
  roleAssignments: PersonRoleAssignment[];
  studentProfiles: StudentProfile[];
  staffProfiles: StaffProfile[];
  relationships: StudentRelationship[];
  accountLinks: AccountLink[];
}
