import { randomUUID } from "node:crypto";
import { handleApi } from "@/app/api/academy/api-utils";
import {
  requireIdempotencyKey,
  toAdmissionApplicationResponse,
} from "@/app/api/academy/admissions/request-utils";
import { createAdmissionsService } from "@/app/api/academy/admissions/service-factory";
import {
  asAcademyDatabase,
  withAcademyDatabaseContext,
} from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import {
  AdmissionsDatabase,
  PostgresAdmissionsRepository,
} from "@/modules/admissions/postgres-repository";
import {
  assertAdmissionsAccess,
  canAccessAdmissions,
} from "@/modules/admissions/policy";
import {
  AdmissionApplication,
  CreateAdmissionApplicationInput,
} from "@/modules/admissions/types";
import { normalizeCreateAdmissionApplicationInput } from "@/modules/admissions/validation";

interface CreateAdmissionApplicationDependencies {
  resolveActor(request: Request): Promise<
    Awaited<ReturnType<typeof resolveAcademyActorFromSession>>["actor"]
  >;
  createDraft(
    actor: Awaited<
      ReturnType<typeof resolveAcademyActorFromSession>
    >["actor"],
    input: CreateAdmissionApplicationInput,
    correlationId: string,
    idempotencyKey: string,
  ): Promise<AdmissionApplication>;
}

const createDependencies: CreateAdmissionApplicationDependencies = {
  resolveActor: async (request) =>
    (await resolveAcademyActorFromSession(request)).actor,
  createDraft: async (actor, input, correlationId, idempotencyKey) =>
    withAcademyDatabaseContext(actor, (client) =>
      createAdmissionsService(client).createDraft(
        actor,
        input,
        correlationId,
        idempotencyKey,
      ),
    ),
};

export async function GET(request: Request) {
  return handleApi(async () => {
    const { actor } = await resolveAcademyActorFromSession(request);
    assertAdmissionsAccess(
      actor,
      actor.tenantId,
      actor.userId,
      "read",
    );
    return withAcademyDatabaseContext(actor, async (client) => {
      const repository = new PostgresAdmissionsRepository(
        asAcademyDatabase<AdmissionsDatabase>(client),
      );
      const staffView = canAccessAdmissions(
        actor,
        actor.tenantId,
        actor.userId,
        "review",
      );
      const applications = await repository.list(actor.tenantId, {
        applicantPersonId: staffView ? undefined : actor.userId,
      });
      return { applications, count: applications.length };
    });
  });
}

export async function POST(request: Request) {
  return createAdmissionApplicationRequest(request);
}

export async function createAdmissionApplicationRequest(
  request: Request,
  dependencies: CreateAdmissionApplicationDependencies = createDependencies,
) {
  return handleApi(async () => {
    const actor = await dependencies.resolveActor(request);
    const body = await request.json().catch(() => {
      throw new Error("Malformed JSON body.");
    });
    const input = normalizeCreateAdmissionApplicationInput(
      body,
      actor.tenantId,
    );
    assertAdmissionsAccess(
      actor,
      input.tenantId,
      input.applicantPersonId,
      "create",
    );
    const idempotencyKey = requireIdempotencyKey(request.headers);
    const correlationId =
      request.headers.get("x-correlation-id")?.trim() ||
      `corr-admission-${randomUUID()}`;

    return {
      application: toAdmissionApplicationResponse(
        await dependencies.createDraft(
        actor,
        input,
        correlationId,
        idempotencyKey,
      ),
      ),
    };
  });
}
