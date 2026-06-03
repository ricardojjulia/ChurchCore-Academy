import { AcademyRole } from "@/modules/academy-auth/policy";
import {
  AccountLink,
  PeopleConfiguration,
  Person,
  PersonRoleAssignment,
  StaffProfile,
  StudentProfile,
  StudentRelationship,
  StudentRelationshipVisibility,
} from "@/modules/people/types";

export type { PeopleConfiguration } from "@/modules/people/types";

export type GuardianAccessCategory = "directory" | "schedule" | "documents" | "progress" | "grades" | "billing";

export interface GuardianAccessRequest {
  guardianPersonId: string;
  studentPersonId: string;
  category: GuardianAccessCategory;
  asOf?: string;
}

const advisorCapableRoles = new Set<AcademyRole>(["advisor", "faculty", "professor", "dean", "academic_admin"]);
const guardianLevelVisibilities = new Set<StudentRelationshipVisibility>(["documents", "progress", "grades", "full_guardian"]);
const contactOnlyRelationshipTypes = new Set<StudentRelationship["relationshipType"]>(["emergency_contact", "pickup_contact"]);
const visibilityCategories: Record<StudentRelationshipVisibility, ReadonlySet<GuardianAccessCategory>> = {
  directory_only: new Set(["directory"]),
  schedule: new Set(["directory", "schedule"]),
  documents: new Set(["directory", "documents"]),
  progress: new Set(["directory", "schedule", "progress"]),
  grades: new Set(["directory", "grades"]),
  billing_excluded: new Set(["directory", "schedule", "documents", "progress", "grades"]),
  full_guardian: new Set(["directory", "schedule", "documents", "progress", "grades"]),
};

function mapById<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

function activeAssignmentsForPerson(assignments: PersonRoleAssignment[], personId: string) {
  return assignments.filter((assignment) => assignment.personId === personId && assignment.status === "active");
}

function dateIsActive(startsOn: string | undefined, endsOn: string | undefined, asOf: string) {
  return (!startsOn || startsOn <= asOf) && (!endsOn || endsOn >= asOf);
}

function relationshipIsActive(relationship: StudentRelationship, asOf = new Date().toISOString().slice(0, 10)) {
  return relationship.status === "active" && dateIsActive(relationship.startsOn, relationship.endsOn, asOf);
}

function hasActiveRole(assignments: PersonRoleAssignment[], personId: string, role: AcademyRole) {
  return activeAssignmentsForPerson(assignments, personId).some((assignment) => assignment.role === role);
}

function hasAdvisorCapableRole(assignments: PersonRoleAssignment[], personId: string) {
  return activeAssignmentsForPerson(assignments, personId).some((assignment) => advisorCapableRoles.has(assignment.role));
}

function validateTenantScopes(config: PeopleConfiguration, errors: string[]) {
  const tenantId = config.institutionProfile.tenantId;

  for (const person of config.people) {
    if (person.tenantId !== tenantId) {
      errors.push(`Person ${person.id} tenant must match the institution tenant.`);
    }
  }

  for (const assignment of config.roleAssignments) {
    if (assignment.tenantId !== tenantId) {
      errors.push(`Role assignment ${assignment.id} tenant must match the institution tenant.`);
    }
  }

  for (const profile of config.studentProfiles) {
    if (profile.tenantId !== tenantId) {
      errors.push(`Student profile ${profile.id} tenant must match the institution tenant.`);
    }
  }

  for (const profile of config.staffProfiles) {
    if (profile.tenantId !== tenantId) {
      errors.push(`Staff profile ${profile.id} tenant must match the institution tenant.`);
    }
  }

  for (const relationship of config.relationships) {
    if (relationship.tenantId !== tenantId) {
      errors.push(`Student relationship ${relationship.id} tenant must match the institution tenant.`);
    }
  }

  for (const accountLink of config.accountLinks) {
    if (accountLink.tenantId !== tenantId) {
      errors.push(`Account link ${accountLink.id} tenant must match the institution tenant.`);
    }
  }
}

function validatePerson(person: Person, errors: string[]) {
  if (!person.displayName.trim()) {
    errors.push(`Person ${person.id} display name must not be empty.`);
  }
}

function validateRoleAssignment(assignment: PersonRoleAssignment, peopleById: Map<string, Person>, relationships: StudentRelationship[], errors: string[]) {
  const person = peopleById.get(assignment.personId);

  if (!person) {
    errors.push(`Role assignment ${assignment.id} must reference an existing person.`);
  } else if (person.tenantId !== assignment.tenantId) {
    errors.push(`Role assignment ${assignment.id} person must belong to the same tenant.`);
  }

  if (assignment.role === "guardian") {
    const activeStudentRelationships = relationships.filter(
      (relationship) =>
        relationship.tenantId === assignment.tenantId &&
        relationship.relatedPersonId === assignment.personId &&
        relationship.relationshipType === "guardian" &&
        relationship.status === "active",
    );

    if (assignment.scopeType !== "student" || !assignment.scopeId || activeStudentRelationships.length === 0) {
      errors.push(`Guardian role assignment ${assignment.id} must be student-scoped and backed by an active student relationship.`);
    } else if (!activeStudentRelationships.some((relationship) => relationship.studentPersonId === assignment.scopeId)) {
      errors.push(`Guardian role assignment ${assignment.id} must be scoped to the related student relationship.`);
    }
  }
}

function validateStudentProfile(
  profile: StudentProfile,
  config: PeopleConfiguration,
  peopleById: Map<string, Person>,
  errors: string[],
) {
  const person = peopleById.get(profile.personId);

  if (!person) {
    errors.push(`Student profile ${profile.id} must reference an existing person.`);
  } else if (person.tenantId !== profile.tenantId) {
    errors.push(`Student profile ${profile.id} person must belong to the same tenant.`);
  }

  if (!hasActiveRole(config.roleAssignments, profile.personId, "student")) {
    errors.push(`Student profile ${profile.id} must have an active student role assignment.`);
  }

  if (profile.advisorPersonId && !hasAdvisorCapableRole(config.roleAssignments, profile.advisorPersonId)) {
    errors.push(`Student profile ${profile.id} advisor must have an active advisor-capable role.`);
  }

  if (profile.studentType === "child" && profile.guardianRequired && config.institutionProfile.operatingRules.usesGuardians) {
    const hasActiveGuardianRelationship = config.relationships.some(
      (relationship) =>
        relationship.tenantId === profile.tenantId &&
        relationship.studentPersonId === profile.personId &&
        relationship.relationshipType === "guardian" &&
        relationship.status === "active",
    );

    if (!hasActiveGuardianRelationship) {
      errors.push(`Child student profile ${profile.id} must have an active guardian relationship.`);
    }
  }
}

function validateStaffProfile(profile: StaffProfile, config: PeopleConfiguration, peopleById: Map<string, Person>, errors: string[]) {
  const person = peopleById.get(profile.personId);

  if (!person) {
    errors.push(`Staff profile ${profile.id} must reference an existing person.`);
  } else if (person.tenantId !== profile.tenantId) {
    errors.push(`Staff profile ${profile.id} person must belong to the same tenant.`);
  }

  if (!hasActiveRole(config.roleAssignments, profile.personId, profile.primaryRole)) {
    errors.push(`Staff profile ${profile.id} must have an active role assignment for ${profile.primaryRole}.`);
  }
}

function validateRelationship(relationship: StudentRelationship, peopleById: Map<string, Person>, errors: string[]) {
  const student = peopleById.get(relationship.studentPersonId);
  const relatedPerson = peopleById.get(relationship.relatedPersonId);

  if (!student) {
    errors.push(`Student relationship ${relationship.id} must reference an existing student person.`);
  } else if (student.tenantId !== relationship.tenantId) {
    errors.push(`Student relationship ${relationship.id} student person must belong to the same tenant.`);
  } else if (student.personStatus === "archived" && relationship.status === "active") {
    errors.push(`Student relationship ${relationship.id} cannot be active for an archived student person.`);
  }

  if (!relatedPerson) {
    errors.push(`Student relationship ${relationship.id} must reference an existing related person.`);
  } else if (relatedPerson.tenantId !== relationship.tenantId) {
    errors.push(`Student relationship ${relationship.id} related person must belong to the same tenant.`);
  } else if (relatedPerson.personStatus === "archived" && relationship.status === "active") {
    errors.push(`Student relationship ${relationship.id} cannot be active for an archived related person.`);
  }

  if (relationship.relationshipType === "emergency_contact" && (relationship.authority === "academic_decision" || relationship.authority === "registration_decision")) {
    errors.push(`Student relationship ${relationship.id} emergency contacts cannot have academic or registration decision authority.`);
  }

  if (relationship.relationshipType === "pickup_contact" && relationship.authority !== "pickup_authorized" && relationship.authority !== "none") {
    errors.push(`Student relationship ${relationship.id} pickup contacts must use pickup authority or no authority.`);
  }

  if (contactOnlyRelationshipTypes.has(relationship.relationshipType) && guardianLevelVisibilities.has(relationship.visibility)) {
    errors.push(`Student relationship ${relationship.id} contact-only relationships cannot use guardian-level visibility.`);
  }
}

function accountLinkHasSecret(accountLink: AccountLink) {
  return Boolean(accountLink.credentialSecret || accountLink.accessToken || accountLink.refreshToken || accountLink.password);
}

function validateAccountLink(accountLink: AccountLink, peopleById: Map<string, Person>, errors: string[]) {
  const person = peopleById.get(accountLink.personId);

  if (!person) {
    errors.push(`Account link ${accountLink.id} must reference an existing person.`);
  } else if (person.tenantId !== accountLink.tenantId) {
    errors.push(`Account link ${accountLink.id} person must belong to the same tenant.`);
  }

  if (accountLinkHasSecret(accountLink)) {
    errors.push(`Account link ${accountLink.id} must not store provider secrets or tokens.`);
  }
}

export function validatePeopleConfiguration(config: PeopleConfiguration): string[] {
  const errors: string[] = [];
  const peopleById = mapById(config.people);

  validateTenantScopes(config, errors);

  for (const person of config.people) {
    validatePerson(person, errors);
  }

  for (const assignment of config.roleAssignments) {
    validateRoleAssignment(assignment, peopleById, config.relationships, errors);
  }

  for (const profile of config.studentProfiles) {
    validateStudentProfile(profile, config, peopleById, errors);
  }

  for (const profile of config.staffProfiles) {
    validateStaffProfile(profile, config, peopleById, errors);
  }

  for (const relationship of config.relationships) {
    validateRelationship(relationship, peopleById, errors);
  }

  for (const accountLink of config.accountLinks) {
    validateAccountLink(accountLink, peopleById, errors);
  }

  return errors;
}

export function canGuardianAccessStudentCategory(config: PeopleConfiguration, request: GuardianAccessRequest): boolean {
  const guardianRole = config.roleAssignments.find(
    (assignment) =>
      assignment.personId === request.guardianPersonId &&
      assignment.role === "guardian" &&
      assignment.scopeType === "student" &&
      assignment.scopeId === request.studentPersonId &&
      assignment.status === "active",
  );

  if (!guardianRole) {
    return false;
  }

  const relationship = config.relationships.find(
    (item) =>
      item.tenantId === config.institutionProfile.tenantId &&
      item.studentPersonId === request.studentPersonId &&
      item.relatedPersonId === request.guardianPersonId &&
      item.relationshipType === "guardian" &&
      relationshipIsActive(item, request.asOf),
  );

  if (!relationship) {
    return false;
  }

  return visibilityCategories[relationship.visibility].has(request.category);
}
