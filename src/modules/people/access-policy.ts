import { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import { GuardianAccessCategory, canGuardianAccessStudentCategory } from "@/modules/people/validation";
import { PeopleConfiguration, PersonRoleAssignment, StudentRelationship } from "@/modules/people/types";

export type PeopleAccessAction =
  | "read_people"
  | "write_people"
  | "admin_people"
  | "read_student"
  | "write_student"
  | "read_guardian_relationship"
  | "write_guardian_relationship"
  | "assign_instruction"
  | "write_person"
  | "write_staff"
  | "write_guardian"
  | "write_relationship"
  | "read_applicant"
  | "write_applicant"
  | "read_advisor_load";

export interface PeopleAccessRequest {
  action: PeopleAccessAction;
  tenantId: string;
  targetPersonId?: string;
  guardianCategory?: GuardianAccessCategory;
  asOf?: string;
}

const peopleReadRoles = new Set<AcademyRole>(["institution_admin", "dean", "registrar", "academic_admin", "admissions"]);
const studentWriteRoles = new Set<AcademyRole>(["institution_admin", "registrar", "admissions"]);
const guardianRelationshipWriteRoles = new Set<AcademyRole>(["institution_admin", "registrar", "admissions"]);
const instructionAssignmentRoles = new Set<AcademyRole>(["institution_admin", "dean", "academic_admin"]);
const assignedStudentReadRoles = new Set<AcademyRole>(["advisor", "faculty", "teacher", "professor"]);
const personWriteRoles = new Set<AcademyRole>(["institution_admin", "registrar"]);
const staffWriteRoles = new Set<AcademyRole>(["institution_admin", "dean", "academic_admin"]);
const guardianWriteRoles = new Set<AcademyRole>(["institution_admin", "registrar", "admissions"]);
const relationshipWriteRoles = new Set<AcademyRole>(["institution_admin", "registrar"]);
const applicantReadRoles = new Set<AcademyRole>(["institution_admin", "registrar", "admissions", "academic_admin", "dean"]);
const applicantWriteRoles = new Set<AcademyRole>(["institution_admin", "registrar", "admissions"]);
const advisorLoadReadRoles = new Set<AcademyRole>(["institution_admin", "dean", "academic_admin", "registrar"]);

function actorTenantMatches(actor: AcademyActor, config: PeopleConfiguration, request: PeopleAccessRequest) {
  return actor.tenantId === request.tenantId && config.institutionProfile.tenantId === request.tenantId;
}

function activeAssignmentsForActor(config: PeopleConfiguration, actor: AcademyActor) {
  return config.roleAssignments.filter((assignment) => assignment.personId === actor.userId && assignment.tenantId === actor.tenantId && assignment.status === "active");
}

function hasActiveMatchingRole(assignments: PersonRoleAssignment[], actor: AcademyActor, allowedRoles: ReadonlySet<AcademyRole>) {
  return assignments.some((assignment) => actor.roles.includes(assignment.role) && allowedRoles.has(assignment.role));
}

function hasActiveRole(assignments: PersonRoleAssignment[], actor: AcademyActor, role: AcademyRole) {
  return assignments.some((assignment) => assignment.role === role && actor.roles.includes(role));
}

function isAssignedStudentRelationship(relationship: StudentRelationship, actorPersonId: string, targetPersonId: string) {
  return relationship.status === "active" && relationship.relatedPersonId === actorPersonId && relationship.studentPersonId === targetPersonId;
}

function canReadAssignedStudent(config: PeopleConfiguration, actor: AcademyActor, assignments: PersonRoleAssignment[], targetPersonId?: string) {
  if (!targetPersonId || !hasActiveMatchingRole(assignments, actor, assignedStudentReadRoles)) {
    return false;
  }

  return (
    assignments.some((assignment) => assignment.scopeType === "student" && assignment.scopeId === targetPersonId) ||
    config.relationships.some((relationship) => isAssignedStudentRelationship(relationship, actor.userId, targetPersonId))
  );
}

function canReadStudent(config: PeopleConfiguration, actor: AcademyActor, assignments: PersonRoleAssignment[], request: PeopleAccessRequest) {
  if (!request.targetPersonId) {
    return false;
  }

  if (hasActiveMatchingRole(assignments, actor, peopleReadRoles)) {
    return true;
  }

  if (hasActiveRole(assignments, actor, "student")) {
    return actor.userId === request.targetPersonId;
  }

  if (hasActiveRole(assignments, actor, "guardian")) {
    return canGuardianAccessStudentCategory(config, {
      guardianPersonId: actor.userId,
      studentPersonId: request.targetPersonId,
      category: request.guardianCategory ?? "directory",
      asOf: request.asOf,
    });
  }

  return canReadAssignedStudent(config, actor, assignments, request.targetPersonId);
}

export function canAccessPeopleDomain(actor: AcademyActor, config: PeopleConfiguration, request: PeopleAccessRequest): boolean {
  if (!actorTenantMatches(actor, config, request)) {
    return false;
  }

  const assignments = activeAssignmentsForActor(config, actor);

  switch (request.action) {
    case "admin_people":
      return hasActiveRole(assignments, actor, "institution_admin");
    case "write_people":
      return hasActiveRole(assignments, actor, "institution_admin");
    case "read_people":
      return hasActiveMatchingRole(assignments, actor, peopleReadRoles);
    case "write_student":
      return Boolean(request.targetPersonId) && hasActiveMatchingRole(assignments, actor, studentWriteRoles);
    case "read_student":
      return canReadStudent(config, actor, assignments, request);
    case "read_guardian_relationship":
      return hasActiveMatchingRole(assignments, actor, peopleReadRoles) || hasActiveRole(assignments, actor, "guardian");
    case "write_guardian_relationship":
      return hasActiveMatchingRole(assignments, actor, guardianRelationshipWriteRoles);
    case "assign_instruction":
      return hasActiveMatchingRole(assignments, actor, instructionAssignmentRoles);
    case "write_person":
      return hasActiveMatchingRole(assignments, actor, personWriteRoles);
    case "write_staff":
      return hasActiveMatchingRole(assignments, actor, staffWriteRoles);
    case "write_guardian":
      return hasActiveMatchingRole(assignments, actor, guardianWriteRoles);
    case "write_relationship":
      return hasActiveMatchingRole(assignments, actor, relationshipWriteRoles);
    case "read_applicant":
      return hasActiveMatchingRole(assignments, actor, applicantReadRoles);
    case "write_applicant":
      return hasActiveMatchingRole(assignments, actor, applicantWriteRoles);
    case "read_advisor_load":
      return hasActiveMatchingRole(assignments, actor, advisorLoadReadRoles);
  }
}

export function assertPeopleAccess(actor: AcademyActor, config: PeopleConfiguration, request: PeopleAccessRequest) {
  if (!canAccessPeopleDomain(actor, config, request)) {
    throw new Error("Forbidden people domain access.");
  }
}
