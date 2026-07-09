import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import type {
  AddStudentGroupMemberInput,
  CreateStudentGroupInput,
  StudentGroup,
  StudentGroupMembership,
  StudentGroupRepository,
  StudentGroupStatus,
  StudentGroupType,
  UpdateStudentGroupInput,
} from "./types";

const adminRoles = new Set<AcademyRole>(["institution_admin", "registrar", "academic_admin", "dean"]);
const groupTypes = new Set<StudentGroupType>(["cohort", "graduating_class", "program_cohort"]);
const groupStatuses = new Set<StudentGroupStatus>(["active", "archived"]);

function assertAccess(actor: AcademyActor) {
  if (!actor.roles.some((role) => adminRoles.has(role))) {
    throw new AcademyAuthorizationError("Forbidden student group access.");
  }
}

function text(value: string | undefined, field: string) {
  const normalized = value?.trim() ?? "";
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

function optionalText(value: string | undefined) {
  return value?.trim() || undefined;
}

function date(value: string | undefined) {
  const normalized = value?.trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("startedOn must use YYYY-MM-DD format.");
  }
  return normalized;
}

function normalizeGroup<T extends CreateStudentGroupInput | UpdateStudentGroupInput>(input: T): T {
  if (!groupTypes.has(input.groupType)) throw new Error("groupType is invalid.");
  if ("status" in input && !groupStatuses.has(input.status)) throw new Error("status is invalid.");
  const academicProgramId = optionalText(input.academicProgramId);
  if (input.groupType === "program_cohort" && !academicProgramId) {
    throw new Error("academicProgramId is required for a program cohort.");
  }
  return {
    ...input,
    name: text(input.name, "name"),
    code: text(input.code, "code").toUpperCase(),
    academicYearId: text(input.academicYearId, "academicYearId"),
    academicProgramId,
    description: optionalText(input.description),
  };
}

export class StudentGroupService {
  constructor(private readonly repository: StudentGroupRepository) {}

  async listGroups(actor: AcademyActor): Promise<StudentGroup[]> {
    assertAccess(actor);
    return this.repository.listGroups(actor.tenantId);
  }

  async createGroup(actor: AcademyActor, input: CreateStudentGroupInput): Promise<StudentGroup> {
    assertAccess(actor);
    return this.repository.createGroup(actor.tenantId, normalizeGroup(input), actor.userId);
  }

  async updateGroup(actor: AcademyActor, groupId: string, input: UpdateStudentGroupInput): Promise<StudentGroup> {
    assertAccess(actor);
    return this.repository.updateGroup(actor.tenantId, text(groupId, "groupId"), normalizeGroup(input));
  }

  async listMembers(actor: AcademyActor, groupId: string): Promise<StudentGroupMembership[]> {
    assertAccess(actor);
    return this.repository.listMembers(actor.tenantId, text(groupId, "groupId"));
  }

  async listStudentMemberships(actor: AcademyActor, studentProfileId: string): Promise<StudentGroupMembership[]> {
    assertAccess(actor);
    return this.repository.listByStudent(actor.tenantId, text(studentProfileId, "studentProfileId"));
  }

  async addMember(
    actor: AcademyActor,
    groupId: string,
    input: AddStudentGroupMemberInput,
  ): Promise<StudentGroupMembership> {
    assertAccess(actor);
    return this.repository.addMember(
      actor.tenantId,
      text(groupId, "groupId"),
      { studentProfileId: text(input.studentProfileId, "studentProfileId"), startedOn: date(input.startedOn) },
      actor.userId,
    );
  }

  async removeMember(actor: AcademyActor, groupId: string, membershipId: string): Promise<void> {
    assertAccess(actor);
    await this.repository.removeMember(
      actor.tenantId,
      text(groupId, "groupId"),
      text(membershipId, "membershipId"),
      actor.userId,
    );
  }
}
