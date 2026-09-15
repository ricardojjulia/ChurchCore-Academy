import { jsonError, jsonOk } from "@/app/api/academy/api-utils";
import { asAcademyDatabase, withAcademyDatabaseContext } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import { AcademyConfigRepository } from "@/modules/academy-config/postgres-repository";
import type { InstitutionProfile } from "@/modules/academy-config/types";
import {
  PostgresLmsRosterSourceRepository,
  type LmsRosterSourceDatabase,
} from "@/modules/lms-roster-source";
import {
  assertLmsProviderReadinessAccess,
  buildLmsProviderReadinessModel,
} from "@/modules/lms-contract/provider-readiness";
import { runLmsSandboxChecks } from "@/modules/lms-contract/sandbox-check-runner";
import {
  PostgresLmsSandboxCheckResultRepository,
  groupLmsSandboxCheckResultsForReadiness,
  type LmsSandboxCheckResultRecord,
  type RecordLmsSandboxCheckResultInput,
} from "@/modules/lms-contract/sandbox-check-results";
import {
  PostgresLmsSandboxEvidenceRepository,
  groupLmsSandboxEvidenceForReadiness,
  type LmsSandboxEvidenceRecord,
  type RecordLmsSandboxEvidenceInput,
} from "@/modules/lms-contract/sandbox-evidence";
import {
  PostgresLmsActivationRequestRepository,
  evaluateLmsActivationEligibility,
  groupLmsActivationRequestsForReadiness,
  type LmsActivationRequestRecord,
  type RequestLmsActivationInput,
} from "@/modules/lms-contract/activation-requests";

type RepoPool = { query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }> };

interface LmsReadinessRepository {
  fetchInstitutionProfile(tenantId: string): Promise<InstitutionProfile>;
  listEvidence?(tenantId: string): Promise<LmsSandboxEvidenceRecord[]>;
  listCheckResults?(tenantId: string): Promise<LmsSandboxCheckResultRecord[]>;
  listActivationRequests?(tenantId: string): Promise<LmsActivationRequestRecord[]>;
  countRosterEligibleSections?(tenantId: string): Promise<number>;
  recordEvidence?(
    tenantId: string,
    recordedByPersonId: string,
    input: RecordLmsSandboxEvidenceInput,
  ): Promise<LmsSandboxEvidenceRecord>;
  recordCheckResult?(
    tenantId: string,
    runByPersonId: string,
    input: RecordLmsSandboxCheckResultInput,
  ): Promise<LmsSandboxCheckResultRecord>;
  requestActivation?(
    tenantId: string,
    requestedByPersonId: string,
    input: RequestLmsActivationInput,
  ): Promise<LmsActivationRequestRecord>;
  approveActivation?(
    tenantId: string,
    providerId: "moodle" | "canvas",
    decidedByPersonId: string,
    decisionNote: string,
  ): Promise<LmsActivationRequestRecord>;
  rejectActivation?(
    tenantId: string,
    providerId: "moodle" | "canvas",
    decidedByPersonId: string,
    decisionNote: string,
  ): Promise<LmsActivationRequestRecord>;
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
    const { profile, evidence, checkResults, activationRequests } = repository
      ? {
          profile: await repository.fetchInstitutionProfile(actor.tenantId),
          evidence: repository.listEvidence ? await repository.listEvidence(actor.tenantId) : [],
          checkResults: repository.listCheckResults ? await repository.listCheckResults(actor.tenantId) : [],
          activationRequests: repository.listActivationRequests ? await repository.listActivationRequests(actor.tenantId) : [],
        }
      : await withAcademyDatabaseContext(actor, async (client) => {
          const database = asAcademyDatabase<RepoPool>(client);
          const profile = await new AcademyConfigRepository(database).fetchInstitutionProfile(actor.tenantId);
          const evidence = await new PostgresLmsSandboxEvidenceRepository(database).listEvidence(actor.tenantId);
          const checkResults = await new PostgresLmsSandboxCheckResultRepository(database).listLatestResults(actor.tenantId);
          const activationRequests = await new PostgresLmsActivationRequestRepository(database).listLatestRequests(actor.tenantId);
          return { profile, evidence, checkResults, activationRequests };
        });

    return jsonOk({
      readiness: buildLmsProviderReadinessModel(profile, actor, {
        recordedSandboxEvidence: groupLmsSandboxEvidenceForReadiness(evidence),
        sandboxCheckResults: groupLmsSandboxCheckResultsForReadiness(checkResults),
        activationRequests: groupLmsActivationRequestsForReadiness(activationRequests),
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
    } & RecordLmsSandboxEvidenceInput)
  | {
      action: "run_sandbox_checks";
      providerId: "moodle" | "canvas";
    }
  | {
      action: "request_activation";
      providerId: "moodle" | "canvas";
    }
  | {
      action: "approve_activation" | "reject_activation";
      providerId: "moodle" | "canvas";
      decisionNote: string;
    };

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

  if (payload.action === "run_sandbox_checks" && (payload.providerId === "moodle" || payload.providerId === "canvas")) {
    return {
      action: payload.action,
      providerId: payload.providerId,
    };
  }

  if (payload.action === "request_activation" && (payload.providerId === "moodle" || payload.providerId === "canvas")) {
    return {
      action: payload.action,
      providerId: payload.providerId,
    };
  }

  if (
    (payload.action === "approve_activation" || payload.action === "reject_activation") &&
    (payload.providerId === "moodle" || payload.providerId === "canvas") &&
    typeof payload.decisionNote === "string"
  ) {
    return {
      action: payload.action,
      providerId: payload.providerId,
      decisionNote: payload.decisionNote,
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

    if (body.action === "run_sandbox_checks") {
      const checkResults = repository?.recordCheckResult
        ? await runSandboxChecksWithRepository(actor, body.providerId, repository)
        : await withAcademyDatabaseContext(actor, async (client) => {
            const database = asAcademyDatabase<RepoPool>(client);
            const repo = new PostgresLmsSandboxCheckResultRepository(database);
            const evidence = await new PostgresLmsSandboxEvidenceRepository(database).listEvidence(actor.tenantId);
            const rosterSections = await new PostgresLmsRosterSourceRepository(
              asAcademyDatabase<LmsRosterSourceDatabase>(client),
            ).listRosterEligibleSections(actor.tenantId);
            const inputs = runLmsSandboxChecks({
              providerId: body.providerId,
              recordedEvidence: groupLmsSandboxEvidenceForReadiness(evidence)[body.providerId] ?? [],
              rosterEligibleSectionCount: rosterSections.length,
            });

            const results: LmsSandboxCheckResultRecord[] = [];
            for (const input of inputs) {
              results.push(await repo.recordResult(actor.tenantId, actor.userId, input));
            }
            return results;
          });

      return jsonOk({ checkResults });
    }

    if (body.action === "request_activation") {
      const activationRequest = repository
        ? await requestActivationWithRepository(actor, body.providerId, repository)
        : await withAcademyDatabaseContext(actor, async (client) => {
            const database = asAcademyDatabase<RepoPool>(client);
            const evidence = await new PostgresLmsSandboxEvidenceRepository(database).listEvidence(actor.tenantId);
            const checkResults = await new PostgresLmsSandboxCheckResultRepository(database).listLatestResults(actor.tenantId);
            const eligibility = evaluateLmsActivationEligibility({
              providerId: body.providerId,
              evidence: groupLmsSandboxEvidenceForReadiness(evidence)[body.providerId] ?? [],
              checkResults: groupLmsSandboxCheckResultsForReadiness(checkResults)[body.providerId] ?? [],
            });
            if (!eligibility.eligible) {
              throw new Error(`Invalid LMS activation request: ${eligibility.blockers.join(" ")}`);
            }
            return new PostgresLmsActivationRequestRepository(database).requestActivation(actor.tenantId, actor.userId, {
              providerId: body.providerId,
              safeSummary: `${body.providerId === "moodle" ? "Moodle" : "Canvas"} activation requested after sandbox checks passed.`,
              evidenceSnapshot: eligibility.evidenceSnapshot,
            });
          });

      return jsonOk({ activationRequest });
    }

    if (body.action === "approve_activation") {
      const activationRequest = repository?.approveActivation
        ? await repository.approveActivation(actor.tenantId, body.providerId, actor.userId, body.decisionNote)
        : await withAcademyDatabaseContext(actor, async (client) => {
            return new PostgresLmsActivationRequestRepository(asAcademyDatabase<RepoPool>(client)).approveActivation(
              actor.tenantId,
              body.providerId,
              actor.userId,
              body.decisionNote,
            );
          });

      return jsonOk({ activationRequest });
    }

    if (body.action === "reject_activation") {
      const activationRequest = repository?.rejectActivation
        ? await repository.rejectActivation(actor.tenantId, body.providerId, actor.userId, body.decisionNote)
        : await withAcademyDatabaseContext(actor, async (client) => {
            return new PostgresLmsActivationRequestRepository(asAcademyDatabase<RepoPool>(client)).rejectActivation(
              actor.tenantId,
              body.providerId,
              actor.userId,
              body.decisionNote,
            );
          });

      return jsonOk({ activationRequest });
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

async function requestActivationWithRepository(
  actor: AcademyActor,
  providerId: "moodle" | "canvas",
  repository: LmsReadinessRepository,
) {
  const evidence = repository.listEvidence ? await repository.listEvidence(actor.tenantId) : [];
  const checkResults = repository.listCheckResults ? await repository.listCheckResults(actor.tenantId) : [];
  const eligibility = evaluateLmsActivationEligibility({
    providerId,
    evidence: groupLmsSandboxEvidenceForReadiness(evidence)[providerId] ?? [],
    checkResults: groupLmsSandboxCheckResultsForReadiness(checkResults)[providerId] ?? [],
  });

  if (!eligibility.eligible) {
    throw new Error(`Invalid LMS activation request: ${eligibility.blockers.join(" ")}`);
  }

  if (!repository.requestActivation) {
    throw new Error("Invalid LMS activation request repository.");
  }

  return repository.requestActivation(actor.tenantId, actor.userId, {
    providerId,
    safeSummary: `${providerId === "moodle" ? "Moodle" : "Canvas"} activation requested after sandbox checks passed.`,
    evidenceSnapshot: eligibility.evidenceSnapshot,
  });
}

async function runSandboxChecksWithRepository(
  actor: AcademyActor,
  providerId: "moodle" | "canvas",
  repository: LmsReadinessRepository,
) {
  if (!repository.recordCheckResult) {
    throw new Error("Invalid LMS sandbox check result repository.");
  }
  const evidence = repository.listEvidence ? await repository.listEvidence(actor.tenantId) : [];
  const rosterEligibleSectionCount = repository.countRosterEligibleSections
    ? await repository.countRosterEligibleSections(actor.tenantId)
    : 0;
  const inputs = runLmsSandboxChecks({
    providerId,
    recordedEvidence: groupLmsSandboxEvidenceForReadiness(evidence)[providerId] ?? [],
    rosterEligibleSectionCount,
  });

  const results: LmsSandboxCheckResultRecord[] = [];
  for (const input of inputs) {
    results.push(await repository.recordCheckResult(actor.tenantId, actor.userId, input));
  }
  return results;
}

export async function GET(request: Request) {
  return loadLmsReadinessRequest(request);
}

export async function POST(request: Request) {
  return handleLmsReadinessAction(request);
}
