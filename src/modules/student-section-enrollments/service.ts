import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import type {
  AssignStudentSectionInput,
  AvailableStudentSection,
  StudentSectionEnrollment,
  StudentSectionEnrollmentRepository,
} from "./types";

const sectionEnrollmentRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
]);

function assertSectionEnrollmentAccess(actor: AcademyActor) {
  if (!actor.roles.some((role) => sectionEnrollmentRoles.has(role))) {
    throw new AcademyAuthorizationError("Forbidden student section enrollment access.");
  }
}

function requireText(value: string | undefined, field: string) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) throw new Error(`${field} is required.`);
  return trimmed;
}

export class StudentSectionEnrollmentService {
  constructor(private readonly repository: StudentSectionEnrollmentRepository) {}

  async listAvailableSections(actor: AcademyActor, studentProfileId: string): Promise<AvailableStudentSection[]> {
    assertSectionEnrollmentAccess(actor);
    return this.repository.listAvailableSections(
      actor.tenantId,
      requireText(studentProfileId, "studentProfileId"),
    );
  }

  async assignSection(
    actor: AcademyActor,
    input: AssignStudentSectionInput,
  ): Promise<StudentSectionEnrollment> {
    assertSectionEnrollmentAccess(actor);
    return this.repository.assignSection(actor.tenantId, {
      studentProfileId: requireText(input.studentProfileId, "studentProfileId"),
      courseSectionId: requireText(input.courseSectionId, "courseSectionId"),
    });
  }
}
