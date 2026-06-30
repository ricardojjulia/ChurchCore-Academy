import { handleApi } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { assertCapability } from "@/modules/academy-auth/policy";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  PostgresTranscriptRepository,
  type TranscriptDatabase,
} from "@/modules/transcripts/postgres-repository";
import { TranscriptService } from "@/modules/transcripts/service";

interface TranscriptTransitionDependencies {
  resolveActor?: (request: Request) => Promise<AcademyActor>;
  serviceForActor?: (actor: AcademyActor) => Promise<TranscriptService>;
}

async function defaultServiceForActor(actor: AcademyActor) {
  return withCapabilityContext(actor, async (client, capabilities) => {
    assertCapability(capabilities, "transcriptWorkflows");
    const repository = new PostgresTranscriptRepository(
      asAcademyDatabase<TranscriptDatabase>(client),
    );
    return new TranscriptService(repository);
  });
}

function parseReason(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

export async function transitionTranscriptRequest(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  action: "hold" | "release" | "revoke",
  dependencies: TranscriptTransitionDependencies = {},
) {
  return handleApi(async () => {
    const { id } = await params;
    if (!id) throw new Error("Transcript id is required.");

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const actor = await (
      dependencies.resolveActor ??
      (async (currentRequest) =>
        (await resolveAcademyActorFromSession(currentRequest)).actor)
    )(request);
    const service = await (
      dependencies.serviceForActor ?? defaultServiceForActor
    )(actor);
    const reason = parseReason(body.reason, `Transcript ${action}.`);

    if (action === "hold") {
      return service.holdTranscript(actor, id, reason);
    }

    if (action === "release") {
      return service.releaseTranscript(actor, id, reason);
    }

    return service.revokeTranscript(actor, id, reason);
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return transitionTranscriptRequest(request, { params }, "revoke");
}
