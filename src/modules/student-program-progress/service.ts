import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import type { StudentProgramProgressRepository, StudentProgramProgressSummary } from "./types";

const progressReadRoles = new Set<AcademyRole>([
  "institution_admin",
  "dean",
  "registrar",
  "academic_admin",
  "advisor",
]);

function assertProgressAccess(actor: AcademyActor) {
  if (!actor.roles.some((role) => progressReadRoles.has(role))) {
    throw new AcademyAuthorizationError("Forbidden student program progress access.");
  }
}

function requireText(value: string | undefined, field: string) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) throw new Error(`${field} is required.`);
  return trimmed;
}

export class StudentProgramProgressService {
  constructor(private readonly repository: StudentProgramProgressRepository) {}

  async getProgress(actor: AcademyActor, studentProfileId: string): Promise<StudentProgramProgressSummary | undefined> {
    assertProgressAccess(actor);
    return this.repository.getProgress(
      actor.tenantId,
      requireText(studentProfileId, "studentProfileId"),
    );
  }
}
