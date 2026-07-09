import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  PostgresTranscriptEntryRepository,
  type TranscriptEntryDatabase,
} from "@/modules/transcript-entries/postgres-repository";
import { TranscriptEntryService } from "@/modules/transcript-entries/service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      const service = new TranscriptEntryService(
        new PostgresTranscriptEntryRepository(asAcademyDatabase<TranscriptEntryDatabase>(client)),
      );
      return {
        entries: await service.listByStudent(actor, id),
        candidates: await service.listCandidates(actor, id),
      };
    });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      const service = new TranscriptEntryService(
        new PostgresTranscriptEntryRepository(asAcademyDatabase<TranscriptEntryDatabase>(client)),
      );
      const entry = await service.createFromRegistration(
        actor,
        id,
        typeof body.courseSectionRegistrationId === "string"
          ? body.courseSectionRegistrationId
          : "",
      );
      return { entry };
    });
  });
}
