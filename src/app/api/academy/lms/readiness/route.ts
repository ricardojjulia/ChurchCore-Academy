import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { asAcademyDatabase } from "@/lib/academy-database-context";
import { withCapabilityContext } from "@/lib/capability-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { assertCapability } from "@/modules/academy-auth/policy";
import { AcademyConfigRepository } from "@/modules/academy-config/postgres-repository";
import type { InstitutionProfile } from "@/modules/academy-config/types";
import {
  assertLmsProviderReadinessAccess,
  buildLmsProviderReadinessModel,
} from "@/modules/lms-contract/provider-readiness";

type RepoPool = { query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }> };

interface LmsReadinessRepository {
  fetchInstitutionProfile(tenantId: string): Promise<InstitutionProfile>;
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
    const profile = repository
      ? await repository.fetchInstitutionProfile(actor.tenantId)
      : await withCapabilityContext(actor, async (client, capabilities) => {
          assertCapability(capabilities, "lmsLaunch");
          return new AcademyConfigRepository(asAcademyDatabase<RepoPool>(client)).fetchInstitutionProfile(actor.tenantId);
        });

    return jsonOk({
      readiness: buildLmsProviderReadinessModel(profile, actor),
    });
  } catch (error) {
    return mapError(error);
  }
}

function parseActionPayload(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid LMS readiness action payload.");
  }

  const payload = body as Record<string, unknown>;
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
) {
  try {
    const { actor } = await resolveActor(request);
    assertLmsProviderReadinessAccess(actor, actor.tenantId, "manage");
    const body = parseActionPayload(await request.json());

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
