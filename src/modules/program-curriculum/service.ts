import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import type { AcademyActor, AcademyRole } from "@/modules/academy-auth/policy";
import type {
  ProgramCurriculumRepository,
  ProgramCurriculumRequirement,
  ProgramCurriculumRequirementInput,
  ReplaceProgramCurriculumInput,
} from "./types";

const curriculumAdminRoles = new Set<AcademyRole>([
  "institution_admin",
  "registrar",
  "academic_admin",
  "dean",
]);

function assertCurriculumAccess(actor: AcademyActor) {
  if (!actor.roles.some((role) => curriculumAdminRoles.has(role))) {
    throw new AcademyAuthorizationError("Forbidden program curriculum access.");
  }
}

function requireText(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required.`);
  return trimmed;
}

function normalizeRequirement(input: ProgramCurriculumRequirementInput): ProgramCurriculumRequirementInput {
  const sequence = Number(input.sequence);
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new Error("sequence must be a positive integer.");
  }

  const credits = Number(input.credits);
  if (!Number.isFinite(credits) || credits < 0) {
    throw new Error("credits must be zero or a positive number.");
  }

  const normalized: ProgramCurriculumRequirementInput = {
    courseId: requireText(input.courseId, "courseId"),
    requirementType: input.requirementType,
    requirementGroup: requireText(input.requirementGroup, "requirementGroup"),
    sequence,
    credits,
  };

  const minimumGrade = input.minimumGrade?.trim();
  if (minimumGrade) normalized.minimumGrade = minimumGrade;

  const notes = input.notes?.trim();
  if (notes) normalized.notes = notes;

  return normalized;
}

export class ProgramCurriculumService {
  constructor(private readonly repository: ProgramCurriculumRepository) {}

  async listCurriculum(
    actor: AcademyActor,
    academicProgramId: string,
    academicYearId: string,
  ): Promise<ProgramCurriculumRequirement[]> {
    assertCurriculumAccess(actor);
    return this.repository.listRequirements(
      actor.tenantId,
      requireText(academicProgramId, "academicProgramId"),
      requireText(academicYearId, "academicYearId"),
    );
  }

  async replaceCurriculum(
    actor: AcademyActor,
    input: ReplaceProgramCurriculumInput,
  ): Promise<ProgramCurriculumRequirement[]> {
    assertCurriculumAccess(actor);

    const normalized = input.requirements
      .map(normalizeRequirement)
      .sort((a, b) => a.sequence - b.sequence);

    const seenCourseIds = new Set<string>();
    for (const requirement of normalized) {
      if (seenCourseIds.has(requirement.courseId)) {
        throw new Error("A course can appear only once in a program curriculum catalog year.");
      }
      seenCourseIds.add(requirement.courseId);
    }

    return this.repository.replaceRequirements(
      actor.tenantId,
      requireText(input.academicProgramId, "academicProgramId"),
      requireText(input.academicYearId, "academicYearId"),
      normalized,
    );
  }
}
