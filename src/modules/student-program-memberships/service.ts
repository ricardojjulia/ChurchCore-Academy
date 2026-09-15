import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import type {
  SetActiveStudentProgramMembershipInput,
  StudentProgramMembership,
  StudentProgramMembershipRepository,
} from "./types";

const membershipAdminRoles = new Set<AcademyRole>([
  "institution_admin",
  "registrar",
  "academic_admin",
  "dean",
]);

function assertMembershipAccess(actor: AcademyActor) {
  if (!actor.roles.some((role) => membershipAdminRoles.has(role))) {
    throw new AcademyAuthorizationError("Forbidden student program membership access.");
  }
}

function requireText(value: string | undefined, field: string) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) throw new Error(`${field} is required.`);
  return trimmed;
}

function normalizeDate(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("startedOn must use YYYY-MM-DD format.");
  }
  return trimmed;
}

export class StudentProgramMembershipService {
  constructor(private readonly repository: StudentProgramMembershipRepository) {}

  async listMemberships(actor: AcademyActor, studentProfileId: string): Promise<StudentProgramMembership[]> {
    assertMembershipAccess(actor);
    return this.repository.listByStudent(actor.tenantId, requireText(studentProfileId, "studentProfileId"));
  }

  async setActiveMembership(
    actor: AcademyActor,
    input: SetActiveStudentProgramMembershipInput,
  ): Promise<StudentProgramMembership> {
    assertMembershipAccess(actor);

    return this.repository.setActive(actor.tenantId, {
      studentProfileId: requireText(input.studentProfileId, "studentProfileId"),
      academicProgramId: requireText(input.academicProgramId, "academicProgramId"),
      catalogAcademicYearId: requireText(input.catalogAcademicYearId, "catalogAcademicYearId"),
      startedOn: normalizeDate(input.startedOn),
    });
  }
}
