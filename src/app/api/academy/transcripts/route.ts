import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyAuthorizationError } from "@/modules/academy-auth/errors";
import {
  PostgresTranscriptRepository,
  type TranscriptDatabase,
} from "@/modules/transcripts/postgres-repository";
import {
  hasTranscriptAdminAccess,
  TranscriptService,
} from "@/modules/transcripts/service";
import type {
  TranscriptDeliveryMethod,
  TranscriptRecord,
} from "@/modules/transcripts/types";

interface TranscriptRouteDependencies {
  resolveActor?: (request: Request) => Promise<AcademyActor>;
  serviceForActor?: (actor: AcademyActor) => Promise<TranscriptService>;
  findByStudent?: (
    actor: AcademyActor,
    studentPersonId: string,
  ) => Promise<TranscriptRecord[]>;
}

function requireIdempotencyKey(request: Request, body: Record<string, unknown>) {
  const key =
    request.headers.get("Idempotency-Key") ??
    (typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined);

  if (!key?.trim()) {
    throw new Error("Idempotency-Key is required.");
  }

  return key.trim();
}

function parseDeliveryMethod(value: unknown): TranscriptDeliveryMethod {
  if (
    value === "digital_download" ||
    value === "email" ||
    value === "print"
  ) {
    return value;
  }

  throw new Error("deliveryMethod is required.");
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

async function defaultServiceForActor(actor: AcademyActor) {
  return withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresTranscriptRepository(
      asAcademyDatabase<TranscriptDatabase>(client),
    );
    return new TranscriptService(repository);
  });
}

async function defaultFindByStudent(actor: AcademyActor, studentPersonId: string) {
  return withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresTranscriptRepository(
      asAcademyDatabase<TranscriptDatabase>(client),
    );
    return repository.findByStudent(actor.tenantId, studentPersonId);
  });
}

export async function createTranscriptRequest(
  request: Request,
  dependencies: TranscriptRouteDependencies = {},
) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;
    const actor = await (
      dependencies.resolveActor ??
      (async (currentRequest) =>
        (await resolveAcademyActorFromSession(currentRequest)).actor)
    )(request);
    const action = stringField(body.action) ?? "issue";
    const studentPersonId =
      stringField(body.studentPersonId) ??
      (action === "request" ? actor.userId : undefined);

    if (!studentPersonId) {
      throw new Error("studentPersonId is required.");
    }

    const input = {
      studentPersonId,
      deliveryMethod: parseDeliveryMethod(body.deliveryMethod),
      recipientName: stringField(body.recipientName),
      recipientEmail: stringField(body.recipientEmail),
      note: stringField(body.note),
      idempotencyKey: requireIdempotencyKey(request, body),
    };
    const service = await (
      dependencies.serviceForActor ?? defaultServiceForActor
    )(actor);

    if (action === "request") {
      return service.requestTranscript(actor, input);
    }

    if (action === "issue") {
      return service.issueTranscript(actor, input);
    }

    throw new Error("action must be request or issue.");
  });
}

export async function listTranscriptRequests(
  request: Request,
  dependencies: TranscriptRouteDependencies = {},
) {
  return handleApi(async () => {
    const { searchParams } = new URL(request.url);
    const studentPersonId = searchParams.get("studentId")?.trim();

    if (!studentPersonId) throw new Error("studentId is required.");

    const actor = await (
      dependencies.resolveActor ??
      (async (currentRequest) =>
        (await resolveAcademyActorFromSession(currentRequest)).actor)
    )(request);

    if (!hasTranscriptAdminAccess(actor) && studentPersonId !== actor.userId) {
      throw new AcademyAuthorizationError(
        "Students can read only their own transcript requests.",
      );
    }

    const records = await (
      dependencies.findByStudent ?? defaultFindByStudent
    )(actor, studentPersonId);

    if (!hasTranscriptAdminAccess(actor)) {
      return records.filter((record) => record.status !== "revoked");
    }

    return records;
  });
}

export async function POST(request: Request) {
  return createTranscriptRequest(request);
}

export async function GET(request: Request) {
  return listTranscriptRequests(request);
}
