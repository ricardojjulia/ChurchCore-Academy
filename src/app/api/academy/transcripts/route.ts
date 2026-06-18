import { randomUUID } from "node:crypto";
import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  PostgresTranscriptRepository,
  type TranscriptDatabase,
} from "@/modules/transcripts/postgres-repository";
import { validateTranscriptRequest } from "@/modules/transcripts/types";

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;
    const { actor } = await resolveAcademyActorFromSession(request);

    const input = validateTranscriptRequest({
      tenantId: actor.tenantId,
      studentPersonId: typeof body.studentPersonId === "string" ? body.studentPersonId : undefined,
      requestedByPersonId: actor.userId,
      deliveryMethod: typeof body.deliveryMethod === "string" ? body.deliveryMethod as never : undefined,
      recipientName: typeof body.recipientName === "string" ? body.recipientName : undefined,
      recipientEmail: typeof body.recipientEmail === "string" ? body.recipientEmail : undefined,
      note: typeof body.note === "string" ? body.note : undefined,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : randomUUID(),
    });

    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new PostgresTranscriptRepository(
        asAcademyDatabase<TranscriptDatabase>(client),
      );
      return repository.issue(input);
    });
  });
}

export async function GET(request: Request) {
  return handleApi(async () => {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) throw new Error("studentId is required.");

    const { actor } = await resolveAcademyActorFromSession(request);
    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new PostgresTranscriptRepository(
        asAcademyDatabase<TranscriptDatabase>(client),
      );
      return repository.findByStudent(actor.tenantId, studentId);
    });
  });
}
