import { handleApi } from "@/app/api/academy/api-utils";
import { withAcademyDatabaseContext, asAcademyDatabase } from "@/lib/academy-database-context";
import { resolveAcademyActorFromSession } from "@/modules/academy-auth/request-context";
import type { AcademyActor } from "@/modules/academy-auth/policy";
import {
  BillingDatabase,
  PostgresBillingRepository,
} from "@/modules/billing/postgres-repository";
import {
  BillingService,
} from "@/modules/billing/service";
import type { BillingPaymentProvider } from "@/modules/billing/types";

interface BillingRouteDependencies {
  resolveActor?: (request: Request) => Promise<AcademyActor>;
  serviceForActor?: (actor: AcademyActor) => Promise<BillingService>;
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

function provider(value: unknown): BillingPaymentProvider {
  if (value === "manual" || value === "stripe") return value;
  throw new Error("provider must be manual or stripe.");
}

function idempotencyKey(request: Request, body: Record<string, unknown>) {
  const key =
    request.headers.get("Idempotency-Key") ??
    optionalText(body.idempotencyKey);
  if (!key) throw new Error("Idempotency-Key is required.");
  return key;
}

async function defaultServiceForActor(actor: AcademyActor) {
  return withAcademyDatabaseContext(actor, async (client) => {
    const repository = new PostgresBillingRepository(
      asAcademyDatabase<BillingDatabase>(client),
    );
    return new BillingService(repository);
  });
}

async function resolveActor(
  request: Request,
  dependencies: BillingRouteDependencies,
) {
  return (
    dependencies.resolveActor ??
    (async (currentRequest) =>
      (await resolveAcademyActorFromSession(currentRequest)).actor)
  )(request);
}

export async function readBillingStatement(
  request: Request,
  dependencies: BillingRouteDependencies = {},
) {
  return handleApi(async () => {
    const actor = await resolveActor(request, dependencies);
    const service = await (
      dependencies.serviceForActor ?? defaultServiceForActor
    )(actor);
    const { searchParams } = new URL(request.url);
    const studentPersonId = searchParams.get("studentId")?.trim() ?? actor.userId;
    return service.readStudentStatement(actor, studentPersonId);
  });
}

export async function mutateBillingAccount(
  request: Request,
  dependencies: BillingRouteDependencies = {},
) {
  return handleApi(async () => {
    const body = await request.json() as Record<string, unknown>;
    const actor = await resolveActor(request, dependencies);
    const action = text(body.action, "action");
    const key = idempotencyKey(request, body);
    const service = await (
      dependencies.serviceForActor ?? defaultServiceForActor
    )(actor);

    if (action === "charge") {
      return service.assessCharge(actor, {
        studentPersonId: text(body.studentPersonId, "studentPersonId"),
        academicPeriodId: optionalText(body.academicPeriodId),
        amountCents: amount(body.amountCents),
        currency: optionalText(body.currency) ?? "USD",
        description: text(body.description, "description"),
        sourceId: optionalText(body.sourceId),
        idempotencyKey: key,
      });
    }

    if (action === "credit") {
      return service.applyCredit(actor, {
        studentPersonId: text(body.studentPersonId, "studentPersonId"),
        academicPeriodId: optionalText(body.academicPeriodId),
        amountCents: amount(body.amountCents),
        currency: optionalText(body.currency) ?? "USD",
        description: text(body.description, "description"),
        sourceId: optionalText(body.sourceId),
        idempotencyKey: key,
      });
    }

    if (action === "payment_intent") {
      return service.createPaymentIntent(actor, {
        studentPersonId: optionalText(body.studentPersonId) ?? actor.userId,
        academicPeriodId: optionalText(body.academicPeriodId),
        amountCents: amount(body.amountCents),
        currency: optionalText(body.currency) ?? "USD",
        provider: provider(body.provider ?? "manual"),
        idempotencyKey: key,
      });
    }

    if (action === "payment") {
      return service.postPayment(actor, {
        studentPersonId: text(body.studentPersonId, "studentPersonId"),
        academicPeriodId: optionalText(body.academicPeriodId),
        amountCents: amount(body.amountCents),
        currency: optionalText(body.currency) ?? "USD",
        provider: provider(body.provider ?? "manual"),
        providerReference: text(body.providerReference, "providerReference"),
        description: text(body.description, "description"),
        idempotencyKey: key,
      });
    }

    throw new Error("action must be charge, credit, payment_intent, or payment.");
  });
}

export async function GET(request: Request) {
  return readBillingStatement(request);
}

export async function POST(request: Request) {
  return mutateBillingAccount(request);
}
