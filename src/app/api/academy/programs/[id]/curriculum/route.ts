import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  PostgresProgramCurriculumRepository,
  type ProgramCurriculumDatabase,
} from "@/modules/program-curriculum/postgres-repository";
import { ProgramCurriculumService } from "@/modules/program-curriculum/service";
import type {
  ProgramCurriculumRequirementInput,
  ProgramCurriculumRequirementType,
} from "@/modules/program-curriculum/types";

function parseRequirementType(value: unknown): ProgramCurriculumRequirementType {
  return value === "elective" || value === "practicum" || value === "capstone" ? value : "required";
}

function parseRequirements(body: Record<string, unknown>): ProgramCurriculumRequirementInput[] {
  const requirements = Array.isArray(body.requirements) ? body.requirements : [];

  return requirements.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      courseId: typeof row.courseId === "string" ? row.courseId : "",
      requirementType: parseRequirementType(row.requirementType),
      requirementGroup: typeof row.requirementGroup === "string" ? row.requirementGroup : "core",
      sequence: typeof row.sequence === "number" ? row.sequence : Number(row.sequence ?? 0),
      credits: typeof row.credits === "number" ? row.credits : Number(row.credits ?? 0),
      minimumGrade: typeof row.minimumGrade === "string" ? row.minimumGrade : undefined,
      notes: typeof row.notes === "string" ? row.notes : undefined,
    };
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");
    if (!academicYearId) throw new Error("academicYearId is required.");

    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      const service = new ProgramCurriculumService(
        new PostgresProgramCurriculumRepository(
          asAcademyDatabase<ProgramCurriculumDatabase>(client),
        ),
      );
      const requirements = await service.listCurriculum(actor, id, academicYearId);
      return { requirements };
    });
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const academicYearId = typeof body.academicYearId === "string" ? body.academicYearId : "";
    const { actor } = await resolveAcademyActorFromSession(request);

    return withAcademyDatabaseContext(actor, async (client) => {
      const service = new ProgramCurriculumService(
        new PostgresProgramCurriculumRepository(
          asAcademyDatabase<ProgramCurriculumDatabase>(client),
        ),
      );
      const requirements = await service.replaceCurriculum(actor, {
        academicProgramId: id,
        academicYearId,
        requirements: parseRequirements(body),
      });
      return { requirements };
    });
  });
}
