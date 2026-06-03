import {
  AccountLink,
  PeopleConfiguration,
  Person,
  PersonRoleAssignment,
  StaffProfile,
  StudentProfile,
  StudentRelationship,
} from "@/modules/people/types";
import { validatePeopleConfiguration } from "@/modules/people/validation";

export interface PeopleReviewMetric {
  label: string;
  value: string;
  detail: string;
}

export interface PeopleReviewItem {
  label: string;
  value: string;
}

export interface PeopleCoverageReviewItem {
  label: string;
  count: number;
  detail: string;
}

export interface StudentReviewItem {
  id: string;
  displayName: string;
  studentNumber: string;
  studentType: string;
  enrollmentStatus: string;
  subdivision: string;
  gradeBand: string;
  advisor: string;
  guardianStatus: string;
}

export interface StaffReviewItem {
  id: string;
  displayName: string;
  staffNumber: string;
  title: string;
  primaryRole: string;
  employmentStatus: string;
  subdivision: string;
  loadPolicy: string;
}

export interface RelationshipReviewItem {
  id: string;
  student: string;
  relatedPerson: string;
  relationshipType: string;
  authority: string;
  visibility: string;
  status: string;
}

export interface AccountLinkReviewItem {
  id: string;
  person: string;
  provider: string;
  externalSubject: string;
  status: string;
  secretPosture: string;
}

export interface PeopleReviewModel {
  summary: {
    tenantId: string;
    institutionName: string;
    primaryMode: string;
    guardianPortal: string;
    studentPwa: string;
    updatedAt: string;
  };
  metrics: PeopleReviewMetric[];
  profile: PeopleReviewItem[];
  roleCoverage: PeopleCoverageReviewItem[];
  statusCoverage: PeopleCoverageReviewItem[];
  students: StudentReviewItem[];
  staff: StaffReviewItem[];
  relationships: RelationshipReviewItem[];
  accountLinks: AccountLinkReviewItem[];
  validation: string[];
}

const labelOverrides: Record<string, string> = {
  academic_admin: "Academic admin",
  academic_decision: "Academic decision",
  active: "Active",
  advisor: "Advisor",
  bible_school: "Bible school",
  childrens_school: "Children's school",
  full_guardian: "Full guardian",
  guardian: "Guardian",
  inactive: "Inactive",
  registration_decision: "Registration decision",
  registrar: "Registrar",
  supabase_auth: "Supabase Auth",
};

function titleize(value: string) {
  const override = labelOverrides[value];
  if (override) return override;

  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function booleanLabel(value: boolean) {
  return value ? "Enabled" : "Off";
}

function mapById<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

function displayName(peopleById: Map<string, Person>, personId?: string) {
  if (!personId) return "Not assigned";
  return peopleById.get(personId)?.displayName ?? "Unknown person";
}

function subdivisionLabel(subdivisionId?: string) {
  return subdivisionId ? titleize(subdivisionId.replace(/^branch-/, "").replace(/^grade-band-/, "grade band ")) : "Institution-wide";
}

function buildCoverage(items: string[], detail: string): PeopleCoverageReviewItem[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    const label = titleize(item);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, detail }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function hasActiveGuardianRelationship(relationships: StudentRelationship[], studentPersonId: string) {
  return relationships.some(
    (relationship) =>
      relationship.studentPersonId === studentPersonId &&
      relationship.relationshipType === "guardian" &&
      relationship.status === "active",
  );
}

function buildProfile(config: PeopleConfiguration): PeopleReviewItem[] {
  return [
    { label: "Tenant", value: config.institutionProfile.tenantId },
    { label: "Primary mode", value: titleize(config.institutionProfile.primaryMode) },
    { label: "Guardian portal", value: booleanLabel(config.institutionProfile.capabilities.guardianPortal) },
    { label: "Student PWA", value: booleanLabel(config.institutionProfile.capabilities.studentPwa) },
    { label: "Faculty portal", value: booleanLabel(config.institutionProfile.capabilities.facultyPortal) },
    { label: "Guardian rules", value: booleanLabel(config.institutionProfile.operatingRules.usesGuardians) },
  ];
}

function buildStudentItems(
  studentProfiles: StudentProfile[],
  peopleById: Map<string, Person>,
  relationships: StudentRelationship[],
): StudentReviewItem[] {
  return studentProfiles.map((profile) => ({
    id: profile.id,
    displayName: displayName(peopleById, profile.personId),
    studentNumber: profile.studentNumber,
    studentType: titleize(profile.studentType),
    enrollmentStatus: titleize(profile.enrollmentStatus),
    subdivision: subdivisionLabel(profile.primarySubdivisionId),
    gradeBand: subdivisionLabel(profile.gradeBandSubdivisionId),
    advisor: displayName(peopleById, profile.advisorPersonId),
    guardianStatus: profile.guardianRequired
      ? hasActiveGuardianRelationship(relationships, profile.personId)
        ? "Guardian linked"
        : "Needs guardian"
      : "Not required",
  }));
}

function buildStaffItems(staffProfiles: StaffProfile[], peopleById: Map<string, Person>): StaffReviewItem[] {
  return staffProfiles.map((profile) => ({
    id: profile.id,
    displayName: displayName(peopleById, profile.personId),
    staffNumber: profile.staffNumber,
    title: profile.title,
    primaryRole: titleize(profile.primaryRole),
    employmentStatus: titleize(profile.employmentStatus),
    subdivision: subdivisionLabel(profile.primarySubdivisionId),
    loadPolicy: profile.loadPolicy ? titleize(profile.loadPolicy) : "Not configured",
  }));
}

function buildRelationshipItems(relationships: StudentRelationship[], peopleById: Map<string, Person>): RelationshipReviewItem[] {
  return relationships.map((relationship) => ({
    id: relationship.id,
    student: displayName(peopleById, relationship.studentPersonId),
    relatedPerson: displayName(peopleById, relationship.relatedPersonId),
    relationshipType: titleize(relationship.relationshipType),
    authority: titleize(relationship.authority),
    visibility: titleize(relationship.visibility),
    status: titleize(relationship.status),
  }));
}

function accountLinkHasSecret(accountLink: AccountLink) {
  return Boolean(accountLink.credentialSecret || accountLink.accessToken || accountLink.refreshToken || accountLink.password);
}

function buildAccountLinkItems(accountLinks: AccountLink[], peopleById: Map<string, Person>): AccountLinkReviewItem[] {
  return accountLinks.map((accountLink) => ({
    id: accountLink.id,
    person: displayName(peopleById, accountLink.personId),
    provider: titleize(accountLink.provider),
    externalSubject: accountLink.externalSubject,
    status: titleize(accountLink.status),
    secretPosture: accountLinkHasSecret(accountLink) ? "Secrets present" : "No stored secrets",
  }));
}

function activeGuardianCount(assignments: PersonRoleAssignment[]) {
  return assignments.filter((assignment) => assignment.role === "guardian" && assignment.status === "active").length;
}

export function buildPeopleReviewModel(config: PeopleConfiguration): PeopleReviewModel {
  const validation = validatePeopleConfiguration(config);
  const peopleById = mapById(config.people);

  return {
    summary: {
      tenantId: config.institutionProfile.tenantId,
      institutionName: config.institutionProfile.institutionName,
      primaryMode: titleize(config.institutionProfile.primaryMode),
      guardianPortal: booleanLabel(config.institutionProfile.capabilities.guardianPortal),
      studentPwa: booleanLabel(config.institutionProfile.capabilities.studentPwa),
      updatedAt: config.institutionProfile.updatedAt,
    },
    metrics: [
      { label: "People", value: String(config.people.length), detail: "Directory records" },
      { label: "Students", value: String(config.studentProfiles.length), detail: "Student profiles" },
      { label: "Staff", value: String(config.staffProfiles.length), detail: "Faculty and administrative profiles" },
      { label: "Guardians", value: String(activeGuardianCount(config.roleAssignments)), detail: "Active student-scoped guardian roles" },
      {
        label: "Validation",
        value: validation.length === 0 ? "Clear" : String(validation.length),
        detail: validation.length === 0 ? "No warnings" : "Warnings found",
      },
    ],
    profile: buildProfile(config),
    roleCoverage: buildCoverage(
      config.roleAssignments.filter((assignment) => assignment.status === "active").map((assignment) => assignment.role),
      "Active role assignments",
    ),
    statusCoverage: buildCoverage(
      config.people.map((person) => person.personStatus),
      "Person status coverage",
    ),
    students: buildStudentItems(config.studentProfiles, peopleById, config.relationships),
    staff: buildStaffItems(config.staffProfiles, peopleById),
    relationships: buildRelationshipItems(config.relationships, peopleById),
    accountLinks: buildAccountLinkItems(config.accountLinks, peopleById),
    validation,
  };
}
