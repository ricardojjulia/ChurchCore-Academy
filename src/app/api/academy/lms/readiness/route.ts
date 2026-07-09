import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyConfigRepository } from "@/modules/academy-config/postgres-repository";
import type { InstitutionProfile } from "@/modules/academy-config/types";
import {
  assertLmsProviderReadinessAccess,
  buildLmsProviderReadinessModel,
} from "@/modules/lms-contract/provider-readiness";
import {
  PostgresLmsSandboxEvidenceRepository,
  groupLmsSandboxEvidenceForReadiness,
  type LmsSandboxEvidenceRecord,
  type RecordLmsSandboxEvidenceInput,
} from "@/modules/lms-contract/sandbox-evidence";

type RepoPool = { query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }> };

interface LmsReadinessRepository {
  fetchInstitutionProfile(tenantId: string): Promise<InstitutionProfile>;
  listEvidence?(tenantId: string): Promise<LmsSandboxEvidenceRecord[]>;
  recordEvidence?(
    tenantId: string,
    recordedByPersonId: string,
    input: RecordLmsSandboxEvidenceInput,
  ): Promise<LmsSandboxEvidenceRecord>;
}

type ActorResolver = (request: Request) => Promise<{ actor: AcademyActor }>;

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to load LMS readiness.";
  if (message.includes("Authentication")) return jsonError("Authentication required.", 401);
  if (message.includes("Forbidden")) return jsonError(message, 403);
  if (message.startsWith("Invalid ")) return jsonError(message, 400);
  return jsonError("Unable to load LMS readiness.", 500);
}

export async function loadLmsReadinessRequest(
  request: Request,
  repository?: LmsReadinessRepository,
  resolveActor: ActorResolver = resolveAcademyActorFromSession,
) {
  try {
    const { actor } = await resolveActor(request);
    assertLmsProviderReadinessAccess(actor, actor.tenantId, "read");
    const { profile, evidence } = repository
      ? {
          profile: await repository.fetchInstitutionProfile(actor.tenantId),
          evidence: repository.listEvidence ? await repository.listEvidence(actor.tenantId) : [],
        }
      : await withAcademyDatabaseContext(actor, async (client) => {
          const database = asAcademyDatabase<RepoPool>(client);
          const profile = await new AcademyConfigRepository(database).fetchInstitutionProfile(actor.tenantId);
          const evidence = await new PostgresLmsSandboxEvidenceRepository(database).listEvidence(actor.tenantId);
          return { profile, evidence };
        });

    return jsonOk({
      readiness: buildLmsProviderReadinessModel(profile, actor, {
        recordedSandboxEvidence: groupLmsSandboxEvidenceForReadiness(evidence),
      }),
    });
  } catch (error) {
    return mapError(error);
  }
}

type ParsedActionPayload =
  | {
      action: "pause" | "resume";
      providerId: "moodle" | "canvas";
    }
  | ({
      action: "record_sandbox_evidence";
    } & RecordLmsSandboxEvidenceInput);

function parseActionPayload(body: unknown): ParsedActionPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid LMS readiness action payload.");
  }

  const payload = body as Record<string, unknown>;
  if (payload.action === "record_sandbox_evidence") {
    return {
      action: payload.action,
      providerId: payload.providerId as "moodle" | "canvas",
      evidenceLabel: payload.evidenceLabel as string,
      status: payload.status as "pending" | "recorded",
      reference: payload.reference as string,
      notes: payload.notes as string | undefined,
    };
  }

  if ((payload.providerId !== "moodle" && payload.providerId !== "canvas") || (payload.action !== "pause" && payload.action !== "resume")) {
    throw new Error("Invalid LMS readiness action.");
  }

  return {
    providerId: payload.providerId,
    action: payload.action,
  };
}

export async function handleLmsReadinessAction(
  request: Request,
  resolveActor: ActorResolver = resolveAcademyActorFromSession,
  repository?: LmsReadinessRepository,
) {
  try {
    const { actor } = await resolveActor(request);
    assertLmsProviderReadinessAccess(actor, actor.tenantId, "manage");
    const body = parseActionPayload(await request.json());

    if (body.action === "record_sandbox_evidence") {
      const { action: _action, ...input } = body;
      const evidence = repository?.recordEvidence
        ? await repository.recordEvidence(actor.tenantId, actor.userId, input)
        : await withAcademyDatabaseContext(actor, async (client) => {
            return new PostgresLmsSandboxEvidenceRepository(asAcademyDatabase<RepoPool>(client)).recordEvidence(
              actor.tenantId,
              actor.userId,
              input,
            );
          });

      return jsonOk({ evidence });
    }

    return jsonOk({
      action: {
        ...body,
        status: "accepted_for_operator_review",
      },
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function GET(request: Request) {
  return loadLmsReadinessRequest(request);
}

export async function POST(request: Request) {
  return handleLmsReadinessAction(request);
}
