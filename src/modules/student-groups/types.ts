export type StudentGroupType = "cohort" | "graduating_class" | "program_cohort";
export type StudentGroupStatus = "active" | "archived";

export interface StudentGroup {
  id: string;
  tenantId: string;
  academicYearId: string;
  academicYearName?: string;
  academicProgramId?: string;
  programCode?: string;
  programTitle?: string;
  name: string;
  code: string;
  groupType: StudentGroupType;
  status: StudentGroupStatus;
  description?: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudentGroupMembership {
  id: string;
  tenantId: string;
  studentGroupId: string;
  groupName?: string;
  groupCode?: string;
  groupType?: StudentGroupType;
  groupStatus?: StudentGroupStatus;
  academicYearId?: string;
  academicYearName?: string;
  academicProgramId?: string;
  programTitle?: string;
  studentProfileId: string;
  studentPersonId: string;
  studentName?: string;
  studentNumber?: string;
  startedOn: string;
  endedOn?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentGroupInput {
  academicYearId: string;
  academicProgramId?: string;
  name: string;
  code: string;
  groupType: StudentGroupType;
  description?: string;
}

export interface UpdateStudentGroupInput {
  academicYearId: string;
  academicProgramId?: string;
  name: string;
  code: string;
  groupType: StudentGroupType;
  status: StudentGroupStatus;
  description?: string;
}

export interface AddStudentGroupMemberInput {
  studentProfileId: string;
  startedOn?: string;
}

export interface StudentGroupRepository {
  listGroups(tenantId: string): Promise<StudentGroup[]>;
  createGroup(tenantId: string, input: CreateStudentGroupInput, actorPersonId?: string): Promise<StudentGroup>;
  updateGroup(tenantId: string, groupId: string, input: UpdateStudentGroupInput): Promise<StudentGroup>;
  listMembers(tenantId: string, groupId: string): Promise<StudentGroupMembership[]>;
  listByStudent(tenantId: string, studentProfileId: string): Promise<StudentGroupMembership[]>;
  addMember(
    tenantId: string,
    groupId: string,
    input: Required<AddStudentGroupMemberInput>,
    actorPersonId: string,
  ): Promise<StudentGroupMembership>;
  removeMember(tenantId: string, groupId: string, membershipId: string, actorPersonId: string): Promise<void>;
}
