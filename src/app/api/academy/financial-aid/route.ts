import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  FinancialAidDatabase,
  PostgresFinancialAidRepository,
} from "@/modules/financial-aid/postgres-repository";
import { FinancialAidService } from "@/modules/financial-aid/service";
import type {
  AidAwardStatus,
  AidAwardType,
  AidHoldType,
  AidSourceType,
} from "@/modules/financial-aid/types";

interface FinancialAidRouteDependencies {
  resolveActor?: (request: Request) => Promise<AcademyActor>;
  serviceForActor?: (actor: AcademyActor) => Promise<FinancialAidService>;
}

function text(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function amount(value: unknown) {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error("amountCents must be a positive integer.");
  }
  return Number(value);
}

function idempotencyKey(request: Request, body: Record<string, unknown>) {
  const key =
    request.headers.get("Idempotency-Key") ??
    optionalText(body.idempotencyKey);
  if (!key) throw new Error("Idempotency-Key is required.");
  return key;
}

function awardType(value: unknown): AidAwardType {
  if (
    value === "scholarship" ||
    value === "grant" ||
    value === "discount" ||
    value === "sponsorship" ||
    value === "federal_grant" ||
    value === "federal_loan"
  ) {
    return value;
  }
  throw new Error("awardType is required.");
}

function sourceType(value: unknown): AidSourceType {
  if (
    value === "institutional" ||
    value === "denominational" ||
    value === "mission" ||
    value === "church" ||
    value === "federal"
  ) {
    return value;
  }
  throw new Error("sourceType is required.");
}

function awardStatus(value: unknown): AidAwardStatus {
  if (
    value === "offered" ||
    value === "accepted" ||
    value === "declined" ||
    value === "cancelled"
  ) {
    return value;
  }
  throw new Error("status must be offered, accepted, declined, or cancelled.");
}

function holdType(value: unknown): AidHoldType {
  if (
    value === "documentation" ||
    value === "sap_review" ||
    value === "aid_review" ||
    value === "federal_aid_disabled"
  ) {
    return value;
  }
  throw new Error("holdType is required.");
}

async function defaultServiceForActor(actor: AcademyActor) {
  return withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresFinancialAidRepository(
      asAcademyDatabase<FinancialAidDatabase>(client),
    );
    return new FinancialAidService(repository);
  });
}

async function resolveActor(
  request: Request,
  dependencies: FinancialAidRouteDependencies,
) {
  return (
    dependencies.resolveActor ??
    (async (currentRequest) =>
      (await resolveAcademyActorFromSession(currentRequest)).actor)
  )(request);
}

export async function readFinancialAidSummary(
  request: Request,
  dependencies: FinancialAidRouteDependencies = {},
) {
  return handleApi(async () => {
    const actor = await resolveActor(request, dependencies);
    const service = await (
      dependencies.serviceForActor ?? defaultServiceForActor
    )(actor);
    const { searchParams } = new URL(request.url);
    const studentPersonId = searchParams.get("studentId")?.trim() ?? actor.userId;
    return service.readStudentAid(actor, studentPersonId);
  });
}

export async function mutateFinancialAid(
  request: Request,
  dependencies: FinancialAidRouteDependencies = {},
) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;
    const actor = await resolveActor(request, dependencies);
    const action = text(body.action, "action");
    const key =
      action === "schedule_disbursement" || action === "post_disbursement"
        ? idempotencyKey(request, body)
        : undefined;
    const service = await (
      dependencies.serviceForActor ?? defaultServiceForActor
    )(actor);

    if (action === "create_package") {
      return service.createPackage(actor, {
        studentPersonId: text(body.studentPersonId, "studentPersonId"),
        aidYear: text(body.aidYear, "aidYear"),
      });
    }

    if (action === "create_award") {
      return service.createAward(actor, {
        packageId: text(body.packageId, "packageId"),
        studentPersonId: text(body.studentPersonId, "studentPersonId"),
        awardType: awardType(body.awardType),
        sourceType: sourceType(body.sourceType),
        amountCents: amount(body.amountCents),
        currency: optionalText(body.currency) ?? "USD",
        description: text(body.description, "description"),
      });
    }

    if (action === "update_award_status") {
      return service.updateAwardStatus(actor, {
        awardId: text(body.awardId, "awardId"),
        status: awardStatus(body.status),
      });
    }

    if (action === "schedule_disbursement") {
      const requiredKey = key ?? idempotencyKey(request, body);
      return service.scheduleDisbursement(actor, {
        awardId: text(body.awardId, "awardId"),
        studentPersonId: text(body.studentPersonId, "studentPersonId"),
        amountCents: amount(body.amountCents),
        currency: optionalText(body.currency) ?? "USD",
        scheduledOn: text(body.scheduledOn, "scheduledOn"),
        idempotencyKey: requiredKey,
      });
    }

    if (action === "post_disbursement") {
      const requiredKey = key ?? idempotencyKey(request, body);
      return service.postDisbursement(actor, {
        disbursementId: text(body.disbursementId, "disbursementId"),
        idempotencyKey: requiredKey,
      });
    }

    if (action === "create_hold") {
      return service.createHold(actor, {
        studentPersonId: text(body.studentPersonId, "studentPersonId"),
        holdType: holdType(body.holdType),
        reason: text(body.reason, "reason"),
      });
    }

    throw new Error(
      "action must be create_package, create_award, update_award_status, schedule_disbursement, post_disbursement, or create_hold.",
    );
  });
}

export async function GET(request: Request) {
  return readFinancialAidSummary(request);
}

export async function POST(request: Request) {
  return mutateFinancialAid(request);
}
