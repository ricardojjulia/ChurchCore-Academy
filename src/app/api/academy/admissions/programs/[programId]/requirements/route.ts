import { handleApi } from "@/app/api/academy/api-utils";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  CreateProgramRequirementInput,
  DocumentChecklistService,
} from "@/modules/admissions/document-checklist";
import {
  DocumentChecklistDatabase,
  PostgresDocumentChecklistRepository,
} from "@/modules/admissions/document-checklist-repository";

type RouteContext = { params: Promise<{ programId: string }> };

export async function GET(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { programId } = await context.params;
    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new PostgresDocumentChecklistRepository(
        asAcademyDatabase<DocumentChecklistDatabase>(client),
      );
      const service = new DocumentChecklistService(repository);
      const requirements = await service.listProgramRequirements(
        actor,
        programId,
      );
      return { requirements };
    });
  });
}

export async function POST(request: Request, context: RouteContext) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    const { programId } = await context.params;
    const body = await request.json().catch(() => {
      throw new Error("Malformed JSON body.");
    });

    const input: CreateProgramRequirementInput = {
      programId,
      label: String(body.label ?? "").trim(),
      description:
        typeof body.description === "string" && body.description.trim().length > 0
          ? body.description.trim()
          : undefined,
      isRequired: Boolean(body.isRequired ?? true),
      displayOrder:
        typeof body.displayOrder === "number" ? body.displayOrder : 0,
    };

    if (!input.label) {
      throw new Error("Requirement label is required.");
    }

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new PostgresDocumentChecklistRepository(
        asAcademyDatabase<DocumentChecklistDatabase>(client),
      );
      const service = new DocumentChecklistService(repository);
      const requirement = await service.createProgramRequirement(actor, input);
      return { requirement };
    });
  });
}
